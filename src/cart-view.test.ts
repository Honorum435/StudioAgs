// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IDEA_MAX_LENGTH,
  STORAGE_KEY,
  createOrderStore,
  type OrderStore,
  type StorageLike,
} from "./cart";
import { initialSelection, products } from "./catalog";
import { IDEA_COUNTER_FROM, ORDER_LAYER, mountCartView, type CartView } from "./cart-view";
import { formatPrice, toIsoDate } from "./format";
import { createOverlays, type Overlays } from "./overlays";
import { createMemoryStorage, mountShell, squash } from "./test-utils";
import { buildOrderMessage } from "./whatsapp";

const NUMBER = "5491123456789";

let root: HTMLElement;
let storage: StorageLike;
let store: OrderStore;
let overlays: Overlays;
let view: CartView;

interface MountOptions {
  number?: string;
  storage?: StorageLike;
}

function mount(options: MountOptions = {}): void {
  storage = options.storage ?? createMemoryStorage();
  store = createOrderStore({ createCode: () => "AGS-TEST", storage, now: () => new Date(2026, 9, 29, 10) });
  overlays = createOverlays();
  view = mountCartView({
    root,
    store,
    overlays,
    whatsappNumber: "number" in options ? options.number : NUMBER,
  });
}

beforeEach(() => {
  window.history.replaceState(null, "");
  root = mountShell();
});

afterEach(() => {
  view?.destroy();
  overlays?.destroy();
  vi.restoreAllMocks();
  delete (navigator as unknown as Record<string, unknown>).clipboard;
  delete (document as unknown as Record<string, unknown>).execCommand;
  delete document.documentElement.dataset.layer;
});

function add(id: string, addOnIds: string[] = [], quantity = 1): string {
  const product = products.find((item) => item.id === id)!;
  return store.add(id, initialSelection(product), addOnIds, quantity)!;
}

function $<T extends Element = HTMLElement>(selector: string): T {
  return root.querySelector<T>(selector)!;
}

function line(id: string): HTMLElement {
  return $(`.cart-item[data-line-id="${id}"]`);
}

function inLine<T extends Element = HTMLButtonElement>(id: string, selector: string): T {
  return line(id).querySelector<T>(selector)!;
}

function live(): string {
  return squash($("[data-cart-live]").textContent).replace(/ /g, "").trim();
}

function dialog(): HTMLDialogElement {
  return $<HTMLDialogElement>("#cart-dialog");
}

function bar(): HTMLElement {
  return $("[data-sticky-bar]");
}

function openPanel(): void {
  const trigger = $<HTMLButtonElement>(".cart-trigger");
  trigger.focus();
  trigger.click();
}

function type(input: HTMLInputElement | HTMLTextAreaElement, value: string, event = "input"): void {
  input.value = value;
  input.dispatchEvent(new Event(event, { bubbles: true }));
}

function fillForm(name = "Ana", delivery: "retiro" | "envio" = "retiro"): void {
  type($<HTMLInputElement>("#pedido-nombre"), name);
  $<HTMLInputElement>(`input[name="pedido-entrega"][value="${delivery}"]`).click();
}

function continueOrder(): HTMLButtonElement {
  const button = $<HTMLButtonElement>('[data-action="checkout"]');
  button.focus();
  button.click();
  return button;
}

function whatsappLink(): HTMLAnchorElement | null {
  return root.querySelector<HTMLAnchorElement>('a[data-action="open-whatsapp"]');
}

function mockClipboard(writeText: () => Promise<void>, execCommand: () => boolean = () => false) {
  const clipboard = { writeText: vi.fn(writeText) };
  const exec = vi.fn(execCommand);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
  Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
  return { writeText: clipboard.writeText, execCommand: exec };
}

// Frena la navegación de happy-dom al tocar el enlace a WhatsApp.
function stopNavigation(): void {
  window.addEventListener("click", (event) => event.preventDefault(), { once: true });
}

describe("hidratación del pedido", () => {
  it("habilita el botón del pedido y pinta contador y barra según el almacén", () => {
    mount();
    const trigger = $<HTMLButtonElement>(".cart-trigger");
    const count = $("[data-cart-count]");

    expect(trigger.disabled).toBe(false);
    expect(count.classList.contains("is-empty")).toBe(true);
    expect(bar().hidden).toBe(true);
    expect(bar().hasAttribute("data-active")).toBe(false);

    add("laminas", [], 2);
    expect(count.classList.contains("is-empty")).toBe(false);
    expect(squash(count.textContent)).toBe("2, 2 productos");
    expect(bar().hidden).toBe(false);
    expect(bar().hasAttribute("data-active")).toBe(true);
    expect(squash(bar().querySelector(".sticky-bar-summary")!.textContent)).toBe(
      `2 productos ${formatPrice(14000)} El total final se confirma por WhatsApp.`,
    );
  });
});

describe("líneas del pedido", () => {
  it("'+' deja el foco en el '+' de esa línea, actualiza en el lugar y anuncia la cantidad", () => {
    mount();
    const id = add("laminas");
    add("fotos");
    openPanel();
    const item = line(id);
    const plus = inLine(id, '[data-action="increment"]');
    plus.focus();
    plus.click();

    expect(store.getState().lines[0].quantity).toBe(2);
    expect(line(id)).toBe(item);
    expect(document.activeElement).toBe(plus);
    expect(inLine<HTMLInputElement>(id, "[data-quantity]").value).toBe("2");
    expect(squash(inLine(id, "[data-line-total]").textContent)).toBe(formatPrice(14000));
    expect(live()).toBe("Cantidad de Láminas: 2");
    expect(inLine(id, '[data-action="decrement"]').hasAttribute("aria-disabled")).toBe(false);
  });

  it("'–' queda inactivo en 1 sin perder el foco", () => {
    mount();
    const id = add("laminas", [], 2);
    openPanel();
    const minus = inLine(id, '[data-action="decrement"]');
    minus.focus();
    minus.click();

    expect(store.getState().lines[0].quantity).toBe(1);
    expect(minus.getAttribute("aria-disabled")).toBe("true");
    expect(minus.disabled).toBe(false);

    minus.click();
    expect(store.getState().lines[0].quantity).toBe(1);
    expect(document.activeElement).toBe(minus);
    expect(live()).toBe("Ya está en 1. Para sacarlo, tocá Quitar.");
  });

  it("quitar la única línea anuncia el producto y lleva el foco al botón del estado vacío", () => {
    mount();
    const id = add("laminas");
    openPanel();
    const remove = inLine(id, '[data-action="remove-line"]');
    remove.focus();
    remove.click();

    expect(store.getState().lines).toHaveLength(0);
    expect(live()).toBe("Quitaste Láminas");
    const empty = $('[data-cart-content] [data-action="browse-products"]');
    expect(squash($("[data-cart-content] h3").textContent)).toBe("Tu pedido empieza acá.");
    expect(document.activeElement).toBe(empty);
  });

  it("al quitar, el foco pasa al 'Quitar' siguiente o, si era la última, al anterior", () => {
    mount();
    const first = add("laminas");
    const second = add("fotos");
    const third = add("bitacoras");
    openPanel();

    inLine(second, '[data-action="remove-line"]').click();
    expect(document.activeElement).toBe(inLine(third, '[data-action="remove-line"]'));
    expect(live()).toBe("Quitaste Fotos para guardar");

    inLine(third, '[data-action="remove-line"]').click();
    expect(document.activeElement).toBe(inLine(first, '[data-action="remove-line"]'));
  });

  it("quitar un adicional deja la línea, lo anuncia y pasa al 'Quitar' siguiente", () => {
    mount();
    const id = add("vinilos", ["vinilos-maqueta", "vinilos-corte-individual"]);
    openPanel();
    const addOns = () => Array.from(line(id).querySelectorAll<HTMLElement>(".cart-addon")).map((item) => item.dataset.addonId);
    expect(addOns()).toEqual(["vinilos-maqueta", "vinilos-corte-individual"]);

    line(id).querySelector<HTMLButtonElement>('[data-addon-id="vinilos-maqueta"] button')!.click();
    expect(addOns()).toEqual(["vinilos-corte-individual"]);
    expect(store.getState().lines[0].addOnIds).toEqual(["vinilos-corte-individual"]);
    expect(live()).toBe("Quitaste Maqueta de Vinilos impresos");
    expect(document.activeElement).toBe(line(id).querySelector('[data-addon-id="vinilos-corte-individual"] button'));

    line(id).querySelector<HTMLButtonElement>('[data-addon-id="vinilos-corte-individual"] button')!.click();
    expect(line(id).querySelector<HTMLElement>(".cart-addons")!.hidden).toBe(true);
    expect(document.activeElement).toBe(inLine(id, '[data-action="remove-line"]'));
  });

  it("escribir '10' no se acota mientras se escribe; '150' queda en 99 al salir del campo", () => {
    mount();
    const id = add("laminas");
    openPanel();
    const input = inLine<HTMLInputElement>(id, "[data-quantity]");
    input.focus();
    type(input, "1");
    type(input, "10");

    expect(store.getState().lines[0].quantity).toBe(1);
    expect(input.value).toBe("10");

    type(input, "150");
    input.blur();
    expect(store.getState().lines[0].quantity).toBe(99);
    expect(input.value).toBe("99");
    expect(live()).toBe("Cantidad de Láminas: 99");
    expect(inLine(id, '[data-action="increment"]').getAttribute("aria-disabled")).toBe("true");
  });

  it("un valor que no es número vuelve a la cantidad anterior; Enter confirma", () => {
    mount();
    const id = add("laminas", [], 3);
    openPanel();
    const input = inLine<HTMLInputElement>(id, "[data-quantity]");
    type(input, "dos", "change");
    expect(input.value).toBe("3");

    input.focus();
    input.value = "7";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(store.getState().lines[0].quantity).toBe(7);
    expect(document.activeElement).toBe(input);
  });
});

describe("formulario", () => {
  it("marca nombre y entrega como obligatorios y muestra la localidad solo con envío", () => {
    mount();
    add("laminas");
    openPanel();
    const name = $<HTMLInputElement>("#pedido-nombre");
    const delivery = $('[data-field="delivery"]');

    expect(name.getAttribute("aria-required")).toBe("true");
    expect(squash($('label[for="pedido-nombre"]').textContent)).toBe("Nombre (obligatorio)");
    expect(delivery.getAttribute("aria-required")).toBe("true");
    expect(squash(delivery.querySelector("legend")!.textContent)).toBe("Entrega (obligatorio)");
    expect($('[data-field="locality"]').hidden).toBe(true);

    fillForm("Ana", "envio");
    expect(store.getState().form).toMatchObject({ name: "Ana", delivery: "envio" });
    expect($('[data-field="locality"]').hidden).toBe(false);
    expect($<HTMLInputElement>("#pedido-localidad").getAttribute("aria-required")).toBe("true");
    expect(squash($("[data-delivery-hint]").textContent)).toContain("Envíos a todo el país");
  });

  it("la fecha tiene como mínimo el día de hoy, calculado en el cliente", () => {
    mount();
    add("laminas");
    expect($<HTMLInputElement>("#pedido-fecha").min).toBe("2026-10-29");
  });

  it("AE3: Láminas no tiene campo de idea; Fotos lo tiene con sus instrucciones de fotos", () => {
    mount();
    add("laminas");
    expect($("[data-cart-ideas-section]").hidden).toBe(true);

    add("fotos");
    expect($("[data-cart-ideas-section]").hidden).toBe(false);
    const block = $('[data-idea-product="fotos"]');
    const area = block.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(area.maxLength).toBe(IDEA_MAX_LENGTH);
    expect(squash(block.querySelector("label")!.textContent)).toBe("Tu idea para Fotos para guardar (opcional)");
    expect(squash(block.querySelector(".cart-photo-help")!.textContent)).toContain("Una foto por cada copia");
    expect(root.querySelector('[data-idea-product="laminas"]')).toBeNull();
  });

  it("el contador de la idea aparece desde los 400 caracteres", () => {
    mount();
    add("calendarios");
    const area = $<HTMLTextAreaElement>('textarea[data-idea="calendarios"]');
    const counter = $('[data-idea-product="calendarios"] [data-idea-counter]');
    area.focus();
    type(area, "a".repeat(IDEA_COUNTER_FROM - 1));
    expect(counter.hidden).toBe(true);
    expect(store.getState().form.ideas.calendarios).toHaveLength(IDEA_COUNTER_FROM - 1);

    type(area, "a".repeat(IDEA_COUNTER_FROM));
    expect(counter.hidden).toBe(false);
    expect(squash(counter.textContent)).toBe("Te quedan 100 caracteres.");
    expect(area.getAttribute("aria-describedby")).toBe(counter.id);
  });

  it("aclara que los datos quedan solo en este navegador", () => {
    mount();
    add("laminas");
    expect(squash($(".cart-privacy").textContent)).toContain("quedan guardados solo en este navegador");
  });

  it("'Vaciar pedido' vacía las líneas, borra lo guardado, lo anuncia y enfoca 'Ver el catálogo'", () => {
    mount();
    add("laminas");
    add("fotos");
    openPanel();
    fillForm();
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

    const clear = $<HTMLButtonElement>('[data-action="clear-order"]');
    clear.focus();
    clear.click();

    expect(store.getState().lines).toEqual([]);
    expect(store.getState().form.name).toBe("");
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(live()).toBe("Vaciaste el pedido.");
    expect(root.querySelector('[data-action="clear-order"]')).toBeNull();
    expect(document.activeElement).toBe($('[data-cart-content] [data-action="browse-products"]'));
  });
});

describe("Continuar", () => {
  it("AE4: sin nombre marca el campo con su mensaje, anuncia el resumen, enfoca el nombre y no muestra WhatsApp", () => {
    mount();
    add("laminas");
    openPanel();
    $<HTMLInputElement>('input[name="pedido-entrega"][value="retiro"]').click();
    continueOrder();
    const name = $<HTMLInputElement>("#pedido-nombre");
    const error = $("#pedido-nombre-error");

    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(error.hidden).toBe(false);
    expect(squash(error.textContent)).toBe("Escribí tu nombre.");
    expect(name.getAttribute("aria-describedby")).toBe("pedido-nombre-error");
    expect(live()).toBe("Revisá un dato: Escribí tu nombre.");
    expect(document.activeElement).toBe(name);
    expect(whatsappLink()).toBeNull();
    expect(root.querySelector('[data-action="copy-order"]')).toBeNull();
    expect(store.getState().status).toBe("borrador");

    type(name, "Ana");
    expect(name.hasAttribute("aria-invalid")).toBe(false);
    expect(error.hidden).toBe(true);
  });

  it("sin nada completo marca nombre y entrega y enfoca el primero", () => {
    mount();
    add("laminas");
    openPanel();
    continueOrder();

    expect($('[data-field="delivery"]').getAttribute("aria-invalid")).toBe("true");
    expect(live()).toBe("Revisá 2 datos: Escribí tu nombre. Elegí retiro o envío.");
    expect(document.activeElement).toBe($("#pedido-nombre"));
  });

  it("con nombre y entrega, enfoca el aviso y muestra el enlace con el mensaje y el código, y 'Copiar pedido'", () => {
    mount();
    add("tarjetas");
    openPanel();
    fillForm();
    continueOrder();
    const notice = $("[data-checkout-focus]");
    const link = whatsappLink()!;

    expect(store.getState().status).toBe("confirmado");
    expect(document.activeElement).toBe(notice);
    expect(notice.getAttribute("tabindex")).toBe("-1");
    expect(squash(notice.textContent)).toBe("Se abre WhatsApp: solo tocá Enviar.");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.classList.contains("primary-button")).toBe(true);
    const [base, query] = link.getAttribute("href")!.split("?text=");
    expect(base).toBe(`https://wa.me/${NUMBER}`);
    const message = decodeURIComponent(query);
    expect(message).toBe(buildOrderMessage(store.getSummary()));
    expect(message).toContain("Código de pedido: AGS-TEST");
    expect(message).toContain("Nombre: Ana");
    expect(notice.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(squash($('[data-action="copy-order"]').textContent)).toBe("Copiar pedido");
    expect(root.querySelector('[data-action="checkout"]')).toBeNull();
  });

  it("cambiar el nombre después de confirmar esconde el enlace y avisa que hay que volver a tocar Continuar", () => {
    mount();
    add("tarjetas");
    openPanel();
    fillForm();
    continueOrder();
    const name = $<HTMLInputElement>("#pedido-nombre");
    name.focus();
    type(name, "Ana María");

    expect(whatsappLink()).toBeNull();
    expect(root.querySelector('[data-action="checkout"]')).not.toBeNull();
    expect(squash($(".checkout-changed").textContent)).toBe("Cambiaste el pedido: volvé a tocar Continuar.");
    expect(live()).toBe("Cambiaste el pedido: volvé a tocar Continuar.");
    expect(document.activeElement).toBe(name);
    expect(store.getState()).toMatchObject({ status: "borrador", code: null });
  });

  it("sin número válido configurado muestra solo 'Copiar pedido' y el aviso de envío sin configurar", () => {
    mount({ number: "" });
    add("tarjetas");
    openPanel();
    fillForm();
    continueOrder();
    const notice = $("[data-checkout-focus]");

    expect(whatsappLink()).toBeNull();
    expect(root.querySelector('a[href*="wa.me"]')).toBeNull();
    expect(document.activeElement).toBe(notice);
    expect(squash(notice.textContent)).toBe(
      "El envío por WhatsApp todavía no está configurado. Copiá el pedido y mandalo por el chat.",
    );
    expect($('[data-action="copy-order"]').classList.contains("primary-button")).toBe(true);
  });

  it("después de un intento con errores, el Continuar válido limpia el resumen y enfoca el aviso", () => {
    mount();
    add("tarjetas");
    openPanel();
    continueOrder();
    expect(live().startsWith("Revisá")).toBe(true);

    fillForm();
    continueOrder();
    expect(store.getState().status).toBe("confirmado");
    expect($("[data-cart-live]").textContent).toBe("");
    expect(document.activeElement).toBe($("[data-checkout-focus]"));
  });

  it("con envío y sin localidad marca la localidad, la describe con su error y la enfoca", () => {
    mount();
    add("tarjetas");
    openPanel();
    fillForm("Ana", "envio");
    continueOrder();
    const locality = $<HTMLInputElement>("#pedido-localidad");
    const error = $("#pedido-localidad-error");

    expect(error.hidden).toBe(false);
    expect(squash(error.textContent)).toBe("Escribí la localidad para el envío.");
    expect(locality.getAttribute("aria-invalid")).toBe("true");
    expect(locality.getAttribute("aria-describedby")).toBe("pedido-localidad-error");
    expect(document.activeElement).toBe(locality);
    expect(live()).toBe("Revisá un dato: Escribí la localidad para el envío.");
    expect(store.getState().status).toBe("borrador");
  });

  it("una fecha antes del plazo de producción avisa sin frenar: Continuar confirma igual", () => {
    mount();
    add("laminas");
    openPanel();
    fillForm();
    const today = toIsoDate(store.today());
    // Hoy no es pasado pero queda antes del primer día posible según el plazo.
    expect(toIsoDate(store.earliestDate()!) > today).toBe(true);
    const date = $<HTMLInputElement>("#pedido-fecha");
    type(date, today);
    const warning = $("#pedido-fecha-aviso");

    expect(warning.hidden).toBe(false);
    expect(squash(warning.textContent)).toContain("Puede que no llegue para esa fecha");
    expect(date.getAttribute("aria-describedby")?.split(" ")).toContain("pedido-fecha-aviso");
    expect(date.hasAttribute("aria-invalid")).toBe(false);

    continueOrder();
    expect(store.getState().status).toBe("confirmado");
    expect($("#pedido-fecha-error").hidden).toBe(true);
    expect(whatsappLink()).not.toBeNull();
  });

  it("una fecha pasada es un error: Continuar no confirma y enfoca la fecha", () => {
    mount();
    add("laminas");
    openPanel();
    fillForm();
    const date = $<HTMLInputElement>("#pedido-fecha");
    // El reloj del almacén está fijo en el 29 de octubre de 2026.
    type(date, "2026-10-28");
    continueOrder();
    const error = $("#pedido-fecha-error");

    expect(error.hidden).toBe(false);
    expect(squash(error.textContent)).toBe("Elegí una fecha desde hoy.");
    expect(date.getAttribute("aria-invalid")).toBe("true");
    expect(date.getAttribute("aria-describedby")).toBe("pedido-fecha-error");
    expect(document.activeElement).toBe(date);
    expect(store.getState().status).toBe("borrador");
    expect(whatsappLink()).toBeNull();
  });

  it("si el enlace es demasiado largo, destaca 'Copiar pedido'", () => {
    mount();
    for (const id of ["calendarios", "fotos", "pizarra-orma", "vinilos", "tarjetas"]) {
      add(id);
      store.setIdea(id, "idea con muchos detalles ".repeat(20).slice(0, IDEA_MAX_LENGTH));
    }
    openPanel();
    fillForm();
    continueOrder();

    expect(whatsappLink()!.classList.contains("secondary-button")).toBe(true);
    expect($('[data-action="copy-order"]').classList.contains("primary-button")).toBe(true);
    expect(squash($(".checkout-hint").textContent)).toContain("podría cortarlo");
  });
});

describe("copiar y después de enviar", () => {
  function confirmOrder(options: MountOptions = {}): void {
    mount(options);
    add("tarjetas");
    openPanel();
    fillForm();
    continueOrder();
  }

  it("AE5: si el portapapeles falla, muestra el texto seleccionado para copiarlo a mano", async () => {
    const { writeText, execCommand } = mockClipboard(() => Promise.reject(new Error("sin permiso")));
    confirmOrder();
    const message = buildOrderMessage(store.getSummary());
    $<HTMLButtonElement>('[data-action="copy-order"]').click();

    await vi.waitFor(() => expect(root.querySelector("[data-manual-copy-text]")).not.toBeNull());
    const area = $<HTMLTextAreaElement>("[data-manual-copy-text]");
    expect(writeText).toHaveBeenCalledWith(message);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(area.value).toBe(message);
    expect(area.readOnly).toBe(true);
    expect(document.activeElement).toBe(area);
    expect(area.selectionStart).toBe(0);
    expect(area.selectionEnd).toBe(message.length);
    expect(store.getState().status).toBe("confirmado");
    expect(root.querySelector(".copy-buffer")).toBeNull();
  });

  it("si execCommand copia, no hace falta el texto a mano", async () => {
    mockClipboard(() => Promise.reject(new Error("sin permiso")), () => true);
    confirmOrder();
    $<HTMLButtonElement>('[data-action="copy-order"]').click();

    await vi.waitFor(() => expect(store.getState().status).toBe("enviado"));
    expect(root.querySelector("[data-manual-copy-text]")).toBeNull();
    expect(live()).toBe("Pedido copiado");
  });

  it("AE5: con el portapapeles andando anuncia 'Pedido copiado' y pregunta si lo envió", async () => {
    const { writeText } = mockClipboard(() => Promise.resolve());
    confirmOrder();
    $<HTMLButtonElement>('[data-action="copy-order"]').focus();
    $<HTMLButtonElement>('[data-action="copy-order"]').click();

    await vi.waitFor(() => expect(store.getState().status).toBe("enviado"));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(live()).toBe("Pedido copiado");
    expect(store.getState().sentVia).toBe("copy");
    const question = $("[data-checkout-focus]");
    expect(squash(question.textContent)).toBe("Copiaste el pedido. ¿Lo enviaste?");
    expect(document.activeElement).toBe(question);
    expect(squash($('[data-action="sent-clear"]').textContent)).toBe("Ya lo envié · vaciar pedido");
  });

  it("después de copiar, 'Ya lo envié · vaciar pedido' vacía el pedido y borra lo guardado", async () => {
    mockClipboard(() => Promise.resolve());
    confirmOrder();
    $<HTMLButtonElement>('[data-action="copy-order"]').click();
    await vi.waitFor(() => expect(store.getState().status).toBe("enviado"));
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

    // Un toque inmediato (doble toque sobre "Copiar") no vacía nada.
    $<HTMLButtonElement>('[data-action="sent-clear"]').click();
    expect(store.getState().lines).toHaveLength(1);

    const later = window.performance.now() + 1000;
    vi.spyOn(window.performance, "now").mockReturnValue(later);
    $<HTMLButtonElement>('[data-action="sent-clear"]').click();
    vi.restoreAllMocks();
    expect(store.getState().lines).toHaveLength(0);
    expect(store.getState().form.name).toBe("");
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.activeElement).toBe($('[data-action="browse-products"]'));
    expect(live()).toBe("Listo, vaciamos el pedido. ¡Gracias!");
    expect(bar().hidden).toBe(true);
  });

  it("abrir WhatsApp pasa a 'Abriste WhatsApp con este pedido. ¿Lo enviaste?' con volver a abrir", async () => {
    confirmOrder();
    stopNavigation();
    whatsappLink()!.click();
    expect(store.getState().status).toBe("confirmado");

    await vi.waitFor(() => expect(store.getState().status).toBe("enviado"));
    expect(store.getState().sentVia).toBe("whatsapp");
    expect(squash($("[data-checkout-focus]").textContent)).toBe("Abriste WhatsApp con este pedido. ¿Lo enviaste?");
    expect(squash(whatsappLink()!.textContent)).toBe("Volver a abrir WhatsApp (se abre en otra pestaña)");
    expect(squash(bar().querySelector(".sticky-bar-note")!.textContent)).toBe(
      "Abriste WhatsApp con este pedido. ¿Lo enviaste?",
    );
  });
});

describe("avisos de restauración", () => {
  function seedDropped(name: string): StorageLike {
    const seeded = createMemoryStorage();
    const first = createOrderStore({ createCode: () => "AGS-TEST", storage: seeded });
    first.add("laminas", initialSelection(products.find((item) => item.id === "laminas")!));
    first.add("fotos", initialSelection(products.find((item) => item.id === "fotos")!));
    const stored = JSON.parse(seeded.getItem(STORAGE_KEY)!);
    stored.lines[0].productId = "ya-no-existe";
    stored.lines[0].name = name;
    seeded.setItem(STORAGE_KEY, JSON.stringify(stored));
    return seeded;
  }

  it("escapa el nombre guardado y espera a 'Entendido'", () => {
    const hostile = '<img src="x" onerror="alert(1)">';
    mount({ storage: seedDropped(hostile) });
    const region = $("[data-cart-restore]");

    expect(region.querySelector("img")).toBeNull();
    expect(squash(region.textContent)).toContain(hostile);
    expect(squash($("[data-cart-trigger-note]").textContent)).toBe(". Actualizamos tu pedido · revisalo");
    expect($(".cart-trigger").classList.contains("has-note")).toBe(true);

    openPanel();
    region.querySelector<HTMLButtonElement>('[data-action="acknowledge-notices"]')!.click();
    expect(store.getState().notices).toHaveLength(0);
    expect(region.innerHTML).toBe("");
    expect($("[data-cart-trigger-note]").hidden).toBe(true);
    expect(document.activeElement).toBe($("[data-cart-lines]"));
  });
});

describe("panel y barra fija", () => {
  it("con el panel abierto la barra no se ve; al cerrarlo vuelve", async () => {
    mount();
    add("laminas");
    expect(bar().hidden).toBe(false);
    openPanel();

    expect(dialog().open).toBe(true);
    expect(overlays.current()).toBe(ORDER_LAYER);
    expect(bar().hidden).toBe(true);
    expect(bar().hasAttribute("data-active")).toBe(true);

    await overlays.close(ORDER_LAYER);
    expect(dialog().open).toBe(false);
    expect(bar().hidden).toBe(false);
  });

  it("cerrar el panel con un campo enfocado no deja la barra oculta", async () => {
    mount();
    add("laminas");
    openPanel();
    $<HTMLInputElement>("#pedido-nombre").focus();
    expect(bar().hidden).toBe(true);

    await overlays.close(ORDER_LAYER);
    expect(dialog().open).toBe(false);
    expect(bar().hidden).toBe(false);
  });

  it("se oculta mientras hay un campo de texto enfocado", () => {
    mount();
    add("laminas");
    const search = $<HTMLInputElement>("[data-search]");
    search.disabled = false;
    search.focus();
    expect(bar().hidden).toBe(true);

    search.blur();
    expect(bar().hidden).toBe(false);
  });

  it("'Ver el catálogo' cierra el panel y después lleva al catálogo", async () => {
    mount();
    openPanel();
    const scroll = vi.fn();
    document.getElementById("catalogo")!.scrollIntoView = scroll;
    $<HTMLButtonElement>('[data-cart-content] [data-action="browse-products"]').click();

    await vi.waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "smooth" }));
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(document.getElementById("catalog-title"));
  });
});
