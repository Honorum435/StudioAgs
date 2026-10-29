import { businessValue, type BusinessInfo } from "./business";
import type { OrderSummary, ResolvedLine, SentVia } from "./cart";
import {
  imageUrl,
  initialSelection,
  intents,
  resolveSelection,
  type AddOn,
  type CatalogProduct,
  type ImageSpec,
  type ResolvedSelection,
} from "./catalog";
import { escapeHtml, formatLongDate, formatPrice } from "./format";

// Módulo puro: lo usan el prerender de vite.config.ts y el cliente. Nada de DOM, import.meta.env
// ni estilos en línea (la CSP no permite 'unsafe-inline').

export interface PageData {
  business: BusinessInfo;
  catalog: readonly CatalogProduct[];
}

export type CartSummary = Pick<OrderSummary, "lines" | "quantity" | "subtotal">;

// Anchos de la foto según el layout de styles.css (margen lateral de 5vw hasta 36 px):
// una columna, dos en celular ancho, dos en tablet y tres desde 1024 px.
export const CARD_IMAGE_SIZES =
  "(max-width: 559px) 90vw, (max-width: 767px) calc(45vw - 8px), (max-width: 1023px) calc(50vw - 47px), (max-width: 1351px) calc(33.3vw - 39px), 412px";
// La ficha ocupa todo el ancho en celular y hasta 880 px desde 768 px (styles.css).
export const FICHA_SIZES = "(max-width: 767px) 100vw, (max-width: 927px) calc(100vw - 48px), 880px";
export const HERO_MAIN_SIZES = "(max-width: 680px) 208px, 260px";
export const HERO_SMALL_SIZES = "(max-width: 680px) 127px, 160px";

export const TOTAL_NOTE = "El total final se confirma por WhatsApp.";
export const ORDER_UPDATED_NOTE = "Actualizamos tu pedido · revisalo";
export const ORDER_CHANGED_NOTE = "Cambiaste el pedido: volvé a tocar Continuar.";

type IconName = "bag" | "close" | "search" | "arrow" | "plus" | "minus";

const iconPaths: Record<IconName, string> = {
  bag: '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
};

function icon(name: IconName): string {
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
}

function attr(value: string | number): string {
  return escapeHtml(String(value));
}

function srcset(spec: ImageSpec): string {
  return spec.widths.map((width) => `${imageUrl(spec, width)} ${width}w`).join(", ");
}

interface ImageOptions {
  className?: string;
  alt: string;
  sizes: string;
  loading?: "lazy";
  highPriority?: boolean;
}

function responsiveImage(spec: ImageSpec, options: ImageOptions): string {
  const attributes = [
    options.className ? `class="${attr(options.className)}"` : "",
    `src="${attr(imageUrl(spec, spec.width))}"`,
    `srcset="${attr(srcset(spec))}"`,
    `sizes="${attr(options.sizes)}"`,
    `width="${spec.width}"`,
    `height="${spec.height}"`,
    `alt="${attr(options.alt)}"`,
    options.loading ? `loading="${options.loading}"` : "",
    options.highPriority ? 'fetchpriority="high"' : 'decoding="async"',
  ];
  return `<img ${attributes.filter(Boolean).join(" ")} />`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase("es") + text.slice(1);
}

export function itemCount(quantity: number): string {
  return quantity === 1 ? "1 producto" : `${quantity} productos`;
}

export function resultCount(count: number): string {
  return count === 0 ? "Ningún producto" : itemCount(count);
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(handle.replace(/^@/, ""))}/`;
}

function instagramLink(business: BusinessInfo): string {
  const handle = businessValue(business.instagramHandle).replace(/^@/, "");
  return `<a href="${attr(instagramUrl(handle))}">@${escapeHtml(handle)}</a>`;
}

// La primera opción de cada grupo, sin adicionales: lo que muestra el HTML antes de hidratar.
export function initialResolved(product: CatalogProduct): ResolvedSelection {
  const resolved = resolveSelection(product, initialSelection(product));
  if (!resolved) {
    throw new Error(`El producto ${product.id} no tiene precio para su primera opción.`);
  }
  return resolved;
}

// Rango de plazos de todo el catálogo, en días hábiles.
function leadTimeRange(catalog: readonly CatalogProduct[]): string | null {
  const times = catalog.map((product) => businessValue(product.leadTime));
  if (times.length === 0) {
    return null;
  }
  const min = Math.min(...times.map((time) => time.min));
  const max = Math.max(...times.map((time) => time.max));
  if (min === max) {
    return min === 1 ? "1 día hábil" : `${min} días hábiles`;
  }
  return `de ${min} a ${max} días hábiles`;
}

// Islas del cliente: el prerender y el cliente arman este HTML con las mismas funciones.

export function cardPrice(resolved: ResolvedSelection): string {
  const unit = resolved.addOns.length > 0 ? `${resolved.unit}, con adicionales` : resolved.unit;
  return `<span class="product-price-amount">${formatPrice(resolved.total)}</span> <span class="product-price-unit">${escapeHtml(unit)}</span>`;
}

// La etiqueta va sola en su span; producto y precio para lectores en un span oculto.
export function addButtonContent(product: CatalogProduct, resolved: ResolvedSelection): string {
  const price = formatPrice(resolved.total);
  return [
    '<span class="add-button-text">',
    '<span class="add-button-label">Sumar</span> ',
    `<span class="add-button-price" aria-hidden="true">· ${price}</span>`,
    "</span> ",
    `<span class="visually-hidden">${escapeHtml(product.name)}, ${price}</span>`,
    icon("arrow"),
  ].join("");
}

export function cartCountContent(quantity: number): string {
  const label = quantity === 0 ? "vacío" : itemCount(quantity);
  return `<span aria-hidden="true">${quantity}</span><span class="visually-hidden">, ${label}</span>`;
}

export function lineName(line: ResolvedLine): string {
  return line.combination.label ? `${line.product.name} (${line.combination.label})` : line.product.name;
}

// Panel del pedido. La estructura sale de acá; cart-view.ts la crea una vez y después solo
// actualiza valores en su lugar (cantidades, totales, campos), sin volver a pintarla entera.

export function cartAddon(line: ResolvedLine, addOn: AddOn): string {
  const name = `${addOn.label} de ${lineName(line)}`;
  return `<li class="cart-addon" data-addon-id="${attr(addOn.id)}"><span class="cart-addon-name">${escapeHtml(addOn.label)}</span> <span class="cart-addon-price">+ ${formatPrice(addOn.price)} <span class="addon-unit">${escapeHtml(addOn.unit)}</span></span> <button class="text-button cart-remove" type="button" data-action="remove-addon" data-line-id="${attr(line.id)}" data-addon-id="${attr(addOn.id)}">Quitar<span class="visually-hidden"> ${escapeHtml(name)}</span></button></li>`;
}

export function cartLine(line: ResolvedLine): string {
  const id = attr(line.id);
  const name = lineName(line);
  const option = line.combination.label
    ? `<p class="cart-item-variant">${escapeHtml(line.combination.label)}</p>`
    : "";
  const addOns = line.addOns.map((addOn) => cartAddon(line, addOn)).join("");
  return `
    <li class="cart-item" data-line-id="${id}">
      <div class="cart-item-head">
        <span class="cart-item-name">${escapeHtml(line.product.name)}</span>
        <span class="cart-item-price" data-line-total>${formatPrice(line.combination.price * line.quantity)}</span>
      </div>
      ${option}
      <p class="cart-item-variant">${formatPrice(line.combination.price)} ${escapeHtml(line.combination.unit)}</p>
      <div class="cart-item-controls">
        <div class="quantity-controls">
          <button type="button" data-action="decrement" data-line-id="${id}" aria-label="Restar uno: ${attr(name)}">${icon("minus")}</button>
          <input class="quantity-input" type="text" inputmode="numeric" autocomplete="off" value="${line.quantity}" data-quantity data-line-id="${id}" aria-label="Cantidad de ${attr(name)}" />
          <button type="button" data-action="increment" data-line-id="${id}" aria-label="Sumar uno: ${attr(name)}">${icon("plus")}</button>
        </div>
        <button class="text-button cart-remove" type="button" data-action="remove-line" data-line-id="${id}">Quitar<span class="visually-hidden"> ${escapeHtml(name)}</span></button>
      </div>
      <ul class="cart-addons" aria-label="Adicionales de ${attr(name)}"${addOns ? "" : " hidden"}>${addOns}</ul>
    </li>`;
}

function fieldTag(text = "obligatorio"): string {
  return `<span class="field-tag">(${text})</span>`;
}

function orderForm(): string {
  return `
    <section class="cart-form" aria-labelledby="pedido-datos-titulo">
      <h3 class="cart-section-title" id="pedido-datos-titulo">Tus datos</h3>
      <div class="field" data-field="name">
        <label class="field-label" for="pedido-nombre">Nombre ${fieldTag()}</label>
        <input class="field-input" id="pedido-nombre" name="nombre" type="text" autocomplete="name" aria-required="true" data-form-field="name" />
        <p class="field-error" id="pedido-nombre-error" data-field-error="name" hidden></p>
      </div>
      <fieldset class="field" data-field="delivery" role="radiogroup" aria-required="true" aria-labelledby="pedido-entrega-titulo">
        <legend class="field-label" id="pedido-entrega-titulo">Entrega ${fieldTag()}</legend>
        <div class="option-list">
          <label class="option-chip"><input type="radio" name="pedido-entrega" value="retiro" autocomplete="off" data-form-field="delivery" /><span>Retiro</span></label>
          <label class="option-chip"><input type="radio" name="pedido-entrega" value="envio" autocomplete="off" data-form-field="delivery" /><span>Envío</span></label>
        </div>
        <p class="field-hint" id="pedido-entrega-ayuda" data-delivery-hint hidden></p>
        <p class="field-error" id="pedido-entrega-error" data-field-error="delivery" hidden></p>
      </fieldset>
      <div class="field" data-field="locality" hidden>
        <label class="field-label" for="pedido-localidad">Localidad ${fieldTag("obligatoria para el envío")}</label>
        <input class="field-input" id="pedido-localidad" name="localidad" type="text" autocomplete="address-level2" aria-required="true" data-form-field="locality" />
        <p class="field-error" id="pedido-localidad-error" data-field-error="locality" hidden></p>
      </div>
      <div class="field" data-field="date">
        <label class="field-label" for="pedido-fecha">¿Para cuándo lo necesitás? ${fieldTag("opcional")}</label>
        <input class="field-input" id="pedido-fecha" name="fecha" type="date" data-form-field="date" />
        <p class="field-hint" id="pedido-fecha-aviso" data-date-warning hidden></p>
        <p class="field-error" id="pedido-fecha-error" data-field-error="date" hidden></p>
      </div>
    </section>`;
}

// Un bloque por producto del pedido que se personaliza o lleva fotos (Láminas no tiene ninguno).
export function ideaBlock(product: CatalogProduct): string {
  const id = attr(product.id);
  const idea = product.personalizable
    ? `
        <label class="field-label" for="pedido-idea-${id}"><span class="visually-hidden">Tu idea para </span>${escapeHtml(product.name)} ${fieldTag("opcional")}</label>
        <textarea class="field-input idea-input" id="pedido-idea-${id}" rows="3" maxlength="500" data-idea="${id}" aria-describedby="pedido-idea-${id}-contador"></textarea>
        <p class="field-counter" id="pedido-idea-${id}-contador" data-idea-counter hidden></p>`
    : `<p class="field-label">${escapeHtml(product.name)}</p>`;
  const help = product.photoInstructions;
  const photos =
    product.needsPhotos && help
      ? `
        <div class="cart-photo-help">
          <p class="cart-photo-title">Cómo mandar las fotos<span class="visually-hidden"> para ${escapeHtml(product.name)}</span></p>
          <ul>
            <li>${escapeHtml(help.quantity)}</li>
            <li>${escapeHtml(help.quality)}</li>
            <li>${escapeHtml(help.howToSend)}</li>
          </ul>
        </div>`
      : "";
  return `
    <div class="idea-block" data-idea-product="${id}">${idea}${photos}
    </div>`;
}

function ideasSection(): string {
  return `
    <section class="cart-ideas" aria-labelledby="pedido-ideas-titulo" data-cart-ideas-section hidden>
      <h3 class="cart-section-title" id="pedido-ideas-titulo">Contanos tu idea</h3>
      <p class="cart-section-intro">Nombres, colores, textos o lo que tengas en mente. Si todavía no lo sabés, lo vemos por WhatsApp.</p>
      <div class="idea-list" data-cart-ideas></div>
    </section>`;
}

export function cartContent(summary: CartSummary): string {
  if (summary.lines.length === 0) {
    return `
      <div class="cart-empty">
        <div class="empty-bag">${icon("bag")}</div>
        <h3>Tu pedido empieza acá.</h3>
        <p>Sumá algo lindo del catálogo y lo vas a encontrar en este espacio.</p>
        <button class="primary-button cart-empty-button" type="button" data-action="browse-products">Ver el catálogo ${icon("arrow")}</button>
      </div>`;
  }

  const subtotal = formatPrice(summary.subtotal);
  return `
    <ul class="cart-items" data-cart-lines tabindex="-1" aria-label="Productos del pedido">${summary.lines.map(cartLine).join("")}
    </ul>
    <div class="cart-summary">
      <div><span>Subtotal estimado</span><strong data-cart-subtotal>${subtotal}</strong></div>
      <p>${TOTAL_NOTE}</p>
    </div>
    ${orderForm()}
    ${ideasSection()}
    <div class="cart-privacy">
      <p>Tus datos quedan guardados solo en este navegador hasta que vacíes el pedido.</p>
      <button class="text-button cart-clear" type="button" data-action="clear-order">Vaciar pedido</button>
    </div>
    <div class="cart-footer">
      <p class="cart-footer-total"><span>Subtotal estimado</span> <strong data-cart-subtotal>${subtotal}</strong></p>
      <div class="checkout" data-checkout></div>
    </div>`;
}

// Avisos de restauración: el texto trae nombres guardados en el navegador, así que va escapado.
export function restoreNotice(messages: readonly string[]): string {
  return `
    <div class="cart-notice" data-restore-notice>
      <p class="cart-notice-title">Actualizamos tu pedido</p>
      <ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>
      <button class="text-button" type="button" data-action="acknowledge-notices">Entendido</button>
    </div>`;
}

export interface WhatsAppLinkView {
  url: string;
  tooLong: boolean;
}

export type CheckoutStage =
  | { kind: "draft"; changed: boolean }
  | { kind: "confirmed"; code: string; link: WhatsAppLinkView | null }
  | { kind: "sent"; code: string; via: SentVia; link: WhatsAppLinkView | null };

export function sentQuestion(via: SentVia): string {
  return via === "copy" ? "Copiaste el pedido. ¿Lo enviaste?" : "Abriste WhatsApp con este pedido. ¿Lo enviaste?";
}

function whatsappLink(link: WhatsAppLinkView, label: string, className: string): string {
  return `<a class="${className} checkout-button" href="${attr(link.url)}" target="_blank" rel="noopener noreferrer" data-action="open-whatsapp">${escapeHtml(label)}<span class="visually-hidden"> (se abre en otra pestaña)</span></a>`;
}

function codeLine(code: string): string {
  return `<p class="checkout-code">Código del pedido: <strong>${escapeHtml(code)}</strong></p>`;
}

// La acción principal del pie: "Continuar", después el enlace y copiar, y al final la pregunta.
export function checkoutContent(stage: CheckoutStage): string {
  if (stage.kind === "draft") {
    const changed = stage.changed ? `<p class="checkout-changed">${ORDER_CHANGED_NOTE}</p>` : "";
    return `${changed}<button class="primary-button checkout-button" type="button" data-action="checkout" data-checkout-focus>Continuar ${icon("arrow")}</button>`;
  }

  const { link } = stage;
  if (stage.kind === "confirmed") {
    const notice = link
      ? `<p class="checkout-notice" tabindex="-1" data-checkout-focus>Se abre WhatsApp: solo tocá Enviar.</p>`
      : `<p class="checkout-notice is-warning" tabindex="-1" data-checkout-focus>El envío por WhatsApp todavía no está configurado. Copiá el pedido y mandalo por el chat.</p>`;
    const long = link?.tooLong
      ? '<p class="checkout-hint">Tu pedido es largo y WhatsApp podría cortarlo: si pasa, copialo y pegalo en el chat.</p>'
      : "";
    const copyFirst = !link || link.tooLong;
    const actions = [
      link ? whatsappLink(link, "Abrir WhatsApp", copyFirst ? "secondary-button" : "primary-button") : "",
      `<button class="${copyFirst ? "primary-button" : "secondary-button"} checkout-button" type="button" data-action="copy-order">Copiar pedido</button>`,
    ].join("");
    return `${notice}${long}${codeLine(stage.code)}<div class="checkout-actions">${actions}</div>`;
  }

  const reopen = link
    ? whatsappLink(link, stage.via === "whatsapp" ? "Volver a abrir WhatsApp" : "Abrir WhatsApp", "secondary-button")
    : "";
  return `
    <p class="checkout-notice" tabindex="-1" data-checkout-focus>${sentQuestion(stage.via)}</p>
    ${codeLine(stage.code)}
    <div class="checkout-actions">
      <button class="primary-button checkout-button" type="button" data-action="sent-clear">Ya lo envié · vaciar pedido</button>
      ${reopen}
      <button class="text-button" type="button" data-action="copy-order">${stage.via === "copy" ? "Copiar de nuevo" : "Copiar pedido"}</button>
    </div>`;
}

// Último respaldo si el navegador no deja copiar: el texto queda seleccionado para copiarlo a mano.
export function manualCopyContent(): string {
  return `
    <div class="manual-copy" data-manual-copy>
      <label class="field-label" for="pedido-texto">No pudimos copiarlo solo. Ya está seleccionado: copialo desde acá.</label>
      <textarea class="field-input manual-copy-text" id="pedido-texto" rows="8" readonly data-manual-copy-text></textarea>
    </div>`;
}

export interface StickyBarMessage {
  text: string;
  // Algo que la clienta tiene que mirar: avisos de restauración o la pregunta de si lo envió.
  alert: boolean;
}

export function stickyBarSummary(
  summary: Pick<OrderSummary, "quantity" | "subtotal">,
  message: StickyBarMessage = { text: TOTAL_NOTE, alert: false },
): string {
  return `
      <span class="sticky-bar-count">${itemCount(summary.quantity)}</span>
      <strong class="sticky-bar-subtotal">${formatPrice(summary.subtotal)}</strong>
      <span class="sticky-bar-note${message.alert ? " is-alert" : ""}">${escapeHtml(message.text)}</span>`;
}

export function stickyBarContent(
  summary: Pick<OrderSummary, "quantity" | "subtotal">,
  message?: StickyBarMessage,
): string {
  return `
    <p class="sticky-bar-summary">${stickyBarSummary(summary, message)}
    </p>
    <button class="primary-button sticky-bar-button" type="button" data-action="open-cart">Ver pedido</button>`;
}

// Secciones de la página, en el orden en que se ven.

export function siteHeader(): string {
  return `
    <header class="site-header">
      <a class="wordmark" href="#" aria-label="StudioAGS, inicio">
        <span class="wordmark-small">studio</span>
        <span class="wordmark-large">ags<span class="wordmark-dot">.</span></span>
      </a>
      <nav class="main-nav" aria-label="Navegación principal">
        <a href="#catalogo">Catálogo</a>
        <a href="#como-comprar">Cómo comprar</a>
      </nav>
      <button class="cart-trigger" type="button" data-action="open-cart" disabled>
        <span>Mi pedido</span>
        ${icon("bag")}
        <span class="cart-count is-empty" data-cart-count>${cartCountContent(0)}</span>
        <span class="cart-trigger-note" data-cart-trigger-note hidden></span>
      </button>
    </header>`;
}

export function noscriptNote(business: BusinessInfo): string {
  return `
    <noscript>
      <p class="noscript-note">Para armar el pedido en la página hace falta JavaScript. Podés ver el catálogo igual y escribirnos por Instagram a ${instagramLink(business)}.</p>
    </noscript>`;
}

export function hero(catalog: readonly CatalogProduct[]): string {
  // La foto más ancha va en la polaroid grande.
  const [main, small] = catalog
    .flatMap((product) => (product.images.hero ? [product.images.hero] : []))
    .sort((a, b) => b.width - a.width);
  const mainPhoto = main
    ? `<div class="hero-photo hero-photo-main">
          ${responsiveImage(main, { alt: "", sizes: HERO_MAIN_SIZES, highPriority: true })}
          <span>un mundo de ideas</span>
        </div>`
    : "";
  const smallPhoto = small
    ? `<div class="hero-photo hero-photo-small">
          ${responsiveImage(small, { alt: "", sizes: HERO_SMALL_SIZES })}
        </div>`
    : "";

  return `
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow"><span class="eyebrow-mark" aria-hidden="true"></span> Papelería y objetos personalizados</p>
        <h1 id="hero-title">Pequeñas ideas,<br /><span>grandes recuerdos.</span></h1>
        <p class="hero-description">
          Calendarios, fotos, tarjetas y láminas para regalar, decorar o darle identidad a tu marca.
          Elegís en el catálogo y lo terminamos de coordinar por WhatsApp.
        </p>
        <a class="primary-button" href="#catalogo">Ver el catálogo ${icon("arrow")}</a>
        <div class="hero-caption">
          <span class="caption-rule" aria-hidden="true"></span>
          <span>Impresiones · papelería · detalles a tu manera</span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-sticker hero-sticker-top">hecho<br />con cariño</div>
        ${mainPhoto}
        ${smallPhoto}
        <div class="hero-sparkle">✳</div>
        <div class="hero-sticker hero-sticker-bottom">para vos<br />o para regalar</div>
      </div>
    </section>`;
}

export function valueStrip(): string {
  const items = [
    "Lo personalizamos con tu nombre, tu logo o tus fotos",
    "Precios a la vista en cada producto",
    "Armás el pedido acá y lo cerramos por WhatsApp",
  ];
  return `
    <ul class="value-strip" aria-label="Lo que ofrece StudioAGS">
      ${items.map((item) => `<li><span class="eyebrow-mark" aria-hidden="true"></span><span>${item}</span></li>`).join("")}
    </ul>`;
}

export function trustStrip({ business, catalog }: PageData): string {
  const range = leadTimeRange(catalog);
  const items = [
    range ? `Producción: ${range}, según el producto` : "",
    "Te mandamos una muestra antes de imprimir",
    `Precios actualizados al ${formatLongDate(businessValue(business.pricesUpdatedAt))}`,
  ].filter(Boolean);
  return `
    <ul class="trust-strip" aria-label="Antes de pedir">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>`;
}

export function catalogToolbar(): string {
  const chips = [{ id: "todo", label: "Todo" }, ...intents]
    .map(
      (intent) =>
        `<button class="filter-chip${intent.id === "todo" ? " is-active" : ""}" type="button" data-action="filter" data-intent="${attr(intent.id)}" aria-pressed="${intent.id === "todo"}" disabled>${escapeHtml(intent.label)}</button>`,
    )
    .join("");
  return `
    <div class="catalog-toolbar">
      <div class="filter-list" role="group" aria-label="Filtrar por uso">${chips}</div>
      <label class="search-field">
        ${icon("search")}
        <span class="visually-hidden">Buscar en el catálogo</span>
        <input type="search" data-search placeholder="Buscar productos" autocomplete="off" disabled />
      </label>
    </div>`;
}

function optionGroups(product: CatalogProduct): string {
  const selection = initialSelection(product);
  return product.groups
    .map((group) => {
      const options = group.options
        .map(
          (option) =>
            `<label class="option-chip"><input type="radio" name="${attr(`opcion-${product.id}-${group.id}`)}" value="${attr(option.id)}"${selection[group.id] === option.id ? " checked" : ""} disabled autocomplete="off" /><span>${escapeHtml(option.label)}</span></label>`,
        )
        .join("");
      return `
        <fieldset class="option-group" data-group="${attr(group.id)}">
          <legend>${escapeHtml(group.label)}<span class="visually-hidden"> de ${escapeHtml(product.name)}</span></legend>
          <div class="option-list">${options}</div>
        </fieldset>`;
    })
    .join("");
}

function addOnGroup(product: CatalogProduct): string {
  if (product.addOns.length === 0) {
    return "";
  }
  const addOns = product.addOns
    .map(
      (addOn) =>
        `<label class="addon"><input type="checkbox" name="${attr(`adicional-${product.id}`)}" value="${attr(addOn.id)}" disabled autocomplete="off" /><span class="addon-label">${escapeHtml(addOn.label)}</span> <span class="addon-price">+ ${formatPrice(addOn.price)} <span class="addon-unit">${escapeHtml(addOn.unit)}</span></span></label>`,
    )
    .join("");
  return `
    <fieldset class="addon-group">
      <legend>Adicionales<span class="visually-hidden"> de ${escapeHtml(product.name)}</span></legend>
      ${addOns}
    </fieldset>`;
}

function photoHelp(product: CatalogProduct): string {
  const help = product.photoInstructions;
  if (!product.needsPhotos || !help) {
    return "";
  }
  return `
    <details class="photo-help">
      <summary>Cómo mandar tus fotos<span class="visually-hidden"> para ${escapeHtml(product.name)}</span></summary>
      <ul>
        <li>${escapeHtml(help.quantity)}</li>
        <li>${escapeHtml(help.quality)}</li>
        <li>${escapeHtml(help.howToSend)}</li>
      </ul>
    </details>`;
}

export function productCard(product: CatalogProduct): string {
  const resolved = initialResolved(product);
  const id = attr(product.id);
  const leadTime = businessValue(product.leadTime).text;
  return `
    <article class="product-card" id="producto-${id}" data-product-id="${id}" aria-labelledby="producto-${id}-titulo">
      <div class="product-image-wrap">
        ${responsiveImage(product.images.card, {
          className: "product-image",
          alt: product.imageAlt,
          sizes: CARD_IMAGE_SIZES,
          loading: "lazy",
        })}
        ${product.personalizable ? '<span class="product-category">Personalizable</span>' : ""}
      </div>
      <div class="product-content">
        <div class="product-title-row">
          <h3 id="producto-${id}-titulo">${escapeHtml(product.name)}</h3>
          <p class="product-price" data-card-price>${cardPrice(resolved)}</p>
        </div>
        <p class="product-description">${escapeHtml(product.description)}</p>
        <p class="product-note product-lead-time">Producción: ${escapeHtml(lowerFirst(leadTime))}</p>
        ${product.note ? `<p class="product-note">${escapeHtml(product.note)}</p>` : ""}
        ${optionGroups(product)}
        ${addOnGroup(product)}
        ${photoHelp(product)}
        <div class="card-actions">
          <button class="add-button" type="button" data-action="add" data-product-id="${id}" disabled>${addButtonContent(product, resolved)}</button>
          <a class="text-button ficha-link" href="${attr(imageUrl(product.images.ficha, product.images.ficha.width))}" data-action="open-ficha" data-product-id="${id}">Ver ficha<span class="visually-hidden"> de ${escapeHtml(product.name)}</span></a>
        </div>
      </div>
    </article>`;
}

export function catalogSection(data: PageData): string {
  return `
    <section class="catalog-section" id="catalogo" aria-labelledby="catalog-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">El catálogo</p>
          <h2 id="catalog-title">Encontrá algo <em>hecho para vos.</em></h2>
        </div>
        <p class="section-intro">Elegí las opciones de cada producto y sumalo a tu pedido. Cuando esté listo, lo mandás por WhatsApp.</p>
      </div>
      ${trustStrip(data)}
      ${catalogToolbar()}
      <div class="catalog-meta">
        <span data-result-count role="status">${resultCount(data.catalog.length)}</span>
        <span>Precios en pesos argentinos</span>
      </div>
      <div class="product-grid" id="product-grid">
        ${data.catalog.map(productCard).join("")}
        <div class="empty-state" data-empty-state hidden>
          <p>No encontramos productos con esa búsqueda.</p>
          <button type="button" class="text-button" data-action="search-all">Buscar en todo</button>
          <button type="button" class="text-button" data-action="clear-filters">Ver todo ${icon("arrow")}</button>
        </div>
      </div>
      <p class="price-note">El total final se confirma por WhatsApp, junto con la disponibilidad y los detalles de tu diseño.</p>
    </section>`;
}

function paymentList(methods: readonly string[]): string {
  return `<ul class="trust-inline-list">${methods.map((method) => `<li>${escapeHtml(method)}</li>`).join("")}</ul>`;
}

export function trustSection({ business, catalog }: PageData): string {
  const range = leadTimeRange(catalog);
  const rows: Array<[string, string]> = [
    [
      "Plazos",
      [
        range ? `Cada producto muestra su plazo de producción: ${escapeHtml(range)}, según cuál elijas.` : "",
        "Si lo necesitás para una fecha, ponela en el pedido y te decimos si llegamos.",
      ].join(" "),
    ],
    [
      "Envíos y retiro",
      `${escapeHtml(businessValue(business.pickupArea))} ${escapeHtml(businessValue(business.shipping))}`,
    ],
    [
      "Pagos",
      `${paymentList(businessValue(business.paymentMethods))} En la página no se paga nada: el pago se coordina por WhatsApp.`,
    ],
    ["Muestra y cambios", escapeHtml(businessValue(business.exchangePolicy))],
    [
      "Contacto",
      `El pedido llega por WhatsApp y también nos encontrás en Instagram como ${instagramLink(business)}. ${escapeHtml(businessValue(business.responseTime))}`,
    ],
  ];
  return `
    <section class="trust-section" id="antes-de-pedir" aria-labelledby="trust-title">
      <div class="trust-heading">
        <p class="eyebrow">Antes de pedir</p>
        <h2 id="trust-title">Plazos, envíos y pagos.</h2>
      </div>
      <dl class="trust-list">
        ${rows.map(([term, answer]) => `<div class="trust-row"><dt>${term}</dt><dd>${answer.trim()}</dd></div>`).join("")}
      </dl>
    </section>`;
}

export function howToBuy(): string {
  const steps: Array<[string, string]> = [
    ["Elegí y sumá", "Elegí las opciones de cada producto y sumalo a tu pedido. El precio cambia según lo que elijas."],
    [
      "Mandalo por WhatsApp",
      "Completá tu nombre y cómo lo querés recibir. Se abre WhatsApp con el pedido escrito: solo tocás Enviar.",
    ],
    [
      "Aprobá la muestra",
      "Te confirmamos el total y el plazo, y te mandamos una muestra. Imprimimos cuando la aprobás.",
    ],
  ];
  return `
    <section class="how-section" id="como-comprar" aria-labelledby="how-title">
      <div class="how-heading">
        <p class="eyebrow">Cómo comprar</p>
        <h2 id="how-title">Así de fácil es pedir.</h2>
      </div>
      <ol class="steps-grid">
        ${steps
          .map(
            ([title, text], index) =>
              `<li class="step-card"><span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><h3>${title}</h3><p>${text}</p></li>`,
          )
          .join("")}
      </ol>
    </section>`;
}

export function siteFooter(): string {
  return `
    <footer class="site-footer">
      <a class="wordmark footer-wordmark" href="#" aria-label="StudioAGS, inicio">
        <span class="wordmark-small">studio</span><span class="wordmark-large">ags<span class="wordmark-dot">.</span></span>
      </a>
      <p>Para que lo lindo se quede.</p>
      <a href="#catalogo" class="footer-link">Volver al catálogo ${icon("arrow")}</a>
    </footer>`;
}

export function fichaTitle(product: CatalogProduct): string {
  return `Ficha de ${product.name}`;
}

export function fichaAlt(product: CatalogProduct): string {
  return `Página del catálogo de ${product.name}, con sus formatos y precios`;
}

// Contenido de la ficha: la foto de la tarjeta queda a la vista hasta que carga la página.
export function fichaContent(product: CatalogProduct, placeholderSrc?: string): string {
  const card = product.images.card;
  const ficha = product.images.ficha;
  const placeholder = placeholderSrc ?? imageUrl(card, Math.min(...card.widths));
  return `
    <div class="ficha-frame" data-action="zoom-ficha">
      <img class="ficha-placeholder" data-ficha-placeholder src="${attr(placeholder)}" width="${card.width}" height="${card.height}" alt="" />
      <img class="ficha-image" data-ficha-image src="${attr(imageUrl(ficha, ficha.width))}" srcset="${attr(srcset(ficha))}" sizes="${attr(FICHA_SIZES)}" width="${ficha.width}" height="${ficha.height}" alt="${attr(fichaAlt(product))}" decoding="async" hidden />
    </div>
    <p class="ficha-message" data-ficha-error hidden>No pudimos cargar la ficha. Revisá tu conexión y volvé a abrirla.</p>`;
}

export function fichaDialog(): string {
  return `
    <dialog class="ficha-dialog" id="ficha-dialog" aria-labelledby="ficha-title">
      <div class="ficha-panel">
        <header class="ficha-header">
          <div class="ficha-heading">
            <h2 id="ficha-title" data-ficha-title>Ficha del catálogo</h2>
            <p class="ficha-hint" id="ficha-hint">Tocá la página<span class="visually-hidden"> o presioná Enter</span> para ampliarla.</p>
          </div>
          <button class="icon-button" type="button" data-action="close-ficha" aria-label="Cerrar ficha">${icon("close")}</button>
        </header>
        <div class="ficha-body" data-ficha-body tabindex="0" role="region" aria-label="Página del catálogo" aria-describedby="ficha-hint"></div>
      </div>
    </dialog>`;
}

const emptyCart: CartSummary = { lines: [], quantity: 0, subtotal: 0 };

export function cartDialog(): string {
  return `
    <dialog class="cart-dialog" id="cart-dialog" aria-labelledby="cart-title">
      <div class="cart-panel">
        <header class="cart-header">
          <div>
            <p class="eyebrow">Tu selección</p>
            <h2 id="cart-title">Tu pedido</h2>
          </div>
          <button class="icon-button close-cart" type="button" data-action="close-cart" aria-label="Cerrar pedido">${icon("close")}</button>
        </header>
        <div class="cart-notices" data-cart-notices>
          <p class="visually-hidden" role="status" data-cart-live></p>
          <div data-cart-restore></div>
        </div>
        <div class="cart-content" id="cart-content" data-cart-content>${cartContent(emptyCart)}
        </div>
      </div>
    </dialog>`;
}

export function stickyBar(): string {
  return `
    <aside class="sticky-bar" aria-label="Resumen del pedido" data-sticky-bar hidden>${stickyBarContent(emptyCart)}
    </aside>`;
}

// Anuncios fuera del panel (por ejemplo, "Tarjetas personales sumado al pedido").
export function announcer(): string {
  return '<div class="visually-hidden" role="status" data-announcer></div>';
}

export function renderPage(data: PageData): string {
  return [
    siteHeader(),
    noscriptNote(data.business),
    "<main>",
    hero(data.catalog),
    valueStrip(),
    catalogSection(data),
    trustSection(data),
    howToBuy(),
    "</main>",
    siteFooter(),
    fichaDialog(),
    cartDialog(),
    stickyBar(),
    announcer(),
  ].join("\n");
}
