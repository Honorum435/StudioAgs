// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrderStore, type OrderStore } from "./cart";
import { FICHA_LAYER, RESULT_COUNT_DELAY, mountCatalogView, type CatalogView } from "./catalog-view";
import { formatPrice } from "./format";
import { LAYER_STATE_KEY, createOverlays, type Overlays } from "./overlays";
import { mountShell, nextPopState, squash } from "./test-utils";

let root: HTMLElement;
let store: OrderStore;
let overlays: Overlays;
let view: CatalogView;

function mount(): void {
  store = createOrderStore({ createCode: () => "AGS-TEST", storage: null });
  overlays = createOverlays();
  view = mountCatalogView({ root, store, overlays });
}

beforeEach(() => {
  window.history.replaceState(null, "");
  root = mountShell();
});

afterEach(() => {
  view?.destroy();
  overlays?.destroy();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.layer;
});

function card(id: string): HTMLElement {
  return root.querySelector<HTMLElement>(`#producto-${id}`)!;
}

function priceText(id: string): string {
  return squash(card(id).querySelector("[data-card-price]")!.textContent);
}

function addButton(id: string): HTMLButtonElement {
  return card(id).querySelector<HTMLButtonElement>('[data-action="add"]')!;
}

function choose(id: string, group: string, value: string): void {
  const input = Array.from(
    card(id).querySelectorAll<HTMLInputElement>(`fieldset[data-group="${group}"] input[type="radio"]`),
  ).find((radio) => radio.value === value)!;
  input.click();
}

function addOn(id: string, value: string): HTMLInputElement {
  return Array.from(card(id).querySelectorAll<HTMLInputElement>('.addon-group input[type="checkbox"]')).find(
    (input) => input.value === value,
  )!;
}

function chip(intent: string): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>(`[data-action="filter"][data-intent="${intent}"]`)!;
}

function search(value: string): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>("[data-search]")!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

function visibleIds(): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".product-card"))
    .filter((item) => !item.hidden)
    .map((item) => item.dataset.productId!);
}

function emptyState(): HTMLElement {
  return root.querySelector<HTMLElement>("[data-empty-state]")!;
}

function announcer(): string {
  return squash(root.querySelector("[data-announcer]")!.textContent).replace(/ /g, "");
}

describe("hidratación de las tarjetas", () => {
  it("habilita opciones, adicionales, botones de sumar, filtros y buscador", () => {
    mount();

    const controls = root.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      '.product-card input, [data-action="add"], [data-action="filter"], [data-search]',
    );
    expect(controls.length).toBeGreaterThan(20);
    controls.forEach((control) => expect(control.disabled).toBe(false));
    // El botón del pedido lo habilita la vista del pedido.
    expect(root.querySelector<HTMLButtonElement>('.cart-trigger[data-action="open-cart"]')!.disabled).toBe(true);
    expect(root.hasAttribute("data-prerendered")).toBe(true);
  });

  it("toma el radio marcado (por si el navegador lo restauró) y pinta precio y botón", () => {
    const restored = Array.from(card("tarjetas").querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    restored.find((radio) => radio.value === "100")!.checked = false;
    restored.find((radio) => radio.value === "200")!.checked = true;
    mount();

    expect(priceText("tarjetas")).toBe(`${formatPrice(19300)} pack de 200`);
    expect(squash(addButton("tarjetas").textContent)).toContain(`Sumar · ${formatPrice(19300)}`);
  });

  it("si un grupo no tiene nada marcado, marca la primera opción", () => {
    card("fotos").querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((radio) => {
      radio.checked = false;
    });
    mount();

    const first = card("fotos").querySelector<HTMLInputElement>('input[type="radio"]')!;
    expect(first.checked).toBe(true);
    expect(priceText("fotos")).toBe(`${formatPrice(800)} por unidad`);
  });
});

describe("precio en vivo", () => {
  it("AE1: 200 · doble faz · laminado actualiza el precio y el botón a $26.300", () => {
    mount();
    const button = addButton("tarjetas");
    choose("tarjetas", "cantidad", "200");
    choose("tarjetas", "faz", "doble-faz");
    choose("tarjetas", "terminacion", "laminado");

    expect(priceText("tarjetas")).toBe(`${formatPrice(26300)} pack de 200`);
    expect(squash(button.textContent)).toContain(`Sumar · ${formatPrice(26300)}`);
    // El nombre para lectores conserva el producto y el precio; el botón es el mismo nodo.
    expect(squash(button.querySelector(".visually-hidden")!.textContent)).toBe(
      `Tarjetas personales, ${formatPrice(26300)}`,
    );
    expect(addButton("tarjetas")).toBe(button);
  });

  it("marcar la maqueta en Vinilos suma $2.500; sumar crea la línea y su sublínea y lo anuncia", () => {
    mount();
    expect(priceText("vinilos")).toBe(`${formatPrice(14500)} por pliego`);

    addOn("vinilos", "vinilos-maqueta").click();
    expect(priceText("vinilos")).toBe(`${formatPrice(17000)} por pliego, con adicionales`);
    expect(squash(addButton("vinilos").textContent)).toContain(`Sumar · ${formatPrice(17000)}`);

    addButton("vinilos").click();
    const [line] = store.getSummary().lines;
    expect(store.getState().lines).toHaveLength(1);
    expect(line.combination.id).toBe("vinilos-blanco-sin-laca");
    expect(line.addOns.map((item) => item.id)).toEqual(["vinilos-maqueta"]);
    expect(announcer()).toBe("Vinilos impresos sumado al pedido");
  });

  it("sumar dos veces el mismo producto lo vuelve a anunciar", () => {
    mount();
    const region = root.querySelector("[data-announcer]")!;
    addButton("laminas").click();
    const first = region.textContent;
    addButton("laminas").click();

    expect(region.textContent).not.toBe(first);
    expect(announcer()).toBe("Láminas sumado al pedido");
    expect(store.getState().lines[0].quantity).toBe(2);
  });
});

describe("filtros y búsqueda", () => {
  it("'Para tu emprendimiento' muestra solo sus productos y queda presionado; 'Todo' vuelve a los 8", () => {
    mount();
    chip("marca").click();

    expect(visibleIds()).toEqual(["calendarios", "vinilos", "tarjetas"]);
    expect(chip("marca").getAttribute("aria-pressed")).toBe("true");
    expect(chip("marca").classList.contains("is-active")).toBe(true);
    expect(chip("todo").getAttribute("aria-pressed")).toBe("false");

    chip("todo").click();
    expect(visibleIds()).toHaveLength(8);
    expect(emptyState().hidden).toBe(true);
  });

  it("buscar no reemplaza las tarjetas y el buscador sigue enfocado", () => {
    mount();
    const before = Array.from(root.querySelectorAll(".product-card"));
    const input = root.querySelector<HTMLInputElement>("[data-search]")!;
    input.focus();
    search("laminas");

    expect(visibleIds()).toEqual(["laminas"]);
    expect(Array.from(root.querySelectorAll(".product-card"))).toEqual(before);
    before.forEach((node) => expect(node.isConnected).toBe(true));
    expect(document.activeElement).toBe(input);
    expect(input.isConnected).toBe(true);

    search("doble faz");
    expect(visibleIds()).toEqual(["tarjetas"]);
  });

  it("anuncia la cantidad de resultados una sola vez, con demora", () => {
    vi.useFakeTimers();
    mount();
    const count = root.querySelector<HTMLElement>("[data-result-count]")!;
    expect(count.getAttribute("role")).toBe("status");

    search("l");
    search("la");
    search("lam");
    search("laminas");
    vi.advanceTimersByTime(RESULT_COUNT_DELAY - 1);
    expect(squash(count.textContent)).toBe("8 productos");

    vi.advanceTimersByTime(1);
    expect(squash(count.textContent)).toBe("1 producto");
  });

  it("filtro más búsqueda sin coincidencias muestra el estado vacío; 'Buscar en todo' conserva el término", () => {
    mount();
    chip("marca").click();
    const input = search("laminas");

    expect(visibleIds()).toEqual([]);
    expect(emptyState().hidden).toBe(false);
    const searchAll = root.querySelector<HTMLButtonElement>('[data-action="search-all"]')!;
    expect(searchAll.hidden).toBe(false);

    searchAll.click();
    expect(input.value).toBe("laminas");
    expect(chip("todo").getAttribute("aria-pressed")).toBe("true");
    expect(visibleIds()).toEqual(["laminas"]);
    expect(emptyState().hidden).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it("sin filtro de intención, el estado vacío no ofrece 'Buscar en todo'; 'Ver todo' limpia todo", () => {
    mount();
    const input = search("zzz");

    expect(emptyState().hidden).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-action="search-all"]')!.hidden).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-action="clear-filters"]')!.click();
    expect(input.value).toBe("");
    expect(visibleIds()).toHaveLength(8);
    expect(document.activeElement).toBe(chip("todo"));
  });

  it("si la grilla se achica, desplaza la página para que la barra de filtros no se mueva", () => {
    mount();
    const toolbar = root.querySelector<HTMLElement>(".catalog-toolbar")!;
    const tops = [120, 160];
    vi.spyOn(toolbar, "getBoundingClientRect").mockImplementation(
      () => ({ top: tops.shift() ?? 160 }) as DOMRect,
    );
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    chip("marca").click();

    expect(scrollTo).toHaveBeenCalledWith({ top: window.scrollY + 40, behavior: "instant" });
  });

  it("si la barra estaba arriba de la pantalla, la deja arriba de todo en lugar de dejar un hueco", () => {
    mount();
    const toolbar = root.querySelector<HTMLElement>(".catalog-toolbar")!;
    const tops = [-1500, -100];
    vi.spyOn(toolbar, "getBoundingClientRect").mockImplementation(
      () => ({ top: tops.shift() ?? -100 }) as DOMRect,
    );
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    search("doble faz");

    expect(scrollTo).toHaveBeenCalledWith({ top: window.scrollY - 100, behavior: "instant" });
  });
});

describe("Ver ficha", () => {
  function fichaLink(id: string): HTMLAnchorElement {
    return card(id).querySelector<HTMLAnchorElement>('[data-action="open-ficha"]')!;
  }

  function dialog(): HTMLDialogElement {
    return root.querySelector<HTMLDialogElement>("#ficha-dialog")!;
  }

  function body(): HTMLElement {
    return root.querySelector<HTMLElement>("[data-ficha-body]")!;
  }

  // Devuelve si la vista interceptó el enlace; después frena la navegación de happy-dom.
  function clickLink(link: HTMLAnchorElement, init: MouseEventInit = {}): boolean {
    let intercepted = false;
    const record = (event: Event) => {
      intercepted = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener("click", record, { once: true });
    link.focus();
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
    return intercepted;
  }

  it("intercepta el enlace y abre el diálogo con la foto de la tarjeta mientras carga la página", () => {
    mount();
    const link = fichaLink("tarjetas");

    expect(clickLink(link)).toBe(true);
    expect(dialog().open).toBe(true);
    expect(overlays.current()).toBe(FICHA_LAYER);
    expect((window.history.state as Record<string, unknown>)[LAYER_STATE_KEY]).toBe(FICHA_LAYER);
    expect(squash(root.querySelector("[data-ficha-title]")!.textContent)).toBe("Ficha de Tarjetas personales");

    const image = body().querySelector<HTMLImageElement>("[data-ficha-image]")!;
    const placeholder = body().querySelector<HTMLImageElement>("[data-ficha-placeholder]")!;
    expect(image.getAttribute("alt")).toBe("Página del catálogo de Tarjetas personales, con sus formatos y precios");
    expect(image.getAttribute("src")).toBe("images/ficha-tarjetas-1800.webp");
    expect(image.hidden).toBe(true);
    expect(placeholder.hidden).toBe(false);
    expect(placeholder.getAttribute("alt")).toBe("");
    expect(body().getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(body());
    expect(body().getAttribute("tabindex")).toBe("0");
  });

  it("cuando carga la página la muestra; tocarla o Enter alternan entre ajustada y ampliada", () => {
    mount();
    clickLink(fichaLink("vinilos"));
    const image = body().querySelector<HTMLImageElement>("[data-ficha-image]")!;
    const frame = body().querySelector<HTMLElement>(".ficha-frame")!;
    image.dispatchEvent(new Event("load"));

    expect(image.hidden).toBe(false);
    expect(body().querySelector<HTMLElement>("[data-ficha-placeholder]")!.hidden).toBe(true);
    expect(body().hasAttribute("aria-busy")).toBe(false);

    image.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
    expect(frame.classList.contains("is-zoomed")).toBe(true);
    expect(frame.style.getPropertyValue("--ficha-zoom-width")).toMatch(/^\d+px$/);
    expect(image.getAttribute("sizes")).toMatch(/^\d+px$/);

    body().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(frame.classList.contains("is-zoomed")).toBe(false);
    expect(frame.style.getPropertyValue("--ficha-zoom-width")).toBe("");
  });

  it("si la página no carga, muestra un mensaje y no se puede ampliar", () => {
    mount();
    clickLink(fichaLink("fotos"));
    const image = body().querySelector<HTMLImageElement>("[data-ficha-image]")!;
    image.dispatchEvent(new Event("error"));

    expect(body().querySelector<HTMLElement>("[data-ficha-error]")!.hidden).toBe(false);
    expect(image.hidden).toBe(true);
    body().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(body().querySelector(".ficha-frame")!.classList.contains("is-zoomed")).toBe(false);
  });

  // El anunciador de afuera queda inerte con el diálogo modal abierto: el aviso va como alerta adentro.
  it("el mensaje de error de la ficha se anuncia como alerta dentro del diálogo", () => {
    mount();
    clickLink(fichaLink("tarjetas"));
    body().querySelector<HTMLImageElement>("[data-ficha-image]")!.dispatchEvent(new Event("error"));

    const error = body().querySelector<HTMLElement>("[data-ficha-error]")!;
    expect(error.hidden).toBe(false);
    expect(error.getAttribute("role")).toBe("alert");
    expect(dialog().contains(error)).toBe(true);
    expect(squash(error.textContent)).toBe("No pudimos cargar la ficha. Revisá tu conexión y volvé a abrirla.");
  });

  it("con Ctrl o Cmd el enlace abre la imagen como siempre", () => {
    mount();

    expect(clickLink(fichaLink("tarjetas"), { ctrlKey: true })).toBe(false);
    expect(dialog().open).toBe(false);
  });

  it("Atrás cierra la ficha y devuelve el foco a 'Ver ficha'", async () => {
    mount();
    const link = fichaLink("laminas");
    clickLink(link);
    const back = vi.spyOn(window.history, "back");
    const popped = nextPopState();
    window.history.back();
    await popped;

    expect(dialog().open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(link);
    expect(body().innerHTML).toBe("");
  });

  it("el botón de cerrar retrocede el historial una sola vez", async () => {
    mount();
    const link = fichaLink("calendarios");
    clickLink(link);
    const back = vi.spyOn(window.history, "back");
    const popped = nextPopState();
    root.querySelector<HTMLButtonElement>('[data-action="close-ficha"]')!.click();
    await popped;

    expect(dialog().open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect((window.history.state as Record<string, unknown> | null)?.[LAYER_STATE_KEY]).toBeUndefined();
    expect(document.activeElement).toBe(link);
  });

  it("cargar la página con un estado de ficha abierta no la reabre", () => {
    window.history.replaceState({ [LAYER_STATE_KEY]: FICHA_LAYER }, "");
    mount();

    expect(dialog().open).toBe(false);
    expect(window.history.state).toBeNull();
  });
});
