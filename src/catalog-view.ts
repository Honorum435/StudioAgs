import type { OrderStore } from "./cart";
import { initialSelection, products, resolveSelection, type CatalogProduct, type Selection } from "./catalog";
import { announceTo, delegateActions, rememberHtml, setHtml, windowOf, type ActionHandler } from "./dom";
import { ALL_INTENTS, isIntentFilter, visibleProductIds, type FilterState } from "./filters";
import { popNumber, slidingIndicator, swapText, type SlidingIndicator } from "./motion";
import type { Overlays } from "./overlays";
import {
  FICHA_SIZES,
  addButtonContent,
  cardPrice,
  fichaContent,
  fichaTitle,
  resultCount,
  sortOptions,
  type SortId,
} from "./templates";

// Islas de las tarjetas, filtros, búsqueda y ficha. Se engancha al HTML prerenderizado sin
// volver a pintarlo: solo actualiza precio y botón de cada tarjeta y muestra u oculta tarjetas.

export const FICHA_LAYER = "ficha";
export const RESULT_COUNT_DELAY = 500;
export const ADDED_LABEL = "¡Sumado!";

export interface CatalogViewOptions {
  root: HTMLElement;
  store: Pick<OrderStore, "add">;
  overlays: Overlays;
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
}

interface Choice {
  selection: Selection;
  addOnIds: string[];
}

interface OpenFicha {
  product: CatalogProduct;
  frame: HTMLElement;
  image: HTMLImageElement;
  ready: boolean;
  zoomed: boolean;
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

function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function mountCatalogView(options: CatalogViewOptions): CatalogView {
  const { root, store, overlays } = options;
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
  const fichaDialog = root.querySelector<HTMLDialogElement>("dialog#ficha-dialog");
  const fichaBody = fichaDialog?.querySelector<HTMLElement>("[data-ficha-body]") ?? null;
  const fichaHeading = fichaDialog?.querySelector<HTMLElement>("[data-ficha-title]") ?? null;

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
  let ficha: OpenFicha | null = null;
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
    if (island.button) {
      setHtml(island.button, addButtonContent(island.product, resolved));
    }
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

  function zoomWidth(fitWidth: number, product: CatalogProduct): number {
    const density = win.devicePixelRatio || 1;
    return Math.round(Math.max(fitWidth * 2, product.images.ficha.width / density));
  }

  // Alterna entre la página ajustada al ancho y ampliada, manteniendo el punto tocado en su lugar.
  function toggleZoom(point?: { x: number; y: number }): void {
    if (!ficha?.ready || !fichaBody) {
      return;
    }
    const { frame, image, product } = ficha;
    const box = fichaBody.getBoundingClientRect();
    const rect = image.getBoundingClientRect();
    const x = point?.x ?? box.left + box.width / 2;
    const y = point?.y ?? box.top + box.height / 2;
    const ratioX = rect.width > 0 ? (x - rect.left) / rect.width : 0;
    const ratioY = rect.height > 0 ? (y - rect.top) / rect.height : 0;

    ficha.zoomed = !ficha.zoomed;
    frame.classList.toggle("is-zoomed", ficha.zoomed);
    if (ficha.zoomed) {
      const width = zoomWidth(fichaBody.clientWidth, product);
      frame.style.setProperty("--ficha-zoom-width", `${width}px`);
      image.sizes = `${width}px`;
    } else {
      frame.style.removeProperty("--ficha-zoom-width");
      image.sizes = FICHA_SIZES;
    }

    const next = image.getBoundingClientRect();
    fichaBody.scrollLeft += next.left + ratioX * next.width - x;
    fichaBody.scrollTop += next.top + ratioY * next.height - y;
  }

  function settleFicha(state: OpenFicha, loaded: boolean): void {
    if (ficha !== state || state.ready || !fichaBody) {
      return;
    }
    fichaBody.removeAttribute("aria-busy");
    if (loaded) {
      state.ready = true;
      state.image.hidden = false;
      fichaBody.querySelector<HTMLElement>("[data-ficha-placeholder]")?.setAttribute("hidden", "");
    } else {
      fichaBody.querySelector<HTMLElement>("[data-ficha-error]")?.removeAttribute("hidden");
    }
  }

  function openFicha(link: HTMLElement, event: MouseEvent): void {
    const island = cards.get(link.dataset.productId ?? "");
    // Con modificadores o sin diálogo, el enlace abre la imagen como siempre.
    if (!island || !fichaDialog || !fichaBody || !isPlainClick(event)) {
      return;
    }
    event.preventDefault();
    if (overlays.current()) {
      return;
    }
    const { product } = island;
    const cardImage = island.card.querySelector<HTMLImageElement>("img.product-image");
    if (fichaHeading) {
      fichaHeading.textContent = fichaTitle(product);
    }
    fichaBody.innerHTML = fichaContent(product, cardImage?.currentSrc || undefined);
    fichaBody.setAttribute("aria-busy", "true");

    const frame = fichaBody.querySelector<HTMLElement>(".ficha-frame")!;
    const image = fichaBody.querySelector<HTMLImageElement>("[data-ficha-image]")!;
    const state: OpenFicha = { product, frame, image, ready: false, zoomed: false };
    ficha = state;
    image.addEventListener("load", () => settleFicha(state, true), { once: true });
    image.addEventListener("error", () => settleFicha(state, false), { once: true });
    if (image.complete && image.naturalWidth > 0) {
      settleFicha(state, true);
    }

    if (overlays.open(FICHA_LAYER, { opener: link })) {
      // Recién con el diálogo a la vista: cerrado conserva el desplazamiento de la vez anterior.
      fichaBody.scrollTop = 0;
      fichaBody.scrollLeft = 0;
      fichaBody.focus({ preventScroll: true });
    }
  }

  function clearFicha(): void {
    ficha = null;
    if (fichaBody) {
      fichaBody.innerHTML = "";
      fichaBody.removeAttribute("aria-busy");
    }
  }

  // Un manejador por data-action.
  const actions: Record<string, ActionHandler> = {
    add(element) {
      const island = cards.get(element.dataset.productId ?? "");
      if (!island) {
        return;
      }
      const { selection, addOnIds } = readChoice(island);
      if (store.add(island.product.id, selection, addOnIds)) {
        announce(`${island.product.name} sumado al pedido`);
        const label = island.button?.querySelector<HTMLElement>(".add-button-label");
        if (label) {
          swapText(label, ADDED_LABEL);
        }
      }
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
    "open-ficha": openFicha,
    "close-ficha"() {
      void overlays.close(FICHA_LAYER);
    },
    "zoom-ficha"(_element, event) {
      toggleZoom({ x: event.clientX, y: event.clientY });
    },
    // Galería de la página del producto: la miniatura tocada pasa a la foto grande.
    "show-photo"(element) {
      const gallery = element.closest<HTMLElement>("[data-gallery]");
      const index = Number(element.dataset.photoIndex);
      if (!gallery || !Number.isInteger(index)) {
        return;
      }
      gallery.querySelectorAll<HTMLElement>("[data-gallery-photo]").forEach((photo, position) => {
        photo.hidden = position !== index;
      });
      gallery.querySelectorAll<HTMLElement>('[data-action="show-photo"]').forEach((thumb) => {
        const active = thumb === element;
        thumb.classList.toggle("is-active", active);
        thumb.setAttribute("aria-pressed", String(active));
      });
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
    if (event.key === "Enter" && fichaBody && event.target === fichaBody && ficha?.ready) {
      event.preventDefault();
      toggleZoom();
    }
  }

  if (fichaDialog) {
    overlays.register(FICHA_LAYER, fichaDialog, { onClose: clearFicha });
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
    if (island.button) {
      island.button.disabled = false;
    }
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
