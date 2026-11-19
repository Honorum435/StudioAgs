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

// Lo que edita el panel: el producto entero está en contenido/<id>.json y el nombre del archivo es
// su id. El panel guarda null o "" en lo que se deja vacío: valen lo mismo. Lo que no se aclara:
// sin opciones, personalizable, plazo provisorio de 3 a 5 días hábiles y sin fotos del cliente.
export interface ProductFile {
  name: string;
  description: string;
  // Párrafos extra para la página del producto, separados por una línea en blanco.
  details?: string | null;
  note?: string | null;
  // La primera foto es la de la tarjeta.
  gallery: FilePhoto[];
  groups?: FileGroup[] | null;
  // Una fila por combinación de los grupos que cambian el precio ("Clásico · Pastel"), o una
  // "Precio único" si no hay ninguno. Las filas que no son de ninguna combinación no se usan. El
  // panel deja el precio en null mientras falta cargarlo (y no deja guardar así).
  prices: { label: string; price: number | null; unit: string }[];
  addOns?: FileAddOn[] | null;
  // Ids de intents; los que no existen no se usan.
  intents?: string[] | null;
  personalizable?: boolean | null;
  // Si el cliente tiene que mandar fotos: cuántas.
  photoQuantity?: string | null;
  // Sin desde y hasta, el provisorio. Sin texto, "De 3 a 5 días hábiles".
  leadTime?: { min?: number | null; max?: number | null; text?: string | null } | null;
  // Va en "Los más vendidos" del inicio.
  featured?: boolean | null;
  // Lugar en el catálogo: los números más chicos primero; sin número, al final.
  order?: number | null;
}

export interface FilePhoto {
  src: string | null;
  alt?: string | null;
  contain?: boolean | null;
}

// Los códigos (id) los pone el panel al guardar y no cambian aunque cambie el nombre: los pedidos
// guardados los usan. Si falta alguno, sale del nombre.
export interface FileOption extends Omit<FilePhoto, "src"> {
  id?: string | null;
  label: string;
  // La foto que aparece al elegir la opción: es opcional.
  src?: string | null;
}

export interface FileGroup {
  id?: string | null;
  label: string;
  // Sin aclarar, cambia el precio. Los que no (los colores de los calendarios) no van en la fila del precio.
  changesPrice?: boolean | null;
  options?: FileOption[] | null;
}

export interface FileAddOn {
  id?: string | null;
  label: string;
  price: number;
  unit: string;
}

// El producto armado, con sus combinaciones y precios.
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
  // Va en "Los más vendidos" del inicio.
  featured: boolean;
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

// "Laca sectorizada" → "laca-sectorizada": minúsculas, sin tildes y con guiones. El panel arma los
// códigos nuevos con la misma regla (public/admin/panel.js).
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// El código guardado o, si falta, el que sale del nombre; si se repite, con -2, -3…
function assignIds(items: readonly { id?: string | null; label: string }[], prefix: string, fallback: string): string[] {
  const used = new Set<string>();
  return items.map((item) => {
    const base = item.id?.trim() || `${prefix}${slugify(item.label) || fallback}`;
    let id = base;
    for (let n = 2; used.has(id); n++) {
      id = `${base}-${n}`;
    }
    used.add(id);
    return id;
  });
}

const intentIds = new Set<string>(intents.map((intent) => intent.id));

function isIntentId(id: string): id is IntentId {
  return intentIds.has(id);
}

// Todas las combinaciones posibles: una opción de cada grupo.
function pick(groups: readonly OptionGroup[]): OptionValue[][] {
  return groups.reduce<OptionValue[][]>(
    (paths, g) => paths.flatMap((path) => g.options.map((option) => [...path, option])),
    [[]],
  );
}

// El nombre de la fila de precio de una combinación: las opciones que cambian el precio, con " · ".
// El panel arma las filas con la misma regla.
export function priceRowLabel(groups: readonly Pick<OptionGroup, "free">[], picked: readonly Pick<OptionValue, "label">[]): string {
  return picked.filter((_, index) => !groups[index].free).map((option) => option.label).join(" · ") || "Precio único";
}

function leadTimeText(min: number, max: number): string {
  if (min === max) {
    return min === 1 ? "1 día hábil" : `${min} días hábiles`;
  }
  return `De ${min} a ${max} días hábiles`;
}

function readLeadTime(raw: ProductFile["leadTime"]): LeadTime | null {
  const { min, max } = raw ?? {};
  if (!Number.isInteger(min) || !Number.isInteger(max) || min! < 1 || max! < min!) {
    return null;
  }
  return { min: min!, max: max!, text: raw?.text?.trim() || leadTimeText(min!, max!) };
}

// Arma el producto de contenido/<id>.json. Lo que el panel no deja guardar (sin nombre, sin fotos,
// un grupo sin opciones o una combinación sin precio) frena el build con el archivo y el motivo.
export function buildProduct(id: string, file: ProductFile): CatalogProduct {
  const path = `contenido/${id}.json`;
  if (!file.name?.trim()) {
    throw new Error(`En ${path} falta el nombre`);
  }
  const gallery = (file.gallery ?? []).filter((photo) => photo.src);
  if (gallery.length === 0) {
    throw new Error(`En ${path} falta al menos una foto`);
  }
  // Las páginas usan <base href>: las rutas van sin la barra del principio. Una foto sin
  // descripción lleva el nombre del producto.
  const toPhoto = (photo: FilePhoto): Photo => ({
    src: (photo.src ?? "").replace(/^\//, ""),
    alt: photo.alt?.trim() || file.name,
    contain: photo.contain ?? false,
  });

  const fileGroups = file.groups ?? [];
  const groupIds = assignIds(fileGroups, "", "opciones");
  const groups: OptionGroup[] = fileGroups.map((g, index) => {
    const fileOptions = g.options ?? [];
    if (fileOptions.length === 0) {
      throw new Error(`En ${path}, «${g.label}» no tiene ninguna opción`);
    }
    const optionIds = assignIds(fileOptions, "", "opcion");
    return {
      id: groupIds[index],
      label: g.label,
      options: fileOptions.map((option, optionIndex) => ({
        id: optionIds[optionIndex],
        label: option.label,
        ...(option.src && { photo: toPhoto({ ...option, src: option.src }) }),
      })),
      ...(g.changesPrice === false && { free: true }),
    };
  });

  const labels = (options: OptionValue[]) => options.map((option) => option.label).join(" · ");
  const combinations = pick(groups).map((picked) => {
    const rowLabel = priceRowLabel(groups, picked);
    const row = file.prices.find((item) => item.label === rowLabel);
    if (!row || typeof row.price !== "number" || !Number.isInteger(row.price) || row.price <= 0 || !row.unit?.trim()) {
      throw new Error(`Falta el precio de «${rowLabel}» en ${path}`);
    }
    return {
      id: [id, ...picked.map((option) => option.id)].join("-"),
      values: Object.fromEntries(groups.map((g, index) => [g.id, picked[index].id])),
      label: labels(picked),
      price: row.price,
      unit: row.unit,
    };
  });

  const fileAddOns = file.addOns ?? [];
  const addOnIds = assignIds(fileAddOns, `${id}-`, "adicional");
  const addOns = fileAddOns.map(({ label, price, unit }, index) => ({ id: addOnIds[index], label, price, unit }));

  const photoQuantity = file.photoQuantity?.trim();
  return {
    id,
    name: file.name,
    description: file.description ?? "",
    details: file.details ?? "",
    note: file.note ?? "",
    gallery: gallery.map(toPhoto),
    groups,
    combinations,
    addOns,
    personalizable: file.personalizable ?? true,
    intents: [...new Set(file.intents ?? [])].filter(isIntentId),
    // Plazo provisorio para los productos que no lo tienen cargado.
    leadTime: readLeadTime(file.leadTime) ?? example({ min: 3, max: 5, text: "De 3 a 5 días hábiles" }),
    needsPhotos: Boolean(photoQuantity),
    ...(photoQuantity && {
      photoInstructions: { quantity: photoQuantity, quality: photoQuality, howToSend: photoSending },
    }),
    featured: file.featured ?? false,
  };
}

// Todos los productos de contenido/, por su lugar en el catálogo y, si empatan, por nombre.
export function buildCatalog(files: Readonly<Record<string, ProductFile>>): CatalogProduct[] {
  const position = (file: ProductFile) => (Number.isFinite(file.order) ? file.order! : Infinity);
  return Object.entries(files)
    .sort(([, a], [, b]) => position(a) - position(b) || a.name.localeCompare(b.name, "es"))
    .map(([id, file]) => buildProduct(id, file));
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
