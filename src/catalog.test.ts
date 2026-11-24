import { describe, expect, it } from "vitest";
import { businessValue, example, isExample } from "./business";
import {
  buildCatalog,
  buildProduct,
  initialSelection,
  intents,
  listPendingCatalogFields,
  products,
  resolveSelection,
  type CatalogProduct,
  type ProductFile,
} from "./catalog";

function product(id: string): CatalogProduct {
  const found = products.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No existe el producto ${id}`);
  }
  return found;
}

// Precios de la lista que mandó la dueña el 05/11/2026.
const expectedPrices: Record<string, number> = {
  "fotos-polaroid": 500,
  "fotos-tira": 1500,
  "fotos-foto-10x10": 1500,
  "fotos-iman-10x10": 4000,
  "pizarra-orma-gris-galvanizada": 35000,
  "pizarra-orma-negro-mate": 40000,
  "entre-flores": 35000,
  "vinilos-blanco-sin-laca": 14500,
  "vinilos-blanco-laca-sectorizada": 16600,
  "vinilos-blanco-laca-completa": 18800,
  "vinilos-transparente-sin-laca": 16200,
  "vinilos-transparente-laca-sectorizada": 18600,
  "vinilos-transparente-laca-completa": 21000,
  "complementos-separador": 1300,
  "complementos-separador-con-iman": 1500,
  "complementos-separadores-con-iman-x3": 3000,
  "complementos-marco-con-iman": 5500,
  "laminas-a3-plus": 7000,
  "laminas-a3": 7000,
  "laminas-a4": 5000,
  "laminas-a5": 4000,
  "laminas-a6": 3000,
  // La lista por metro cuadrado y los productos nuevos de la lista del 05/11/2026.
  "gran-formato-vinilo-blanco": 33300,
  "gran-formato-vinilo-blanco-laca-sectorizada": 38300,
  "gran-formato-vinilo-blanco-laca-completa": 42200,
  "gran-formato-vinilo-transparente": 36700,
  "gran-formato-vinilo-transparente-laca-sectorizada": 40000,
  "gran-formato-vinilo-transparente-laca-completa": 43300,
  "gran-formato-lona-frontlight": 27000,
  "gran-formato-lona-frontlight-laca": 32400,
  "gran-formato-blueback": 20900,
  "gran-formato-blueback-laca": 25200,
  "dtf-textil": 22500,
  "archivo-bajonero": 13000,
  "minijuegos-naranja": 15000,
  "minijuegos-rosa": 15000,
  "minijuegos-celeste": 15000,
  "minijuegos-verde": 15000,
  "minijuegos-amarillo": 15000,
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

// Los colores de los calendarios y las hojas de las bitácoras no cambian el precio.
const calendarFormats: Record<string, number> = {
  "clasico-sin-notas": 40000,
  "clasico-con-notas": 40000,
  unico: 28000,
  "doce-meses": 26000,
  "semanal-grande": 26000,
  "semanal-chico": 21000,
  acrilico: 55000,
  iman: 20000,
};
for (const [format, price] of Object.entries(calendarFormats)) {
  for (const colors of ["pastel", "intenso", "calido", "frio", "monocromo"]) {
    expectedPrices[`calendarios-${format}-${colors}`] = price;
  }
}
for (const [format, price] of Object.entries({ "bitacora-a5": 7000, "bitacora-a6": 5000 })) {
  for (const sheets of ["lisas", "rayadas", "cuadriculadas", "punteadas"]) {
    expectedPrices[`bitacoras-${format}-${sheets}`] = price;
  }
}

const allCombinations = products.flatMap((item) => item.combinations);
const allAddOns = products.flatMap((item) => item.addOns);

describe("catálogo", () => {
  it("tiene los 13 productos con IDs únicos", () => {
    const ids = products.map((item) => item.id);
    expect(ids).toEqual([
      "calendarios",
      "fotos",
      "pizarra-orma",
      "entre-flores",
      "vinilos",
      "gran-formato",
      "dtf-textil",
      "tarjetas",
      "bitacoras",
      "archivo-bajonero",
      "complementos",
      "laminas",
      "minijuegos",
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
      calendarios: ["formato", "colores"],
      fotos: ["formato"],
      "pizarra-orma": ["color"],
      "entre-flores": [],
      vinilos: ["material", "laca"],
      "gran-formato": ["material"],
      "dtf-textil": [],
      tarjetas: ["cantidad", "faz", "terminacion"],
      bitacoras: ["formato", "hojas"],
      "archivo-bajonero": [],
      complementos: ["tipo"],
      laminas: ["tamano"],
      minijuegos: ["color"],
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
    expect(product("calendarios").combinations).toHaveLength(40);
    expect(product("vinilos").addOns.map((addOn) => [addOn.id, addOn.price, addOn.unit])).toEqual([
      ["vinilos-maqueta", 2500, "cada 5 diseños"],
      ["vinilos-corte-individual", 2500, "por pliego"],
    ]);
    expect(product("calendarios").addOns.map((addOn) => [addOn.id, addOn.price])).toEqual([
      ["calendarios-notas-con-iman", 3500],
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
      "Para tu emprendimiento",
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
      "complementos",
    ]);
  });

  it("Gran formato lleva las fotos de la vidriera y la pared", () => {
    expect(product("gran-formato").gallery.map((photo) => photo.src)).toEqual([
      "fotos/gran-formato-1.webp",
      "fotos/gran-formato-2.webp",
      "fotos/gran-formato-3.webp",
      "fotos/gran-formato-4.webp",
    ]);
  });
});

describe("buildProduct", () => {
  const file: ProductFile = {
    name: "Prueba",
    description: "Un producto de prueba",
    details: null,
    note: null,
    gallery: [{ src: "/fotos/prueba.webp", alt: null, contain: false }],
    groups: [
      {
        id: "tamano",
        label: "Tamaño",
        changesPrice: true,
        options: [
          { id: "chico", label: "Chico" },
          { id: "grande", label: "Grande" },
        ],
      },
      {
        id: "color",
        label: "Color",
        changesPrice: false,
        options: [
          { id: "rojo", label: "Rojo", src: "/fotos/prueba-rojo.webp", alt: "Prueba roja", contain: true },
          { id: "azul", label: "Azul", src: null, alt: null, contain: false },
        ],
      },
    ],
    prices: [
      { label: "Chico", price: 100, unit: "por unidad" },
      { label: "Grande", price: 200, unit: "por unidad" },
    ],
    addOns: [],
    intents: ["regalar"],
  };

  it("arma las combinaciones con el precio de los grupos que cambian el precio", () => {
    const built = buildProduct("prueba", file);
    expect(built.combinations.map(({ id, label, price }) => [id, label, price])).toEqual([
      ["prueba-chico-rojo", "Chico · Rojo", 100],
      ["prueba-chico-azul", "Chico · Azul", 100],
      ["prueba-grande-rojo", "Grande · Rojo", 200],
      ["prueba-grande-azul", "Grande · Azul", 200],
    ]);
    expect(built.groups.map((group) => group.free)).toEqual([undefined, true]);
  });

  it("los textos y fotos que el panel deja vacíos (null) no rompen nada", () => {
    const built = buildProduct("prueba", file);
    expect([built.details, built.note]).toEqual(["", ""]);
    // Sin barra al principio y, sin descripción, con el nombre del producto.
    expect(built.gallery).toEqual([{ src: "fotos/prueba.webp", alt: "Prueba", contain: false }]);
    const [rojo, azul] = built.groups[1].options;
    expect(rojo.photo).toEqual({ src: "fotos/prueba-rojo.webp", alt: "Prueba roja", contain: true });
    expect(azul.photo).toBeUndefined();
  });

  it("sin grupos busca la fila «Precio único» y usa los valores por defecto", () => {
    const single = { ...file, groups: null, prices: [{ label: "Precio único", price: 500, unit: "por unidad" }] };
    const built = buildProduct("prueba", single);
    expect(built.combinations).toEqual([{ id: "prueba", values: {}, label: "", price: 500, unit: "por unidad" }]);
    expect([built.personalizable, built.needsPhotos, isExample(built.leadTime), built.featured]).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it("sin adicionales (null), quedan en una lista vacía", () => {
    expect(buildProduct("prueba", { ...file, addOns: null }).addOns).toEqual([]);
  });

  it("un producto nuevo del panel sin códigos los arma con el nombre, sin repetir", () => {
    const built = buildProduct("prueba", {
      ...file,
      groups: [{ label: "Tamaño", options: [{ label: "A4 (21 × 29,7)" }, { label: "Más grande" }, { label: "más grande" }] }],
      prices: [
        { label: "A4 (21 × 29,7)", price: 100, unit: "por unidad" },
        { label: "Más grande", price: 200, unit: "por unidad" },
        { label: "más grande", price: 300, unit: "por unidad" },
      ],
      addOns: [{ label: "Caja de regalo", price: 900, unit: "por unidad" }],
    });
    expect(built.groups[0].id).toBe("tamano");
    expect(built.groups[0].options.map((option) => option.id)).toEqual(["a4-21-29-7", "mas-grande", "mas-grande-2"]);
    expect(built.combinations.map((combination) => [combination.id, combination.price])).toEqual([
      ["prueba-a4-21-29-7", 100],
      ["prueba-mas-grande", 200],
      ["prueba-mas-grande-2", 300],
    ]);
    expect(built.addOns.map((addOn) => addOn.id)).toEqual(["prueba-caja-de-regalo"]);
  });

  it("no usa las filas de precio que ya no son de ninguna combinación ni las intenciones que no existen", () => {
    const built = buildProduct("prueba", {
      ...file,
      prices: [...file.prices, { label: "Mediano", price: 150, unit: "por unidad" }],
      intents: ["regalar", "inventada", "regalar", "decorar"],
    });
    expect(built.combinations).toHaveLength(4);
    expect(built.intents).toEqual(["regalar", "decorar"]);
  });

  it("arma el texto del plazo con desde y hasta; incompleto o al revés queda el provisorio", () => {
    const leadTime = (value: ProductFile["leadTime"]) => buildProduct("prueba", { ...file, leadTime: value }).leadTime;
    expect(leadTime({ min: 2, max: 4, text: null })).toEqual({ min: 2, max: 4, text: "De 2 a 4 días hábiles" });
    expect(leadTime({ min: 1, max: 1, text: "" })).toEqual({ min: 1, max: 1, text: "1 día hábil" });
    expect(leadTime({ min: 3, max: 3 })).toEqual({ min: 3, max: 3, text: "3 días hábiles" });
    expect(leadTime({ min: 1, max: 4, text: "De 1 a 4 días" })).toEqual({ min: 1, max: 4, text: "De 1 a 4 días" });
    for (const pending of [null, { min: 5, max: 3 }, { min: 2, max: null }, { min: 0, max: 2 }]) {
      expect(isExample(leadTime(pending))).toBe(true);
    }
  });

  it("con cuántas fotos manda el cliente, pide fotos y da las instrucciones", () => {
    const built = buildProduct("prueba", { ...file, photoQuantity: " Una por copia. " });
    expect([built.needsPhotos, built.photoInstructions?.quantity]).toEqual([true, "Una por copia."]);
    expect(buildProduct("prueba", { ...file, photoQuantity: "  " }).needsPhotos).toBe(false);
  });

  it("avisa en castellano lo que frena el build", () => {
    expect(() => buildProduct("prueba", { ...file, prices: file.prices.slice(0, 1) })).toThrow(
      "Falta el precio de «Grande» en contenido/prueba.json",
    );
    expect(() => buildProduct("prueba", { ...file, gallery: [{ src: "" }] })).toThrow(
      "En contenido/prueba.json falta al menos una foto",
    );
    expect(() => buildProduct("prueba", { ...file, groups: [{ label: "Color", options: [] }] })).toThrow(
      "En contenido/prueba.json, «Color» no tiene ninguna opción",
    );
    expect(() => buildProduct("prueba", { ...file, name: " " })).toThrow("En contenido/prueba.json falta el nombre");
  });
});

describe("buildCatalog", () => {
  const single = (name: string, order?: number | null): ProductFile => ({
    name,
    description: "",
    gallery: [{ src: "/fotos/prueba.webp" }],
    prices: [{ label: "Precio único", price: 100, unit: "por unidad" }],
    order,
  });

  it("ordena por el lugar en el catálogo; sin número van al final y los empates, por nombre", () => {
    const built = buildCatalog({
      b: single("Bitácora", 2),
      sin: single("Agenda", null),
      c: single("Calendario", 1),
      a: single("Álbum", 2),
      otro: single("Zapato"),
    });
    expect(built.map((item) => item.id)).toEqual(["c", "a", "b", "sin", "otro"]);
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
