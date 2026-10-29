import { describe, expect, it } from "vitest";
import { products } from "./catalog";
import {
  ALL_INTENTS,
  isIntentFilter,
  normalizeText,
  searchText,
  visibleProductIds,
  type FilterState,
} from "./filters";

function visible(state: Partial<FilterState>): string[] {
  return visibleProductIds(products, { intent: ALL_INTENTS, query: "", ...state });
}

describe("normalizeText", () => {
  it("saca tildes, pasa a minúsculas y junta los espacios", () => {
    expect(normalizeText("  Láminas   y TAMAÑO ")).toBe("laminas y tamano");
  });
});

describe("filtro por intención", () => {
  it("'Para tu marca' devuelve los productos que la incluyen, en el orden del catálogo", () => {
    expect(visible({ intent: "marca" })).toEqual(["calendarios", "vinilos", "tarjetas"]);
  });

  it("un producto puede aparecer en más de una intención", () => {
    expect(visible({ intent: "regalar" })).toContain("calendarios");
    expect(visible({ intent: "organizarte" })).toContain("calendarios");
  });

  it("'Todo' devuelve los 8 productos", () => {
    expect(visible({ intent: ALL_INTENTS })).toHaveLength(8);
    expect(visible({})).toEqual(products.map((product) => product.id));
  });

  it("reconoce los filtros válidos", () => {
    expect(isIntentFilter("todo")).toBe(true);
    expect(isIntentFilter("marca")).toBe(true);
    expect(isIntentFilter("otra")).toBe(false);
  });
});

describe("búsqueda", () => {
  it("'laminas' sin tilde encuentra Láminas", () => {
    expect(visible({ query: "laminas" })).toEqual(["laminas"]);
  });

  it("'doble faz' encuentra Tarjetas por el nombre de la opción", () => {
    expect(visible({ query: "doble faz" })).toEqual(["tarjetas"]);
  });

  it("mira los nombres de intención y de los adicionales", () => {
    expect(visible({ query: "para decorar" })).toEqual(visible({ intent: "decorar" }));
    expect(visible({ query: "maqueta" })).toEqual(["vinilos"]);
    expect(visible({ query: "notas con iman" })).toEqual(["calendarios"]);
  });

  it("las palabras pueden ir en cualquier orden", () => {
    expect(visible({ query: "faz TARJETAS" })).toEqual(["tarjetas"]);
  });

  it("una búsqueda vacía o solo con espacios no filtra", () => {
    expect(visible({ query: "   " })).toHaveLength(8);
  });

  it("filtro y búsqueda sin coincidencias devuelve vacío", () => {
    expect(visible({ intent: "marca", query: "laminas" })).toEqual([]);
  });

  it("'Buscar en todo' conserva el término y limpia la intención", () => {
    const state: FilterState = { intent: "marca", query: "laminas" };
    expect(visible({ ...state, intent: ALL_INTENTS })).toEqual(["laminas"]);
  });

  it("compara la búsqueda normalizada contra el texto normalizado del producto", () => {
    const tarjetas = products.find((product) => product.id === "tarjetas")!;
    expect(searchText(tarjetas)).toContain("laminado");
    expect(visible({ query: "LAMINADO" })).toContain("tarjetas");
    expect(visible({ query: "laminas" })).not.toContain("tarjetas");
  });
});
