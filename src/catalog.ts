import { example, isExample, type BusinessField } from "./business";

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

export interface OptionValue {
  id: string;
  label: string;
  // La foto que aparece al elegir la opción, como pidió la dueña ("minijuegos rosa, la imagen
  // cambia a rosa"). Sin foto, queda la que se estaba viendo.
  photo?: GalleryPhoto;
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
  // La página del catálogo en PDF; los productos que no estaban en el catálogo no la tienen.
  ficha?: ImageSpec;
}

// Una foto de la galería de la página del producto.
export interface GalleryPhoto {
  image: ImageSpec;
  alt: string;
  // La página del catálogo se muestra entera; las fotos llenan el cuadro.
  fit?: "contain";
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
  // Fotos reales para la página del producto; sin ellas, la galería usa la foto y la ficha.
  gallery?: readonly GalleryPhoto[];
  // Párrafos extra para la página del producto.
  details?: readonly string[];
}

export interface ResolvedSelection {
  combination: Combination;
  addOns: readonly AddOn[];
  // Precio de la combinación más los adicionales elegidos.
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
  return pricedByFirstGroup(productId, group, options, [], unit);
}

// Un grupo con precio y otros que no lo cambian, como los colores de los calendarios: cada
// combinación cuesta lo que la opción elegida del primero.
function pricedByFirstGroup(
  productId: string,
  group: Omit<OptionGroup, "options">,
  options: readonly PricedOption[],
  free: readonly OptionGroup[],
  unit = "por unidad",
): Pick<CatalogProduct, "groups" | "combinations"> {
  const groups = [{ ...group, options: options.map(({ id, label, photo }) => (photo ? { id, label, photo } : { id, label })) }, ...free];
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

// Fotos del álbum de la dueña y de las que mandó por WhatsApp, cuadradas como las produce
// fotos-album.py: a 1200 y 600 px, o a la medida del cuadrado si es más chico (las de WhatsApp
// miden 960).
function albumPhoto(productId: string, number: number, alt: string, size = 1200): GalleryPhoto {
  return { image: cardImage(`foto-${productId}-${number}`, [600, size], size), alt };
}

// Una foto que la dueña pidió sin recortar: se ve entera dentro del cuadro de la galería.
function uncroppedPhoto(productId: string, number: number, alt: string, width: number, height: number): GalleryPhoto {
  return { image: cardImage(`foto-${productId}-${number}`, [600, width], height), alt, fit: "contain" };
}

// Un dibujo del catálogo en PDF para una opción (las medidas de Fotos, las lacas de Vinilos),
// como lo produce extraer-imagenes.py: a 400 px y a su ancho, entero dentro del cuadro.
function pdfDrawing(base: string, widths: readonly number[], height: number, alt: string): GalleryPhoto {
  return { image: cardImage(base, widths, height), alt, fit: "contain" };
}

export function imageUrl(spec: ImageSpec, width: number): string {
  return `images/${spec.base}-${width}.webp`;
}

export function imageSrcset(spec: ImageSpec): string {
  return spec.widths.map((width) => `${imageUrl(spec, width)} ${width}w`).join(", ");
}

// Ruta de la página del producto, relativa a la raíz del sitio como las imágenes.
export function productPath(product: Pick<CatalogProduct, "id">): string {
  return `producto/${product.id}/`;
}

// Las fotos reales primero; después la de la tarjeta, si no es una de ellas, y la página del
// catálogo, si la tiene.
export function galleryPhotos(product: CatalogProduct): GalleryPhoto[] {
  const gallery = product.gallery ?? [];
  const { card, ficha } = product.images;
  return [
    ...gallery,
    ...(gallery.some((photo) => photo.image.base === card.base) ? [] : [{ image: card, alt: product.imageAlt }]),
    ...(ficha ? [{ image: ficha, alt: `Página del catálogo de ${product.name}`, fit: "contain" as const }] : []),
  ];
}

// Las fotos de las opciones que no están en la galería, una vez cada una: la página del
// producto las tiene listas, ocultas, para pasarlas a la foto grande.
export function optionPhotos(product: CatalogProduct): GalleryPhoto[] {
  const seen = new Set(galleryPhotos(product).map((photo) => photo.image.base));
  const photos: GalleryPhoto[] = [];
  for (const option of product.groups.flatMap((group) => group.options)) {
    if (option.photo && !seen.has(option.photo.image.base)) {
      seen.add(option.photo.image.base);
      photos.push(option.photo);
    }
  }
  return photos;
}

// Todas las fotos del producto: la galería y después las de las opciones.
export function productPhotos(product: CatalogProduct): GalleryPhoto[] {
  return [...galleryPhotos(product), ...optionPhotos(product)];
}

// Plazo provisorio para los productos que el catálogo no informa.
function pendingLeadTime(): BusinessField<LeadTime> {
  return example({ min: 3, max: 5, text: "De 3 a 5 días hábiles" });
}

const photoQuality =
  "Que sean las originales de la cámara o del celular: las capturas de pantalla y las fotos bajadas de redes salen pixeladas.";
export const photoSending =
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

const vinylStickers = albumPhoto("vinilos", 1, "Planchas de stickers redondos con el logo de Maika", 960);

const vinylMaterial: OptionGroup = {
  id: "material",
  label: "Vinilo",
  options: [
    { id: "blanco", label: "Blanco", photo: vinylStickers },
    {
      id: "transparente",
      label: "Transparente",
      photo: pdfDrawing("opcion-vinilos-transparente", [400, 692], 409, "Dibujo del vinilo transparente: el logo deja ver lo que hay detrás"),
    },
  ],
};

const vinylLacquer: OptionGroup = {
  id: "laca",
  label: "Laca UV",
  options: [
    { id: "sin-laca", label: "Sin laca", photo: pdfDrawing("opcion-vinilos-sin-laca", [394], 458, "Dibujo de un sticker sin laca") },
    {
      id: "laca-sectorizada",
      label: "Laca sectorizada",
      photo: pdfDrawing("opcion-vinilos-laca-sectorizada", [400, 436], 468, "Dibujo de la laca sectorizada: solo sobre una parte del diseño"),
    },
    {
      id: "laca-completa",
      label: "Laca completa",
      photo: pdfDrawing("opcion-vinilos-laca-completa", [400, 518], 420, "Dibujo de la laca completa: sobre todo el diseño"),
    },
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

const boardPhotos = [
  uncroppedPhoto("pizarra-orma", 2, "Pizarra OrMa gris con marco de madera, fotos, polaroids y una gorra colgada", 959, 1278),
  albumPhoto("pizarra-orma", 1, "Pizarra OrMa negra con imanes, fotos, notas y fibrones"),
];

const extrasPhotos = [
  albumPhoto("complementos", 1, "Separadores imantados con flores y moños, en sus tarjetas de colores", 960),
  albumPhoto("complementos", 2, "Separadores imantados con flores, cuadros y figuras en blanco y negro", 960),
  albumPhoto("complementos", 3, "Marco con imán en la heladera, con la foto de un perro"),
  // Los marcos que mandó la dueña el 05/11/2026.
  uncroppedPhoto("complementos", 4, "Marcos con imán para polaroid: rojo, amarillo con limones, cuadrillé verde y rosa con flores", 1200, 588),
  uncroppedPhoto("complementos", 5, "Marcos con imán para fotos cuadradas: lila, blanco con dibujos, blanco y negro, y verde", 1200, 600),
  uncroppedPhoto("complementos", 6, "Marcos con imán para tiras de fotos: bordó con flores, lila, blanco y negro, y dorado", 1200, 771),
];

// Las bitácoras A5 en stock que mandó la dueña el 05/11/2026.
const notebookStock = [
  uncroppedPhoto("bitacoras", 2, "Bitácoras A5 en stock: celestes y crema con el sol de la bandera, y tapas de dibujos en blanco y negro", 1080, 1280),
  uncroppedPhoto("bitacoras", 3, "Más bitácoras A5 en stock con el sol de la bandera, flores, rayos y cuadrillé verde", 1080, 1280),
  uncroppedPhoto("bitacoras", 4, "Tapas A5 en stock: ajíes, arándanos, patitos, perros salchicha, sardinas y formas lilas", 1200, 414),
  uncroppedPhoto("bitacoras", 5, "Bitácoras A5 anilladas: formas bordó, una chica con flores, limones y un gato en la bañera", 1104, 456),
];

// El Archivo bajonero: la tapa y la página del top, las dos que eligió la dueña (05/11/2026).
const bajoneroCover = uncroppedPhoto("archivo-bajonero", 1, "Tapa azul del Archivo bajonero, con un alfajor desarmado en capas", 912, 1504);
const bajoneroTop: GalleryPhoto = {
  image: cardImage("foto-archivo-bajonero-2", [558], 848),
  alt: "Página del top del Archivo bajonero, con 34 puestos para anotar los mejores alfajores",
  fit: "contain",
};

// Los colores que nombró la dueña (chat del 02/11/2026). No cambian el precio.
const minigamePhotos = [
  albumPhoto("minijuegos", 1, "Minijuegos anillados en naranja, rosa, celeste y verde", 1086),
  albumPhoto("minijuegos", 2, "Minijuegos de todos los colores abiertos en abanico, el celeste adelante, en la mano"),
  albumPhoto("minijuegos", 3, "Una búsqueda de objetos a medio jugar, con el fibrón, sobre las piedras"),
  albumPhoto("minijuegos", 4, "Minijuego naranja con la tapa Mini juegos para el viaje, sobre las piedras"),
];

// Del amarillo todavía no hay foto.
const minigameColors: OptionGroup = {
  id: "color",
  label: "Color",
  options: [
    { id: "naranja", label: "Naranja", photo: minigamePhotos[3] },
    { id: "rosa", label: "Rosa", photo: albumPhoto("minijuegos", 5, "Minijuego rosa con sus dos fibrones, en la mano") },
    { id: "celeste", label: "Celeste", photo: minigamePhotos[1] },
    { id: "verde", label: "Verde", photo: albumPhoto("minijuegos", 6, "Minijuego verde con la tapa Mini juegos para el viaje", 706) },
    { id: "amarillo", label: "Amarillo" },
  ],
};

// Reparto inicial de intenciones y personalizables: revisar con la dueña. Los precios son los de
// la lista que mandó la dueña el 05/11/2026; las promos del cartel de la feria no están en ella.
export const products: readonly CatalogProduct[] = [
  {
    id: "calendarios",
    name: "Calendarios",
    description:
      "Formatos clásicos, semanales y magnéticos. Personalizalos con colores, logo o un diseño propio.",
    imageAlt: "Muestra de diseños y formatos de calendarios StudioAGS",
    // Los colores los pidió la dueña: los monocromos son los de los emprendimientos y los
    // personalizados. No cambian el precio.
    ...pricedByFirstGroup(
      "calendarios",
      { id: "formato", label: "Formato" },
      [
        {
          id: "clasico-sin-notas",
          label: "Clásico sin notas",
          price: 40000,
          photo: albumPhoto("calendarios", 5, "Calendario clásico rojo de julio, con la grilla del mes"),
        },
        {
          id: "clasico-con-notas",
          label: "Clásico con notas",
          price: 40000,
          photo: albumPhoto("calendarios", 6, "Calendario clásico rosa de diciembre, todo escrito, con las notas abajo"),
        },
        { id: "unico", label: "Único", price: 28000, photo: albumPhoto("calendarios", 7, "Calendario único rosa sobre la mesa, con un fibrón") },
        {
          id: "doce-meses",
          label: "Doce meses",
          price: 26000,
          photo: pdfDrawing("opcion-calendarios-doce-meses", [400, 553], 894, "Dibujo del calendario de doce meses: el año entero en una hoja"),
        },
        {
          id: "semanal-grande",
          label: "Semanal grande",
          price: 26000,
          photo: albumPhoto("calendarios", 8, "Calendario semanal grande rojo, con fibrones y un borrador"),
        },
        { id: "semanal-chico", label: "Semanal chico", price: 21000, photo: albumPhoto("calendarios", 9, "Calendario semanal chico rojo, con fibrones") },
        { id: "acrilico", label: "Acrílico", price: 55000, photo: albumPhoto("calendarios", 10, "Calendario de acrílico de septiembre, apoyado en la pared") },
        { id: "iman", label: "Imán", price: 20000, photo: albumPhoto("calendarios", 11, "Calendario de imán lila en la heladera, con fibrones") },
      ],
      [
        {
          id: "colores",
          label: "Colores",
          // Los abanicos son calendarios impresos; la de pastel, una de las capturas de la dueña.
          options: [
            { id: "pastel", label: "Pastel", photo: uncroppedPhoto("calendarios", 16, "Los doce meses en colores pastel", 1200, 461) },
            { id: "intenso", label: "Intenso", photo: albumPhoto("calendarios", 13, "Calendarios en colores intensos, abiertos en abanico") },
            { id: "calido", label: "Cálido", photo: albumPhoto("calendarios", 12, "Calendarios en colores cálidos, abiertos en abanico") },
            { id: "frio", label: "Frío", photo: albumPhoto("calendarios", 14, "Calendarios en colores fríos, abiertos en abanico") },
            { id: "monocromo", label: "Monocromo", photo: albumPhoto("calendarios", 15, "Calendarios monocromos en gris, negro y lila") },
          ],
        },
      ],
    ),
    note: "Monocromo: un solo color, para tu emprendimiento o un diseño propio. En el Único, que es una lámina, el color lo elegís por WhatsApp.",
    addOns: [{ id: "calendarios-notas-con-iman", label: "Notas con imán", price: 3500, unit: "por unidad" }],
    personalizable: true,
    needsPhotos: false,
    intents: ["organizarte", "regalar", "marca"],
    leadTime: pendingLeadTime(),
    images: { card: cardImage("calendarios", [400, 800], 600), ficha: fichaImage("calendarios") },
    gallery: [
      albumPhoto("calendarios", 1, "Calendarios de todos los colores, uno encima del otro"),
      albumPhoto("calendarios", 2, "Calendarios semanales rojos con fibrones para escribir"),
      albumPhoto("calendarios", 3, "Calendario de cumpleaños personalizado para La Carmela, con caballos", 960),
      albumPhoto("calendarios", 4, "Calendario 2027 personalizado con la foto de dos gatos, Minga y Pipi", 1075),
    ],
  },
  {
    id: "fotos",
    name: "Fotos para guardar",
    description:
      "Tus recuerdos en formatos Polaroid, tiras, fotos cuadradas o imanes para la heladera.",
    imageAlt: "Ejemplos de formatos para imprimir fotos",
    // Las fotos de las opciones son las medidas del catálogo en PDF y los imanes en la heladera.
    ...singleGroup("fotos", { id: "formato", label: "Formato" }, [
      {
        id: "polaroid",
        label: "Polaroid 8 × 6,5",
        price: 500,
        photo: pdfDrawing("opcion-fotos-polaroid", [400, 606], 691, "Medidas de la polaroid: 8 × 10 cm, con la foto de 6,6 × 6,6 cm"),
      },
      {
        id: "tira",
        label: "Tira de fotos",
        price: 1500,
        unit: "por tira",
        photo: pdfDrawing("opcion-fotos-tira", [400, 542], 1020, "Medidas de la tira: 6 × 17 cm, con tres fotos de 5 × 5 cm"),
      },
      {
        id: "foto-10x10",
        label: "Foto 10 × 10",
        price: 1500,
        photo: pdfDrawing("opcion-fotos-10x10", [400, 672], 651, "Medidas de la foto de 10 × 10 cm"),
      },
      { id: "iman-10x10", label: "Imán 10 × 10", price: 4000, photo: albumPhoto("fotos", 1, "Imanes con fotos en la heladera, uno con forma de corazón") },
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
    },
  },
  {
    id: "pizarra-orma",
    name: "Pizarra OrMa",
    description:
      "Pizarra magnética de 50 × 50 cm con fotos, polaroids, tira de fotos y pinzas imantadas.",
    imageAlt: "Pizarra OrMa con fotos, notas y accesorios magnéticos",
    ...singleGroup("pizarra-orma", { id: "color", label: "Color" }, [
      { id: "gris-galvanizada", label: "Gris galvanizada", price: 35000, photo: boardPhotos[0] },
      { id: "negro-mate", label: "Negro mate", price: 40000, photo: boardPhotos[1] },
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
    gallery: boardPhotos,
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
    gallery: [vinylStickers],
  },
  // La lista por metro cuadrado de la dueña (05/11/2026). Todavía no hay fotos: la tarjeta lleva
  // la imagen provisoria de fotos-album.py. El vinilo de corte no tiene precio en la lista.
  {
    id: "gran-formato",
    name: "Gran formato",
    description: "Vinilo, lona frontlight y blueback por metro cuadrado, para carteles, banners y vidrieras.",
    imageAlt: "Logo de StudioAGS en verde sobre amarillo, mientras llegan las fotos de Gran formato",
    note: "El vinilo de corte, para vidrieras y stickers, se cotiza aparte: consultanos.",
    ...singleGroup(
      "gran-formato",
      { id: "material", label: "Material" },
      [
        { id: "vinilo-blanco", label: "Vinilo blanco", price: 33300 },
        { id: "vinilo-blanco-laca-sectorizada", label: "Vinilo blanco con laca sectorizada", price: 38300 },
        { id: "vinilo-blanco-laca-completa", label: "Vinilo blanco con laca completa", price: 42200 },
        { id: "vinilo-transparente", label: "Vinilo transparente", price: 36700 },
        { id: "vinilo-transparente-laca-sectorizada", label: "Vinilo transparente con laca sectorizada", price: 40000 },
        { id: "vinilo-transparente-laca-completa", label: "Vinilo transparente con laca completa", price: 43300 },
        { id: "lona-frontlight", label: "Lona frontlight 13 oz", price: 27000 },
        { id: "lona-frontlight-laca", label: "Lona frontlight 13 oz con laca", price: 32400 },
        { id: "blueback", label: "Blueback 150 g mate", price: 20900 },
        { id: "blueback-laca", label: "Blueback 150 g mate con laca", price: 25200 },
      ],
      "por m²",
    ),
    addOns: [],
    personalizable: true,
    needsPhotos: false,
    intents: ["marca", "decorar"],
    leadTime: pendingLeadTime(),
    images: { card: cardImage("gran-formato", [400, 800], 800) },
  },
  // Las fotos son la remera de StudioAGS y dos cuadros de los videos de las remeras que mandó la
  // dueña (02/11/2026). El precio, de la lista por metro cuadrado.
  {
    id: "dtf-textil",
    name: "DTF textil",
    description: "Estampado DTF para remeras o cualquier tela, con tu logo o tu diseño.",
    imageAlt: "Remera negra con el logo de StudioAGS estampado en blanco",
    note: "El precio es por metro cuadrado de estampado.",
    groups: [],
    combinations: combine("dtf-textil", [], () => ({ price: 22500, unit: "por m²" })),
    addOns: [],
    personalizable: true,
    needsPhotos: false,
    intents: ["marca", "regalar"],
    leadTime: pendingLeadTime(),
    images: { card: albumPhoto("dtf-textil", 1, "").image },
    gallery: [
      albumPhoto("dtf-textil", 1, "Remera negra con el logo de StudioAGS estampado en blanco, con un mate en la mano"),
      albumPhoto("dtf-textil", 2, "Remera negra en una percha con el estampado Campeón mundial", 720),
      albumPhoto("dtf-textil", 3, "De cerca, el estampado Campeón mundial en blanco sobre la tela negra", 720),
    ],
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
    gallery: [
      albumPhoto("tarjetas", 1, "Gift cards, tarjetas de agradecimiento y tarjetas personales hechas para Maika", 960),
      albumPhoto("tarjetas", 2, "Tarjetas personales de StudioAGS en rosa, amarillo, azul y verde, con las caritas de la marca", 960),
      albumPhoto("tarjetas", 3, "Tarjetas personales de Aura artesanal, velas y resina", 960),
      albumPhoto("tarjetas", 4, "Tarjetas rosas de Las Reinas, artesanías para el hogar", 960),
      albumPhoto("tarjetas", 5, "Tarjetas de Luz Sosa con la foto de dos manos tomadas", 960),
    ],
  },
  {
    id: "bitacoras",
    name: "Bitácoras",
    description: "Bitácoras anilladas A5 o A6, con 60 hojas de opalina de 120 g y tapas ilustradas.",
    imageAlt: "Bitácoras anilladas con tapas ilustradas de limones, cuadros, fantasmas y naranjas",
    ...pricedByFirstGroup(
      "bitacoras",
      { id: "formato", label: "Formato" },
      [
        { id: "bitacora-a5", label: "Bitácora A5", price: 7000, photo: notebookStock[0] },
        { id: "bitacora-a6", label: "Bitácora A6", price: 5000 },
      ],
      [
        {
          id: "hojas",
          label: "Hojas",
          options: [
            { id: "lisas", label: "Lisas" },
            { id: "rayadas", label: "Rayadas" },
            { id: "cuadriculadas", label: "Cuadriculadas" },
            { id: "punteadas", label: "Punteadas" },
          ],
        },
      ],
    ),
    addOns: [],
    personalizable: true,
    needsPhotos: false,
    intents: ["organizarte", "regalar"],
    leadTime: pendingLeadTime(),
    // La foto principal es la que eligió la dueña.
    images: {
      card: albumPhoto("bitacoras", 1, "", 896).image,
      ficha: fichaImage("bitacoras"),
    },
    gallery: [albumPhoto("bitacoras", 1, "Bitácoras anilladas con tapas ilustradas de limones, cuadros, fantasmas y naranjas", 896), ...notebookStock],
    // El texto de la dueña (chat del 02/11/2026), con el vos de la página.
    details: [
      "Nuestras bitácoras tienen 60 hojas de opalina de 120 g, ideales para escritura, dibujo e ilustración. Su papel permite trabajar con distintos materiales, incluidos marcadores y pinturas a base de alcohol. Van anilladas con espiral blanco, negro o transparente.",
      "Consultá la disponibilidad de diseños, tamaños (A5 y A6) y stock al momento de hacer tu pedido.",
      "También hacemos tapas completamente personalizadas con nombres, ilustraciones, logos o diseños exclusivos. Para coordinar este tipo de trabajo y pedir un presupuesto, escribinos por Instagram o WhatsApp.",
    ],
  },
  // De la lista de la dueña (05/11/2026), en "encuadernados". El texto sale de lo que dicen sus
  // páginas en las fotos: es una colaboración con Paraná Bajoneros.
  {
    id: "archivo-bajonero",
    name: "Archivo bajonero + alfajor",
    description: "Un cuadernillo para registrar cada alfajor que probás: marca, sabor, puntaje y tu top. Viene con un alfajor.",
    imageAlt: "Tapa azul del Archivo bajonero, con un alfajor desarmado en capas",
    groups: [],
    combinations: combine("archivo-bajonero", [], () => ({ price: 13000, unit: "por unidad" })),
    addOns: [],
    personalizable: false,
    needsPhotos: false,
    intents: ["regalar"],
    leadTime: pendingLeadTime(),
    images: { card: bajoneroCover.image },
    gallery: [bajoneroCover, bajoneroTop],
    details: [
      "En cada página anotás un bajón: marca, sabor, precio y fecha, guardás un pedacito del envoltorio y le ponés puntaje a las tapitas, el relleno y la cobertura. Al final armás tu top 34 y, si querés, lo compartís en Instagram.",
      "Trae también una breve historia del alfajor. Es una colaboración entre Paraná Bajoneros y StudioAGS.",
    ],
  },
  // Lo que se suma a otra cosa: los separadores, que antes iban con las bitácoras, y los marcos
  // con imán, que iban con las fotos. Los precios son los del catálogo y los del cartel de la feria.
  {
    id: "complementos",
    name: "Complementos",
    description: "Separadores imantados para tus libros y bitácoras, y marcos con imán para tus fotos.",
    imageAlt: "Separadores imantados con flores y moños, en sus tarjetas de colores",
    // Del separador clásico todavía no hay foto.
    ...singleGroup("complementos", { id: "tipo", label: "Tipo" }, [
      { id: "separador", label: "Separador clásico", price: 1300 },
      { id: "separador-con-iman", label: "Separador con imán", price: 1500, photo: extrasPhotos[0] },
      { id: "separadores-con-iman-x3", label: "3 separadores con imán", price: 3000, photo: extrasPhotos[1] },
      { id: "marco-con-iman", label: "Marco con imán", price: 5500, photo: extrasPhotos[3] },
    ]),
    addOns: [],
    personalizable: true,
    needsPhotos: true,
    intents: ["regalar", "organizarte"],
    leadTime: pendingLeadTime(),
    photoInstructions: {
      quantity: "Solo para los marcos: una foto por cada marco. Los separadores no llevan fotos.",
      quality: photoQuality,
      howToSend: photoSending,
    },
    images: { card: albumPhoto("complementos", 1, "", 960).image },
    gallery: extrasPhotos,
    // El texto de la dueña (chat del 02/11/2026), con el vos de la página. La promo de 3 por
    // $3.000 es la del cartel de la feria, que está junto a los separadores con imán.
    details: [
      "Marcá tus lecturas con separadores ideales para acompañarte en cada libro. Prácticos y lindos, te ayudan a retomar justo donde quedaste sin doblar las páginas. Elegí tus favoritos y dale un toque especial a tus momentos de lectura.",
      "¡Llevá 3 separadores con imán por solo $3.000!",
    ],
  },
  {
    id: "laminas",
    name: "Láminas",
    description:
      "Ilustraciones y gráficas de distintos artistas, en formatos para decorar tus espacios.",
    imageAlt: "Selección de ilustraciones y láminas decorativas",
    note: "Diseños y disponibilidad pueden variar. Encuadrado a medida, por encargue.",
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
    gallery: [albumPhoto("laminas", 1, "Láminas e ilustraciones de distintos artistas en un exhibidor", 960)],
  },
  // El texto y los colores de la dueña (chat del 02/11/2026), con el vos de la página; el precio,
  // de la lista del 05/11/2026 ("lúdico"). "Mini juegos para el viaje" es lo que dice la tapa.
  {
    id: "minijuegos",
    name: "Minijuegos",
    description: "Mini juegos para el viaje: más de 15 juegos reutilizables y 2 fibrones con borrador.",
    imageAlt: "Minijuegos anillados en naranja, rosa, celeste y verde",
    groups: [minigameColors],
    combinations: combine("minijuegos", [minigameColors], () => ({ price: 15000, unit: "por unidad" })),
    addOns: [],
    personalizable: false,
    needsPhotos: false,
    intents: ["regalar"],
    leadTime: pendingLeadTime(),
    images: { card: albumPhoto("minijuegos", 1, "", 1086).image },
    gallery: minigamePhotos,
    details: [
      "Jugás, borrás y volvés a empezar. Cada uno mide 11,5 × 11,5 cm y va anillado, así entra en cualquier mochila.",
      "Elegí el tuyo en naranja, rosa, celeste, verde o amarillo.",
    ],
  },
];

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
