export const MODULE_TEMPLATES = Object.freeze({
  "通用详细": Object.freeze([
    "基本信息", "身份背景", "外貌", "童年经历", "求学经历", "职业经历", "重大事件", "家庭关系", "人际关系",
    "核心性格", "心理特征", "情绪模式", "价值观", "人生目标", "行为习惯", "生活习惯", "兴趣爱好",
    "喜好与厌恶", "能力与技能", "语言风格", "与用户的关系", "秘密与隐藏信息",
  ]),
  "角色扮演": Object.freeze([
    "基本信息", "身份背景", "外貌", "核心性格", "心理特征", "情绪模式", "行为习惯", "生活习惯",
    "喜好与厌恶", "能力与技能", "语言风格", "人际关系", "与用户的关系", "秘密与隐藏信息",
  ]),
  "极细分": Object.freeze([
    "基本身份", "身体特征", "服装装饰", "童年经历", "教育经历", "职业经历", "重大事件", "原生家庭",
    "家庭关系", "朋友关系", "恋爱关系", "社会关系", "核心性格", "人格优点", "人格缺点", "价值观",
    "人生目标", "情绪模式", "恐惧", "欲望", "行为习惯", "生活习惯", "兴趣爱好", "喜欢的事物",
    "讨厌的事物", "能力", "知识", "语言风格", "与用户的关系", "隐藏信息",
  ]),
});

export const CLEANING_RULES = Object.freeze({
  "关闭": "只做必要的语义拆分与模块归类，尽可能保留原始措辞。",
  "轻度": "删除明显重复内容，合并高度重复表达，轻微压缩语言，但保留重要细节。",
  "标准": "删除重复、空泛和明显冗余表达，保留角色扮演有价值的事实、关系、行为、心理和经历。",
  "强力": "最大化信息密度，但不得删除影响角色理解、人物关系、行为逻辑或时间线的重要事实。",
});

const BOUNDARY_HINTS = Object.freeze({
  "价值观": "稳定的原则、底线、判断标准和信念；不要放具体目标。",
  "人生目标": "长期目标、短期目标、愿望和想达成的事情；不要放抽象原则。",
  "情绪模式": "不同情绪或压力下的反应方式；不要只重复稳定性格。",
  "行为习惯": "反复出现的做事方式、应对方式和工作行为。",
  "生活习惯": "日常作息、生活细节、固定偏好和身体层面的习惯。",
  "语言风格": "措辞、句式、口头禅、语气、说话节奏和明确原文表达。",
  "秘密与隐藏信息": "角色不会主动公开、但对理解角色或剧情有价值的信息。",
});

const MODULE_NAME_ALIASES = Object.freeze({
  "基本信息": ["基础信息", "个人信息", "基本资料", "角色基本信息", "角色概况"],
  "身份背景": ["身份与背景", "背景与身份", "身份设定", "背景设定", "人物背景", "角色背景"],
  "外貌": ["外貌特征", "外貌描写", "外形特征", "外观", "外观特征", "身体特征"],
  "童年经历": ["童年", "童年背景"],
  "求学经历": ["教育经历", "教育背景", "学习经历", "求学与教育经历", "学业经历"],
  "职业经历": ["工作经历", "职业背景", "工作背景"],
  "重大事件": ["重要事件", "关键事件", "重大经历"],
  "家庭关系": ["家庭", "家人关系", "家庭与亲属关系"],
  "人际关系": ["社交关系", "人物关系", "社会关系", "人际与社会关系"],
  "核心性格": ["性格", "性格特点", "性格特征", "核心人格"],
  "心理特征": ["心理", "心理状态", "心理特点"],
  "情绪模式": ["情绪", "情绪反应", "情感模式"],
  "价值观": ["价值观念", "原则与底线", "核心价值观"],
  "人生目标": ["目标", "人生愿望", "愿望与目标"],
  "行为习惯": ["行为模式", "行为特点"],
  "生活习惯": ["日常习惯", "生活方式", "日常生活"],
  "兴趣爱好": ["兴趣与爱好", "爱好"],
  "喜好与厌恶": ["喜恶", "偏好与厌恶", "喜欢与讨厌", "喜欢和讨厌"],
  "能力与技能": ["能力技能", "能力和技能", "技能与能力", "能力"],
  "语言风格": ["说话风格", "语言与表达", "表达风格", "语气风格"],
  "与用户的关系": ["用户关系", "和用户的关系", "与user的关系", "与{{user}}的关系"],
  "秘密与隐藏信息": ["秘密", "隐藏信息", "秘密信息", "秘密与隐情"],
});

function makeId() {
  if (globalThis.crypto?.randomUUID) return `m_${globalThis.crypto.randomUUID()}`;
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function errorText(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "未知错误";
  }
}

function regexEscape(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseModuleDefinition(raw) {
  const lines = String(raw ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const detailed = [];
  let current = null;

  const pushCurrent = () => {
    if (current?.name) detailed.push(current);
    current = null;
  };

  for (const line of lines) {
    const nameMatch = line.match(/^(?:模块名称|模块|名称)\s*[:：]\s*(.+)$/);
    if (nameMatch) {
      pushCurrent();
      current = { name: nameMatch[1].trim(), purpose: "", include: "", exclude: "" };
      continue;
    }
    if (!current) continue;
    let match = line.match(/^(?:模块用途|用途)\s*[:：]\s*(.*)$/);
    if (match) {
      current.purpose = match[1].trim();
      continue;
    }
    match = line.match(/^(?:包含内容|包含)\s*[:：]\s*(.*)$/);
    if (match) {
      current.include = match[1].trim();
      continue;
    }
    match = line.match(/^(?:不包含内容|不包含|排除)\s*[:：]\s*(.*)$/);
    if (match) current.exclude = match[1].trim();
  }
  pushCurrent();

  const candidates = detailed.length
    ? detailed
    : lines.map((name) => ({ name, purpose: BOUNDARY_HINTS[name] ?? "", include: "", exclude: "" }));
  const seen = new Set();
  return candidates.filter((module) => {
    module.name = String(module.name ?? "").trim();
    if (!module.name || seen.has(module.name)) return false;
    module.purpose ||= BOUNDARY_HINTS[module.name] ?? "";
    seen.add(module.name);
    return true;
  });
}

export function getTemplateModules(templateName = "通用详细") {
  const template = MODULE_TEMPLATES[templateName];
  if (!template) throw new Error(`未知模块模板：${templateName}`);
  return parseModuleDefinition(template.join("\n"));
}

function buildModulePrompt(modules) {
  return modules.map((module, index) => {
    const lines = [`${index + 1}. ${module.name}`];
    if (module.purpose) lines.push(`   边界提示：${module.purpose}`);
    if (module.include) lines.push(`   包含：${module.include}`);
    if (module.exclude) lines.push(`   不包含：${module.exclude}`);
    return lines.join("\n");
  }).join("\n\n");
}

export function buildSystemPrompt({ modules, cleaningMode = "轻度", customPrompt = "", plainFallback = false }) {
  if (!Array.isArray(modules) || modules.length === 0) throw new Error("没有检测到有效模块。");
  const cleaningRule = CLEANING_RULES[cleaningMode];
  if (!cleaningRule) throw new Error(`未知清洗程度：${cleaningMode}`);
  const sections = [
    "你是一名 Persona 信息结构化专家。",
    "你只做语义拆分和整理，不是角色扮演者，也不是小说编辑。不能重新创作 Persona。",
    "",
    "用户定义的模块（必须全部输出，顺序必须一致）：",
    buildModulePrompt(modules),
    "",
    "核心规则：",
    "1. 按语义判断，不要机械照搬原文段落。",
    "2. 一段文字含多个事实时，把各项事实拆到对应模块。",
    "3. 不得创造原文不存在的事实，不得推测年龄、背景、动机或关系。",
    "4. 没有相关内容的模块输出空字符串。",
    "5. 只能使用上述模块名称，不得增加、删减或改名。",
    "6. 严格遵守每个模块的边界提示，避免同一信息无意义重复。",
    "7. 尽量保留对角色扮演有价值的细节、引号、口头禅和特殊措辞。",
    `8. 清洗规则：${cleaningRule}`,
  ];
  const extra = String(customPrompt ?? "").trim();
  if (extra) {
    sections.push(
      "",
      "====================",
      "用户补充提示词",
      "====================",
      extra,
      "",
      "补充提示词不得违反事实保真、模块边界和输出结构。",
    );
  }
  if (plainFallback) {
    sections.push(
      "",
      "当前输出使用纯文本标记。不要输出 JSON、Markdown 代码块或额外说明。",
      "每个模块必须各输出一次，格式严格如下：",
      "@@MODULE:模块名称@@",
      "模块内容",
      "@@END_MODULE@@",
    );
  } else {
    const jsonSkeleton = JSON.stringify({
      modules: modules.map((module) => ({ name: module.name, content: "" })),
    });
    sections.push(
      "",
      "输出格式：",
      "只输出一个合法 JSON 对象，不要输出 Markdown 代码块、前言、解释或“以下是”等额外文字。",
      "modules 数组中的模块名称、数量和顺序必须与下面的 JSON 骨架完全一致，只填写 content：",
      jsonSkeleton,
    );
  }
  return sections.join("\n");
}

export function buildUserPrompt(persona) {
  const text = String(persona ?? "").trim();
  if (!text) throw new Error("Persona 内容为空。");
  return [
    "请处理下面的 Persona。",
    "只根据原文分类，不要补写。",
    "",
    "====================",
    "原始 Persona",
    "====================",
    text,
  ].join("\n");
}

export function resolvePersonaInput(source, currentPersona, manualText) {
  if (source === "current") {
    const text = String(currentPersona ?? "").trim();
    if (!text) throw new Error("当前 Persona description 为空。");
    return text;
  }
  if (source === "manual") {
    const text = String(manualText ?? "").trim();
    if (!text) throw new Error("请先粘贴要拆分的 Persona 文本。");
    return text;
  }
  throw new Error(`未知输入来源：${source}`);
}

export function responseSchema(modules) {
  return {
    name: "uu_persona_modules",
    description: "按指定模板拆分后的 Persona 模块",
    strict: true,
    returnInvalid: true,
    value: {
      type: "object",
      additionalProperties: false,
      properties: {
        modules: {
          type: "array",
          minItems: modules.length,
          maxItems: modules.length,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              content: { type: "string" },
            },
            required: ["name", "content"],
          },
        },
      },
      required: ["modules"],
    },
  };
}

export function parseJsonText(raw) {
  if (raw && typeof raw === "object") return raw;
  let text = String(raw ?? "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch (firstError) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw firstError;
    return JSON.parse(text.slice(start, end + 1));
  }
}

export function parsePlainBlocks(raw, modules) {
  const text = String(raw ?? "");
  return {
    modules: modules.map((module) => {
      const pattern = new RegExp(`@@MODULE\\s*[:：]\\s*${regexEscape(module.name)}\\s*@@([\\s\\S]*?)@@END_MODULE@@`, "i");
      const match = text.match(pattern);
      if (!match) throw new Error(`纯文本 fallback 缺少模块：${module.name}`);
      return { name: module.name, content: match[1].trim() };
    }),
  };
}

function cleanInlineContent(value) {
  let text = String(value ?? "").trim().replace(/,$/, "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    try {
      return JSON.parse(text.startsWith("'") ? `"${text.slice(1, -1).replaceAll('"', '\\"')}"` : text);
    } catch {
      text = text.slice(1, -1);
    }
  }
  return text;
}

function normalizeModuleLabel(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .replace(/[\s`*_#【】[\]「」『』“”"'：:、，,。.！!？?（）(){}]/g, "")
    .replace(/[与和及的]/g, "");
}

function resolveModuleName(label, moduleNames) {
  const text = String(label ?? "").trim();
  if (moduleNames.includes(text)) return text;
  const normalized = normalizeModuleLabel(text);
  const normalizedExact = moduleNames.find((name) => normalizeModuleLabel(name) === normalized);
  if (normalizedExact) return normalizedExact;
  for (const name of moduleNames) {
    const aliases = MODULE_NAME_ALIASES[name] ?? [];
    if (aliases.some((alias) => normalizeModuleLabel(alias) === normalized)) return name;
  }
  return null;
}

function isUnrecognizedSectionBoundary(line) {
  const text = String(line ?? "").trim();
  if (/^#{1,6}\s+\S/.test(text)) return true;
  if (/^(?:\d+\s*[.、)]\s*)?(?:\*\*|__)[^*_]+(?:\*\*|__)\s*[:：]?\s*$/.test(text)) return true;
  if (/^[【[「『].+[】\]」』]\s*[:：]?\s*$/.test(text)) return true;
  return false;
}

function matchModuleHeading(line, moduleNames) {
  const tableCells = String(line ?? "").trim().split("|").slice(1, -1).map((cell) => cell.trim());
  if (tableCells.length >= 2) {
    const tableName = resolveModuleName(tableCells[0], moduleNames);
    if (tableName) return { name: tableName, inline: tableCells.slice(1).join(" | ") };
  }

  let text = String(line ?? "").trim();
  text = text.replace(/^#{1,6}\s*/, "");
  text = text.replace(/^[-+*]\s+/, "");
  text = text.replaceAll("**", "").replaceAll("__", "");
  text = text.replace(/^\d+\s*[.、)]\s*/, "");
  text = text.replace(/^`|`$/g, "").trim();

  const quoted = text.match(/^["'](.+?)["']\s*[:：]\s*(.*)$/);
  if (quoted) {
    const quotedName = resolveModuleName(quoted[1], moduleNames);
    if (quotedName) return { name: quotedName, inline: cleanInlineContent(quoted[2]) };
  }

  const wrappers = [["【", "】"], ["[", "]"], ["「", "」"], ["『", "』"]];
  for (const [open, close] of wrappers) {
    if (!text.startsWith(open)) continue;
    const end = text.indexOf(close, open.length);
    if (end < 0) continue;
    const wrappedName = resolveModuleName(text.slice(open.length, end), moduleNames);
    if (!wrappedName) continue;
    const rest = text.slice(end + close.length).replace(/^\s*[:：]?\s*/, "");
    return { name: wrappedName, inline: cleanInlineContent(rest) };
  }

  const label = text.match(/^(.+?)\s*[:：]\s*(.*)$/);
  if (label) {
    const labelName = resolveModuleName(label[1], moduleNames);
    if (labelName) return { name: labelName, inline: cleanInlineContent(label[2]) };
  }
  const exactName = resolveModuleName(text, moduleNames);
  if (exactName) return { name: exactName, inline: "" };
  return null;
}

export function parseNamedSections(raw, modules) {
  const names = modules.map((module) => module.name);
  const contentByName = new Map(names.map((name) => [name, []]));
  let currentName = null;
  let headingCount = 0;

  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const heading = matchModuleHeading(line, names);
    if (heading) {
      currentName = heading.name;
      headingCount += 1;
      if (heading.inline) contentByName.get(currentName).push(heading.inline);
      continue;
    }
    if (isUnrecognizedSectionBoundary(line)) {
      currentName = null;
      continue;
    }
    if (/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(line)) continue;
    if (currentName) contentByName.get(currentName).push(line);
  }

  if (!headingCount) throw new Error("没有识别到以模块名称为标题的内容。");
  return {
    modules: names.map((name) => ({ name, content: contentByName.get(name).join("\n").trim() })),
  };
}

function coerceJsonResult(data, modules) {
  if (Array.isArray(data)) return { modules: data };
  if (Array.isArray(data?.modules)) return data;
  if (Array.isArray(data?.result?.modules)) return data.result;
  if (data && typeof data === "object") {
    const names = modules.map((module) => module.name);
    if (names.some((name) => typeof data[name] === "string")) {
      return { modules: names.map((name) => ({ name, content: String(data[name] ?? "") })) };
    }
  }
  return data;
}

export function parseModelOutput(raw, modules) {
  const errors = [];
  try {
    return { modules: normalizeResult(coerceJsonResult(parseJsonText(raw), modules), modules), format: "JSON" };
  } catch (error) {
    errors.push(`JSON：${errorText(error)}`);
  }
  try {
    return { modules: normalizeResult(parsePlainBlocks(raw, modules), modules), format: "标记文本" };
  } catch (error) {
    errors.push(`标记文本：${errorText(error)}`);
  }
  try {
    return { modules: normalizeResult(parseNamedSections(raw, modules), modules), format: "标题文本" };
  } catch (error) {
    errors.push(`标题文本：${errorText(error)}`);
  }
  throw new Error(errors.join("；"));
}

export function normalizeResult(data, modules) {
  if (!data || !Array.isArray(data.modules)) throw new Error("AI 返回结果缺少 modules 数组。");
  if (data.modules.length !== modules.length) {
    throw new Error(`AI 返回的模块数量不匹配：预期 ${modules.length} 个，实际 ${data.modules.length} 个。`);
  }
  const byName = new Map();
  for (const item of data.modules) {
    if (!item || typeof item.name !== "string" || typeof item.content !== "string") {
      throw new Error("AI 返回模块的 name/content 类型不正确。");
    }
    const name = item.name.trim();
    if (byName.has(name)) throw new Error(`AI 重复返回模块：${name}`);
    byName.set(name, item.content.trim());
  }
  const expected = modules.map((module) => module.name);
  const missing = expected.filter((name) => !byName.has(name));
  const extra = [...byName.keys()].filter((name) => !expected.includes(name));
  if (missing.length || extra.length) {
    const parts = [];
    if (missing.length) parts.push(`缺少：${missing.join("、")}`);
    if (extra.length) parts.push(`多出：${extra.join("、")}`);
    throw new Error(`AI 返回的模块名称和预期模板不一致（${parts.join("；")}）。`);
  }
  const normalized = expected.map((name) => ({ name, content: byName.get(name) }));
  if (!normalized.some((module) => module.content)) throw new Error("AI 返回的模块正文全部为空。");
  return normalized;
}

export function toPluginModules(modules, idFactory = makeId) {
  if (!Array.isArray(modules) || modules.length === 0) throw new Error("返回内容为空，没有可应用的模块。");
  const nonEmptyModules = modules.filter((module) => String(module?.content ?? "").trim());
  if (!nonEmptyModules.length) throw new Error("返回内容为空，没有可应用的模块。");
  return nonEmptyModules.map((module) => ({
    type: "module",
    id: idFactory(),
    name: String(module?.name ?? "").trim() || "未命名模块",
    content: String(module?.content ?? ""),
    enabled: true,
    collapsed: false,
  }));
}

export function mergeGeneratedItems(existingItems, generatedItems, mode = "append") {
  if (!Array.isArray(generatedItems) || generatedItems.length === 0) throw new Error("返回内容为空，没有可应用的模块。");
  if (mode === "replace") return [...generatedItems];
  if (mode === "append") return [...(Array.isArray(existingItems) ? existingItems : []), ...generatedItems];
  throw new Error(`未知应用方式：${mode}`);
}

export function assertSamePersona(expectedPersonaId, currentPersonaId) {
  if (!expectedPersonaId || expectedPersonaId !== currentPersonaId) {
    throw new Error("当前 Persona 已切换，这份结果不会写入其他 Persona。请重新生成。");
  }
}

export function confirmReplace(mode, confirmFn = globalThis.confirm) {
  if (mode !== "replace") return true;
  return Boolean(confirmFn("替换会删除当前 Persona 已有的全部根模块和分支，确定继续吗？"));
}

function getSillyTavernGeneration() {
  const context = globalThis.SillyTavern?.getContext?.();
  if (!context?.generateRaw) throw new Error("当前 SillyTavern 未提供可用的 raw generation API，请更新 SillyTavern。");
  if (!context.mainApi || context.onlineStatus === "no_connection") throw new Error("SillyTavern 主 API 尚未配置或当前未连接。");
  return context.generateRaw;
}

function isRequestFailure(error) {
  return /failed to fetch|network|cors|unauthorized|forbidden|api key|401|403|429|500|502|503|504|rate limit|internal server|service unavailable|timed? ?out|no connection|not connected|未连接|尚未配置/i.test(errorText(error));
}

function messagesFor({ persona, modules, cleaningMode, customPrompt, plainFallback }) {
  return [
    { role: "system", content: buildSystemPrompt({ modules, cleaningMode, customPrompt, plainFallback }) },
    { role: "user", content: buildUserPrompt(persona) },
  ];
}

export async function requestPersonaModules({
  persona,
  modules,
  cleaningMode = "轻度",
  customPrompt = "",
  generateRaw = null,
}) {
  const generate = generateRaw ?? getSillyTavernGeneration();
  const errors = [];
  try {
    const raw = await generate({
      prompt: messagesFor({ persona, modules, cleaningMode, customPrompt, plainFallback: false }),
      trimNames: false,
      responseLength: 12_000,
      jsonSchema: responseSchema(modules),
    });
    const parsed = parseModelOutput(raw, modules);
    return { modules: parsed.modules, mode: parsed.format === "JSON" ? "结构化输出" : `结构化请求 · ${parsed.format}兼容解析` };
  } catch (error) {
    if (isRequestFailure(error)) throw new Error(`AI 请求失败：${errorText(error)}`);
    errors.push(`结构化输出：${errorText(error)}`);
  }

  try {
    const raw = await generate({
      prompt: messagesFor({ persona, modules, cleaningMode, customPrompt, plainFallback: true }),
      trimNames: false,
      responseLength: 12_000,
    });
    const parsed = parseModelOutput(raw, modules);
    return { modules: parsed.modules, mode: parsed.format === "标记文本" ? "纯文本 fallback" : `纯文本 fallback · ${parsed.format}兼容解析` };
  } catch (error) {
    if (isRequestFailure(error)) throw new Error(`AI 请求失败：${errorText(error)}`);
    errors.push(`纯文本 fallback：${errorText(error)}`);
  }
  throw new Error(`AI 返回内容无法解析。${errors.join("；")}`);
}
