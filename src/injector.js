import { eventSource, event_types } from "/script.js";
import { power_user, persona_description_positions } from "/scripts/power-user.js";
import { getCurrentPersonaId, getPreview, getSettings } from "./store.js";

let activeSnapshot = null;
let restoreTimer = null;
let installed = false;

function applyInjection() {
  if (activeSnapshot || !getSettings().enabled || !getCurrentPersonaId()) return;
  if (Number(power_user.persona_description_position) === persona_description_positions.NONE) return;

  const addition = getPreview();
  if (!addition.trim()) return;

  const original = String(power_user.persona_description ?? "");
  const separator = getSettings().separator;
  const combined = original.trim() ? `${original}${separator}${addition}` : addition;
  if (combined === original) return;

  activeSnapshot = original;
  power_user.persona_description = combined;
  restoreTimer = window.setTimeout(() => restoreInjection(), 30_000);
}

function restoreInjection() {
  if (activeSnapshot === null) return;
  power_user.persona_description = activeSnapshot;
  activeSnapshot = null;
  if (restoreTimer) window.clearTimeout(restoreTimer);
  restoreTimer = null;
}

export function registerInjection() {
  if (installed) return;
  installed = true;

  eventSource.on(event_types.GENERATION_AFTER_COMMANDS, (_type, _options, dryRun) => {
    if (!dryRun) applyInjection();
  });
  eventSource.on(event_types.GENERATION_ENDED, restoreInjection);
  eventSource.on(event_types.GENERATION_STOPPED, restoreInjection);
  eventSource.on(event_types.CHAT_CHANGED, restoreInjection);

  globalThis.uuModularPersonaGenerateInterceptor = async () => applyInjection();
}
