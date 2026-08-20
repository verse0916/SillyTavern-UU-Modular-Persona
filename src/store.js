import { extension_settings } from "/scripts/extensions.js";
import { saveSettingsDebounced } from "/script.js";
import { user_avatar } from "/scripts/personas.js";
import { buildPersonaText } from "./build.js";
import { assertSamePersona, mergeGeneratedItems } from "./ai.js";

export const EXTENSION_KEY = "uu_modular_persona";
export const SCHEMA_VERSION = 1;

const DEFAULTS = Object.freeze({
  version: SCHEMA_VERSION,
  enabled: true,
  separator: "\n\n",
  uus: {},
});

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeModule(value) {
  return {
    type: "module",
    id: String(value?.id ?? "").trim() || makeId("m"),
    name: String(value?.name ?? "").trim() || "未命名模块",
    content: String(value?.content ?? ""),
    enabled: value?.enabled !== false,
    collapsed: value?.collapsed === true,
  };
}

function normalizeItem(value) {
  if (value?.type === "branch") {
    return {
      type: "branch",
      id: String(value?.id ?? "").trim() || makeId("b"),
      name: String(value?.name ?? "").trim() || "未命名分支",
      enabled: value?.enabled !== false,
      collapsed: value?.collapsed === true,
      children: (Array.isArray(value?.children) ? value.children : [])
        .filter((child) => child?.type === "module")
        .map(normalizeModule),
    };
  }
  return normalizeModule(value);
}

export function getSettings() {
  const current = extension_settings[EXTENSION_KEY];
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    extension_settings[EXTENSION_KEY] = structuredClone(DEFAULTS);
  }

  const settings = extension_settings[EXTENSION_KEY];
  settings.version = SCHEMA_VERSION;
  settings.enabled = settings.enabled !== false;
  settings.separator = typeof settings.separator === "string" ? settings.separator : "\n\n";
  if (!settings.uus || typeof settings.uus !== "object" || Array.isArray(settings.uus)) settings.uus = {};
  return settings;
}

export function getCurrentPersonaId() {
  return String(user_avatar ?? "").trim();
}

export function getUu(personaId = getCurrentPersonaId()) {
  if (!personaId) return null;
  const settings = getSettings();
  const raw = settings.uus[personaId];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) settings.uus[personaId] = { items: [] };
  const uu = settings.uus[personaId];
  uu.items = (Array.isArray(uu.items) ? uu.items : []).map(normalizeItem);
  return uu;
}

export function saveSettings() {
  saveSettingsDebounced();
}

export function addModule(parentBranchId = null) {
  const uu = getUu();
  if (!uu) return null;
  const item = normalizeModule({ type: "module", name: "新模块" });
  if (parentBranchId) {
    const branch = uu.items.find((entry) => entry.type === "branch" && entry.id === parentBranchId);
    if (!branch) return null;
    branch.children.push(item);
  } else {
    uu.items.push(item);
  }
  saveSettings();
  return item;
}

export function addBranch() {
  const uu = getUu();
  if (!uu) return null;
  const branch = normalizeItem({ type: "branch", name: "新分支", children: [] });
  uu.items.push(branch);
  saveSettings();
  return branch;
}

export function findItem(itemId) {
  const uu = getUu();
  if (!uu) return null;
  for (const item of uu.items) {
    if (item.id === itemId) return item;
    if (item.type === "branch") {
      const child = item.children.find((entry) => entry.id === itemId);
      if (child) return child;
    }
  }
  return null;
}

export function deleteItem(itemId) {
  const uu = getUu();
  if (!uu) return;
  const rootIndex = uu.items.findIndex((item) => item.id === itemId);
  if (rootIndex >= 0) uu.items.splice(rootIndex, 1);
  else {
    for (const branch of uu.items.filter((item) => item.type === "branch")) {
      const childIndex = branch.children.findIndex((item) => item.id === itemId);
      if (childIndex >= 0) {
        branch.children.splice(childIndex, 1);
        break;
      }
    }
  }
  saveSettings();
}

export function duplicateModule(itemId) {
  const uu = getUu();
  const source = findItem(itemId);
  if (!uu || source?.type !== "module") return;
  const copy = normalizeModule({ ...source, id: undefined, name: `${source.name} 副本` });
  const rootIndex = uu.items.findIndex((item) => item.id === itemId);
  if (rootIndex >= 0) uu.items.splice(rootIndex + 1, 0, copy);
  else {
    for (const branch of uu.items.filter((item) => item.type === "branch")) {
      const childIndex = branch.children.findIndex((item) => item.id === itemId);
      if (childIndex >= 0) {
        branch.children.splice(childIndex + 1, 0, copy);
        break;
      }
    }
  }
  saveSettings();
}

export function replaceCurrentItems(items) {
  const uu = getUu();
  if (!uu) return;
  uu.items = (Array.isArray(items) ? items : []).map(normalizeItem);
  saveSettings();
}

export function applyGeneratedModules(personaId, generatedItems, mode = "append") {
  const id = String(personaId ?? "").trim();
  if (!id) throw new Error("当前没有选择 Persona。");
  assertSamePersona(id, getCurrentPersonaId());
  const modules = (Array.isArray(generatedItems) ? generatedItems : [])
    .filter((item) => item?.type === "module")
    .map(normalizeModule);
  mergeGeneratedItems([], modules, mode);
  const uu = getUu(id);
  if (!uu) throw new Error("无法读取当前 Persona 的 UU 数据。");
  uu.items = mergeGeneratedItems(uu.items, modules, mode);
  saveSettings();
  return modules.length;
}

export function getPreview() {
  const uu = getUu();
  if (!uu) return "";
  return buildPersonaText(uu.items, getSettings().separator);
}

export function exportPayload() {
  const settings = getSettings();
  return {
    format: "sillytavern-uu-modular-persona",
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: structuredClone(settings),
  };
}

export function importPayload(payload) {
  const incoming = payload?.settings ?? payload;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("JSON 顶层格式无效");
  if (!incoming.uus || typeof incoming.uus !== "object" || Array.isArray(incoming.uus)) throw new Error("JSON 中缺少有效的 uus 数据");

  const next = {
    version: SCHEMA_VERSION,
    enabled: incoming.enabled !== false,
    separator: typeof incoming.separator === "string" ? incoming.separator : "\n\n",
    uus: {},
  };
  for (const [personaId, value] of Object.entries(incoming.uus)) {
    if (!personaId.trim()) continue;
    next.uus[personaId] = {
      items: (Array.isArray(value?.items) ? value.items : []).map(normalizeItem),
    };
  }
  extension_settings[EXTENSION_KEY] = next;
  saveSettings();
}
