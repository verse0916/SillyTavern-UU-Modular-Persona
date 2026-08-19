import { eventSource, event_types } from "/script.js";
import { registerInjection } from "./src/injector.js";
import { registerUiRefresh } from "./src/ui.js";

try {
  registerInjection();
  registerUiRefresh(eventSource, event_types);
  console.info("[UU Modular Persona] Initialized");
} catch (error) {
  console.error("[UU Modular Persona] Failed to initialize", error);
}
