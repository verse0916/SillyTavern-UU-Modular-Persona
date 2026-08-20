import {
  CLEANING_RULES,
  MODULE_TEMPLATES,
  assertSamePersona,
  confirmReplace,
  getTemplateModules,
  parseModuleDefinition,
  resolvePersonaInput,
  requestPersonaModules,
  toPluginModules,
} from "./ai.js";
import { applyGeneratedModules, getCurrentPersonaId } from "./store.js";

const DIALOG_ID = "uu-ai-module-dialog";

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function toast(type, message) {
  if (globalThis.toastr?.[type]) globalThis.toastr[type](message);
  else console[type === "error" ? "error" : "log"](`[UU Modular Persona] ${message}`);
}

function getCurrentPersonaDescription() {
  const textarea = document.querySelector("#persona_description");
  if (textarea instanceof HTMLTextAreaElement) return textarea.value;
  return String(globalThis.SillyTavern?.getContext?.()?.powerUserSettings?.persona_description ?? "");
}

function createDialog() {
  const dialog = el("dialog", "uu-ai-dialog");
  dialog.id = DIALOG_ID;
  dialog.innerHTML = `
    <div class="uu-ai-shell">
      <header class="uu-ai-header">
        <div>
          <h3>✨ AI 自动分模块</h3>
          <p>使用 SillyTavern 当前主 API 和当前模型，生成内容不会写入聊天记录。</p>
        </div>
        <button type="button" class="menu_button fa-solid fa-xmark uu-ai-close" aria-label="关闭" title="关闭"></button>
      </header>
      <div class="uu-ai-body">
        <section class="uu-ai-config">
          <fieldset>
            <legend>输入来源</legend>
            <label><input type="radio" name="uu-ai-source" value="current" checked> 当前 Persona</label>
            <label><input type="radio" name="uu-ai-source" value="manual"> 手动粘贴文本</label>
            <div class="uu-ai-manual" hidden>
              <textarea class="text_pole" rows="10" placeholder="粘贴要拆分的 Persona 文本。结果仍会应用到当前选中的 Persona。"></textarea>
            </div>
          </fieldset>
          <div class="uu-ai-grid">
            <label>模块模板
              <select class="text_pole uu-ai-template"></select>
            </label>
            <label>模块模式
              <select class="text_pole uu-ai-mode">
                <option value="normal">普通模式</option>
                <option value="advanced">高级自定义模式</option>
              </select>
            </label>
            <label>清洗程度
              <select class="text_pole uu-ai-cleaning"></select>
            </label>
          </div>
          <div class="uu-ai-custom-modules" hidden>
            <label>自定义模块和边界
              <textarea class="text_pole" rows="12" placeholder="每行一个模块；也支持“模块名称：”“模块用途：”“包含内容：”“不包含内容：”格式。"></textarea>
            </label>
          </div>
          <div class="uu-ai-module-preview text_muted"></div>
          <label>补充 Prompt（可选）
            <textarea class="text_pole uu-ai-extra-prompt" rows="4" placeholder="例如：语言风格尽量保留原句，不要把讽刺表达改成中性描述。"></textarea>
          </label>
        </section>
        <div class="uu-ai-actions">
          <button type="button" class="menu_button uu-ai-generate">开始分模块</button>
          <span class="uu-ai-status text_muted" role="status"></span>
        </div>
        <section class="uu-ai-results" hidden>
          <h4>拆分结果预览</h4>
          <p class="uu-ai-result-meta text_muted"></p>
          <div class="uu-ai-result-list"></div>
          <fieldset class="uu-ai-apply-mode">
            <legend>应用方式</legend>
            <label><input type="radio" name="uu-ai-apply-mode" value="append" checked> 追加到当前模块</label>
            <label><input type="radio" name="uu-ai-apply-mode" value="replace"> 替换当前模块</label>
          </fieldset>
          <button type="button" class="menu_button uu-ai-apply">应用到当前 Persona</button>
        </section>
      </div>
    </div>`;
  return dialog;
}

function populateOptions(dialog) {
  const templateSelect = dialog.querySelector(".uu-ai-template");
  for (const name of Object.keys(MODULE_TEMPLATES)) templateSelect.add(new Option(name, name));
  const cleaningSelect = dialog.querySelector(".uu-ai-cleaning");
  for (const name of Object.keys(CLEANING_RULES)) cleaningSelect.add(new Option(name, name, false, name === "轻度"));
  dialog.querySelector(".uu-ai-custom-modules textarea").value = MODULE_TEMPLATES[templateSelect.value].join("\n");
}

function getSelectedModules(dialog) {
  const mode = dialog.querySelector(".uu-ai-mode").value;
  if (mode === "advanced") return parseModuleDefinition(dialog.querySelector(".uu-ai-custom-modules textarea").value);
  return getTemplateModules(dialog.querySelector(".uu-ai-template").value);
}

function updateModulePreview(dialog) {
  const modules = getSelectedModules(dialog);
  const preview = dialog.querySelector(".uu-ai-module-preview");
  preview.textContent = modules.length
    ? `将输出 ${modules.length} 个模块：${modules.map((module) => module.name).join("、")}`
    : "没有检测到有效模块。";
}

function setStatus(dialog, message, type = "muted") {
  const status = dialog.querySelector(".uu-ai-status");
  status.textContent = message;
  status.classList.toggle("uu-ai-error", type === "error");
  status.classList.toggle("uu-ai-success", type === "success");
}

function setBusy(dialog, busy) {
  for (const control of dialog.querySelectorAll(".uu-ai-config input, .uu-ai-config select, .uu-ai-config textarea")) {
    control.disabled = busy;
  }
  dialog.querySelector(".uu-ai-generate").disabled = busy;
  dialog.querySelector(".uu-ai-generate").textContent = busy ? "正在分模块…" : "开始分模块";
}

function renderResults(dialog, modules, meta) {
  const results = dialog.querySelector(".uu-ai-results");
  const list = dialog.querySelector(".uu-ai-result-list");
  list.replaceChildren();
  for (const module of modules) {
    const card = el("article", "uu-ai-result-card");
    card.append(el("h5", "", module.name));
    const content = el("div", "uu-ai-result-content", module.content || "（无对应内容）");
    if (!module.content) content.classList.add("text_muted");
    card.append(content);
    list.append(card);
  }
  dialog.querySelector(".uu-ai-result-meta").textContent = meta;
  results.hidden = false;
}

function bindDialog(dialog, onApplied) {
  let pendingModules = null;
  let generatedForPersonaId = "";

  const clearPending = () => {
    pendingModules = null;
    generatedForPersonaId = "";
    dialog.querySelector(".uu-ai-results").hidden = true;
  };

  const close = () => {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.remove();
  };

  dialog.querySelector(".uu-ai-close").addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });

  dialog.querySelector(".uu-ai-config").addEventListener("input", (event) => {
    if (event.isTrusted) clearPending();
  });
  dialog.querySelector(".uu-ai-config").addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.name === "uu-ai-source") {
      dialog.querySelector(".uu-ai-manual").hidden = target.value !== "manual";
    }
    if (target.classList.contains("uu-ai-mode")) {
      dialog.querySelector(".uu-ai-custom-modules").hidden = target.value !== "advanced";
    }
    if (target.classList.contains("uu-ai-template")) {
      dialog.querySelector(".uu-ai-custom-modules textarea").value = MODULE_TEMPLATES[target.value].join("\n");
    }
    updateModulePreview(dialog);
  });

  dialog.querySelector(".uu-ai-custom-modules textarea").addEventListener("input", () => updateModulePreview(dialog));

  dialog.querySelector(".uu-ai-generate").addEventListener("click", async () => {
    clearPending();
    setStatus(dialog, "正在准备请求…");
    setBusy(dialog, true);
    try {
      const personaId = getCurrentPersonaId();
      if (!personaId) throw new Error("当前没有选择 Persona。");
      const source = dialog.querySelector('input[name="uu-ai-source"]:checked').value;
      const persona = resolvePersonaInput(
        source,
        getCurrentPersonaDescription(),
        dialog.querySelector(".uu-ai-manual textarea").value,
      );
      const modules = getSelectedModules(dialog);
      if (!modules.length) throw new Error("没有检测到有效模块。");
      setStatus(dialog, "正在使用 SillyTavern 当前主 API 和模型生成…");
      const started = Date.now();
      const response = await requestPersonaModules({
        persona,
        modules,
        cleaningMode: dialog.querySelector(".uu-ai-cleaning").value,
        customPrompt: dialog.querySelector(".uu-ai-extra-prompt").value,
      });
      assertSamePersona(personaId, getCurrentPersonaId());
      pendingModules = toPluginModules(response.modules);
      generatedForPersonaId = personaId;
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      renderResults(dialog, response.modules, `${response.modules.length} 个模块 · ${response.mode} · ${seconds} 秒`);
      setStatus(dialog, "拆分完成，请检查预览后再应用。", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(dialog, message, "error");
      toast("error", message);
    } finally {
      setBusy(dialog, false);
    }
  });

  dialog.querySelector(".uu-ai-apply").addEventListener("click", () => {
    try {
      if (!pendingModules?.length) throw new Error("当前没有可应用的 AI 拆分结果。");
      assertSamePersona(generatedForPersonaId, getCurrentPersonaId());
      const mode = dialog.querySelector('input[name="uu-ai-apply-mode"]:checked').value;
      if (!confirmReplace(mode)) return;
      const count = applyGeneratedModules(generatedForPersonaId, pendingModules, mode);
      toast("success", `${count} 个 AI 模块已${mode === "replace" ? "替换" : "追加"}到当前 Persona`);
      onApplied?.();
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(dialog, message, "error");
      toast("error", message);
    }
  });
}

export function openAiModuleDialog({ onApplied } = {}) {
  const personaId = getCurrentPersonaId();
  if (!personaId) {
    toast("error", "当前没有选择 Persona。");
    return;
  }
  document.getElementById(DIALOG_ID)?.remove();
  const dialog = createDialog();
  populateOptions(dialog);
  bindDialog(dialog, onApplied);
  updateModulePreview(dialog);
  document.body.append(dialog);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}
