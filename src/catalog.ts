import { example, isExample, type BusinessField } from "./business";
import content from "./contenido";

// Módulo puro: lo importa vite.config.ts, así que nada de DOM ni import.meta.env.

export type IntentId = "regalar" | "marca" | "decorar" | "organizarte";

export interface Intent {
  id: IntentId;
  label: string;
}

export const intents: readonly Intent[] = [
  { id: "regalar", label: "Para regalar" },
  { id: "marca", label: "Para tu emprendimiento" },
  { id: "decorar", label: "Para decorar" },
  { id: "organizarte", label: "Para organizarte" },
];

// Una foto de la galería o de una opción. Sin "contain", llena el cuadro; con "contain", se ve entera.
export interface Photo {
  src: string;
  alt: string;
  contain: boolean;
}

export interface OptionValue {
  id: string;
  label: string;
  // La foto que aparece al elegir la opción. Sin foto, queda la que se estaba viendo.
  photo?: Photo;
}

export interface OptionGroup {
  id: string;
  label: string;
  options: readonly OptionValue[];
  // Un grupo gratis no cambia el precio (los colores de los calendarios).
  free?: boolean;
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

// Lo que se edita desde el panel (contenido/<id>.json). El panel guarda null en los textos que se
// dejan vacíos: null y "" valen lo mismo.
export interface ProductContent {
  name: string;
  description: string;
  // Párrafos extra para la página del producto, separados por una línea en blanco.
  details: string | null;
  note: string | null;
  // La primera foto es la de la tarjeta.
  gallery: { src: string; alt: string | null; contain: boolean }[];
  // Una fila por combinación de los grupos con precio; "Precio único" si no hay ninguno.
  prices: { label: string; price: number; unit: string }[];
  addOns: AddOn[];
  // Una fila por opción de cada grupo, "<Grupo>: <Opción>"; src vacío si no tiene foto.
  optionPhotos: { option: string; src: string | null; alt: string | null; contain: boolean }[];
}

// Lo que queda en el código, en la lista de más abajo. Lo que no se aclara: sin opciones,
// personalizable, plazo provisorio de 3 a 5 días hábiles y sin fotos del cliente.
export interface ProductStructure {
  id: string;
  intents: IntentId[];
  groups?: OptionGroup[];
  personalizable?: boolean;
  // Solo los plazos que informa el catálogo.
  leadTime?: LeadTime;
  // Si el cliente tiene que mandar fotos: cuántas.
  photoQuantity?: string;
}

// El producto armado: la estructura más el contenido, con sus combinaciones y precios.
export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  details: string;
  note: string;
  gallery: Photo[];
  groups: OptionGroup[];
  combinations: Combination[];
  addOns: AddOn[];
  personalizable: boolean;
  intents: IntentId[];
  // Los plazos sin confirmar van en example(...), como en src/business.ts.
  leadTime: BusinessField<LeadTime>;
  needsPhotos: boolean;
  photoInstructions?: PhotoInstructions;
}

export interface ResolvedSelection {
  combination: Combination;
  addOns: readonly AddOn[];
  // Precio de la combinación más los adicionales elegidos.
  total: number;
}

// Ruta de la página del producto, relativa a la raíz del sitio como las imágenes.
export function productPath(product: Pick<CatalogProduct, "id">): string {
  return `producto/${product.id}/`;
}

const photoQuality =
  "Que sean las originales de la cámara o del celular: las capturas de pantalla y las fotos bajadas de redes salen pixeladas.";
export const photoSending =
  "Mandalas por WhatsApp como documento (no como foto), así no pierden calidad, apenas nos mandes el pedido.";

// Un grupo de opciones, cada una como [id, etiqueta]. Los ids no se cambian: los pedidos guardados los usan.
function group(id: string, label: string, options: [string, string][]): OptionGroup {
  return { id, label, options: options.map(([optionId, optionLabel]) => ({ id: optionId, label: optionLabel })) };
}

// Un grupo que no cambia el precio.
function freeGroup(id: string, label: string, options: [string, string][]): OptionGroup {
  return { ...group(id, label, options), free: true };
}

// Reparto inicial de intenciones y personalizables: revisar con la dueña.
const structures: ProductStructure[] = [
  {
    id: "calendarios",
    intents: ["organizarte", "regalar", "marca"],
    // Los colores los pidió la dueña: los monocromos son los de los emprendimientos y los personalizados.
    groups: [
      group("formato", "Formato", [
        ["clasico-sin-notas", "Clásico sin notas"],
        ["clasico-con-notas", "Clásico con notas"],
        ["unico", "Único"],
        ["doce-meses", "Doce meses"],
        ["semanal-grande", "Semanal grande"],
        ["semanal-chico", "Semanal chico"],
        ["acrilico", "Acrílico"],
        ["iman", "Imán"],
      ]),
      freeGroup("colores", "Colores", [
        ["pastel", "Pastel"],
        ["intenso", "Intenso"],
        ["calido", "Cálido"],
        ["frio", "Frío"],
        ["monocromo", "Monocromo"],
      ]),
    ],
  },
  {
    id: "fotos",
    intents: ["regalar", "decorar"],
    groups: [
      group("formato", "Formato", [
        ["polaroid", "Polaroid 8 × 6,5"],
        ["tira", "Tira de fotos"],
        ["foto-10x10", "Foto 10 × 10"],
        ["iman-10x10", "Imán 10 × 10"],
      ]),
    ],
    leadTime: { min: 1, max: 3, text: "De 1 a 3 días hábiles" },
    photoQuantity: "Una foto por cada copia que pidas; para cada tira, tres.",
  },
  {
    id: "pizarra-orma",
    intents: ["decorar", "organizarte", "regalar"],
    groups: [group("color", "Color", [["gris-galvanizada", "Gris galvanizada"], ["negro-mate", "Negro mate"]])],
    photoQuantity:
      "Para los accesorios: 3 fotos para los imanes de 10 × 10, 3 para las polaroid mini y 9 para las 3 tiras triples.",
  },
  { id: "entre-flores", intents: ["regalar", "decorar"] },
  {
    id: "vinilos",
    intents: ["marca", "decorar"],
    groups: [
      group("material", "Vinilo", [["blanco", "Blanco"], ["transparente", "Transparente"]]),
      group("laca", "Laca UV", [
        ["sin-laca", "Sin laca"],
        ["laca-sectorizada", "Laca sectorizada"],
        ["laca-completa", "Laca completa"],
      ]),
    ],
    // El catálogo dice "de 1 a 4 días", sin aclarar si son hábiles.
    leadTime: { min: 1, max: 4, text: "De 1 a 4 días" },
  },
  {
    id: "gran-formato",
    intents: ["marca", "decorar"],
    groups: [
      group("material", "Material", [
        ["vinilo-blanco", "Vinilo blanco"],
        ["vinilo-blanco-laca-sectorizada", "Vinilo blanco con laca sectorizada"],
        ["vinilo-blanco-laca-completa", "Vinilo blanco con laca completa"],
        ["vinilo-transparente", "Vinilo transparente"],
        ["vinilo-transparente-laca-sectorizada", "Vinilo transparente con laca sectorizada"],
        ["vinilo-transparente-laca-completa", "Vinilo transparente con laca completa"],
        ["lona-frontlight", "Lona frontlight 13 oz"],
        ["lona-frontlight-laca", "Lona frontlight 13 oz con laca"],
        ["blueback", "Blueback 150 g mate"],
        ["blueback-laca", "Blueback 150 g mate con laca"],
      ]),
    ],
  },
  { id: "dtf-textil", intents: ["marca", "regalar"] },
  {
    id: "tarjetas",
    intents: ["marca"],
    groups: [
      group("cantidad", "Cantidad", [["100", "100"], ["200", "200"], ["300", "300"], ["500", "500"], ["1000", "1.000"]]),
      group("faz", "Impresión", [["simple-faz", "Simple faz"], ["doble-faz", "Doble faz"]]),
      group("terminacion", "Terminación", [["sin-laminar", "Sin laminar"], ["laminado", "Laminado mate o brillo"]]),
    ],
  },
  {
    id: "bitacoras",
    intents: ["organizarte", "regalar"],
    groups: [
      group("formato", "Formato", [["bitacora-a5", "Bitácora A5"], ["bitacora-a6", "Bitácora A6"]]),
      freeGroup("hojas", "Hojas", [
        ["lisas", "Lisas"],
        ["rayadas", "Rayadas"],
        ["cuadriculadas", "Cuadriculadas"],
        ["punteadas", "Punteadas"],
      ]),
    ],
  },
  { id: "archivo-bajonero", intents: ["regalar"], personalizable: false },
  {
    id: "complementos",
    intents: ["regalar", "organizarte"],
    groups: [
      group("tipo", "Tipo", [
        ["separador", "Separador clásico"],
        ["separador-con-iman", "Separador con imán"],
        ["separadores-con-iman-x3", "3 separadores con imán"],
        ["marco-con-iman", "Marco con imán"],
      ]),
    ],
    photoQuantity: "Solo para los marcos: una foto por cada marco. Los separadores no llevan fotos.",
  },
  {
    id: "laminas",
    intents: ["decorar", "regalar"],
    groups: [group("tamano", "Tamaño", [["a3-plus", "A3+ (SA3)"], ["a3", "A3"], ["a4", "A4"], ["a5", "A5"], ["a6", "A6"]])],
    personalizable: false,
  },
  {
    id: "minijuegos",
    intents: ["regalar"],
    // Los colores que nombró la dueña (chat del 02/11/2026).
    groups: [
      freeGroup("color", "Color", [
        ["naranja", "Naranja"],
        ["rosa", "Rosa"],
        ["celeste", "Celeste"],
        ["verde", "Verde"],
        ["amarillo", "Amarillo"],
      ]),
    ],
    personalizable: false,
  },
];

// Todas las combinaciones posibles: una opción de cada grupo.
function pick(groups: readonly OptionGroup[]): OptionValue[][] {
  return groups.reduce<OptionValue[][]>(
    (paths, g) => paths.flatMap((path) => g.options.map((option) => [...path, option])),
    [[]],
  );
}

// Junta la estructura del código con lo que se edita en contenido/<id>.json.
export function buildProduct(structure: ProductStructure, content: ProductContent): CatalogProduct {
  const file = `contenido/${structure.id}.json`;
  // Las páginas usan <base href>: las rutas van sin la barra del principio. Una foto sin
  // descripción lleva el nombre del producto.
  const toPhoto = (photo: { src: string | null; alt: string | null; contain: boolean }): Photo => ({
    src: (photo.src ?? "").replace(/^\//, ""),
    alt: photo.alt || content.name,
    contain: photo.contain,
  });

  const rowName = (g: OptionGroup, option: OptionValue) => `${g.label}: ${option.label}`;
  const known = (structure.groups ?? []).flatMap((g) => g.options.map((option) => rowName(g, option)));
  const unknown = content.optionPhotos.find((row) => !known.includes(row.option));
  if (unknown) {
    throw new Error(`En ${file}, «${unknown.option}» no es una opción de ${structure.id}`);
  }
  const groups = (structure.groups ?? []).map((g) => ({
    ...g,
    options: g.options.map((option) => {
      const row = content.optionPhotos.find((item) => item.option === rowName(g, option));
      return row?.src ? { ...option, photo: toPhoto(row) } : option;
    }),
  }));

  const labels = (options: OptionValue[]) => options.map((option) => option.label).join(" · ");
  const combinations = pick(groups).map((picked) => {
    // El precio depende solo de los grupos que no son gratis.
    const priceLabel = labels(picked.filter((_, index) => !groups[index].free)) || "Precio único";
    const row = content.prices.find((item) => item.label === priceLabel);
    if (!row) {
      throw new Error(`Falta el precio de «${priceLabel}» en ${file}`);
    }
    return {
      id: [structure.id, ...picked.map((option) => option.id)].join("-"),
      values: Object.fromEntries(groups.map((g, index) => [g.id, picked[index].id])),
      label: labels(picked),
      price: row.price,
      unit: row.unit,
    };
  });

  const { photoQuantity } = structure;
  return {
    id: structure.id,
    name: content.name,
    description: content.description,
    details: content.details ?? "",
    note: content.note ?? "",
    gallery: content.gallery.map(toPhoto),
    groups,
    combinations,
    addOns: content.addOns,
    personalizable: structure.personalizable ?? true,
    intents: structure.intents,
    // Plazo provisorio para los productos que el catálogo no informa.
    leadTime: structure.leadTime ?? example({ min: 3, max: 5, text: "De 3 a 5 días hábiles" }),
    needsPhotos: Boolean(photoQuantity),
    ...(photoQuantity && {
      photoInstructions: { quantity: photoQuantity, quality: photoQuality, howToSend: photoSending },
    }),
  };
}

export function buildCatalog(content: Record<string, ProductContent>): CatalogProduct[] {
  return structures.map((structure) => {
    if (!content[structure.id]) {
      throw new Error(`Falta contenido/${structure.id}.json`);
    }
    return buildProduct(structure, content[structure.id]);
  });
}

export const products = buildCatalog(content);

// Las fotos de las opciones que no están en la galería, una vez cada una: la página del
// producto las tiene listas, ocultas, para pasarlas a la foto grande.
export function extraOptionPhotos(product: CatalogProduct): Photo[] {
  const seen = new Set(product.gallery.map((photo) => photo.src));
  const photos: Photo[] = [];
  for (const option of product.groups.flatMap((g) => g.options)) {
    if (option.photo && !seen.has(option.photo.src)) {
      seen.add(option.photo.src);
      photos.push(option.photo);
    }
  }
  return photos;
}

export function initialSelection(product: CatalogProduct): Selection {
  return Object.fromEntries(product.groups.map((group) => [group.id, group.options[0].id]));
}

// "Nombre (opción)" para el pedido, el mensaje y los avisos; sin opciones, solo el nombre.
export function lineName(product: Pick<CatalogProduct, "name">, combination: Pick<Combination, "label">): string {
  return combination.label ? `${product.name} (${combination.label})` : product.name;
}

// Los adicionales del producto con esos ids, una vez cada uno y en el orden del catálogo.
export function pickAddOns(product: CatalogProduct, ids: readonly string[]): AddOn[] {
  return product.addOns.filter((addOn) => ids.includes(addOn.id));
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

  // Los valores de cada combinación son opciones de su grupo: si falta un grupo o la opción no
  // existe, ninguna coincide.
  const combination = product.combinations.find((item) =>
    product.groups.every((group) => item.values[group.id] === selection[group.id]),
  );
  if (!combination || addOnIds.some((id) => !product.addOns.some((addOn) => addOn.id === id))) {
    return null;
  }

  const addOns = pickAddOns(product, addOnIds);
  const total = addOns.reduce((sum, addOn) => sum + addOn.price, combination.price);
  return { combination, addOns, total };
}

// Campos del catálogo que siguen con la marca de ejemplo, como "calendarios.leadTime".
export function listPendingCatalogFields(catalog: readonly CatalogProduct[]): string[] {
  return catalog.flatMap((product) =>
    Object.entries(product)
      .filter(([, value]) => isExample(value))
      .map(([field]) => `${product.id}.${field}`),
  );
}
