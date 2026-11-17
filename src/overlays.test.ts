// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAYER_STATE_KEY, createOverlays, type Overlays } from "./overlays";
import { nextPopState } from "./test-utils";

// happy-dom abre y cierra <dialog> y maneja pushState/back/popstate, pero no traduce Escape ni el
// gesto Atrás en un cierre: esos casos se simulan con la secuencia que dispara el navegador
// (cancel y después close, sin popstate).

function markedLayer(): unknown {
  const state = window.history.state as Record<string, unknown> | null;
  return state ? state[LAYER_STATE_KEY] ?? null : null;
}

function backdropEvent(type: "pointerdown" | "click", target: Element): void {
  const init = { bubbles: true, cancelable: true, clientX: 500, clientY: 500, button: 0 };
  target.dispatchEvent(type === "click" ? new MouseEvent(type, init) : new PointerEvent(type, init));
}

let overlays: Overlays;
let dialog: HTMLDialogElement;
let opener: HTMLButtonElement;
let back: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.history.replaceState(null, "");
  document.body.innerHTML = `
    <button type="button" id="opener">Abrir panel</button>
    <dialog id="panel"><p>Panel</p><button type="button" id="inside">Cerrar</button></dialog>
    <dialog id="pedido"><p>Pedido</p></dialog>`;
  dialog = document.querySelector<HTMLDialogElement>("#panel")!;
  opener = document.querySelector<HTMLButtonElement>("#opener")!;
  back = vi.spyOn(window.history, "back");
  overlays = createOverlays();
  overlays.register("panel", dialog);
});

afterEach(() => {
  overlays.destroy();
  back.mockRestore();
  delete document.documentElement.dataset.layer;
});

function openPanel(): void {
  opener.focus();
  expect(overlays.open("panel")).toBe(true);
}

describe("abrir", () => {
  it("agrega una entrada al historial que marca la capa y bloquea el desplazamiento", () => {
    const before = window.history.length;
    openPanel();

    expect(dialog.open).toBe(true);
    expect(window.history.length).toBe(before + 1);
    expect(markedLayer()).toBe("panel");
    expect(document.documentElement.dataset.layer).toBe("panel");
    expect(overlays.current()).toBe("panel");
  });

  it("no abre una segunda capa encima ni la misma dos veces", () => {
    overlays.register("pedido", document.querySelector<HTMLDialogElement>("#pedido")!);
    openPanel();

    expect(overlays.open("panel")).toBe(false);
    expect(overlays.open("pedido")).toBe(false);
    expect(overlays.open("otra")).toBe(false);
  });

  it("avisa a quien se suscribe cuando cambia la capa abierta", async () => {
    const seen: Array<string | null> = [];
    overlays.subscribe((current) => seen.push(current));
    openPanel();
    await overlays.close("panel");

    expect(seen).toEqual(["panel", null]);
  });
});

describe("cerrar", () => {
  it("con el botón retrocede el historial una sola vez y devuelve el foco", async () => {
    openPanel();
    document.querySelector<HTMLButtonElement>("#inside")!.focus();
    await overlays.close("panel");

    expect(dialog.open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(markedLayer()).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.documentElement.dataset.layer).toBeUndefined();
  });

  it("close() se resuelve recién después del popstate, para poder desplazar la página", async () => {
    const order: string[] = [];
    openPanel();
    window.addEventListener("popstate", () => order.push("popstate"), { once: true });
    await overlays.close("panel").then(() => order.push("cerrado"));

    expect(order).toEqual(["popstate", "cerrado"]);
  });

  it("con Escape (cancel y close del navegador) retrocede una sola vez", async () => {
    openPanel();
    const popped = nextPopState();
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    dialog.close();
    await popped;

    expect(back).toHaveBeenCalledTimes(1);
    expect(markedLayer()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("tocando el fondo cierra y retrocede una sola vez", async () => {
    openPanel();
    const popped = nextPopState();
    backdropEvent("pointerdown", dialog);
    backdropEvent("click", dialog);
    await popped;

    expect(dialog.open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(markedLayer()).toBeNull();
  });

  it("un toque dentro del panel o un arrastre que termina en el fondo no lo cierran", () => {
    openPanel();
    const inside = document.querySelector("#panel p")!;
    inside.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 500, clientY: 500 }));
    backdropEvent("pointerdown", inside);
    backdropEvent("click", dialog);

    expect(dialog.open).toBe(true);
    expect(back).not.toHaveBeenCalled();
  });

  it("Atrás del navegador la cierra sin volver a retroceder y devuelve el foco", async () => {
    openPanel();
    const popped = nextPopState();
    window.history.back();
    await popped;

    expect(dialog.open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
    expect(document.documentElement.dataset.layer).toBeUndefined();
  });

  it("cerrar sin popstate (gesto Atrás de Android) no deja una entrada colgada", async () => {
    const before = window.history.length;
    openPanel();
    const popped = nextPopState();
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    dialog.close();
    await popped;

    expect(back).toHaveBeenCalledTimes(1);
    expect(markedLayer()).toBeNull();
    // Volver a abrir reemplaza la entrada de adelante en lugar de apilar otra.
    openPanel();
    expect(window.history.length).toBe(before + 1);
  });

  it("cerrar una capa que no está abierta no toca el historial", async () => {
    await overlays.close("panel");

    expect(back).not.toHaveBeenCalled();
  });
});

describe("recargar y navegar", () => {
  it("cargar con un estado de panel abierto no lo reabre y limpia la marca", () => {
    overlays.destroy();
    window.history.replaceState({ [LAYER_STATE_KEY]: "panel", otro: 1 }, "");
    overlays = createOverlays();
    overlays.register("panel", dialog);

    expect(dialog.open).toBe(false);
    expect(markedLayer()).toBeNull();
    expect(window.history.state).toEqual({ otro: 1 });
  });

  it("volver con Adelante a una entrada marcada no reabre el panel", async () => {
    openPanel();
    await overlays.close("panel");
    const popped = nextPopState();
    window.history.forward();
    await popped;

    expect(dialog.open).toBe(false);
    expect(markedLayer()).toBeNull();
  });
});
