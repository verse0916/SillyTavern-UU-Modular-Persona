/**
 * Build the additional persona text from a one-level module/branch tree.
 * Titles are UI-only and are never included in the prompt.
 *
 * @param {unknown} items
 * @param {string} separator
 * @returns {string}
 */
export function buildPersonaText(items, separator = "\n\n") {
  if (!Array.isArray(items)) return "";

  const chunks = [];
  const addModule = (item) => {
    if (!item || item.type !== "module" || item.enabled === false) return;
    const content = String(item.content ?? "");
    if (content.trim()) chunks.push(content);
  };

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "module") {
      addModule(item);
      continue;
    }
    if (item.type === "branch" && item.enabled !== false) {
      for (const child of Array.isArray(item.children) ? item.children : []) {
        addModule(child);
      }
    }
  }

  return chunks.join(String(separator ?? "\n\n"));
}
