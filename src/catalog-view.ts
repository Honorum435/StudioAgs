import { MAX_QUANTITY, MIN_QUANTITY, clampQuantity, type OrderStore } from "./cart";
import {
  initialSelection,
  products,
  resolveSelection,
  type CatalogProduct,
  type Photo,
  type Selection,
} from "./catalog";
import { announceTo, delegateActions, rememberHtml, setHtml, windowOf, type ActionHandler } from "./dom";
import { ALL_INTENTS, isIntentFilter, visibleProductIds, type FilterState } from "./filters";
import { popNumber, slidingIndicator, swapText, type SlidingIndicator } from "./motion";
import {
  addButtonContent,
  cardPrice,
  resultCount,
  sortOptions,
  type SortId,
} from "./templates";

// Islas de las tarjetas, filtros y búsqueda. Se engancha al HTML prerenderizado sin
// volver a pintarlo: solo actualiza precio y botón de cada tarjeta y muestra u oculta tarjetas.

export const RESULT_COUNT_DELAY = 500;
export const ADDED_LABEL = "¡Sumado!";

export interface CatalogViewOptions {
  root: HTMLElement;
  store: Pick<OrderStore, "add">;
  catalog?: readonly CatalogProduct[];
  countDelay?: number;
}

export interface CatalogView {
  destroy(): void;
}

interface CardIsland {
  product: CatalogProduct;
  card: HTMLElement;
  price: HTMLElement | null;
  button: HTMLButtonElement | null;
  // Cuántos suma el botón; Tarjetas no lo tiene porque elige la cantidad en sus opciones.
  quantity: HTMLInputElement | null;
}

interface Choice {
  selection: Selection;
  addOnIds: string[];
}

function lowestPrice(product: CatalogProduct): number {
  return Math.min(...product.combinations.map((combination) => combination.price));
}

function isSortId(value: string): value is SortId {
  return sortOptions.some((option) => option.id === value);
}

// Orden de las tarjetas: "destacados" es el del catálogo; los empates quedan en ese orden.
export function sortProducts(catalog: readonly CatalogProduct[], sort: SortId): CatalogProduct[] {
  const compare: Record<SortId, (a: CatalogProduct, b: CatalogProduct) => number> = {
    destacados: () => 0,
    "menor-precio": (a, b) => lowestPrice(a) - lowestPrice(b),
    "mayor-precio": (a, b) => lowestPrice(b) - lowestPrice(a),
    nombre: (a, b) => a.name.localeCompare(b.name, "es"),
  };
  return [...catalog].sort(compare[sort]);
}

// Lee la opción marcada de cada grupo (la primera si no hay) y los adicionales marcados.
function readChoice({ card, product }: CardIsland): Choice {
  const fieldsets = Array.from(card.querySelectorAll<HTMLFieldSetElement>("fieldset[data-group]"));
  const selection: Record<string, string> = {};
  for (const group of product.groups) {
    const fieldset = fieldsets.find((item) => item.dataset.group === group.id);
    const radios = Array.from(fieldset?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? []);
    const checked = radios.find((radio) => radio.checked && group.options.some((option) => option.id === radio.value));
    if (checked) {
      selection[group.id] = checked.value;
      continue;
    }
    const first = group.options[0].id;
    selection[group.id] = first;
    const firstRadio = radios.find((radio) => radio.value === first);
    if (firstRadio) {
      firstRadio.checked = true;
    }
  }
  const addOnIds = Array.from(card.querySelectorAll<HTMLInputElement>('.addon-group input[type="checkbox"]'))
    .filter((input) => input.checked && product.addOns.some((addOn) => addOn.id === input.value))
    .map((input) => input.value);
  return { selection, addOnIds };
}

// En el tope, el botón de la cantidad sigue en el orden del teclado pero no hace nada.
function setInert(button: Element | null, inert: boolean): void {
  if (inert) {
    button?.setAttribute("aria-disabled", "true");
  } else {
    button?.removeAttribute("aria-disabled");
  }
}

// Lo escrito en la cantidad, entre 1 y 99; si no es un número, vuelve a 1. Deja el campo como
// quedó, así se ve lo que se va a sumar.
function readQuantity({ quantity }: CardIsland): number {
  if (!quantity) {
    return MIN_QUANTITY;
  }
  const raw = quantity.value.trim();
  const value = /^\d+$/.test(raw) ? clampQuantity(Number(raw)) : MIN_QUANTITY;
  if (quantity.value !== String(value)) {
    quantity.value = String(value);
  }
  return value;
}

// La foto grande de la galería pasa a la de esa posición y las miniaturas marcan cuál es. Las
// fotos de las opciones no tienen miniatura: con una de ellas, ninguna queda marcada.
function showSlide(gallery: HTMLElement, index: number): void {
  gallery.querySelectorAll<HTMLElement>("[data-gallery-photo]").forEach((photo, position) => {
    photo.hidden = position !== index;
  });
  gallery.querySelectorAll<HTMLElement>('[data-action="show-photo"]').forEach((thumb) => {
    const active = Number(thumb.dataset.photoIndex) === index;
    thumb.classList.toggle("is-active", active);
    thumb.setAttribute("aria-pressed", String(active));
  });
}

// En la tarjeta, la foto pasa a la de la opción; los dibujos del catálogo se ven enteros.
function paintCardImage(image: HTMLImageElement, photo: Photo): void {
  image.src = photo.src;
  image.alt = photo.alt;
  image.closest(".product-image-wrap")?.classList.toggle("is-contained", photo.contain);
}

export function mountCatalogView(options: CatalogViewOptions): CatalogView {
  const { root, store } = options;
  const catalog = options.catalog ?? products;
  const countDelay = options.countDelay ?? RESULT_COUNT_DELAY;
  const doc = root.ownerDocument;
  const win = windowOf(root);

  const toolbar = root.querySelector<HTMLElement>(".catalog-toolbar");
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action="filter"]'));
  const searchInput = root.querySelector<HTMLInputElement>("[data-search]");
  const grid = root.querySelector<HTMLElement>(".product-grid");
  const emptyState = root.querySelector<HTMLElement>("[data-empty-state]");
  const searchAllButton = root.querySelector<HTMLButtonElement>('[data-action="search-all"]');
  const sortSelect = root.querySelector<HTMLSelectElement>("[data-sort]");
  const resultCountElement = root.querySelector<HTMLElement>("[data-result-count]");
  const announcer = root.querySelector<HTMLElement>("[data-announcer]");

  const cards = new Map<string, CardIsland>();
  // Islas: las tarjetas del catálogo y el detalle de la página de un producto.
  root.querySelectorAll<HTMLElement>("[data-product-island][data-product-id]").forEach((card) => {
    const product = catalog.find((item) => item.id === card.dataset.productId);
    if (!product) {
      return;
    }
    const island: CardIsland = {
      product,
      card,
      price: card.querySelector<HTMLElement>("[data-card-price]"),
      button: card.querySelector<HTMLButtonElement>('[data-action="add"]'),
      quantity: card.querySelector<HTMLInputElement>("[data-card-quantity]"),
    };
    // El prerender pintó la primera opción: si sigue elegida, hidratar no reescribe nada.
    const initial = resolveSelection(product, initialSelection(product));
    if (initial && island.price) {
      rememberHtml(island.price, cardPrice(initial));
    }
    if (initial && island.button) {
      rememberHtml(island.button, addButtonContent(product, initial));
    }
    cards.set(product.id, island);
  });

  let filters: FilterState = { intent: ALL_INTENTS, query: searchInput?.value ?? "" };
  let countTimer: ReturnType<typeof setTimeout> | null = null;
  const indicators = new Map<HTMLElement, SlidingIndicator>();

  // Única función de actualización de la isla de la tarjeta: la usan la hidratación y los cambios.
  // Al hidratar no hay animación; al cambiar una opción el precio entra de nuevo.
  function paintCard(island: CardIsland, animate = false): void {
    const { selection, addOnIds } = readChoice(island);
    const resolved =
      resolveSelection(island.product, selection, addOnIds) ??
      resolveSelection(island.product, initialSelection(island.product));
    if (!resolved) {
      return;
    }
    if (island.price) {
      const before = animate ? island.price.querySelector(".product-price-amount")?.textContent : undefined;
      const amount = setHtml(island.price, cardPrice(resolved))
        ? island.price.querySelector<HTMLElement>(".product-price-amount")
        : null;
      if (animate && amount && amount.textContent !== before) {
        popNumber(amount, amount.textContent ?? "");
      }
    }
    const quantity = readQuantity(island);
    if (island.button) {
      setHtml(island.button, addButtonContent(island.product, resolved, quantity));
    }
    setInert(island.card.querySelector('[data-action="card-less"]'), quantity <= MIN_QUANTITY);
    setInert(island.card.querySelector('[data-action="card-more"]'), quantity >= MAX_QUANTITY);
  }

  // La opción elegida muestra su foto, como pidió la dueña: en la página del producto pasa a la
  // foto grande y en la tarjeta reemplaza la imagen.
  function showOptionPhoto(island: CardIsland, src: string): void {
    const gallery = island.card.querySelector<HTMLElement>("[data-gallery]");
    if (gallery) {
      const slides = Array.from(gallery.querySelectorAll<HTMLElement>("[data-gallery-photo]"));
      const index = slides.findIndex((slide) => slide.dataset.photoSrc === src);
      if (index >= 0) {
        showSlide(gallery, index);
      }
      return;
    }
    const photo = island.product.groups.flatMap((g) => g.options).find((o) => o.photo?.src === src)?.photo;
    const image = island.card.querySelector<HTMLImageElement>(".product-image");
    if (photo && image) {
      paintCardImage(image, photo);
    }
  }

  function stepQuantity(element: HTMLElement, step: number): void {
    const island = cards.get(element.dataset.productId ?? "");
    if (!island?.quantity || element.getAttribute("aria-disabled") === "true") {
      return;
    }
    island.quantity.value = String(clampQuantity(readQuantity(island) + step));
    paintCard(island, true);
    announce(`Cantidad de ${island.product.name}: ${island.quantity.value}`);
  }

  function announce(message: string): void {
    announceTo(announcer, message);
  }

  function scheduleCount(count: number): void {
    if (countTimer !== null) {
      clearTimeout(countTimer);
    }
    countTimer = setTimeout(() => {
      countTimer = null;
      if (resultCountElement) {
        resultCountElement.textContent = resultCount(count);
      }
    }, countDelay);
  }

  // La barra de filtros queda en el mismo lugar de la pantalla aunque la grilla se achique.
  function keepToolbarInPlace(change: () => void): void {
    if (!toolbar) {
      change();
      return;
    }
    const before = toolbar.getBoundingClientRect().top;
    grid?.style.removeProperty("min-height");
    change();
    const after = toolbar.getBoundingClientRect().top;
    if (Math.abs(after - before) < 1) {
      return;
    }
    // Si la barra ya estaba arriba de la pantalla, queda arriba de todo en lugar de dejar un hueco.
    const target = win.scrollY + after - Math.max(before, 0);
    const maxScroll = doc.documentElement.scrollHeight - win.innerHeight;
    if (grid && target > maxScroll) {
      grid.style.setProperty("min-height", `${Math.ceil(grid.offsetHeight + target - maxScroll)}px`);
    }
    win.scrollTo({ top: target, behavior: "instant" });
  }

  function applyFilters(next: FilterState): void {
    filters = next;
    const visible = new Set(visibleProductIds(catalog, filters));
    keepToolbarInPlace(() => {
      cards.forEach((island) => {
        island.card.hidden = !visible.has(island.product.id);
      });
      chips.forEach((chip) => {
        const active = chip.dataset.intent === filters.intent;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
      const shown = [...cards.values()].filter((island) => !island.card.hidden).length;
      if (emptyState) {
        emptyState.hidden = shown > 0;
      }
      if (searchAllButton) {
        searchAllButton.hidden = filters.intent === ALL_INTENTS;
      }
    });
    scheduleCount([...cards.values()].filter((island) => !island.card.hidden).length);
  }

  // Reacomoda las tarjetas de la grilla; el aviso de búsqueda vacía queda al final.
  function applySort(sort: SortId): void {
    if (!grid) {
      return;
    }
    const anchor = emptyState?.parentElement === grid ? emptyState : null;
    for (const product of sortProducts(catalog, sort)) {
      const island = cards.get(product.id);
      if (island && island.card.parentElement === grid) {
        grid.insertBefore(island.card, anchor);
      }
    }
    announce(`Productos ordenados por ${sortOptions.find((option) => option.id === sort)?.label.toLocaleLowerCase("es")}.`);
  }

  // Un manejador por data-action.
  const actions: Record<string, ActionHandler> = {
    add(element) {
      const island = cards.get(element.dataset.productId ?? "");
      if (!island) {
        return;
      }
      const { selection, addOnIds } = readChoice(island);
      if (store.add(island.product.id, selection, addOnIds, readQuantity(island))) {
        announce(`${island.product.name} sumado al pedido`);
        const label = island.button?.querySelector<HTMLElement>(".add-button-label");
        if (label) {
          swapText(label, ADDED_LABEL);
        }
      }
    },
    "card-less"(element) {
      stepQuantity(element, -1);
    },
    "card-more"(element) {
      stepQuantity(element, 1);
    },
    filter(element) {
      const intent = element.dataset.intent ?? "";
      if (isIntentFilter(intent)) {
        applyFilters({ ...filters, intent });
      }
    },
    "search-all"() {
      applyFilters({ intent: ALL_INTENTS, query: filters.query });
      searchInput?.focus({ preventScroll: true });
    },
    "clear-filters"() {
      if (searchInput) {
        searchInput.value = "";
      }
      applyFilters({ intent: ALL_INTENTS, query: "" });
      chips.find((chip) => chip.dataset.intent === ALL_INTENTS)?.focus({ preventScroll: true });
    },
    // Galería de la página del producto: la miniatura tocada pasa a la foto grande.
    "show-photo"(element) {
      const gallery = element.closest<HTMLElement>("[data-gallery]");
      const index = Number(element.dataset.photoIndex);
      if (gallery && Number.isInteger(index)) {
        showSlide(gallery, index);
      }
    },
  };

  function onChange(event: Event): void {
    const target = event.target;
    if (sortSelect && target === sortSelect) {
      applySort(isSortId(sortSelect.value) ? sortSelect.value : "destacados");
      return;
    }
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const card = target.closest<HTMLElement>("[data-product-island]");
    const island = card ? cards.get(card.dataset.productId ?? "") : undefined;
    if (island) {
      paintCard(island, true);
      if (target.type === "radio" && target.checked && target.dataset.photo) {
        showOptionPhoto(island, target.dataset.photo);
      }
      const list = target.closest<HTMLElement>(".option-list");
      if (list) {
        indicators.get(list)?.update(true);
      }
    }
  }

  function onInput(event: Event): void {
    if (searchInput && event.target === searchInput) {
      applyFilters({ ...filters, query: searchInput.value });
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    // Enter en la cantidad la confirma sin esperar a que el campo pierda el foco.
    if (event.key === "Enter" && target instanceof HTMLInputElement && target.hasAttribute("data-card-quantity")) {
      event.preventDefault();
      const card = target.closest<HTMLElement>("[data-product-island]");
      const island = card ? cards.get(card.dataset.productId ?? "") : undefined;
      if (island) {
        paintCard(island, true);
      }
    }
  }

  const removeActions = delegateActions(root, actions);
  root.addEventListener("change", onChange);
  root.addEventListener("input", onInput);
  root.addEventListener("keydown", onKeyDown);

  // Hidratación: pinta cada tarjeta según lo marcado y habilita sus controles. Los indicadores
  // miden el layout, así que van después de todas las escrituras.
  cards.forEach((island) => {
    paintCard(island);
    island.card.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      input.disabled = false;
    });
    island.card.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = false;
    });
  });
  cards.forEach((island) => {
    island.card.querySelectorAll<HTMLElement>(".option-list").forEach((list) => {
      indicators.set(list, slidingIndicator(list));
    });
  });
  chips.forEach((chip) => {
    chip.disabled = false;
  });
  root.querySelectorAll<HTMLButtonElement>('[data-action="show-photo"]').forEach((thumb) => {
    thumb.disabled = false;
  });
  if (searchInput) {
    searchInput.disabled = false;
  }
  if (sortSelect) {
    sortSelect.disabled = false;
    if (sortSelect.value !== "destacados" && isSortId(sortSelect.value)) {
      applySort(sortSelect.value);
    }
  }
  // Los círculos del inicio llegan con productos/?uso=<id> y el buscador del encabezado con
  // productos/?q=<texto>: el catálogo arranca con ese filtro y esa búsqueda.
  const params = new URLSearchParams(win.location.search);
  const requested = params.get("uso") ?? "";
  const intent = chips.length > 0 && isIntentFilter(requested) ? requested : ALL_INTENTS;
  const query = params.get("q")?.trim() ?? "";
  if (searchInput && query) {
    searchInput.value = query;
    filters = { ...filters, query };
  }
  if (intent !== ALL_INTENTS || filters.query.trim() !== "") {
    applyFilters({ ...filters, intent });
  }

  return {
    destroy() {
      removeActions();
      root.removeEventListener("change", onChange);
      root.removeEventListener("input", onInput);
      root.removeEventListener("keydown", onKeyDown);
      if (countTimer !== null) {
        clearTimeout(countTimer);
      }
      indicators.forEach((indicator) => indicator.destroy());
      indicators.clear();
    },
  };
}
