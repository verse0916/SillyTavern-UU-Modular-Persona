import {
  addBranch,
  addModule,
  deleteItem,
  duplicateModule,
  exportPayload,
  findItem,
  getCurrentPersonaId,
  getPreview,
  getSettings,
  getUu,
  importPayload,
  replaceCurrentItems,
  saveSettings,
} from "./store.js";

const PANEL_ID = "uu-modular-persona-panel";
let renderQueued = false;

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function iconButton(icon, label, action) {
  const button = el("button", `menu_button fa-solid ${icon} uu-icon-button`);
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.dataset.action = action;
  return button;
}

function toast(type, message) {
  if (globalThis.toastr?.[type]) globalThis.toastr[type](message);
  else console[type === "error" ? "error" : "log"](`[UU Modular Persona] ${message}`);
}

function renderModule(item) {
  const row = el("section", "uu-node uu-module");
  row.dataset.type = "module";
  row.dataset.id = item.id;

  const head = el("div", "uu-node-head");
  const handle = el("span", "fa-solid fa-grip-vertical uu-drag-handle");
  handle.title = "拖拽排序或移动";
  const enabled = el("input");
  enabled.type = "checkbox";
  enabled.checked = item.enabled !== false;
  enabled.dataset.field = "enabled";
  enabled.setAttribute("aria-label", "启用模块");
  const name = el("input", "text_pole uu-name-input");
  name.type = "text";
  name.value = item.name;
  name.dataset.field = "name";
  name.placeholder = "模块名称";
  const collapse = iconButton(item.collapsed ? "fa-chevron-right" : "fa-chevron-down", item.collapsed ? "展开" : "折叠", "collapse");
  const copy = iconButton("fa-copy", "复制一份模块", "duplicate");
  const remove = iconButton("fa-trash", "删除模块", "delete");
  head.append(handle, enabled, name, collapse, copy, remove);

  const body = el("div", "uu-module-body");
  if (item.collapsed) body.hidden = true;
  const content = el("textarea", "text_pole textarea_compact uu-content");
  content.value = item.content;
  content.dataset.field = "content";
  content.rows = 9;
  content.placeholder = "输入会追加到 Persona 描述后的内容……";
  body.append(content);
  row.append(head, body);
  return row;
}

function renderBranch(branch) {
  const section = el("section", "uu-node uu-branch");
  section.dataset.type = "branch";
  section.dataset.id = branch.id;

  const head = el("div", "uu-node-head uu-branch-head");
  const handle = el("span", "fa-solid fa-grip-vertical uu-drag-handle");
  handle.title = "拖拽分支排序";
  const enabled = el("input");
  enabled.type = "checkbox";
  enabled.checked = branch.enabled !== false;
  enabled.dataset.field = "enabled";
  enabled.setAttribute("aria-label", "启用整条分支");
  const name = el("input", "text_pole uu-name-input");
  name.type = "text";
  name.value = branch.name;
  name.dataset.field = "name";
  name.placeholder = "分支名称";
  const collapse = iconButton(branch.collapsed ? "fa-chevron-right" : "fa-chevron-down", branch.collapsed ? "展开" : "折叠", "collapse");
  const remove = iconButton("fa-trash", "删除分支及其模块", "delete");
  head.append(handle, enabled, name, collapse, remove);

  const body = el("div", "uu-branch-body");
  if (branch.collapsed) body.hidden = true;
  const list = el("div", "uu-module-list");
  list.dataset.branchId = branch.id;
  for (const child of branch.children) list.append(renderModule(child));
  const add = el("button", "menu_button uu-add-child", "＋ 分支内添加模块");
  add.type = "button";
  add.dataset.action = "add-child";
  body.append(list, add);
  section.append(head, body);
  return section;
}

function updatePreview(panel) {
  const preview = panel.querySelector(".uu-preview");
  const empty = panel.querySelector(".uu-preview-empty");
  const text = getPreview();
  preview.value = text;
  empty.hidden = Boolean(text);
}

function syncOrderFromDom(panel) {
  const existing = new Map();
  const uu = getUu();
  if (!uu) return;
  for (const item of uu.items) {
    existing.set(item.id, item);
    if (item.type === "branch") for (const child of item.children) existing.set(child.id, child);
  }

  const items = [];
  for (const node of panel.querySelectorAll("#uu-root-list > .uu-node")) {
    const item = existing.get(node.dataset.id);
    if (!item) continue;
    if (item.type === "branch") {
      item.children = [];
      for (const childNode of node.querySelectorAll(":scope > .uu-branch-body > .uu-module-list > .uu-module")) {
        const child = existing.get(childNode.dataset.id);
        if (child?.type === "module") item.children.push(child);
      }
    }
    items.push(item);
  }
  replaceCurrentItems(items);
  updatePreview(panel);
}

function initSortables(panel) {
  const jq = globalThis.jQuery ?? globalThis.$;
  if (!jq?.fn?.sortable) {
    panel.querySelector(".uu-sort-note").hidden = false;
    return;
  }

  const common = {
    handle: ".uu-drag-handle",
    cancel: "input, textarea, button, label",
    placeholder: "uu-sort-placeholder",
    tolerance: "pointer",
    forcePlaceholderSize: true,
    stop: () => window.setTimeout(() => syncOrderFromDom(panel), 0),
  };

  jq(panel.querySelector("#uu-root-list")).sortable({
    ...common,
    items: "> .uu-node",
    connectWith: ".uu-module-list",
  });
  jq(panel.querySelectorAll(".uu-module-list")).sortable({
    ...common,
    items: "> .uu-module",
    connectWith: "#uu-root-list, .uu-module-list",
    receive(_event, ui) {
      if (ui.item.attr("data-type") === "branch") jq(this).sortable("cancel");
    },
  });
}

function buildPanel() {
  const panel = el("section", "uu-panel");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <details open>
      <summary class="uu-summary">UU 模块化管理</summary>
      <div class="uu-panel-content">
        <div class="uu-toolbar">
          <button type="button" class="menu_button" data-action="add-module">＋ 模块</button>
          <button type="button" class="menu_button" data-action="add-branch">＋ 分支</button>
          <button type="button" class="menu_button" data-action="export">导出 JSON</button>
          <button type="button" class="menu_button" data-action="import">导入 JSON</button>
          <input class="uu-import-input" type="file" accept="application/json,.json" hidden>
        </div>
        <label class="uu-master-toggle"><input type="checkbox" data-setting="enabled"> 启用 prompt 注入</label>
        <label class="uu-separator-label">模块分隔符 <input class="text_pole uu-separator" type="text" data-setting="separator" placeholder="默认：两个换行"></label>
        <p class="uu-persona-label"></p>
        <p class="uu-sort-note text_muted" hidden>当前 SillyTavern 没有提供 jQuery UI Sortable，编辑功能可用，但拖拽暂不可用。</p>
        <div id="uu-root-list" class="uu-root-list"></div>
        <div class="uu-preview-wrap">
          <div class="uu-preview-title">当前生效预览</div>
          <textarea class="text_pole uu-preview" readonly rows="8"></textarea>
          <p class="uu-preview-empty text_muted">当前没有启用且有内容的模块。</p>
        </div>
        <button type="button" class="menu_button uu-apply" data-action="apply">应用当前配置</button>
      </div>
    </details>`;
  return panel;
}

function populatePanel(panel) {
  const personaId = getCurrentPersonaId();
  panel.querySelector(".uu-persona-label").textContent = personaId ? `当前 Persona：${personaId}` : "请先选择一个 Persona";
  panel.querySelector('[data-setting="enabled"]').checked = getSettings().enabled;
  panel.querySelector('[data-setting="separator"]').value = getSettings().separator.replaceAll("\n", "\\n");
  const root = panel.querySelector("#uu-root-list");
  root.replaceChildren();
  const uu = getUu();
  if (uu) for (const item of uu.items) root.append(item.type === "branch" ? renderBranch(item) : renderModule(item));
  for (const button of panel.querySelectorAll("button, input, textarea:not(.uu-preview)")) {
    if (!personaId && !button.matches('[data-action="import"]')) button.disabled = true;
  }
  updatePreview(panel);
  initSortables(panel);
}

function scheduleRender(delay = 0) {
  if (renderQueued) return;
  renderQueued = true;
  window.setTimeout(() => {
    renderQueued = false;
    ensureUi();
  }, delay);
}

function downloadExport() {
  const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `uu-modular-persona-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindPanel(panel) {
  panel.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.dataset.setting === "separator") {
      getSettings().separator = target.value.replaceAll("\\n", "\n");
      saveSettings();
      updatePreview(panel);
      return;
    }
    const node = target.closest(".uu-node");
    const item = node ? findItem(node.dataset.id) : null;
    if (!item || !target.dataset.field) return;
    item[target.dataset.field] = target.type === "checkbox" ? target.checked : target.value;
    saveSettings();
    updatePreview(panel);
  });

  panel.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.setting === "enabled") {
      getSettings().enabled = target.checked;
      saveSettings();
    }
    if (target.classList.contains("uu-import-input") && target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result ?? ""));
          if (!confirm("导入会覆盖插件当前保存的全部 UU 数据，继续吗？")) return;
          importPayload(payload);
          toast("success", "UU 数据已导入");
          scheduleRender();
        } catch (error) {
          toast("error", `导入失败：${error.message}`);
        } finally {
          target.value = "";
        }
      };
      reader.readAsText(target.files[0]);
    }
  });

  panel.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const node = button.closest(".uu-node");
    const itemId = node?.dataset.id;
    if (action === "add-module") addModule();
    else if (action === "add-branch") addBranch();
    else if (action === "add-child") addModule(button.closest(".uu-branch")?.dataset.id);
    else if (action === "delete" && itemId) {
      if (confirm(node.dataset.type === "branch" ? "删除这个分支和其中全部模块？" : "删除这个模块？")) deleteItem(itemId);
      else return;
    } else if (action === "duplicate" && itemId) {
      duplicateModule(itemId);
    } else if (action === "collapse" && itemId) {
      const item = findItem(itemId);
      item.collapsed = !item.collapsed;
      saveSettings();
    } else if (action === "export") {
      downloadExport();
      return;
    } else if (action === "import") {
      panel.querySelector(".uu-import-input").click();
      return;
    } else if (action === "apply") {
      saveSettings();
      toast("success", "当前配置已应用，下一次生成会自动注入预览内容");
      return;
    } else return;
    scheduleRender();
  });
}

export function ensureUi() {
  const host = document.querySelector("#persona-management-block, #PersonaManagement");
  if (!host) return false;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = buildPanel();
    const anchor = host.querySelector("#persona_description")?.closest(".flex-container, .inline-drawer, div");
    if (anchor?.parentElement) anchor.insertAdjacentElement("afterend", panel);
    else host.append(panel);
    bindPanel(panel);
  }
  populatePanel(panel);
  return true;
}

export function registerUiRefresh(eventSource, eventTypes) {
  const refresh = () => scheduleRender(50);
  eventSource.on(eventTypes.APP_READY, refresh);
  eventSource.on(eventTypes.CHAT_CHANGED, refresh);
  if (eventTypes.PERSONA_CHANGED) eventSource.on(eventTypes.PERSONA_CHANGED, refresh);
  for (const eventName of ["PERSONA_CREATED", "PERSONA_UPDATED", "PERSONA_RENAMED", "PERSONA_DELETED"]) {
    if (eventTypes[eventName]) eventSource.on(eventTypes[eventName], refresh);
  }
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("#persona-management-button .drawer-toggle, #user_avatar_block .avatar-container")) refresh();
  }, true);
  refresh();
}
