import { intents as allIntents, type CatalogProduct, type Intent, type IntentId } from "./catalog";

// Módulo puro: filtro por intención y búsqueda sin tildes. Nada de DOM.

export const ALL_INTENTS = "todo";

export type IntentFilter = IntentId | typeof ALL_INTENTS;

export interface FilterState {
  intent: IntentFilter;
  query: string;
}

export function isIntentFilter(value: string, intentList: readonly Intent[] = allIntents): value is IntentFilter {
  return value === ALL_INTENTS || intentList.some((intent) => intent.id === value);
}

// Minúsculas, sin tildes ni diéresis y con un solo espacio entre palabras.
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

// Todo lo que la búsqueda mira de un producto, ya normalizado.
export function searchText(product: CatalogProduct, intentList: readonly Intent[] = allIntents): string {
  const intentLabels = intentList
    .filter((intent) => product.intents.includes(intent.id))
    .map((intent) => intent.label);
  const optionLabels = product.groups.flatMap((group) => group.options.map((option) => option.label));
  return normalizeText(
    [
      product.name,
      product.description,
      ...intentLabels,
      ...optionLabels,
      ...product.addOns.map((addOn) => addOn.label),
    ].join(" "),
  );
}

export function matchesIntent(product: CatalogProduct, intent: IntentFilter): boolean {
  return intent === ALL_INTENTS || product.intents.includes(intent);
}

// Cada palabra buscada tiene que aparecer en algún lado, en cualquier orden.
export function matchesQuery(haystack: string, query: string): boolean {
  const words = normalizeText(query).split(" ").filter(Boolean);
  return words.every((word) => haystack.includes(word));
}

export function visibleProductIds(
  catalog: readonly CatalogProduct[],
  state: FilterState,
  intentList: readonly Intent[] = allIntents,
): string[] {
  return catalog
    .filter((product) => matchesIntent(product, state.intent))
    .filter((product) => matchesQuery(searchText(product, intentList), state.query))
    .map((product) => product.id);
}
