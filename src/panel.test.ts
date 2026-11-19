import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProduct, type ProductFile } from "./catalog";

// public/admin/panel.js corre en el navegador, dentro de Sveltia CMS. Acá se carga con un CMS de
// mentira para revisar que lo que guarda (códigos y filas de precio) es lo que espera el catálogo.

// Lo mínimo de un Map de Immutable: get, set y toJS.
class FakeMap {
  constructor(private readonly values: Record<string, unknown>) {}
  get(key: string): unknown {
    return this.values[key];
  }
  set(key: string, value: unknown): FakeMap {
    return new FakeMap({ ...this.values, [key]: value });
  }
  toJS(): Record<string, unknown> {
    return structuredClone(this.values);
  }
}

type PreSave = (args: { entry: FakeMap }) => FakeMap | undefined;

function loadPanel(): { preSave: PreSave; fieldTypes: string[]; initialized: boolean } {
  const loaded = { preSave: undefined as PreSave | undefined, fieldTypes: [] as string[], initialized: false };
  const CMS = {
    React: { createElement: () => null, useEffect: () => {}, useImperativeHandle: () => {}, useRef: () => ({}) },
    registerFieldType: ({ name }: { name: string }) => loaded.fieldTypes.push(name),
    registerEventListener: ({ name, handler }: { name: string; handler: PreSave }) => {
      if (name === "preSave") {
        loaded.preSave = handler;
      }
    },
    init: () => {
      loaded.initialized = true;
    },
  };
  new Function("window", readFileSync("public/admin/panel.js", "utf8"))({ CMS });
  if (!loaded.preSave) {
    throw new Error("panel.js no registró el preSave");
  }
  return { ...loaded, preSave: loaded.preSave };
}

const panel = loadPanel();

function save(data: Partial<ProductFile>, slug = "prueba", collection = "productos"): ProductFile {
  const entry = new FakeMap({ collection, slug, data: new FakeMap(data) });
  const result = panel.preSave({ entry });
  return (result ? result.toJS() : data) as ProductFile;
}

const base: ProductFile = {
  name: "Prueba",
  description: "",
  gallery: [{ src: "/fotos/prueba.webp" }],
  prices: [],
};

describe("panel.js", () => {
  it("suma la tabla de precios y arranca el panel después de registrarla", () => {
    expect(panel.fieldTypes).toEqual(["precios"]);
    expect(panel.initialized).toBe(true);
  });

  it("al guardar pone los códigos que faltan con la misma regla que el catálogo", () => {
    const saved = save({
      ...base,
      groups: [
        { label: "Tamaño", changesPrice: true, options: [{ label: "A4 (21 × 29,7)" }, { label: "Más grande" }, { label: "más grande" }] },
        { id: "color", label: "Color", changesPrice: false, options: [{ id: "rojo-fuego", label: "Rojo" }, { label: "" }] },
      ],
      addOns: [{ label: "Caja de regalo", price: 900, unit: "por unidad" }],
    });
    expect(saved.groups!.map((group) => group.id)).toEqual(["tamano", "color"]);
    expect(saved.groups![0].options!.map((option) => option.id)).toEqual(["a4-21-29-7", "mas-grande", "mas-grande-2"]);
    // Los códigos que ya estaban no cambian, aunque el nombre ya no coincida.
    expect(saved.groups![1].options!.map((option) => option.id)).toEqual(["rojo-fuego", "opcion"]);
    expect(saved.addOns!.map((addOn) => addOn.id)).toEqual(["prueba-caja-de-regalo"]);
  });

  it("deja solo las filas de precio de las opciones de ahora y con eso arma el producto", () => {
    const saved = save({
      ...base,
      groups: [
        { label: "Vinilo", options: [{ label: "Blanco" }, { label: "Transparente" }] },
        { label: "Laca", options: [{ label: "Sin laca" }, { label: "Completa" }] },
        { label: "Color", changesPrice: false, options: [{ label: "Rojo" }] },
      ],
      prices: [
        { label: "Blanco · Sin laca", price: 100, unit: "por pliego" },
        { label: "Blanco · Completa", price: 120, unit: "por pliego" },
        { label: "Transparente · Sin laca", price: 110, unit: "por pliego" },
        // Si se reordenan los grupos, la fila sigue valiendo para su combinación.
        { label: "Completa · Transparente", price: 130, unit: "por pliego" },
        { label: "Mate", price: 999, unit: "por pliego" },
      ],
    });
    expect(saved.prices).toEqual([
      { label: "Blanco · Sin laca", price: 100, unit: "por pliego" },
      { label: "Blanco · Completa", price: 120, unit: "por pliego" },
      { label: "Transparente · Sin laca", price: 110, unit: "por pliego" },
      { label: "Transparente · Completa", price: 130, unit: "por pliego" },
    ]);
    const built = buildProduct("prueba", saved);
    expect(built.combinations.map((combination) => [combination.id, combination.price])).toEqual([
      ["prueba-blanco-sin-laca-rojo", 100],
      ["prueba-blanco-completa-rojo", 120],
      ["prueba-transparente-sin-laca-rojo", 110],
      ["prueba-transparente-completa-rojo", 130],
    ]);
  });

  it("sin grupos que cambien el precio, queda una sola fila «Precio único»", () => {
    const saved = save({
      ...base,
      groups: [{ label: "Color", changesPrice: false, options: [{ label: "Rojo" }, { label: "Azul" }] }],
      prices: [{ label: "Precio único", price: 500, unit: "por unidad" }],
    });
    expect(saved.prices).toEqual([{ label: "Precio único", price: 500, unit: "por unidad" }]);
    expect(buildProduct("prueba", saved).combinations.map((combination) => combination.price)).toEqual([500, 500]);
  });

  it("una opción nueva queda sin precio, con la unidad más usada, y el catálogo no la acepta así", () => {
    const saved = save({
      ...base,
      groups: [{ label: "Tamaño", options: [{ label: "A4" }, { label: "A5" }, { label: "A3" }] }],
      prices: [
        { label: "A4", price: 100, unit: "por hoja" },
        { label: "A5", price: 80, unit: "por hoja" },
      ],
    });
    expect(saved.prices[saved.prices.length - 1]).toEqual({ label: "A3", price: null, unit: "por hoja" });
    expect(() => buildProduct("prueba", saved)).toThrow("Falta el precio de «A3» en contenido/prueba.json");
  });

  it("no toca lo que se guarda en otras colecciones", () => {
    const data = { name: "Otra cosa", description: "", gallery: [], prices: [] };
    expect(save(data, "x", "paginas")).toEqual(data);
  });
});
