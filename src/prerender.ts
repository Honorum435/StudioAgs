import {
  business as defaultBusiness,
  businessValue,
  listPendingFields,
  type BusinessInfo,
} from "./business";
import {
  imageUrl,
  listPendingCatalogFields,
  products as defaultCatalog,
  type CatalogProduct,
} from "./catalog";
import { escapeHtml } from "./format";
import { instagramUrl, renderPage, type PageData } from "./templates";

// Lo único que importa vite.config.ts del código de la tienda: documento, metadatos y pendientes.

export const SITE_NAME = "StudioAGS";
export const SITE_TITLE = "StudioAGS — Objetos para guardar lo lindo";
export const SITE_DESCRIPTION =
  "Calendarios, fotos, tarjetas, vinilos y láminas personalizados. Elegí las opciones, mirá el precio y armá tu pedido por WhatsApp.";

export const SHARE_IMAGE = {
  path: "images/compartir.jpg",
  width: 1200,
  height: 630,
  alt: "Un calendario magnético, un cuadro de flores prensadas y tarjetas personales de StudioAGS",
};

const APP_PLACEHOLDER = '<div id="app"></div>';

export interface ContentOptions {
  business?: BusinessInfo;
  catalog?: readonly CatalogProduct[];
}

export interface SiteOptions extends ContentOptions {
  // Dirección pública sin barra final, por ejemplo https://studioags.com.ar o https://usuario.github.io/StudioAgs.
  siteUrl: string;
}

// Mismo formato que HtmlTagDescriptor de Vite: los atributos van sin escapar (Vite los escapa) y
// children ya es HTML.
export interface HeadTag {
  tag: string;
  attrs?: Record<string, string>;
  children?: string;
}

export interface PendingFields {
  business: string[];
  catalog: string[];
}

function pageData(options: ContentOptions): PageData {
  return { business: options.business ?? defaultBusiness, catalog: options.catalog ?? defaultCatalog };
}

export function renderDocument(options: ContentOptions = {}): string {
  return renderPage(pageData(options));
}

// Reemplaza el #app vacío de index.html por la cáscara prerenderizada.
export function injectApp(html: string, markup: string): string {
  const index = html.indexOf(APP_PLACEHOLDER);
  if (index < 0) {
    throw new Error(`index.html tiene que tener ${APP_PLACEHOLDER} para prerenderizar la tienda.`);
  }
  return `${html.slice(0, index)}<div id="app" data-prerendered>${markup}\n</div>${html.slice(index + APP_PLACEHOLDER.length)}`;
}

export function pendingFields(options: ContentOptions = {}): PendingFields {
  const { business, catalog } = pageData(options);
  return { business: listPendingFields(business), catalog: listPendingCatalogFields(catalog) };
}

// Dentro de <script> nada puede cerrar la etiqueta: cada "<" sale como <, que sigue siendo JSON válido.
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// Las rutas de la tienda son relativas ("images/…") para que funcione también dentro de una carpeta.
function absolute(siteUrl: string, path: string): string {
  return `${siteUrl}/${path.replace(/^\//, "")}`;
}

function productOffer(product: CatalogProduct, storeId: string): Record<string, unknown> {
  const prices = product.combinations.map((combination) => combination.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const seller = { "@id": storeId };
  if (prices.length === 1 || low === high) {
    return { "@type": "Offer", price: low, priceCurrency: "ARS", seller };
  }
  return {
    "@type": "AggregateOffer",
    lowPrice: low,
    highPrice: high,
    offerCount: prices.length,
    priceCurrency: "ARS",
    seller,
  };
}

export function jsonLd(options: SiteOptions): string {
  const { business, catalog } = pageData(options);
  const home = absolute(options.siteUrl, "/");
  const storeId = `${home}#tienda`;
  const store = {
    "@type": "Store",
    "@id": storeId,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: home,
    image: absolute(options.siteUrl, SHARE_IMAGE.path),
    currenciesAccepted: "ARS",
    paymentAccepted: businessValue(business.paymentMethods).join(", "),
    sameAs: [instagramUrl(businessValue(business.instagramHandle))],
  };
  const list = {
    "@type": "ItemList",
    name: `Catálogo de ${SITE_NAME}`,
    numberOfItems: catalog.length,
    itemListElement: catalog.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: absolute(options.siteUrl, imageUrl(product.images.card, product.images.card.width)),
        url: `${home}#producto-${product.id}`,
        brand: { "@type": "Brand", name: SITE_NAME },
        offers: productOffer(product, storeId),
      },
    })),
  };
  return serializeForScript({ "@context": "https://schema.org", "@graph": [store, list] });
}

export function headTags(options: SiteOptions): HeadTag[] {
  const home = absolute(options.siteUrl, "/");
  const image = absolute(options.siteUrl, SHARE_IMAGE.path);
  const meta = (key: "name" | "property", name: string, content: string): HeadTag => ({
    tag: "meta",
    attrs: { [key]: name, content },
  });
  return [
    { tag: "title", children: escapeHtml(SITE_TITLE) },
    meta("name", "description", SITE_DESCRIPTION),
    { tag: "link", attrs: { rel: "canonical", href: home } },
    meta("property", "og:type", "website"),
    meta("property", "og:locale", "es_AR"),
    meta("property", "og:site_name", SITE_NAME),
    meta("property", "og:title", SITE_TITLE),
    meta("property", "og:description", SITE_DESCRIPTION),
    meta("property", "og:url", home),
    meta("property", "og:image", image),
    meta("property", "og:image:type", "image/jpeg"),
    meta("property", "og:image:width", String(SHARE_IMAGE.width)),
    meta("property", "og:image:height", String(SHARE_IMAGE.height)),
    meta("property", "og:image:alt", SHARE_IMAGE.alt),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", SITE_TITLE),
    meta("name", "twitter:description", SITE_DESCRIPTION),
    meta("name", "twitter:image", image),
    meta("name", "twitter:image:alt", SHARE_IMAGE.alt),
    { tag: "script", attrs: { type: "application/ld+json" }, children: jsonLd(options) },
  ];
}
