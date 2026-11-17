// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrderStore, type OrderStore } from "./cart";
import { products } from "./catalog";
import { RESULT_COUNT_DELAY, mountCatalogView, type CatalogView } from "./catalog-view";
import { formatPrice } from "./format";
import { mountShell, squash } from "./test-utils";

let root: HTMLElement;
let store: OrderStore;
let view: CatalogView;

function mount(): void {
  store = createOrderStore({ createCode: () => "AGS-TEST", storage: null });
  view = mountCatalogView({ root, store });
}

beforeEach(() => {
  window.history.replaceState(null, "");
  root = mountShell();
});

afterEach(() => {
  view?.destroy();
  window.history.replaceState(null, "", window.location.pathname);
  vi.useRealTimers();
  vi.restoreAllMocks();
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

function cardImage(id: string): HTMLImageElement {
  return card(id).querySelector<HTMLImageElement>(".product-image")!;
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
      '.product-card input, .product-card button, [data-action="filter"], [data-search]',
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
    expect(priceText("fotos")).toBe(`${formatPrice(500)} por unidad`);
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

describe("cantidad", () => {
  function quantity(id: string): HTMLInputElement {
    return card(id).querySelector<HTMLInputElement>("[data-card-quantity]")!;
  }

  function step(id: string, action: "card-less" | "card-more"): HTMLButtonElement {
    const button = card(id).querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
    button.click();
    return button;
  }

  function type(id: string, value: string, key?: string): void {
    const input = quantity(id);
    input.value = value;
    if (key) {
      input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    } else {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  it("con + y − cambia cuántos suma el botón, con el precio de todos, y lo anuncia", () => {
    mount();
    const less = card("fotos").querySelector<HTMLButtonElement>('[data-action="card-less"]')!;
    expect(less.disabled).toBe(false);
    expect(less.getAttribute("aria-disabled")).toBe("true");
    step("fotos", "card-less");
    expect(quantity("fotos").value).toBe("1");

    step("fotos", "card-more");
    step("fotos", "card-more");
    step("fotos", "card-more");
    expect(quantity("fotos").value).toBe("4");
    expect(less.hasAttribute("aria-disabled")).toBe(false);
    expect(priceText("fotos")).toBe(`${formatPrice(500)} por unidad`);
    expect(squash(addButton("fotos").textContent)).toContain(`Sumar 4 · ${formatPrice(2000)}`);
    expect(squash(addButton("fotos").querySelector(".visually-hidden")!.textContent)).toBe(
      `Fotos para guardar, cantidad 4, ${formatPrice(2000)}`,
    );
    expect(announcer()).toBe("Cantidad de Fotos para guardar: 4");

    step("fotos", "card-less");
    addButton("fotos").click();
    expect(store.getState().lines.map((line) => [line.id, line.quantity])).toEqual([["fotos-polaroid", 3]]);
  });

  it("lo escrito queda entre 1 y 99, y Enter lo confirma", () => {
    mount();
    type("laminas", "250");
    expect(quantity("laminas").value).toBe("99");
    expect(card("laminas").querySelector('[data-action="card-more"]')!.getAttribute("aria-disabled")).toBe("true");

    type("laminas", "diez");
    expect(quantity("laminas").value).toBe("1");

    type("laminas", "10", "Enter");
    expect(squash(addButton("laminas").textContent)).toContain(`Sumar 10 · ${formatPrice(70000)}`);
  });

  it("Tarjetas no la lleva: elige la cantidad en sus opciones", () => {
    mount();
    expect(card("tarjetas").querySelector("[data-card-quantity]")).toBeNull();
    addButton("tarjetas").click();
    expect(store.getState().lines[0].quantity).toBe(1);
  });
});

describe("filtros y búsqueda", () => {
  it("'Para tu emprendimiento' muestra solo sus productos y queda presionado; 'Todo' vuelve a los 13", () => {
    mount();
    chip("marca").click();

    expect(visibleIds()).toEqual(["calendarios", "vinilos", "gran-formato", "dtf-textil", "tarjetas"]);
    expect(chip("marca").getAttribute("aria-pressed")).toBe("true");
    expect(chip("marca").classList.contains("is-active")).toBe(true);
    expect(chip("todo").getAttribute("aria-pressed")).toBe("false");

    chip("todo").click();
    expect(visibleIds()).toHaveLength(13);
    expect(emptyState().hidden).toBe(true);
  });

  it("llega con ?uso= desde los círculos del inicio y arranca con ese filtro", () => {
    window.history.replaceState(null, "", "?uso=marca");
    mount();

    expect(visibleIds()).toEqual(["calendarios", "vinilos", "gran-formato", "dtf-textil", "tarjetas"]);
    expect(chip("marca").getAttribute("aria-pressed")).toBe("true");
    expect(chip("todo").getAttribute("aria-pressed")).toBe("false");
  });

  it("llega con ?q= desde el buscador del encabezado y arranca con esa búsqueda", () => {
    window.history.replaceState(null, "", "?q=laminas");
    mount();

    expect(root.querySelector<HTMLInputElement>("[data-search]")!.value).toBe("laminas");
    expect(visibleIds()).toEqual(["laminas"]);
  });

  it("ordena las tarjetas por precio y por nombre, y vuelve al orden del catálogo", () => {
    mount();
    const select = root.querySelector<HTMLSelectElement>("[data-sort]")!;
    expect(select.disabled).toBe(false);
    const order = () =>
      Array.from(root.querySelectorAll<HTMLElement>(".product-grid > .product-card")).map((card) => card.dataset.productId!);
    const lowest = (id: string) => Math.min(...products.find((item) => item.id === id)!.combinations.map((c) => c.price));
    const original = order();

    const choose = (value: string) => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    choose("menor-precio");
    const ascending = order().map(lowest);
    expect([...ascending].sort((a, b) => a - b)).toEqual(ascending);
    expect(root.querySelector(".product-grid")!.lastElementChild?.hasAttribute("data-empty-state")).toBe(true);

    choose("mayor-precio");
    const descending = order().map(lowest);
    expect([...descending].sort((a, b) => b - a)).toEqual(descending);

    choose("nombre");
    const names = order().map((id) => products.find((item) => item.id === id)!.name);
    expect([...names].sort((a, b) => a.localeCompare(b, "es"))).toEqual(names);

    choose("destacados");
    expect(order()).toEqual(original);
  });

  it("un ?uso= que no existe deja todo el catálogo", () => {
    window.history.replaceState(null, "", "?uso=cualquiera");
    mount();

    expect(visibleIds()).toHaveLength(13);
    expect(chip("todo").getAttribute("aria-pressed")).toBe("true");
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
    expect(squash(count.textContent)).toBe("13 productos");

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
    expect(visibleIds()).toHaveLength(13);
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

describe("foto de la opción", () => {
  it("elegir el minijuego rosa cambia la foto de la tarjeta a la rosa; el amarillo, sin foto, la deja", () => {
    mount();
    const before = cardImage("minijuegos").getAttribute("src");
    choose("minijuegos", "color", "rosa");
    const image = cardImage("minijuegos");
    expect(image.getAttribute("src")).toBe("fotos/minijuegos-5.webp");
    expect(image.getAttribute("alt")).toBe("Minijuego rosa con sus dos fibrones, en la mano");
    expect(image.getAttribute("src")).not.toBe(before);

    choose("minijuegos", "color", "amarillo");
    expect(cardImage("minijuegos").getAttribute("src")).toBe("fotos/minijuegos-5.webp");
  });

  it("un dibujo del catálogo se ve entero y una foto vuelve a llenar el cuadro", () => {
    mount();
    choose("fotos", "formato", "tira");
    expect(cardImage("fotos").getAttribute("src")).toBe("fotos/opcion-fotos-tira.webp");
    expect(cardImage("fotos").closest(".product-image-wrap")?.classList.contains("is-contained")).toBe(true);

    choose("fotos", "formato", "iman-10x10");
    expect(cardImage("fotos").getAttribute("src")).toBe("fotos/fotos-1.webp");
    expect(cardImage("fotos").closest(".product-image-wrap")?.classList.contains("is-contained")).toBe(false);
  });

  it("en Calendarios cambia con el formato y con el color, el último que se toca", () => {
    mount();
    choose("calendarios", "formato", "acrilico");
    expect(cardImage("calendarios").getAttribute("src")).toBe("fotos/calendarios-10.webp");
    choose("calendarios", "colores", "frio");
    expect(cardImage("calendarios").getAttribute("src")).toBe("fotos/calendarios-14.webp");
  });

  it("cada paleta de Calendarios muestra su lámina de los doce meses, entera", () => {
    mount();
    // Pastel viene elegido: va al final, para que elegirlo sea un cambio.
    for (const [color, number] of [["intenso", 13], ["calido", 12], ["frio", 14], ["monocromo", 15], ["pastel", 16]] as const) {
      choose("calendarios", "colores", color);
      expect(cardImage("calendarios").getAttribute("src")).toBe(`fotos/calendarios-${number}.webp`);
      expect(cardImage("calendarios").getAttribute("alt")).toMatch(/^Los doce meses /);
      expect(cardImage("calendarios").closest(".product-image-wrap")?.classList.contains("is-contained")).toBe(true);
    }
  });

  it("en Bitácoras la A6 muestra las A6 en stock y la A5, las A5", () => {
    mount();
    choose("bitacoras", "formato", "bitacora-a6");
    expect(cardImage("bitacoras").getAttribute("src")).toBe("fotos/bitacoras-4.webp");
    expect(cardImage("bitacoras").getAttribute("alt")).toMatch(/^Bitácoras A6 /);
    choose("bitacoras", "formato", "bitacora-a5");
    expect(cardImage("bitacoras").getAttribute("src")).toBe("fotos/bitacoras-2.webp");
  });
});
