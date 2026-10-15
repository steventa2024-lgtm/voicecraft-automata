import { generateTemplate, templateById } from "../../../packages/protocol/src/templates.js";

export const LOCAL_BLUEPRINTS_KEY = "voicecraft.local.blueprints";
const FAVORITES_KEY = "voicecraft.catalog.favorites";
const listeners = new Set();
export const subscribeLocal = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function emit() {
  for (const listener of listeners) listener();
}
function arrayAt(key, storage) {
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function readLocalBlueprints(storage = globalThis.localStorage) {
  return arrayAt(LOCAL_BLUEPRINTS_KEY, storage).flatMap((item) => {
    try {
      if (!templateById(item.templateId)) return [];
      const plan = generateTemplate(item.templateId, item.options || {});
      return [
        {
          id: String(item.id || `legacy-${item.templateId}`),
          templateId: item.templateId,
          name: String(item.name || templateById(item.templateId).name).slice(0, 80),
          options: plan.settings,
          fingerprint: plan.fingerprint,
          generatorVersion: item.generatorVersion || 1,
          needsReview: (item.generatorVersion || 1) !== plan.generatorVersion,
          savedAt: item.savedAt || "",
          favorite: Boolean(item.favorite),
        },
      ];
    } catch {
      return [];
    }
  });
}
function write(items, storage) {
  storage.setItem(LOCAL_BLUEPRINTS_KEY, JSON.stringify(items));
  emit();
}
export function saveLocalBlueprint(input, storage = globalThis.localStorage) {
  const plan = generateTemplate(input.templateId, input.options);
  const id =
    input.id || `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const items = readLocalBlueprints(storage);
  const previous = items.find((item) => item.id === id);
  const item = {
    id,
    templateId: input.templateId,
    name: String(input.name || templateById(input.templateId).name)
      .trim()
      .slice(0, 80),
    options: plan.settings,
    fingerprint: plan.fingerprint,
    generatorVersion: plan.generatorVersion,
    savedAt: new Date().toISOString(),
    favorite: previous?.favorite || false,
  };
  if (!item.name) throw new Error("Give your blueprint a name.");
  write([item, ...items.filter((other) => other.id !== id)], storage);
  return item;
}
export function manageLocalBlueprint(id, action, value, storage = globalThis.localStorage) {
  const items = readLocalBlueprints(storage);
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error("This blueprint is no longer on this device.");
  if (action === "delete")
    write(
      items.filter((entry) => entry.id !== id),
      storage,
    );
  else if (action === "duplicate")
    return saveLocalBlueprint({ ...item, id: undefined, name: `${item.name} copy` }, storage);
  else {
    if (action === "rename") {
      const name = String(value || "")
        .trim()
        .slice(0, 80);
      if (!name) throw new Error("Give your blueprint a name.");
      item.name = name;
    } else if (action === "favorite") item.favorite = !item.favorite;
    else throw new Error("Unknown blueprint action.");
    write(items, storage);
  }
}
export function readFavorites(storage = globalThis.localStorage) {
  return arrayAt(FAVORITES_KEY, storage).filter((id) => typeof id === "string" && templateById(id));
}
export function toggleFavorite(id, storage = globalThis.localStorage) {
  const favorites = readFavorites(storage);
  storage.setItem(
    FAVORITES_KEY,
    JSON.stringify(
      favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id],
    ),
  );
  emit();
}
