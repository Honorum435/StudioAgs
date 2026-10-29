// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrderStore, type OrderStore, type StorageLike } from "./cart";
import { mountCartView, type CartView } from "./cart-view";
import { initialSelection, products } from "./catalog";
import { ADDED_LABEL, mountCatalogView, type CatalogView } from "./catalog-view";
import { formatPrice } from "./format";
import { SWAP_DURATION, SWAP_HOLD, popNumber, scrollToTarget, slidingIndicator, swapText, tilt } from "./motion";
import { createOverlays, type Overlays } from "./overlays";
import { createMemoryStorage, mountShell, squash } from "./test-utils";

// Las animaciones se ven en el navegador; acá se prueba qué clases, textos y variables se ponen,
// en qué orden, y que con "reducir movimiento" todo llega al estado final al instante.

let root: HTMLElement;
let store: OrderStore;
let overlays: Overlays | null = null;
let catalogView: CatalogView | null = null;
let cartView: CartView | null = null;

const REDUCE = "(prefers-reduced-motion: reduce)";
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

function emulateMedia({ reduce = false, finePointer = true }: { reduce?: boolean; finePointer?: boolean }): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: (query === REDUCE && reduce) || (query === FINE_POINTER && finePointer),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

function createStore(storage: StorageLike | null = null): OrderStore {
  return createOrderStore({ createCode: () => "AGS-TEST", storage });
}

function mount(storage: StorageLike | null = null): void {
  store = createStore(storage);
  overlays = createOverlays();
  catalogView = mountCatalogView({ root, store, overlays });
  cartView = mountCartView({ root, store, overlays, whatsappNumber: "5491123456789" });
}

beforeEach(() => {
  window.history.replaceState(null, "");
  root = mountShell();
});

afterEach(() => {
  catalogView?.destroy();
  cartView?.destroy();
  overlays?.destroy();
  catalogView = null;
  cartView = null;
  overlays = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.layer;
});

function $<T extends Element = HTMLElement>(selector: string): T {
  return root.querySelector<T>(selector)!;
}

function addButton(id: string): HTMLButtonElement {
  return $<HTMLButtonElement>(`#producto-${id} [data-action="add"]`);
}

function labelOf(button: HTMLButtonElement): HTMLElement {
  return button.querySelector<HTMLElement>(".add-button-label")!;
}

// Lo que lee un lector de pantalla: todo menos lo marcado con aria-hidden.
function accessibleText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
  return squash(clone.textContent);
}

// Las clases que fue teniendo el elemento, en orden y sin repetir estados seguidos.
function recordClasses(element: Element): () => string[] {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(element, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  return () => {
    records.push(...observer.takeRecords());
    const states = [...records.map((record) => record.oldValue ?? ""), element.getAttribute("class") ?? ""];
    return states.filter((state, index) => index === 0 || state !== states[index - 1]);
  };
}

function starts(states: string[], token: string): number {
  const has = (state: string | undefined) => (state ?? "").split(" ").includes(token);
  return states.filter((state, index) => has(state) && !has(states[index - 1])).length;
}

function define(element: Element, values: Record<string, number>): void {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
}

describe("botón de sumar", () => {
  it("AE6: con reducir movimiento, la etiqueta y el contador cambian al instante y sin clases de animación", () => {
    vi.useFakeTimers();
    emulateMedia({ reduce: true });
    mount();
    const button = addButton("laminas");
    const label = labelOf(button);
    const count = $("[data-cart-count]");
    const labelClasses = recordClasses(label);
    const countClasses = recordClasses(count);

    button.click();

    // Sin avanzar ningún temporizador.
    expect(label.textContent).toBe(ADDED_LABEL);
    expect(squash(count.textContent)).toBe("1, 1 producto");
    expect(count.classList.contains("is-bumping")).toBe(false);

    vi.advanceTimersByTime(SWAP_HOLD);
    expect(label.textContent).toBe("Sumar");
    expect(labelClasses()).toEqual(["add-button-label"]);
    expect(starts(countClasses(), "is-bumping")).toBe(0);
  });

  it("sin reducir movimiento, pasa por las fases en orden y el nombre accesible conserva el producto", () => {
    vi.useFakeTimers();
    emulateMedia({ reduce: false });
    mount();
    const button = addButton("tarjetas");
    const label = labelOf(button);
    const forReaders = squash(button.querySelector(".visually-hidden")!.textContent);
    const classes = recordClasses(label);

    button.click();
    expect(label.textContent).toBe("Sumar");
    expect(label.classList.contains("is-exit")).toBe(true);

    vi.advanceTimersByTime(SWAP_DURATION);
    expect(label.textContent).toBe(ADDED_LABEL);
    expect(label.className).toBe("add-button-label");
    expect(forReaders).toContain("Tarjetas personales");
    expect(accessibleText(button)).toBe(`${ADDED_LABEL} ${forReaders}`);

    vi.advanceTimersByTime(SWAP_HOLD);
    expect(label.textContent).toBe(ADDED_LABEL);
    expect(label.classList.contains("is-exit")).toBe(true);

    vi.advanceTimersByTime(SWAP_DURATION);
    expect(label.textContent).toBe("Sumar");
    expect(accessibleText(button)).toBe(`Sumar ${forReaders}`);
    expect(classes()).toEqual([
      "add-button-label",
      "add-button-label is-exit",
      "add-button-label",
      "add-button-label is-enter-start",
      "add-button-label",
      "add-button-label is-exit",
      "add-button-label",
      "add-button-label is-enter-start",
      "add-button-label",
    ]);
  });

  it("sumar otra vez mientras dice ¡Sumado! alarga la espera en lugar de repetir las fases", () => {
    vi.useFakeTimers();
    emulateMedia({ reduce: false });
    const label = document.createElement("span");
    label.textContent = "Sumar";
    document.body.append(label);

    swapText(label, ADDED_LABEL);
    vi.advanceTimersByTime(SWAP_DURATION + SWAP_HOLD - 100);
    const classes = recordClasses(label);
    swapText(label, ADDED_LABEL);
    vi.advanceTimersByTime(SWAP_HOLD - 1);

    expect(label.textContent).toBe(ADDED_LABEL);
    expect(classes()).toEqual([""]);
    vi.advanceTimersByTime(1 + SWAP_DURATION);
    expect(label.textContent).toBe("Sumar");
  });
});

describe("contador del pedido", () => {
  it("sumar dos veces seguidas reinicia la animación del contador en lugar de apilarla", () => {
    emulateMedia({ reduce: false });
    mount();
    const count = $("[data-cart-count]");
    const classes = recordClasses(count);

    addButton("laminas").click();
    addButton("fotos").click();

    expect(squash(count.textContent)).toBe("2, 2 productos");
    expect(starts(classes(), "is-bumping")).toBe(2);
    expect(root.querySelectorAll(".is-bumping")).toHaveLength(1);
  });

  it("restaurar el pedido guardado o bajar la cantidad no hace saltar el contador", () => {
    emulateMedia({ reduce: false });
    const storage = createMemoryStorage();
    const laminas = products.find((product) => product.id === "laminas")!;
    createStore(storage).add("laminas", initialSelection(laminas), [], 2);
    const count = $("[data-cart-count]");
    const classes = recordClasses(count);

    mount(storage);
    expect(squash(count.textContent)).toBe("2, 2 productos");
    store.decrement(store.getState().lines[0].id);
    expect(squash(count.textContent)).toBe("1, 1 producto");

    expect(starts(classes(), "is-bumping")).toBe(0);
  });
});

describe("números que entran", () => {
  it("los dígitos animados quedan ocultos para lectores y el texto que se lee es el precio", () => {
    emulateMedia({ reduce: false });
    const price = document.createElement("strong");
    price.textContent = formatPrice(1000);
    document.body.append(price);
    const text = formatPrice(2500);

    popNumber(price, text);

    expect(price.textContent).toBe(text);
    expect(squash(price.querySelector(".visually-hidden")!.textContent)).toBe(squash(text));
    const group = price.querySelector<HTMLElement>(".digit-group")!;
    expect(group.getAttribute("aria-hidden")).toBe("true");
    expect(group.classList.contains("is-animating")).toBe(true);
    const digits = Array.from(group.children) as HTMLElement[];
    expect(digits.map((digit) => digit.dataset.char).join("")).toBe(text);
    expect(digits.slice(-2).map((digit) => digit.dataset.stagger)).toEqual(["1", "2"]);
    expect(digits.slice(0, -2).every((digit) => digit.dataset.stagger === undefined)).toBe(true);
  });

  it("con reducir movimiento cambia el texto sin dígitos animados ni retardos", () => {
    emulateMedia({ reduce: true });
    const price = document.createElement("strong");
    document.body.append(price);

    popNumber(price, formatPrice(2500));

    expect(price.textContent).toBe(formatPrice(2500));
    expect(price.children).toHaveLength(0);
  });

  it("el precio de la tarjeta entra al cambiar una opción, pero no al hidratar", () => {
    emulateMedia({ reduce: false });
    mount();
    const amount = () => $("#producto-tarjetas .product-price-amount");
    expect(amount().querySelector(".digit-group")).toBeNull();

    $<HTMLInputElement>('#producto-tarjetas fieldset[data-group="cantidad"] input[value="200"]').click();

    expect(amount().querySelector(".digit-group")).not.toBeNull();
    expect(amount().textContent).toBe(formatPrice(19300));
  });
});

describe("indicador deslizante de las opciones", () => {
  // Opciones con medidas inventadas: happy-dom no calcula el layout.
  function optionList(tops: number[], checked = 0): HTMLElement {
    const list = document.createElement("div");
    list.className = "option-list";
    list.innerHTML = tops
      .map(
        (_top, index) =>
          `<label class="option-chip"><input type="radio" name="grupo" value="${index}"${index === checked ? " checked" : ""} /><span>Opción ${index}</span></label>`,
      )
      .join("");
    document.body.append(list);
    define(list, { offsetWidth: 300 });
    list.querySelectorAll(".option-chip").forEach((chip, index) => {
      define(chip, { offsetTop: tops[index], offsetLeft: index * 90, offsetWidth: 84, offsetHeight: 44 });
    });
    return list;
  }

  it("solo aparece si todas las opciones entran en una línea, sin role=tablist", () => {
    const single = optionList([0, 0, 0], 1);
    const wrapped = optionList([0, 0, 50]);
    const first = slidingIndicator(single);
    const second = slidingIndicator(wrapped);

    expect(single.classList.contains("has-pill")).toBe(true);
    const pill = single.querySelector<HTMLElement>(".option-pill")!;
    expect(pill.getAttribute("aria-hidden")).toBe("true");
    expect(pill.style.getPropertyValue("--pill-x")).toBe("90px");
    expect(pill.style.getPropertyValue("--pill-w")).toBe("84px");
    expect(pill.style.getPropertyValue("--pill-h")).toBe("44px");
    expect(wrapped.classList.contains("has-pill")).toBe(false);
    expect(document.querySelector('[role="tablist"], [role="tab"]')).toBeNull();

    // Si al achicarse la pantalla el grupo pasa a otra línea, vuelve al estilo fijo.
    define(single.querySelectorAll(".option-chip")[2], { offsetTop: 50 });
    first.update();
    expect(single.classList.contains("has-pill")).toBe(false);

    first.destroy();
    second.destroy();
    expect(single.querySelector(".option-pill")).toBeNull();
  });

  it("al elegir otra opción se desliza; al volver a medir salta sin transición", () => {
    emulateMedia({ reduce: false });
    const list = optionList([0, 0, 0]);
    const indicator = slidingIndicator(list);
    const pill = list.querySelector<HTMLElement>(".option-pill")!;
    const classes = recordClasses(pill);

    list.querySelectorAll<HTMLInputElement>("input")[2].checked = true;
    indicator.update(true);
    expect(pill.style.getPropertyValue("--pill-x")).toBe("180px");
    expect(starts(classes(), "is-snapping")).toBe(0);

    indicator.update();
    expect(starts(classes(), "is-snapping")).toBe(1);
    expect(pill.classList.contains("is-snapping")).toBe(false);
    indicator.destroy();
  });

  it("con reducir movimiento también salta sin transición al elegir", () => {
    emulateMedia({ reduce: true });
    const list = optionList([0, 0]);
    const indicator = slidingIndicator(list);
    const pill = list.querySelector<HTMLElement>(".option-pill")!;
    const classes = recordClasses(pill);

    list.querySelectorAll<HTMLInputElement>("input")[1].checked = true;
    indicator.update(true);

    expect(starts(classes(), "is-snapping")).toBe(1);
    indicator.destroy();
  });
});

describe("inclinación de las polaroids", () => {
  function heroArt(): { area: HTMLElement; photo: HTMLElement } {
    const area = $(".hero-art");
    const photo = area.querySelector<HTMLElement>(".hero-photo-main")!;
    define(area, { offsetWidth: 400, offsetHeight: 400 });
    area.getBoundingClientRect = () => new DOMRect(0, 0, 400, 400);
    define(photo, { offsetLeft: 100, offsetTop: 0, offsetWidth: 200, offsetHeight: 300 });
    area.querySelectorAll<HTMLElement>(".hero-photo-small").forEach((small) => {
      define(small, { offsetLeft: 0, offsetTop: 300, offsetWidth: 50, offsetHeight: 50 });
    });
    return { area, photo };
  }

  function move(area: HTMLElement, pointerType: string): void {
    area.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType, clientX: 300, clientY: 0 }));
  }

  it("con mouse y puntero fino se inclina hacia el puntero y suma el reflejo; al salir vuelve", () => {
    emulateMedia({ reduce: false });
    const { area, photo } = heroArt();
    const stop = tilt(area);

    move(area, "mouse");
    expect(photo.classList.contains("is-hover")).toBe(true);
    expect(photo.style.getPropertyValue("--tilt-ry")).toBe("4.00deg");
    expect(photo.style.getPropertyValue("--tilt-rx")).toBe("4.00deg");
    expect(photo.style.getPropertyValue("--tilt-gx")).toBe("100.0%");

    area.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    expect(photo.classList.contains("is-hover")).toBe(false);
    expect(photo.style.getPropertyValue("--tilt-ry")).toBe("0deg");
    stop();
  });

  it("no se mueve con el dedo, sin puntero fino ni con reducir movimiento", () => {
    const { area, photo } = heroArt();
    const stop = tilt(area);

    emulateMedia({ reduce: false });
    move(area, "touch");
    vi.restoreAllMocks();
    emulateMedia({ reduce: false, finePointer: false });
    move(area, "mouse");
    vi.restoreAllMocks();
    emulateMedia({ reduce: true });
    move(area, "mouse");

    expect(photo.classList.contains("is-hover")).toBe(false);
    expect(photo.style.getPropertyValue("--tilt-ry")).toBe("");
    stop();
  });
});

describe("desplazamiento", () => {
  it("con reducir movimiento, 'Ver el catálogo' del pedido vacío lleva al catálogo al instante", async () => {
    emulateMedia({ reduce: true });
    mount();
    const trigger = $<HTMLButtonElement>(".cart-trigger");
    trigger.focus();
    trigger.click();
    const scroll = vi.fn();
    document.getElementById("catalogo")!.scrollIntoView = scroll;

    $<HTMLButtonElement>('[data-cart-content] [data-action="browse-products"]').click();

    await vi.waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "instant" }));
  });

  it("sin reducir movimiento es suave, y sin destino no hace nada", () => {
    emulateMedia({ reduce: false });
    const target = document.createElement("div");
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    document.body.append(target);

    scrollToTarget(target, { block: "nearest" });

    expect(scroll).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    expect(() => scrollToTarget(null)).not.toThrow();
  });
});
