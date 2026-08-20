import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSamePersona,
  buildSystemPrompt,
  confirmReplace,
  getTemplateModules,
  mergeGeneratedItems,
  normalizeResult,
  parseModuleDefinition,
  requestPersonaModules,
  resolvePersonaInput,
  toPluginModules,
} from "../src/ai.js";

test("built-in templates keep their declared order and boundary hints", () => {
  const modules = getTemplateModules("角色扮演");
  assert.equal(modules[0].name, "基本信息");
  assert.equal(modules.at(-1).name, "秘密与隐藏信息");
  assert.match(modules.find((item) => item.name === "语言风格").purpose, /口头禅/);
});

test("advanced definitions support explicit module boundaries", () => {
  const modules = parseModuleDefinition(`
模块名称：公开身份
模块用途：公开资料
包含内容：职业
不包含内容：秘密
模块名称：隐藏信息
模块用途：不会主动公开的事实
`);
  assert.deepEqual(modules, [
    { name: "公开身份", purpose: "公开资料", include: "职业", exclude: "秘密" },
    { name: "隐藏信息", purpose: "不会主动公开的事实", include: "", exclude: "" },
  ]);
});

test("prompt keeps fact fidelity, selected cleaning rule, and extra instruction", () => {
  const prompt = buildSystemPrompt({
    modules: getTemplateModules("角色扮演"),
    cleaningMode: "轻度",
    customPrompt: "保留讽刺原句。",
  });
  assert.match(prompt, /不得创造原文不存在的事实/);
  assert.match(prompt, /不得推测年龄、背景、动机或关系/);
  assert.match(prompt, /删除明显重复内容/);
  assert.match(prompt, /保留讽刺原句/);
});

test("current and manually pasted Persona sources resolve without an internal Persona id", () => {
  assert.equal(resolvePersonaInput("current", "  当前 Persona  ", "手动文本"), "当前 Persona");
  assert.equal(resolvePersonaInput("manual", "当前 Persona", "  手动文本  "), "手动文本");
  assert.throws(() => resolvePersonaInput("current", "", ""), /description 为空/);
  assert.throws(() => resolvePersonaInput("manual", "", ""), /请先粘贴/);
});

test("structured raw generation returns normalized modules without chat messages", async () => {
  const modules = parseModuleDefinition("基本信息\n语言风格");
  const calls = [];
  const chat = [{ role: "user", content: "原有聊天" }];
  const chatSnapshot = structuredClone(chat);
  const response = await requestPersonaModules({
    persona: "她是医生，说话总带一点讽刺。",
    modules,
    generateRaw: async (options) => {
      calls.push(options);
      return JSON.stringify({ modules: [
        { name: "基本信息", content: "她是医生。" },
        { name: "语言风格", content: "说话总带一点讽刺。" },
      ] });
    },
  });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].jsonSchema);
  assert.deepEqual(calls[0].prompt.map((message) => message.role), ["system", "user"]);
  assert.deepEqual(response.modules, [
    { name: "基本信息", content: "她是医生。" },
    { name: "语言风格", content: "说话总带一点讽刺。" },
  ]);
  assert.deepEqual(chat, chatSnapshot);
});

test("plain marker fallback is used when structured output is unavailable", async () => {
  const modules = parseModuleDefinition("基本信息\n语言风格");
  let calls = 0;
  const response = await requestPersonaModules({
    persona: "她是医生，说话总带一点讽刺。",
    modules,
    generateRaw: async (options) => {
      calls += 1;
      if (options.jsonSchema) throw new Error("structured output unsupported");
      return [
        "@@MODULE:基本信息@@", "她是医生。", "@@END_MODULE@@",
        "@@MODULE:语言风格@@", "说话总带一点讽刺。", "@@END_MODULE@@",
      ].join("\n");
    },
  });
  assert.equal(calls, 2);
  assert.equal(response.mode, "纯文本 fallback");
  assert.equal(response.modules[1].content, "说话总带一点讽刺。");
});

test("network failure does not issue a second request", async () => {
  const modules = parseModuleDefinition("基本信息");
  let calls = 0;
  await assert.rejects(
    requestPersonaModules({
      persona: "这是一段足够长的 Persona。",
      modules,
      generateRaw: async () => {
        calls += 1;
        throw new Error("Failed to fetch");
      },
    }),
    /AI 请求失败/,
  );
  assert.equal(calls, 1);
});

test("unexpected module names are rejected before plugin data is built", () => {
  const modules = parseModuleDefinition("基本信息\n语言风格");
  assert.throws(() => normalizeResult({ modules: [
    { name: "基本信息", content: "A" },
    { name: "自行新增", content: "B" },
  ] }, modules), /模块名称和预期模板不一致/);
});

test("an all-empty AI response is rejected while individual empty modules remain valid", () => {
  const modules = parseModuleDefinition("基本信息\n语言风格");
  assert.throws(() => normalizeResult({ modules: [
    { name: "基本信息", content: "" },
    { name: "语言风格", content: "  " },
  ] }, modules), /正文全部为空/);
  assert.deepEqual(normalizeResult({ modules: [
    { name: "基本信息", content: "她是医生。" },
    { name: "语言风格", content: "" },
  ] }, modules), [
    { name: "基本信息", content: "她是医生。" },
    { name: "语言风格", content: "" },
  ]);
});

test("plugin modules are root modules with fresh ids and enabled defaults", () => {
  let id = 0;
  const items = toPluginModules([
    { name: "基本信息", content: "A" },
    { name: "语言风格", content: "B" },
  ], () => `m_test_${++id}`);
  assert.deepEqual(items, [
    { type: "module", id: "m_test_1", name: "基本信息", content: "A", enabled: true, collapsed: false },
    { type: "module", id: "m_test_2", name: "语言风格", content: "B", enabled: true, collapsed: false },
  ]);
});

test("append preserves existing branches while replace returns only generated modules", () => {
  const branch = { type: "branch", id: "b1", name: "年龄线", children: [{ type: "module", id: "old", name: "旧模块" }] };
  const generated = [{ type: "module", id: "new", name: "AI 模块" }];
  const existing = [branch];
  const existingSnapshot = structuredClone(existing);
  const appended = mergeGeneratedItems(existing, generated, "append");
  assert.deepEqual(appended, [branch, generated[0]]);
  assert.equal(appended[0], branch);
  assert.deepEqual(mergeGeneratedItems([branch], generated, "replace"), generated);
  assert.deepEqual(existing, existingSnapshot);
  assert.throws(() => mergeGeneratedItems([branch], [], "append"), /返回内容为空/);
});

test("Persona switch protection and replacement cancellation leave existing data untouched", () => {
  assert.doesNotThrow(() => assertSamePersona("persona-a", "persona-a"));
  assert.throws(() => assertSamePersona("persona-a", "persona-b"), /不会写入其他 Persona/);
  const existing = [{ type: "branch", id: "b1", children: [] }];
  let confirmationCalls = 0;
  const approved = confirmReplace("replace", () => {
    confirmationCalls += 1;
    return false;
  });
  assert.equal(approved, false);
  assert.equal(confirmationCalls, 1);
  assert.deepEqual(existing, [{ type: "branch", id: "b1", children: [] }]);
  assert.equal(confirmReplace("append", () => true), true);
});
