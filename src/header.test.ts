// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountHeader } from "./header";
import { mountShell } from "./test-utils";

let root: HTMLElement;
let stop: (() => void) | null = null;

function $<T extends Element = HTMLElement>(selector: string): T {
  return root.querySelector<T>(selector)!;
}

function header(): HTMLElement {
  return $(".site-header");
}

function toggle(): HTMLButtonElement {
  return $<HTMLButtonElement>("[data-menu-toggle]");
}

beforeEach(() => {
  root = mountShell("inicio");
  stop = mountHeader(header());
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.restoreAllMocks();
});

describe("menú del celu", () => {
  it("el botón lo abre y lo cierra, avisa si está abierto y lleva el foco al buscador", () => {
    expect(header().classList.contains("has-menu")).toBe(true);

    toggle().click();
    expect(header().classList.contains("is-menu-open")).toBe(true);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().textContent?.trim()).toBe("Cerrar menú");
    expect(document.activeElement).toBe($(".header-search input"));

    toggle().click();
    expect(header().classList.contains("is-menu-open")).toBe(false);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().textContent?.trim()).toBe("Menú");
  });

  it("se cierra con Escape y el foco vuelve al botón", () => {
    toggle().click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(header().classList.contains("is-menu-open")).toBe(false);
    expect(document.activeElement).toBe(toggle());
  });

  it("se cierra tocando afuera o eligiendo un enlace, pero no tocando adentro", () => {
    toggle().click();
    $(".header-search").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(header().classList.contains("is-menu-open")).toBe(true);

    $("main").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(header().classList.contains("is-menu-open")).toBe(false);

    toggle().click();
    const link = $<HTMLAnchorElement>(".main-nav a");
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
    link.click();
    expect(header().classList.contains("is-menu-open")).toBe(false);
  });

  it("al soltarlo deja de responder y saca sus clases", () => {
    stop?.();
    stop = null;
    toggle().click();
    expect(header().classList.contains("is-menu-open")).toBe(false);
    expect(header().classList.contains("has-menu")).toBe(false);
  });
});

describe("buscador del encabezado", () => {
  it("lleva a Productos con el texto buscado", () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign } as Location);
    $<HTMLInputElement>(".header-search input").value = "  doble faz ";
    $<HTMLFormElement>("[data-header-search]").dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.pathname.endsWith("/productos/")).toBe(true);
    expect(url.searchParams.get("q")).toBe("doble faz");
  });

  it("sin texto lleva a Productos sin búsqueda", () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign } as Location);
    $<HTMLFormElement>("[data-header-search]").dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.search).toBe("");
  });
});
