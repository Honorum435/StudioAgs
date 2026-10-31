// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, createOrderStore, type OrderStore } from "./cart";
import { initialSelection, products } from "./catalog";
import type { Overlays } from "./overlays";
import { injectApp, renderDocument, renderProductDocument, renderSitePageDocument } from "./prerender";
import { nextPopState, squash } from "./test-utils";

// Hidratación completa sobre el HTML que genera el prerender, con main.ts tal cual arranca.

let overlays: Overlays | null = null;

// Productos: la página con el catálogo, donde pasa casi todo.
function loadPrerenderedPage(): void {
  document.body.innerHTML = injectApp('<div id="app"></div>', renderSitePageDocument("productos"));
}

function loadHomePage(): void {
  document.body.innerHTML = injectApp('<div id="app"></div>', renderDocument());
}

// Arma lo guardado como lo dejaría una visita anterior.
function previousVisit(build: (store: OrderStore) => void): void {
  const store = createOrderStore({ createCode: () => "AGS-K7QZ", storage: window.localStorage });
  build(store);
}

function add(store: OrderStore, id: string, addOnIds: string[] = [], quantity = 1): void {
  const product = products.find((item) => item.id === id)!;
  store.add(id, initialSelection(product), addOnIds, quantity);
}

async function hydrate(): Promise<typeof import("./main")> {
  vi.resetModules();
  const main = await import("./main");
  overlays = main.overlays;
  return main;
}

function $<T extends Element = HTMLElement>(selector: string): T {
  return document.querySelector<T>(selector)!;
}

function bar(): HTMLElement {
  return $("[data-sticky-bar]");
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "");
  loadPrerenderedPage();
});

afterEach(() => {
  overlays?.destroy();
  overlays = null;
  delete document.documentElement.dataset.layer;
});

describe("hidratación completa", () => {
  it("AE2: restaura líneas y formulario, actualiza la barra y no duplica ni reemplaza nada", async () => {
    previousVisit((store) => {
      add(store, "tarjetas", [], 2);
      add(store, "vinilos", ["vinilos-maqueta"]);
      store.updateForm({ name: "Ana", delivery: "envio", locality: "Rosario" });
      store.setIdea("vinilos", "Logo en negro");
    });
    const cards = Array.from(document.querySelectorAll(".product-card"));
    const dialog = $("#cart-dialog");
    const app = $("#app");
    expect(app.hasAttribute("data-prerendered")).toBe(true);

    const { orderStore } = await hydrate();

    expect(app.hasAttribute("data-prerendered")).toBe(false);
    expect(orderStore.getState().lines).toHaveLength(2);
    expect(Array.from(document.querySelectorAll(".product-card"))).toEqual(cards);
    expect($("#cart-dialog")).toBe(dialog);
    for (const selector of ["#app", "#cart-dialog", "#ficha-dialog", "[data-sticky-bar]", ".site-header", ".cart-items"]) {
      expect(document.querySelectorAll(selector)).toHaveLength(1);
    }

    const lines = Array.from(document.querySelectorAll<HTMLElement>(".cart-item")).map((item) => item.dataset.lineId);
    expect(lines).toEqual(["tarjetas-100-simple-faz-sin-laminar", "vinilos-blanco-sin-laca"]);
    expect(
      $<HTMLInputElement>('.cart-item[data-line-id="tarjetas-100-simple-faz-sin-laminar"] [data-quantity]').value,
    ).toBe("2");
    expect($('.cart-addon[data-addon-id="vinilos-maqueta"]')).not.toBeNull();
    expect($<HTMLInputElement>("#pedido-nombre").value).toBe("Ana");
    expect($<HTMLInputElement>('input[name="pedido-entrega"][value="envio"]').checked).toBe(true);
    expect($<HTMLInputElement>("#pedido-localidad").value).toBe("Rosario");
    expect($<HTMLTextAreaElement>('textarea[data-idea="vinilos"]').value).toBe("Logo en negro");

    expect($<HTMLButtonElement>(".cart-trigger").disabled).toBe(false);
    expect($("[data-cart-count]").classList.contains("is-empty")).toBe(false);
    expect(squash($("[data-cart-count]").textContent)).toBe("3, 3 productos");
    expect(bar().hidden).toBe(false);
    expect(squash(bar().querySelector(".sticky-bar-count")!.textContent)).toBe("3 productos");
    // Las tarjetas también quedaron hidratadas.
    expect($<HTMLButtonElement>('[data-action="add"]').disabled).toBe(false);
    expect($<HTMLDialogElement>("#cart-dialog").open).toBe(false);
  });

  it("sin nada guardado deja el estado vacío prerenderizado y la barra oculta", async () => {
    const empty = $("[data-cart-content] .cart-empty");
    await hydrate();

    expect($("[data-cart-content] .cart-empty")).toBe(empty);
    expect($("[data-cart-count]").classList.contains("is-empty")).toBe(true);
    expect(bar().hidden).toBe(true);
    expect($<HTMLButtonElement>(".cart-trigger").disabled).toBe(false);
  });

  it("F2: al volver con un pedido enviado no abre el panel y la barra pregunta si se envió", async () => {
    previousVisit((store) => {
      add(store, "fotos", [], 10);
      store.updateForm({ name: "Ana", delivery: "retiro" });
      store.confirm();
      store.markSent("whatsapp");
    });
    const { orderStore } = await hydrate();

    expect(orderStore.getState().status).toBe("enviado");
    expect($<HTMLDialogElement>("#cart-dialog").open).toBe(false);
    expect(document.documentElement.dataset.layer).toBeUndefined();
    expect(bar().hidden).toBe(false);
    const note = bar().querySelector(".sticky-bar-note")!;
    expect(squash(note.textContent)).toBe("Abriste WhatsApp con este pedido. ¿Lo enviaste?");
    expect(note.classList.contains("is-alert")).toBe(true);
    expect(squash($('[data-checkout] [data-checkout-focus]').textContent)).toBe(
      "Abriste WhatsApp con este pedido. ¿Lo enviaste?",
    );
  });

  it("con un producto descartado, la barra y el botón avisan hasta abrir el panel y tocar 'Entendido'", async () => {
    previousVisit((store) => {
      add(store, "laminas");
      add(store, "fotos");
    });
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    stored.lines[0].productId = "producto-retirado";
    stored.lines[0].name = "Producto retirado";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const { orderStore } = await hydrate();

    const note = () => squash(bar().querySelector(".sticky-bar-note")!.textContent);
    expect(note()).toBe("Actualizamos tu pedido · revisalo");
    expect(squash($("[data-cart-trigger-note]").textContent)).toContain("Actualizamos tu pedido · revisalo");
    expect(orderStore.getState().lines).toHaveLength(1);

    const trigger = $<HTMLButtonElement>(".cart-trigger");
    trigger.focus();
    trigger.click();
    const notice = $("[data-cart-restore] [data-restore-notice]");
    expect(squash(notice.textContent)).toContain("Producto retirado");
    // Abrir no alcanza: sigue pendiente hasta "Entendido".
    expect(orderStore.getState().notices).toHaveLength(1);

    notice.querySelector<HTMLButtonElement>('[data-action="acknowledge-notices"]')!.click();
    expect(orderStore.getState().notices).toHaveLength(0);
    expect(note()).toBe("El total final se confirma por WhatsApp.");
    expect($("[data-cart-trigger-note]").hidden).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).notices).toEqual([]);

    const popped = nextPopState();
    window.history.back();
    await popped;
  });

  it("con el panel abierto la barra no se ve; Atrás lo cierra una sola vez", async () => {
    previousVisit((store) => add(store, "laminas"));
    await hydrate();
    const dialog = $<HTMLDialogElement>("#cart-dialog");
    const opener = bar().querySelector<HTMLButtonElement>('[data-action="open-cart"]')!;
    opener.focus();
    opener.click();

    expect(dialog.open).toBe(true);
    expect(document.documentElement.dataset.layer).toBe("pedido");
    expect(bar().hidden).toBe(true);

    const back = vi.spyOn(window.history, "back");
    const popped = nextPopState();
    window.history.back();
    await popped;

    expect(dialog.open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.layer).toBeUndefined();
    expect(bar().hidden).toBe(false);
    expect(document.activeElement).toBe(opener);
    back.mockRestore();
  });

  it("tocar el fondo cierra el panel y retrocede el historial una sola vez", async () => {
    previousVisit((store) => add(store, "laminas"));
    await hydrate();
    const dialog = $<HTMLDialogElement>("#cart-dialog");
    $<HTMLButtonElement>(".cart-trigger").click();
    expect(dialog.open).toBe(true);

    const back = vi.spyOn(window.history, "back");
    const popped = nextPopState();
    const init = { bubbles: true, cancelable: true, clientX: 500, clientY: 500, button: 0 };
    dialog.dispatchEvent(new PointerEvent("pointerdown", init));
    dialog.dispatchEvent(new MouseEvent("click", init));
    await popped;

    expect(dialog.open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(bar().hidden).toBe(false);
    back.mockRestore();
  });
});

describe("página de un producto", () => {
  function loadProductPage(id: string): void {
    document.body.innerHTML = injectApp('<div id="app"></div>', renderProductDocument(id));
  }

  it("el detalle cambia el precio con la opción y suma al mismo pedido que ve Productos", async () => {
    loadProductPage("calendarios");
    await hydrate();
    const detail = $("article.product-page");
    const add = detail.querySelector<HTMLButtonElement>('[data-action="add"]')!;
    expect(add.disabled).toBe(false);

    detail.querySelector<HTMLInputElement>('input[value="acrilico"]')!.click();
    expect(detail.querySelector("[data-card-price]")?.textContent).toContain("55.000");
    add.click();
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("calendarios-acrilico");

    overlays?.destroy();
    overlays = null;
    loadPrerenderedPage();
    const { orderStore } = await hydrate();
    expect(orderStore.getState().lines.map((line) => line.id)).toEqual(["calendarios-acrilico"]);
  });

  it("la miniatura tocada pasa a la foto grande", async () => {
    loadProductPage("calendarios");
    await hydrate();
    const thumbs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="show-photo"]'));
    const photos = Array.from(document.querySelectorAll<HTMLElement>("[data-gallery-photo]"));
    expect(thumbs.every((thumb) => !thumb.disabled)).toBe(true);

    thumbs[2].click();
    expect(photos.map((photo) => photo.hidden)).toEqual(photos.map((_photo, index) => index !== 2));
    expect(thumbs.map((thumb) => thumb.getAttribute("aria-pressed"))).toEqual(
      thumbs.map((_thumb, index) => String(index === 2)),
    );
    expect(thumbs[2].classList.contains("is-active")).toBe(true);
    expect(thumbs[0].classList.contains("is-active")).toBe(false);
  });
});

describe("pedidos personalizados", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin número de WhatsApp, 'Contanos tu idea' sigue yendo a Instagram", async () => {
    vi.stubEnv("VITE_WHATSAPP_NUMBER", "");
    loadHomePage();
    await hydrate();
    expect($<HTMLAnchorElement>("[data-custom-order]").getAttribute("href")).toBe("https://www.instagram.com/__studioags/");
  });

  it("con número, abre el chat con el mensaje ya escrito", async () => {
    vi.stubEnv("VITE_WHATSAPP_NUMBER", "5493435555555");
    loadHomePage();
    await hydrate();
    const href = $<HTMLAnchorElement>("[data-custom-order]").getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/5493435555555?text=")).toBe(true);
    expect(decodeURIComponent(href.split("text=")[1])).toBe("¡Hola! Tengo una idea para un pedido personalizado.");
  });

  it("en Contacto, 'Escribinos' va a Instagram sin número y al chat con número", async () => {
    vi.stubEnv("VITE_WHATSAPP_NUMBER", "");
    document.body.innerHTML = injectApp('<div id="app"></div>', renderSitePageDocument("contacto"));
    await hydrate();
    expect($<HTMLAnchorElement>("[data-contact-chat]").getAttribute("href")).toBe("https://www.instagram.com/__studioags/");

    overlays?.destroy();
    overlays = null;
    vi.stubEnv("VITE_WHATSAPP_NUMBER", "5493435555555");
    document.body.innerHTML = injectApp('<div id="app"></div>', renderSitePageDocument("contacto"));
    await hydrate();
    // El de la tarjeta y el botón flotante.
    const buttons = [...document.querySelectorAll<HTMLAnchorElement>("[data-contact-chat]")];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      const href = button.getAttribute("href") ?? "";
      expect(href.startsWith("https://wa.me/5493435555555?text=")).toBe(true);
      expect(decodeURIComponent(href.split("text=")[1])).toBe("¡Hola! Les quería hacer una consulta.");
    }
  });
});
