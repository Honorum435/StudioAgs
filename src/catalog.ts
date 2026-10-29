import { example, isExample, type BusinessField } from "./business";

// Módulo puro: lo importa vite.config.ts, así que nada de DOM ni import.meta.env.

export type IntentId = "regalar" | "marca" | "decorar" | "organizarte";

export interface Intent {
  id: IntentId;
  label: string;
}

export const intents: readonly Intent[] = [
  { id: "regalar", label: "Para regalar" },
  { id: "marca", label: "Para tu marca" },
  { id: "decorar", label: "Para decorar" },
  { id: "organizarte", label: "Para organizarte" },
];

export interface OptionValue {
  id: string;
  label: string;
}

export interface OptionGroup {
  id: string;
  label: string;
  options: readonly OptionValue[];
}

// Una opción elegida por grupo: id del grupo → id de la opción.
export type Selection = Readonly<Record<string, string>>;

export interface Combination {
  // Producto + valores elegidos, nunca un índice: no cambia si se reordena el catálogo.
  id: string;
  values: Selection;
  // Vacía cuando el producto no tiene grupos de opciones.
  label: string;
  price: number;
  unit: string;
}

export interface AddOn {
  id: string;
  label: string;
  price: number;
  unit: string;
}

export interface LeadTime {
  // Días hábiles.
  min: number;
  max: number;
  text: string;
}

export interface PhotoInstructions {
  quantity: string;
  quality: string;
  howToSend: string;
}

export interface ImageSpec {
  // Cada ancho se publica como /images/<base>-<ancho>.webp.
  base: string;
  widths: readonly number[];
  // Medidas del archivo más ancho.
  width: number;
  height: number;
}

export interface ProductImages {
  card: ImageSpec;
  ficha: ImageSpec;
  hero?: ImageSpec;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  imageAlt: string;
  note?: string;
  groups: readonly OptionGroup[];
  combinations: readonly Combination[];
  addOns: readonly AddOn[];
  personalizable: boolean;
  needsPhotos: boolean;
  intents: readonly IntentId[];
  // Los plazos sin confirmar van en example(...), como en src/business.ts.
  leadTime: BusinessField<LeadTime>;
  photoInstructions?: PhotoInstructions;
  images: ProductImages;
}

export interface ResolvedSelection {
  combination: Combination;
  unit: string;
  addOns: readonly AddOn[];
  total: number;
}

interface CombinationData {
  price: number;
  unit: string;
}

function combine(
  productId: string,
  groups: readonly OptionGroup[],
  describe: (picked: readonly OptionValue[]) => CombinationData,
): Combination[] {
  const paths = groups.reduce<OptionValue[][]>(
    (partial, group) => partial.flatMap((path) => group.options.map((option) => [...path, option])),
    [[]],
  );

  return paths.map((picked) => ({
    id: [productId, ...picked.map((option) => option.id)].join("-"),
    values: Object.fromEntries(groups.map((group, index) => [group.id, picked[index].id])),
    label: picked.map((option) => option.label).join(" · "),
    ...describe(picked),
  }));
}

interface PricedOption extends OptionValue {
  price: number;
  unit?: string;
}

function singleGroup(
  productId: string,
  group: Omit<OptionGroup, "options">,
  options: readonly PricedOption[],
  unit = "por unidad",
): Pick<CatalogProduct, "groups" | "combinations"> {
  const groups = [{ ...group, options: options.map(({ id, label }) => ({ id, label })) }];
  const priced = new Map(options.map((option) => [option.id, option]));
  const combinations = combine(productId, groups, ([option]) => {
    const { price, unit: optionUnit } = priced.get(option.id)!;
    return { price, unit: optionUnit ?? unit };
  });
  return { groups, combinations };
}

// Anchos y alto del archivo más ancho tal como los produce extraer-imagenes.py, que nunca
// amplía: si el recorte del PDF mide menos de 800 px, el archivo mayor tiene ese ancho.
function cardImage(base: string, widths: readonly number[], height: number): ImageSpec {
  return { base, widths, width: Math.max(...widths), height };
}

// Páginas del PDF de 613 × 860 pt, renderizadas a 300 dpi.
function fichaImage(productId: string): ImageSpec {
  return { base: `ficha-${productId}`, widths: [1200, 1800], width: 1800, height: 2523 };
}

function heroImage(productId: string, widths: readonly number[], height: number): ImageSpec {
  return { base: `hero-${productId}`, widths, width: Math.max(...widths), height };
}

export function imageUrl(spec: ImageSpec, width: number): string {
  return `/images/${spec.base}-${width}.webp`;
}

// Plazo provisorio para los productos que el catálogo no informa.
function pendingLeadTime(): BusinessField<LeadTime> {
  return example({ min: 3, max: 5, text: "De 3 a 5 días hábiles" });
}

const photoQuality =
  "Que sean las originales de la cámara o del celular: las capturas de pantalla y las fotos bajadas de redes salen pixeladas.";
const photoSending =
  "Mandalas por WhatsApp como documento (no como foto), así no pierden calidad, apenas nos mandes el pedido.";

const cardQuantity: OptionGroup = {
  id: "cantidad",
  label: "Cantidad",
  options: [
    { id: "100", label: "100" },
    { id: "200", label: "200" },
    { id: "300", label: "300" },
    { id: "500", label: "500" },
    { id: "1000", label: "1.000" },
  ],
};

const cardSides: OptionGroup = {
  id: "faz",
  label: "Impresión",
  options: [
    { id: "simple-faz", label: "Simple faz" },
    { id: "doble-faz", label: "Doble faz" },
  ],
};

const cardFinish: OptionGroup = {
  id: "terminacion",
  label: "Terminación",
  options: [
    { id: "sin-laminar", label: "Sin laminar" },
    { id: "laminado", label: "Laminado mate o brillo" },
  ],
};

// Por cantidad, en el orden del catálogo: simple faz sin laminar, simple faz laminado,
// doble faz sin laminar, doble faz laminado.
const cardPrices: Record<string, readonly number[]> = {
  "100": [13300, 16300, 16300, 19300],
  "200": [19300, 24500, 24500, 26300],
  "300": [23800, 30600, 30600, 37500],
  "500": [34000, 44500, 46000, 56000],
  "1000": [58800, 78100, 80600, 99000],
};

const cardGroups = [cardQuantity, cardSides, cardFinish];

const cardCombinations = combine("tarjetas", cardGroups, ([quantity, sides, finish]) => {
  const column =
    cardSides.options.indexOf(sides) * cardFinish.options.length + cardFinish.options.indexOf(finish);
  return { price: cardPrices[quantity.id][column], unit: `pack de ${quantity.label}` };
});

const vinylMaterial: OptionGroup = {
  id: "material",
  label: "Vinilo",
  options: [
    { id: "blanco", label: "Blanco" },
    { id: "transparente", label: "Transparente" },
  ],
};

const vinylLacquer: OptionGroup = {
  id: "laca",
  label: "Laca UV",
  options: [
    { id: "sin-laca", label: "Sin laca" },
    { id: "laca-sectorizada", label: "Laca sectorizada" },
    { id: "laca-completa", label: "Laca completa" },
  ],
};

// Por material: sin laca, laca sectorizada, laca completa.
const vinylPrices: Record<string, readonly number[]> = {
  blanco: [14500, 16600, 18800],
  transparente: [16200, 18600, 21000],
};

const vinylGroups = [vinylMaterial, vinylLacquer];

const vinylCombinations = combine("vinilos", vinylGroups, ([material, lacquer]) => ({
  price: vinylPrices[material.id][vinylLacquer.options.indexOf(lacquer)],
  unit: "por pliego",
}));

// Reparto inicial de intenciones y personalizables: revisar con la dueña.
export const products: readonly CatalogProduct[] = [
  {
    id: "calendarios",
    name: "Calendarios",
    description:
      "Formatos clásicos, semanales y magnéticos. Personalizalos con colores, logo o un diseño propio.",
    imageAlt: "Muestra de diseños y formatos de calendarios StudioAGS",
    ...singleGroup("calendarios", { id: "formato", label: "Formato" }, [
      { id: "clasico-sin-notas", label: "Clásico sin notas", price: 41500 },
      { id: "clasico-con-notas", label: "Clásico con notas", price: 41500 },
      { id: "unico", label: "Único", price: 28000 },
      { id: "doce-meses", label: "Doce meses", price: 26000 },
      { id: "semanal-grande", label: "Semanal grande", price: 26000 },
      { id: "semanal-chico", label: "Semanal chico", price: 21000 },
      { id: "acrilico", label: "Acrílico", price: 55000 },
      { id: "iman", label: "Imán", price: 23000 },
    ]),
    addOns: [{ id: "calendarios-notas-con-iman", label: "Notas con imán", price: 2500, unit: "por unidad" }],
    personalizable: true,
    needsPhotos: false,
    intents: ["organizarte", "regalar", "marca"],
    leadTime: pendingLeadTime(),
    images: { card: cardImage("calendarios", [400, 800], 600), ficha: fichaImage("calendarios") },
  },
  {
    id: "fotos",
    name: "Fotos para guardar",
    description:
      "Tus recuerdos en formatos Polaroid, tiras, fotos cuadradas o imanes para la heladera.",
    imageAlt: "Ejemplos de formatos para imprimir fotos",
    ...singleGroup("fotos", { id: "formato", label: "Formato" }, [
      { id: "polaroid", label: "Polaroid 8 × 6,5", price: 800 },
      { id: "tira", label: "Tira de fotos", price: 1500, unit: "por tira" },
      { id: "foto-10x10", label: "Foto 10 × 10", price: 1500 },
      { id: "iman-10x10", label: "Imán 10 × 10", price: 4000 },
      { id: "marco-con-iman", label: "Marco con imán", price: 5500 },
    ]),
    addOns: [],
    personalizable: true,
    needsPhotos: true,
    intents: ["regalar", "decorar"],
    leadTime: { min: 1, max: 3, text: "De 1 a 3 días hábiles" },
    photoInstructions: {
      quantity: "Una foto por cada copia que pidas; para cada tira, tres.",
      quality: photoQuality,
      howToSend: photoSending,
    },
    images: {
      card: cardImage("fotos", [400, 585], 439),
      ficha: fichaImage("fotos"),
      hero: heroImage("fotos", [400, 434], 542),
    },
  },
  {
    id: "pizarra-orma",
    name: "Pizarra OrMa",
    description:
      "Pizarra magnética de 50 × 50 cm con fotos, polaroids, tira de fotos y pinzas imantadas.",
    imageAlt: "Pizarra OrMa con fotos, notas y accesorios magnéticos",
    ...singleGroup("pizarra-orma", { id: "color", label: "Color" }, [
      { id: "gris-galvanizada", label: "Gris galvanizada", price: 50000 },
      { id: "negro-mate", label: "Negro mate", price: 60000 },
    ]),
    addOns: [],
    personalizable: true,
    needsPhotos: true,
    intents: ["decorar", "organizarte", "regalar"],
    leadTime: pendingLeadTime(),
    photoInstructions: {
      quantity:
        "Para los accesorios: 3 fotos para los imanes de 10 × 10, 3 para las polaroid mini y 9 para las 3 tiras triples.",
      quality: photoQuality,
      howToSend: photoSending,
    },
    images: { card: cardImage("pizarra-orma", [400, 617], 463), ficha: fichaImage("pizarra-orma") },
  },
  {
    id: "entre-flores",
    name: "Entre Flores",
    description:
      "Cuadro artesanal con flores de verbena reales, cultivadas y prensadas a mano. Se puede personalizar.",
    imageAlt: "Cuadro artesanal Entre Flores con flores prensadas",
    note: "Cada composición es única.",
    groups: [],
    combinations: combine("entre-flores", [], () => ({ price: 35000, unit: "por unidad" })),
    addOns: [],
    personalizable: true,
    needsPhotos: false,
    intents: ["regalar", "decorar"],
    leadTime: pendingLeadTime(),
    images: { card: cardImage("entre-flores", [400, 512], 384), ficha: fichaImage("entre-flores") },
  },
  {
    id: "vinilos",
    name: "Vinilos impresos",
    description:
      "Impresión UV en vinilo blanco o transparente, con distintas terminaciones de laca.",
    imageAlt: "Muestras de vinilos impresos y sus terminaciones",
    groups: vinylGroups,
    combinations: vinylCombinations,
    addOns: [
      { id: "vinilos-maqueta", label: "Maqueta", price: 2500, unit: "cada 5 diseños" },
      { id: "vinilos-corte-individual", label: "Corte individual", price: 2500, unit: "por pliego" },
    ],
    personalizable: true,
    needsPhotos: false,
    intents: ["marca", "decorar"],
    // El catálogo dice "de 1 a 4 días", sin aclarar si son hábiles.
    leadTime: { min: 1, max: 4, text: "De 1 a 4 días" },
    images: { card: cardImage("vinilos", [369], 277), ficha: fichaImage("vinilos") },
  },
  {
    id: "tarjetas",
    name: "Tarjetas personales",
    description:
      "Tarjetas en papel ilustración de 300 g. Elegí cantidad, impresión simple o doble faz y laminado.",
    imageAlt: "Tarjetas impresas con distintas terminaciones",
    groups: cardGroups,
    combinations: cardCombinations,
    addOns: [],
    personalizable: true,
    needsPhotos: false,
    intents: ["marca"],
    leadTime: pendingLeadTime(),
    images: { card: cardImage("tarjetas", [400, 679], 509), ficha: fichaImage("tarjetas") },
  },
  {
    id: "bitacoras",
    name: "Bitácoras y separadores",
    description: "Bitácoras A5 o A6 con 60 hojas, y separadores clásicos o imantados.",
    imageAlt: "Colección de diseños ilustrados para bitácoras",
    ...singleGroup("bitacoras", { id: "formato", label: "Formato" }, [
      { id: "bitacora-a5", label: "Bitácora A5", price: 7000 },
      { id: "bitacora-a6", label: "Bitácora A6", price: 5000 },
      { id: "separador", label: "Separador clásico", price: 1300 },
      { id: "separador-con-iman", label: "Separador con imán", price: 1500 },
    ]),
    addOns: [],
    personalizable: true,
    needsPhotos: false,
    intents: ["organizarte", "regalar"],
    leadTime: pendingLeadTime(),
    images: {
      card: cardImage("bitacoras", [400, 800], 600),
      ficha: fichaImage("bitacoras"),
      hero: heroImage("bitacoras", [400, 800], 1000),
    },
  },
  {
    id: "laminas",
    name: "Láminas",
    description:
      "Ilustraciones y gráficas de distintos artistas, en formatos para decorar tus espacios.",
    imageAlt: "Selección de ilustraciones y láminas decorativas",
    note: "Diseños y disponibilidad pueden variar.",
    ...singleGroup("laminas", { id: "tamano", label: "Tamaño" }, [
      { id: "a3-plus", label: "A3+ (SA3)", price: 7000 },
      { id: "a3", label: "A3", price: 7000 },
      { id: "a4", label: "A4", price: 5000 },
      { id: "a5", label: "A5", price: 4000 },
      { id: "a6", label: "A6", price: 3000 },
    ]),
    addOns: [],
    personalizable: false,
    needsPhotos: false,
    intents: ["decorar", "regalar"],
    leadTime: pendingLeadTime(),
    images: { card: cardImage("laminas", [400, 740], 555), ficha: fichaImage("laminas") },
  },
];

export function initialSelection(product: CatalogProduct): Selection {
  return Object.fromEntries(product.groups.map((group) => [group.id, group.options[0].id]));
}

export function resolveSelection(
  product: CatalogProduct,
  selection: Selection,
  addOnIds: readonly string[] = [],
): ResolvedSelection | null {
  const groupIds = new Set(product.groups.map((group) => group.id));
  if (Object.keys(selection).some((key) => !groupIds.has(key))) {
    return null;
  }

  const complete = product.groups.every((group) =>
    group.options.some((option) => option.id === selection[group.id]),
  );
  if (!complete) {
    return null;
  }

  const combination = product.combinations.find((item) =>
    product.groups.every((group) => item.values[group.id] === selection[group.id]),
  );
  if (!combination || addOnIds.some((id) => !product.addOns.some((addOn) => addOn.id === id))) {
    return null;
  }

  const addOns = product.addOns.filter((addOn) => addOnIds.includes(addOn.id));
  const total = addOns.reduce((sum, addOn) => sum + addOn.price, combination.price);
  return { combination, unit: combination.unit, addOns, total };
}

// Campos del catálogo que siguen con la marca de ejemplo, como "calendarios.leadTime".
export function listPendingCatalogFields(catalog: readonly CatalogProduct[]): string[] {
  return catalog.flatMap((product) =>
    Object.entries(product)
      .filter(([, value]) => isExample(value))
      .map(([field]) => `${product.id}.${field}`),
  );
}
