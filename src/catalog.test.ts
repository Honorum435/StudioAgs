import { describe, expect, it } from "vitest";
import { businessValue, example, isExample } from "./business";
import {
  imageUrl,
  initialSelection,
  intents,
  listPendingCatalogFields,
  products,
  resolveSelection,
  type CatalogProduct,
} from "./catalog";

function product(id: string): CatalogProduct {
  const found = products.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No existe el producto ${id}`);
  }
  return found;
}

// Precios del catálogo del 14/7/2026 (página 5 del PDF).
const expectedPrices: Record<string, number> = {
  "calendarios-clasico-sin-notas": 41500,
  "calendarios-clasico-con-notas": 41500,
  "calendarios-unico": 28000,
  "calendarios-doce-meses": 26000,
  "calendarios-semanal-grande": 26000,
  "calendarios-semanal-chico": 21000,
  "calendarios-acrilico": 55000,
  "calendarios-iman": 23000,
  "fotos-polaroid": 800,
  "fotos-tira": 1500,
  "fotos-foto-10x10": 1500,
  "fotos-iman-10x10": 4000,
  "fotos-marco-con-iman": 5500,
  "pizarra-orma-gris-galvanizada": 50000,
  "pizarra-orma-negro-mate": 60000,
  "entre-flores": 35000,
  "vinilos-blanco-sin-laca": 14500,
  "vinilos-blanco-laca-sectorizada": 16600,
  "vinilos-blanco-laca-completa": 18800,
  "vinilos-transparente-sin-laca": 16200,
  "vinilos-transparente-laca-sectorizada": 18600,
  "vinilos-transparente-laca-completa": 21000,
  "bitacoras-bitacora-a5": 7000,
  "bitacoras-bitacora-a6": 5000,
  "bitacoras-separador": 1300,
  "bitacoras-separador-con-iman": 1500,
  "laminas-a3-plus": 7000,
  "laminas-a3": 7000,
  "laminas-a4": 5000,
  "laminas-a5": 4000,
  "laminas-a6": 3000,
};

const cardMatrix: Record<string, readonly number[]> = {
  "100": [13300, 16300, 16300, 19300],
  "200": [19300, 24500, 24500, 26300],
  "300": [23800, 30600, 30600, 37500],
  "500": [34000, 44500, 46000, 56000],
  "1000": [58800, 78100, 80600, 99000],
};
for (const [quantity, prices] of Object.entries(cardMatrix)) {
  ["simple-faz-sin-laminar", "simple-faz-laminado", "doble-faz-sin-laminar", "doble-faz-laminado"].forEach(
    (suffix, index) => {
      expectedPrices[`tarjetas-${quantity}-${suffix}`] = prices[index];
    },
  );
}

const allCombinations = products.flatMap((item) => item.combinations);
const allAddOns = products.flatMap((item) => item.addOns);

describe("catálogo", () => {
  it("tiene los 8 productos con IDs únicos", () => {
    const ids = products.map((item) => item.id);
    expect(ids).toEqual([
      "calendarios",
      "fotos",
      "pizarra-orma",
      "entre-flores",
      "vinilos",
      "tarjetas",
      "bitacoras",
      "laminas",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("conserva todos los precios del catálogo y ninguno más", () => {
    const actual = Object.fromEntries(allCombinations.map((item) => [item.id, item.price]));
    expect(actual).toEqual(expectedPrices);
  });

  it("declara los grupos de opciones de cada producto", () => {
    const groups = Object.fromEntries(
      products.map((item) => [item.id, item.groups.map((group) => group.id)]),
    );
    expect(groups).toEqual({
      calendarios: ["formato"],
      fotos: ["formato"],
      "pizarra-orma": ["color"],
      "entre-flores": [],
      vinilos: ["material", "laca"],
      tarjetas: ["cantidad", "faz", "terminacion"],
      bitacoras: ["formato"],
      laminas: ["tamano"],
    });
  });

  it("arma cada ID con el producto y los valores elegidos, sin índices", () => {
    for (const item of products) {
      expect(item.combinations.length).toBe(
        item.groups.reduce((count, group) => count * group.options.length, 1),
      );
      for (const combination of item.combinations) {
        const values = item.groups.map((group) => combination.values[group.id]);
        expect(combination.id).toBe([item.id, ...values].join("-"));
        expect(Object.keys(combination.values)).toEqual(item.groups.map((group) => group.id));
      }
    }
  });

  it("no repite IDs entre combinaciones y adicionales de todo el catálogo", () => {
    const ids = [...allCombinations, ...allAddOns].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no repite opciones dentro de un grupo", () => {
    for (const group of products.flatMap((item) => item.groups)) {
      const ids = group.options.map((option) => option.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(group.options.length).toBeGreaterThan(0);
    }
  });

  it("separa los adicionales de las combinaciones", () => {
    const addOnPattern = /maqueta|corte|notas con imán/i;
    for (const id of ["vinilos", "calendarios"]) {
      for (const combination of product(id).combinations) {
        expect(combination.label).not.toMatch(addOnPattern);
        expect(combination.id).not.toMatch(/maqueta|corte|notas-con-iman/);
      }
    }
    expect(product("vinilos").combinations).toHaveLength(6);
    expect(product("calendarios").combinations).toHaveLength(8);
    expect(product("vinilos").addOns.map((addOn) => [addOn.id, addOn.price, addOn.unit])).toEqual([
      ["vinilos-maqueta", 2500, "cada 5 diseños"],
      ["vinilos-corte-individual", 2500, "por pliego"],
    ]);
    expect(product("calendarios").addOns.map((addOn) => [addOn.id, addOn.price])).toEqual([
      ["calendarios-notas-con-iman", 2500],
    ]);
  });

  it("da a cada producto al menos una intención válida y sin repetir", () => {
    const valid = new Set(intents.map((intent) => intent.id));
    for (const item of products) {
      expect(item.intents.length).toBeGreaterThan(0);
      expect(new Set(item.intents).size).toBe(item.intents.length);
      expect(item.intents.every((intent) => valid.has(intent))).toBe(true);
    }
    expect(intents.map((intent) => intent.label)).toEqual([
      "Para regalar",
      "Para tu marca",
      "Para decorar",
      "Para organizarte",
    ]);
  });

  it("declara un plazo con mínimo ≤ máximo y su texto", () => {
    for (const item of products) {
      const { min, max, text } = businessValue(item.leadTime);
      expect(Number.isInteger(min) && min >= 1).toBe(true);
      expect(Number.isInteger(max)).toBe(true);
      expect(min).toBeLessThanOrEqual(max);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("toma del catálogo los plazos de Fotos y Vinilos", () => {
    expect(product("fotos").leadTime).toEqual({ min: 1, max: 3, text: "De 1 a 3 días hábiles" });
    expect(product("vinilos").leadTime).toEqual({ min: 1, max: 4, text: "De 1 a 4 días" });
  });

  it("separa personalizable de lleva fotos e incluye instrucciones solo cuando lleva fotos", () => {
    expect(product("laminas").personalizable).toBe(false);
    for (const item of products) {
      if (item.needsPhotos) {
        const { quantity, quality, howToSend } = item.photoInstructions!;
        expect(quantity.length && quality.length && howToSend.length).toBeGreaterThan(0);
        expect(howToSend).toMatch(/documento/);
      } else {
        expect(item.photoInstructions).toBeUndefined();
      }
    }
    expect(products.filter((item) => item.needsPhotos).map((item) => item.id)).toEqual([
      "fotos",
      "pizarra-orma",
    ]);
  });

  it("declara sus imágenes con anchos, ancho y alto", () => {
    for (const item of products) {
      const { card, ficha, hero } = item.images;
      for (const spec of [card, ficha, ...(hero ? [hero] : [])]) {
        expect(spec.base.length).toBeGreaterThan(0);
        expect(spec.widths.length).toBeGreaterThan(0);
        expect([...spec.widths].sort((a, b) => a - b)).toEqual(spec.widths);
        expect(spec.width).toBe(Math.max(...spec.widths));
        expect(spec.height).toBeGreaterThan(0);
      }
      expect(card.base).toBe(item.id);
    }
    expect(products.filter((item) => item.images.hero).map((item) => item.id)).toEqual([
      "fotos",
      "bitacoras",
    ]);
    const bases = products.flatMap(({ images }) =>
      [images.card, images.ficha, images.hero].flatMap((spec) => (spec ? [spec.base] : [])),
    );
    expect(new Set(bases).size).toBe(bases.length);
  });

  it("arma la ruta de cada imagen con su nombre base y su ancho", () => {
    expect(imageUrl(product("tarjetas").images.card, 400)).toBe("/images/tarjetas-400.webp");
    expect(imageUrl(product("tarjetas").images.ficha, 1800)).toBe("/images/ficha-tarjetas-1800.webp");
  });
});

describe("resolveSelection", () => {
  it("Tarjetas 200 · doble faz · laminado cuesta $26.300 (AE1)", () => {
    const resolved = resolveSelection(product("tarjetas"), {
      cantidad: "200",
      faz: "doble-faz",
      terminacion: "laminado",
    });
    expect(resolved?.combination.id).toBe("tarjetas-200-doble-faz-laminado");
    expect(resolved?.total).toBe(26300);
    expect(resolved?.combination.unit).toBe("pack de 200");
  });

  it("Vinilos blanco · laca completa con maqueta suma el adicional", () => {
    const resolved = resolveSelection(
      product("vinilos"),
      { material: "blanco", laca: "laca-completa" },
      ["vinilos-maqueta"],
    );
    expect(resolved?.combination.price).toBe(18800);
    expect(resolved?.addOns.map((addOn) => addOn.id)).toEqual(["vinilos-maqueta"]);
    expect(resolved?.total).toBe(18800 + 2500);
    expect(resolved?.combination.unit).toBe("por pliego");
  });

  it("suma cada adicional una sola vez y en el orden del catálogo", () => {
    const resolved = resolveSelection(
      product("vinilos"),
      { material: "transparente", laca: "sin-laca" },
      ["vinilos-corte-individual", "vinilos-maqueta", "vinilos-corte-individual"],
    );
    expect(resolved?.addOns.map((addOn) => addOn.id)).toEqual([
      "vinilos-maqueta",
      "vinilos-corte-individual",
    ]);
    expect(resolved?.total).toBe(16200 + 2500 + 2500);
  });

  it("resuelve la selección inicial de cada producto con precio y unidad", () => {
    for (const item of products) {
      const resolved = resolveSelection(item, initialSelection(item));
      expect(resolved).not.toBeNull();
      expect(resolved!.combination).toBe(item.combinations[0]);
      expect(resolved!.total).toBeGreaterThan(0);
      expect(resolved!.combination.unit.length).toBeGreaterThan(0);
      expect(resolved!.addOns).toEqual([]);
    }
  });

  it("la selección inicial toma la primera opción de cada grupo", () => {
    expect(initialSelection(product("tarjetas"))).toEqual({
      cantidad: "100",
      faz: "simple-faz",
      terminacion: "sin-laminar",
    });
  });

  it("Entre Flores no tiene grupos y resuelve a su único precio", () => {
    const entreFlores = product("entre-flores");
    expect(entreFlores.groups).toEqual([]);
    expect(initialSelection(entreFlores)).toEqual({});
    const resolved = resolveSelection(entreFlores, {});
    expect(resolved?.combination.id).toBe("entre-flores");
    expect(resolved?.total).toBe(35000);
    expect(resolved?.combination.unit).toBe("por unidad");
  });

  it("cada combinación se puede elegir a partir de sus valores", () => {
    for (const item of products) {
      for (const combination of item.combinations) {
        expect(resolveSelection(item, combination.values)?.combination).toBe(combination);
      }
    }
  });

  it("devuelve null sin romper con una selección incompleta o inválida", () => {
    const tarjetas = product("tarjetas");
    const cases: Record<string, string>[] = [
      {},
      { cantidad: "200", faz: "doble-faz" },
      { cantidad: "250", faz: "doble-faz", terminacion: "laminado" },
      { cantidad: "200", faz: "triple-faz", terminacion: "laminado" },
      { cantidad: "200", faz: "doble-faz", terminacion: "laminado", color: "rojo" },
      { cantidad: "", faz: "doble-faz", terminacion: "laminado" },
    ];
    for (const selection of cases) {
      expect(() => resolveSelection(tarjetas, selection)).not.toThrow();
      expect(resolveSelection(tarjetas, selection)).toBeNull();
    }
    expect(resolveSelection(product("entre-flores"), { formato: "unico" })).toBeNull();
  });

  it("devuelve null con un adicional que no es del producto", () => {
    const vinilos = product("vinilos");
    const selection = { material: "blanco", laca: "sin-laca" };
    expect(resolveSelection(vinilos, selection, ["calendarios-notas-con-iman"])).toBeNull();
    expect(resolveSelection(vinilos, selection, ["maqueta"])).toBeNull();
    expect(resolveSelection(product("laminas"), { tamano: "a4" }, ["vinilos-maqueta"])).toBeNull();
  });
});

describe("listPendingCatalogFields", () => {
  const confirmed = products.map((item) => ({ ...item, leadTime: businessValue(item.leadTime) }));

  it("devuelve una lista vacía con los plazos confirmados", () => {
    expect(listPendingCatalogFields(confirmed)).toEqual([]);
  });

  it("nombra cada plazo que conserva la marca de ejemplo", () => {
    const catalog = confirmed.map((item) =>
      item.id === "tarjetas" || item.id === "laminas"
        ? { ...item, leadTime: example(item.leadTime) }
        : item,
    );
    expect(listPendingCatalogFields(catalog)).toEqual(["tarjetas.leadTime", "laminas.leadTime"]);
  });

  it("marca como pendientes los plazos que el catálogo no informa", () => {
    const pending = products.filter((item) => isExample(item.leadTime)).map((item) => item.id);
    expect(listPendingCatalogFields(products)).toEqual(pending.map((id) => `${id}.leadTime`));
    expect(pending).not.toContain("fotos");
    expect(pending).not.toContain("vinilos");
  });
});
