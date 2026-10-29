import "./styles.css";
import { categories, products, type CatalogProduct, type ProductVariant } from "./catalog";
import { WHATSAPP_NUMBER } from "./config";
import { isValidWhatsAppNumber } from "./validation";

interface CartLine {
  productId: string;
  variantId: string;
  quantity: number;
}

const app = (() => {
  const element = document.querySelector<HTMLDivElement>("#app");
  if (!element) {
    throw new Error("No se encontró el contenedor principal de la tienda.");
  }
  return element;
})();

const cartDialog = document.createElement("dialog");
cartDialog.className = "cart-dialog";
cartDialog.id = "cart-dialog";
cartDialog.setAttribute("aria-labelledby", "cart-title");
cartDialog.innerHTML = `
  <div class="cart-panel">
    <header class="cart-header">
      <div>
        <span class="eyebrow">Tu selección</span>
        <h2 id="cart-title">Tu pedido</h2>
      </div>
      <button class="icon-button close-cart" type="button" data-action="close-cart" aria-label="Cerrar pedido">
        ${icon("close")}
      </button>
    </header>
    <div id="cart-content"></div>
  </div>
`;
document.body.append(cartDialog);

let activeCategory = "Todo";
let searchTerm = "";
let cart: CartLine[] = [];
const selectedVariants = new Map<string, string>();

function icon(name: "bag" | "close" | "search" | "arrow" | "plus" | "minus" | "trash"): string {
  const paths: Record<typeof name, string> = {
    bag: '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
  };

  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);
}

function getVariant(product: CatalogProduct, variantId: string): ProductVariant | undefined {
  return product.variants.find((variant) => variant.id === variantId);
}

function getInitialVariant(product: CatalogProduct): ProductVariant {
  const savedVariantId = selectedVariants.get(product.id);
  return product.variants.find((variant) => variant.id === savedVariantId) ?? product.variants[0];
}

function renderProductCard(product: CatalogProduct): string {
  const variant = getInitialVariant(product);
  const price = Math.min(...product.variants.map((item) => item.price));
  const picker =
    product.variants.length > 1
      ? `
        <label class="variant-picker">
          <span>Elegí una opción</span>
          <select data-variant-select data-product-id="${product.id}" aria-label="Elegí una opción para ${escapeHtml(product.name)}">
            ${product.variants
              .map(
                (item) =>
                  `<option value="${item.id}" ${item.id === variant.id ? "selected" : ""}>${escapeHtml(item.label)} · ${formatPrice(item.price)}</option>`,
              )
              .join("")}
          </select>
        </label>
      `
      : `<p class="single-variant">${escapeHtml(variant.label)}</p>`;

  return `
    <article class="product-card">
      <div class="product-image-wrap">
        <img
          class="product-image"
          src="${product.image}"
          alt="${escapeHtml(product.imageAlt)}"
          loading="lazy"
          width="760"
          height="1070"
        />
        <span class="product-category">${escapeHtml(product.category)}</span>
      </div>
      <div class="product-content">
        <div class="product-title-row">
          <h3>${escapeHtml(product.name)}</h3>
          <span class="starting-price">${product.variants.length > 1 ? "Desde " : ""}${formatPrice(price)}</span>
        </div>
        <p class="product-description">${escapeHtml(product.description)}</p>
        ${product.note ? `<p class="product-note">${escapeHtml(product.note)}</p>` : ""}
        ${picker}
        <button class="add-button" type="button" data-action="add" data-product-id="${product.id}" data-variant-id="${variant.id}">
          Sumar al pedido
          ${icon("arrow")}
        </button>
      </div>
    </article>
  `;
}

function getVisibleProducts(): CatalogProduct[] {
  const normalizedTerm = searchTerm.trim().toLocaleLowerCase("es");

  return products.filter((product) => {
    const matchesCategory = activeCategory === "Todo" || product.category === activeCategory;
    const searchable = `${product.name} ${product.category} ${product.description} ${product.variants
      .map((variant) => variant.label)
      .join(" ")}`.toLocaleLowerCase("es");

    return matchesCategory && (!normalizedTerm || searchable.includes(normalizedTerm));
  });
}

function renderProducts(): void {
  const grid = document.querySelector<HTMLDivElement>("#product-grid");
  const resultCount = document.querySelector<HTMLSpanElement>("#result-count");
  const visibleProducts = getVisibleProducts();

  if (!grid || !resultCount) {
    throw new Error("No se encontró la sección del catálogo.");
  }

  resultCount.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "colección" : "colecciones"}`;
  grid.innerHTML = visibleProducts.length
    ? visibleProducts.map(renderProductCard).join("")
    : `<div class="empty-state"><p>No encontramos productos con esa búsqueda.</p><button type="button" class="text-button" data-action="clear-filters">Ver todo el catálogo ${icon("arrow")}</button></div>`;
}

function renderCategories(): string {
  return ["Todo", ...categories]
    .map(
      (category) => `
        <button
          class="filter-chip ${category === activeCategory ? "is-active" : ""}"
          type="button"
          data-action="filter"
          data-category="${escapeHtml(category)}"
          aria-pressed="${category === activeCategory}"
        >${escapeHtml(category)}</button>
      `,
    )
    .join("");
}

function renderPage(): void {
  app.innerHTML = `
    <header class="site-header">
      <a class="wordmark" href="#" aria-label="StudioAGS, inicio">
        <span class="wordmark-small">studio</span>
        <span class="wordmark-large">ags<span class="wordmark-dot">.</span></span>
      </a>
      <nav class="main-nav" aria-label="Navegación principal">
        <a href="#catalogo">Catálogo</a>
        <a href="#como-comprar">Cómo comprar</a>
      </nav>
      <button class="cart-trigger" type="button" data-action="open-cart">
        <span>Mi pedido</span>
        ${icon("bag")}
        <span class="cart-count" aria-live="polite">0</span>
      </button>
    </header>

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-mark"></span> Papelería y objetos con intención</p>
          <h1 id="hero-title">Pequeñas ideas,<br /><span>grandes recuerdos.</span></h1>
          <p class="hero-description">
            Diseños para regalar, decorar y guardar esos momentos que merecen quedarse un poquito más.
            Hechos con cariño por StudioAGS.
          </p>
          <a class="primary-button" href="#catalogo">Encontrá tu próximo favorito ${icon("arrow")}</a>
          <div class="hero-caption">
            <span class="caption-rule"></span>
            <span>Impresiones · papelería · detalles hechos a tu manera</span>
          </div>
        </div>
        <div class="hero-art" aria-label="Selección de productos ilustrados de StudioAGS">
          <div class="hero-sticker hero-sticker-top">hecho<br />con cariño</div>
          <div class="hero-photo hero-photo-main">
            <img src="/images/bitacoras.webp" alt="" fetchpriority="high" />
            <span>un mundo de ideas</span>
          </div>
          <div class="hero-photo hero-photo-small">
            <img src="/images/fotos.webp" alt="" />
          </div>
          <div class="hero-sparkle" aria-hidden="true">✳</div>
          <div class="hero-sticker hero-sticker-bottom">para vos<br />o para regalar</div>
        </div>
      </section>

      <section class="value-strip" aria-label="Lo que ofrece StudioAGS">
        <div><span class="value-index">01</span><span>Ideas que podés personalizar</span></div>
        <div><span class="value-index">02</span><span>Diseños para cada momento</span></div>
        <div><span class="value-index">03</span><span>Pedidos coordinados por WhatsApp</span></div>
      </section>

      <section class="catalog-section" id="catalogo" aria-labelledby="catalog-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Un detalle puede cambiarlo todo</p>
            <h2 id="catalog-title">Encontrá algo <em>hecho para vos.</em></h2>
          </div>
          <p class="section-intro">Explorá las colecciones, elegí tus opciones y armá tu pedido en unos pocos pasos.</p>
        </div>
        <div class="catalog-toolbar">
          <div class="filter-list" aria-label="Filtrar por colección">${renderCategories()}</div>
          <label class="search-field">
            ${icon("search")}
            <span class="visually-hidden">Buscar en el catálogo</span>
            <input type="search" data-search placeholder="Buscar productos" autocomplete="off" />
          </label>
        </div>
        <div class="catalog-meta">
          <span id="result-count" aria-live="polite"></span>
          <span>Precios expresados en pesos argentinos</span>
        </div>
        <div class="product-grid" id="product-grid"></div>
        <p class="price-note">Los precios corresponden al catálogo recibido. Consultá disponibilidad, personalización y detalles antes de confirmar.</p>
      </section>

      <section class="how-section" id="como-comprar" aria-labelledby="how-title">
        <div class="how-heading">
          <p class="eyebrow">Sin vueltas, con mucho cariño</p>
          <h2 id="how-title">Así de fácil es pedir.</h2>
        </div>
        <div class="steps-grid">
          <article class="step-card"><span>01</span><h3>Elegí tus favoritos</h3><p>Explorá las colecciones, elegí formato y sumá cada opción a tu pedido.</p></article>
          <article class="step-card"><span>02</span><h3>Escribinos por WhatsApp</h3><p>Te ayudamos a revisar disponibilidad, personalización y presupuesto.</p></article>
          <article class="step-card"><span>03</span><h3>Coordinamos los detalles</h3><p>Diseño, producción y tiempos se confirman con vos antes de realizar el encargo.</p></article>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <a class="wordmark footer-wordmark" href="#" aria-label="StudioAGS, inicio">
        <span class="wordmark-small">studio</span><span class="wordmark-large">ags<span class="wordmark-dot">.</span></span>
      </a>
      <p>Hecho con cariño, para que lo lindo se quede.</p>
      <a href="#catalogo" class="footer-link">Volver al catálogo ${icon("arrow")}</a>
    </footer>
    <div class="toast" role="status" aria-live="polite"></div>
  `;

  renderProducts();
  renderCart();
}

function getCartDetails(): Array<{ line: CartLine; product: CatalogProduct; variant: ProductVariant }> {
  return cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    const variant = product ? getVariant(product, line.variantId) : undefined;
    return product && variant ? [{ line, product, variant }] : [];
  });
}

function renderCart(): void {
  const content = document.querySelector<HTMLDivElement>("#cart-content");
  const count = document.querySelector<HTMLSpanElement>(".cart-count");

  if (!content || !count) {
    return;
  }

  const items = getCartDetails();
  const totalQuantity = items.reduce((total, item) => total + item.line.quantity, 0);
  const totalPrice = items.reduce((total, item) => total + item.variant.price * item.line.quantity, 0);

  count.textContent = String(totalQuantity);
  count.classList.toggle("is-empty", totalQuantity === 0);

  if (items.length === 0) {
    content.innerHTML = `
      <div class="cart-empty">
        <div class="empty-bag">${icon("bag")}</div>
        <h3>Tu pedido empieza acá.</h3>
        <p>Sumá algo lindo del catálogo y lo vas a encontrar en este espacio.</p>
        <button class="primary-button cart-empty-button" type="button" data-action="browse-products">Explorar productos ${icon("arrow")}</button>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <ul class="cart-items">
      ${items
        .map(
          ({ line, product, variant }) => `
            <li class="cart-item">
              <div class="cart-item-copy">
                <span class="cart-item-name">${escapeHtml(product.name)}</span>
                <span class="cart-item-variant">${escapeHtml(variant.label)}</span>
                <span class="cart-item-price">${formatPrice(variant.price * line.quantity)}</span>
                <div class="quantity-controls" aria-label="Cantidad de ${escapeHtml(product.name)}">
                  <button type="button" data-action="decrement" data-product-id="${product.id}" data-variant-id="${variant.id}" aria-label="${line.quantity === 1 ? "Quitar" : "Restar"} ${escapeHtml(product.name)}">
                    ${line.quantity === 1 ? icon("trash") : icon("minus")}
                  </button>
                  <span>${line.quantity}</span>
                  <button type="button" data-action="increment" data-product-id="${product.id}" data-variant-id="${variant.id}" aria-label="Sumar ${escapeHtml(product.name)}">${icon("plus")}</button>
                </div>
              </div>
            </li>
          `,
        )
        .join("")}
    </ul>
    <div class="cart-summary">
      <div><span>Subtotal estimado</span><strong>${formatPrice(totalPrice)}</strong></div>
      <p>El monto final y la disponibilidad se confirman por WhatsApp.</p>
      <button class="primary-button checkout-button" type="button" data-action="checkout">
        Continuar por WhatsApp ${icon("arrow")}
      </button>
    </div>
  `;
}

let toastTimer = 0;

function showToast(message: string): void {
  const toast = document.querySelector<HTMLDivElement>(".toast");
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

function addToCart(productId: string, variantId: string): void {
  const product = products.find((item) => item.id === productId);
  const variant = product ? getVariant(product, variantId) : undefined;

  if (!product || !variant) {
    showToast("No pudimos agregar esa opción. Actualizá la página e intentá otra vez.");
    return;
  }

  const existingLine = cart.find(
    (line) => line.productId === productId && line.variantId === variantId,
  );

  if (existingLine) {
    existingLine.quantity += 1;
  } else {
    cart = [...cart, { productId, variantId, quantity: 1 }];
  }

  renderCart();
  showToast(`${product.name} se sumó a tu pedido.`);
}

function updateCartQuantity(productId: string, variantId: string, change: number): void {
  const line = cart.find(
    (item) => item.productId === productId && item.variantId === variantId,
  );

  if (!line) {
    return;
  }

  if (line.quantity + change <= 0) {
    cart = cart.filter((item) => item !== line);
  } else {
    line.quantity += change;
  }

  renderCart();
}

function sendWhatsAppOrder(): void {
  const items = getCartDetails();

  if (!items.length) {
    return;
  }

  if (!isValidWhatsAppNumber(WHATSAPP_NUMBER)) {
    showToast("El envío por WhatsApp todavía no está configurado.");
    return;
  }

  const totalPrice = items.reduce((total, item) => total + item.variant.price * item.line.quantity, 0);
  const message = [
    "¡Hola, StudioAGS! Quiero consultar por este pedido:",
    "",
    ...items.map(
      ({ line, product, variant }) =>
        `• ${line.quantity} × ${product.name} — ${variant.label} (${formatPrice(variant.price * line.quantity)})`,
    ),
    "",
    `Subtotal estimado: ${formatPrice(totalPrice)}`,
    "",
    "¿Me confirman disponibilidad y los detalles para coordinarlo? ¡Gracias!",
  ].join("\n");
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const actionTarget = target.closest<HTMLElement>("[data-action]");
  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.action;
  const productId = actionTarget.dataset.productId ?? "";
  const variantId = actionTarget.dataset.variantId ?? "";

  switch (action) {
    case "filter":
      activeCategory = actionTarget.dataset.category ?? "Todo";
      document.querySelectorAll<HTMLButtonElement>(".filter-chip").forEach((button) => {
        const isActive = button.dataset.category === activeCategory;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      renderProducts();
      break;
    case "add":
      addToCart(productId, variantId);
      break;
    case "open-cart":
      cartDialog.showModal();
      break;
    case "close-cart":
      cartDialog.close();
      break;
    case "browse-products": {
      const catalogSection = document.querySelector<HTMLElement>("#catalogo");
      if (!catalogSection) {
        throw new Error("No se encontró la sección del catálogo.");
      }
      cartDialog.close();
      catalogSection.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "increment":
      updateCartQuantity(productId, variantId, 1);
      break;
    case "decrement":
      updateCartQuantity(productId, variantId, -1);
      break;
    case "checkout":
      sendWhatsAppOrder();
      break;
    case "clear-filters":
      activeCategory = "Todo";
      searchTerm = "";
      const searchInput = document.querySelector<HTMLInputElement>("[data-search]");
      if (searchInput) {
        searchInput.value = "";
      }
      document.querySelectorAll<HTMLButtonElement>(".filter-chip").forEach((button) => {
        const isActive = button.dataset.category === "Todo";
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      renderProducts();
      break;
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.matches("[data-variant-select]")) {
    return;
  }

  const productId = target.dataset.productId;
  if (!productId) {
    return;
  }

  selectedVariants.set(productId, target.value);
  const card = target.closest(".product-card");
  const addButton = card?.querySelector<HTMLButtonElement>('[data-action="add"]');
  if (addButton) {
    addButton.dataset.variantId = target.value;
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches("[data-search]")) {
    return;
  }

  searchTerm = target.value;
  renderProducts();
});

cartDialog.addEventListener("click", (event) => {
  if (event.target === cartDialog) {
    cartDialog.close();
  }
});

renderPage();
