import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSamePersona,
  buildSystemPrompt,
  confirmReplace,
  getTemplateModules,
  mergeGeneratedItems,
  normalizeResult,
  parseModelOutput,
  parseModuleDefinition,
  parseNamedSections,
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
  assert.match(prompt, /只输出一个合法 JSON 对象/);
  assert.match(prompt, /"modules"/);
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

test("natural-language preface and Markdown module headings are parsed without a second request", async () => {
  const modules = parseModuleDefinition("基本信息\n语言风格");
  let calls = 0;
  const response = await requestPersonaModules({
    persona: "她是医生，说话总带一点讽刺。",
    modules,
    generateRaw: async () => {
      calls += 1;
      return [
        "以下是对原始 Persona 的整理：",
        "## 1. **基本信息**",
        "她是医生。",
        "## 2. **语言风格**",
        "说话总带一点讽刺。",
      ].join("\n");
    },
  });
  assert.equal(calls, 1);
  assert.match(response.mode, /标题文本兼容解析/);
  assert.deepEqual(response.modules, [
    { name: "基本信息", content: "她是医生。" },
    { name: "语言风格", content: "说话总带一点讽刺。" },
  ]);
});

test("loose section parsing accepts inline labels, wrapped headings, tables, and full-width markers", () => {
  const modules = parseModuleDefinition("基本信息\n语言风格");
  assert.deepEqual(parseNamedSections([
    "**基本信息：** 她是医生。",
    "【语言风格】",
    "说话总带一点讽刺。",
  ].join("\n"), modules).modules, [
    { name: "基本信息", content: "她是医生。" },
    { name: "语言风格", content: "说话总带一点讽刺。" },
  ]);
  assert.equal(parseModelOutput([
    "@@MODULE：基本信息@@", "她是医生。", "@@END_MODULE@@",
    "@@MODULE：语言风格@@", "带一点讽刺。", "@@END_MODULE@@",
  ].join("\n"), modules).format, "标记文本");
  assert.deepEqual(parseNamedSections([
    "| 模块 | 内容 |",
    "| --- | --- |",
    "| 基本信息 | 她是医生。 |",
    "| 语言风格 | 带一点讽刺。 |",
  ].join("\n"), modules).modules, [
    { name: "基本信息", content: "她是医生。" },
    { name: "语言风格", content: "带一点讽刺。" },
  ]);
});

test("common AI heading aliases stay in separate template modules", () => {
  const modules = getTemplateModules("通用详细");
  const parsed = parseNamedSections([
    "### 基本信息",
    "24 岁，中国籍。",
    "### 身份与背景",
    "* **原本专业：** 西方魔法专业",
    "* **当前状态：** 在咒术高专进行交换。",
    "---",
    "### 外貌特征",
    "黑色长发。",
    "### 模型擅自增加的标题",
    "这段内容不得进入外貌模块。",
    "### 语言与表达",
    "说话时经常保留讽刺措辞。",
  ].join("\n"), modules).modules;

  assert.equal(parsed.find((item) => item.name === "基本信息").content, "24 岁，中国籍。");
  assert.equal(parsed.find((item) => item.name === "身份背景").content, [
    "* **原本专业：** 西方魔法专业",
    "* **当前状态：** 在咒术高专进行交换。",
  ].join("\n"));
  assert.equal(parsed.find((item) => item.name === "外貌").content, "黑色长发。");
  assert.equal(parsed.find((item) => item.name === "语言风格").content, "说话时经常保留讽刺措辞。");
  assert.doesNotMatch(parsed.find((item) => item.name === "外貌").content, /不得进入/);
});

test("exact extreme-template names take priority over aliases", () => {
  const modules = getTemplateModules("极细分");
  const parsed = parseNamedSections([
    "### 身体特征",
    "身高 175cm。",
    "### 教育经历",
    "就读咒术高专。",
    "### 能力",
    "擅长结界术。",
    "### 隐藏信息",
    "隐瞒了真实来历。",
  ].join("\n"), modules).modules;

  assert.equal(parsed.find((item) => item.name === "身体特征").content, "身高 175cm。");
  assert.equal(parsed.find((item) => item.name === "教育经历").content, "就读咒术高专。");
  assert.equal(parsed.find((item) => item.name === "能力").content, "擅长结界术。");
  assert.equal(parsed.find((item) => item.name === "隐藏信息").content, "隐瞒了真实来历。");
});

test("JSON arrays and module-name maps are normalized as valid model output", () => {
  const modules = parseModuleDefinition("基本信息\n语言风格");
  const arrayResult = parseModelOutput(JSON.stringify([
    { name: "基本信息", content: "她是医生。" },
    { name: "语言风格", content: "带一点讽刺。" },
  ]), modules);
  assert.equal(arrayResult.format, "JSON");
  const mapResult = parseModelOutput(JSON.stringify({
    基本信息: "她是医生。",
    语言风格: "带一点讽刺。",
  }), modules);
  assert.deepEqual(mapResult.modules, arrayResult.modules);
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

test("plugin module conversion skips empty classifications", () => {
  let id = 0;
  const items = toPluginModules([
    { name: "基本信息", content: "A" },
    { name: "身份背景", content: "   " },
    { name: "外貌", content: "\n\t" },
  ], () => `m_test_${++id}`);
  assert.deepEqual(items, [
    { type: "module", id: "m_test_1", name: "基本信息", content: "A", enabled: true, collapsed: false },
  ]);
  assert.equal(id, 1);
  assert.throws(() => toPluginModules([
    { name: "基本信息", content: "" },
    { name: "身份背景", content: "  " },
  ]), /返回内容为空/);
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
