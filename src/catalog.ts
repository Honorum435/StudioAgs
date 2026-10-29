export interface ProductVariant {
  id: string;
  label: string;
  price: number;
}

export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  imageAlt: string;
  note?: string;
  variants: ProductVariant[];
}

const cardFinishes = [
  { sides: "Simple faz", finish: "Sin laminar" },
  { sides: "Simple faz", finish: "Laminado mate/brillo" },
  { sides: "Doble faz", finish: "Sin laminar" },
  { sides: "Doble faz", finish: "Laminado mate/brillo" },
];

const cardPrices = [
  { quantity: 100, prices: [13300, 16300, 16300, 19300] },
  { quantity: 200, prices: [19300, 24500, 24500, 26300] },
  { quantity: 300, prices: [23800, 30600, 30600, 37500] },
  { quantity: 500, prices: [34000, 44500, 46000, 56000] },
  { quantity: 1000, prices: [58800, 78100, 80600, 99000] },
];

const cardVariants: ProductVariant[] = cardPrices.flatMap(({ quantity, prices }) =>
  cardFinishes.map(({ sides, finish }, index) => ({
    id: `tarjetas-${quantity}-${index}`,
    label: `${quantity} unidades · ${sides} · ${finish}`,
    price: prices[index],
  })),
);

export const categories = [
  "Calendarios",
  "Fotos",
  "Pizarra OrMa",
  "Cuadros",
  "Vinilos",
  "Tarjetas",
  "Bitácoras",
  "Láminas",
];

export const products: CatalogProduct[] = [
  {
    id: "calendarios",
    name: "Calendarios",
    category: "Calendarios",
    description:
      "Formatos clásicos, semanales y magnéticos. Personalizalos con colores, logo o un diseño propio.",
    image: "/images/calendarios.webp",
    imageAlt: "Muestra de diseños y formatos de calendarios StudioAGS",
    variants: [
      { id: "clasico-sin-notas", label: "Clásico · sin notas", price: 41500 },
      { id: "clasico-con-notas", label: "Clásico · con notas", price: 41500 },
      { id: "unico", label: "Único", price: 28000 },
      { id: "doce-meses", label: "Doce meses", price: 26000 },
      { id: "semanal-grande", label: "Semanal grande", price: 26000 },
      { id: "semanal-chico", label: "Semanal chico", price: 21000 },
      { id: "acrilico", label: "Acrílico", price: 55000 },
      { id: "iman", label: "Imán", price: 23000 },
      { id: "notas-con-iman", label: "Notas con imán", price: 2500 },
    ],
  },
  {
    id: "fotos",
    name: "Fotos para guardar",
    category: "Fotos",
    description:
      "Tus recuerdos en formatos Polaroid, tiras, fotos cuadradas o imanes para la heladera.",
    image: "/images/fotos.webp",
    imageAlt: "Ejemplos de formatos para imprimir fotos",
    note: "Producción estimada: de 1 a 3 días hábiles.",
    variants: [
      { id: "polaroid", label: "Polaroid 8 × 6,5", price: 800 },
      { id: "tira", label: "Tira de fotos", price: 1500 },
      { id: "foto-10x10", label: "Foto 10 × 10", price: 1500 },
      { id: "iman-10x10", label: "Imán 10 × 10", price: 4000 },
      { id: "marco-iman", label: "Marco con imán", price: 5500 },
    ],
  },
  {
    id: "pizarra-orma",
    name: "Pizarra OrMa",
    category: "Pizarra OrMa",
    description:
      "Pizarra magnética de 50 × 50 cm con fotos, polaroids, tira de fotos y pinzas imantadas.",
    image: "/images/pizarra-orma.webp",
    imageAlt: "Pizarra OrMa con fotos, notas y accesorios magnéticos",
    variants: [
      { id: "gris-galvanizada", label: "Gris galvanizada", price: 50000 },
      { id: "negro-mate", label: "Negro mate", price: 60000 },
    ],
  },
  {
    id: "entre-flores",
    name: "Entre Flores",
    category: "Cuadros",
    description:
      "Cuadro artesanal con flores de verbena reales, cultivadas y prensadas a mano. Se puede personalizar.",
    image: "/images/entre-flores.webp",
    imageAlt: "Cuadro artesanal Entre Flores con flores prensadas",
    note: "Cada composición es única.",
    variants: [{ id: "entre-flores", label: "Entre Flores", price: 35000 }],
  },
  {
    id: "vinilos",
    name: "Vinilos impresos",
    category: "Vinilos",
    description:
      "Impresión UV en vinilo blanco o transparente, con distintas terminaciones de laca.",
    image: "/images/vinilos.webp",
    imageAlt: "Muestras de vinilos impresos y sus terminaciones",
    note: "Producción estimada: de 1 a 4 días.",
    variants: [
      { id: "blanco-sin-laca", label: "Blanco · sin laca", price: 14500 },
      {
        id: "blanco-laca-sectorizada",
        label: "Blanco · laca sectorizada",
        price: 16600,
      },
      {
        id: "blanco-laca-completa",
        label: "Blanco · laca completa",
        price: 18800,
      },
      { id: "transparente-sin-laca", label: "Transparente · sin laca", price: 16200 },
      {
        id: "transparente-laca-sectorizada",
        label: "Transparente · laca sectorizada",
        price: 18600,
      },
      {
        id: "transparente-laca-completa",
        label: "Transparente · laca completa",
        price: 21000,
      },
      { id: "maqueta", label: "Maqueta · cada 5 diseños", price: 2500 },
      { id: "corte-individual", label: "Corte individual por pliego", price: 2500 },
    ],
  },
  {
    id: "tarjetas",
    name: "Tarjetas personales",
    category: "Tarjetas",
    description:
      "Tarjetas en papel ilustración de 300 g. Elegí cantidad, impresión simple o doble faz y laminado.",
    image: "/images/tarjetas.webp",
    imageAlt: "Tarjetas impresas con distintas terminaciones",
    variants: cardVariants,
  },
  {
    id: "bitacoras",
    name: "Bitácoras y separadores",
    category: "Bitácoras",
    description:
      "Bitácoras A5 o A6 con 60 hojas, y separadores clásicos o imantados.",
    image: "/images/bitacoras.webp",
    imageAlt: "Colección de diseños ilustrados para bitácoras",
    variants: [
      { id: "bitacora-a5", label: "Bitácora A5", price: 7000 },
      { id: "bitacora-a6", label: "Bitácora A6", price: 5000 },
      { id: "separador", label: "Separador clásico", price: 1300 },
      { id: "separador-iman", label: "Separador con imán", price: 1500 },
    ],
  },
  {
    id: "laminas",
    name: "Láminas",
    category: "Láminas",
    description:
      "Ilustraciones y gráficas de distintos artistas, en formatos para decorar tus espacios.",
    image: "/images/laminas.webp",
    imageAlt: "Selección de ilustraciones y láminas decorativas",
    note: "Diseños y disponibilidad pueden variar.",
    variants: [
      { id: "a3-plus", label: "A3+ (SA3)", price: 7000 },
      { id: "a3", label: "A3", price: 7000 },
      { id: "a4", label: "A4", price: 5000 },
      { id: "a5", label: "A5", price: 4000 },
      { id: "a6", label: "A6", price: 3000 },
    ],
  },
];
