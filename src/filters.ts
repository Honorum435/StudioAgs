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

function buildSearchText(product: CatalogProduct, intentList: readonly Intent[]): string {
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

// Los productos no cambian: el texto de cada uno se arma una sola vez por lista de intenciones.
const searchTexts = new WeakMap<readonly Intent[], WeakMap<CatalogProduct, string>>();

// Todo lo que la búsqueda mira de un producto, ya normalizado.
export function searchText(product: CatalogProduct, intentList: readonly Intent[] = allIntents): string {
  let texts = searchTexts.get(intentList);
  if (!texts) {
    texts = new WeakMap();
    searchTexts.set(intentList, texts);
  }
  let text = texts.get(product);
  if (text === undefined) {
    text = buildSearchText(product, intentList);
    texts.set(product, text);
  }
  return text;
}

export function matchesIntent(product: CatalogProduct, intent: IntentFilter): boolean {
  return intent === ALL_INTENTS || product.intents.includes(intent);
}

function queryWords(query: string): string[] {
  return normalizeText(query).split(" ").filter(Boolean);
}

// Cada palabra buscada tiene que aparecer en algún lado, en cualquier orden.
function containsAll(haystack: string, words: readonly string[]): boolean {
  return words.every((word) => haystack.includes(word));
}

export function matchesQuery(haystack: string, query: string): boolean {
  return containsAll(haystack, queryWords(query));
}

export function visibleProductIds(
  catalog: readonly CatalogProduct[],
  state: FilterState,
  intentList: readonly Intent[] = allIntents,
): string[] {
  // La búsqueda se normaliza una vez por llamada, no una vez por producto.
  const words = queryWords(state.query);
  return catalog
    .filter((product) => matchesIntent(product, state.intent))
    .filter((product) => words.length === 0 || containsAll(searchText(product, intentList), words))
    .map((product) => product.id);
}
