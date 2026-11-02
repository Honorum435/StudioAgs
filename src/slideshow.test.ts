// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { business } from "./business";
import { products } from "./catalog";
import { SLIDE_INTERVAL, mountSlideshow } from "./slideshow";
import { renderSitePage } from "./templates";

let stop: (() => void) | null = null;

function emulateReducedMotion(reduce: boolean): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduce && query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

function show(): HTMLElement {
  return document.querySelector<HTMLElement>("[data-slideshow]")!;
}

function toggle(): HTMLButtonElement {
  return show().querySelector<HTMLButtonElement>("[data-slideshow-toggle]")!;
}

function currentIndex(): number {
  return [...show().querySelectorAll(".slideshow-slide")].findIndex((slide) => slide.classList.contains("is-current"));
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = renderSitePage({ business, catalog: products }, "preguntas-frecuentes");
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fotos que se van pasando", () => {
  it("sin JavaScript se ve la primera y el botón no aparece", () => {
    const slides = [...show().querySelectorAll<HTMLImageElement>(".slideshow-slide")];
    expect(slides.length).toBeGreaterThan(1);
    expect(currentIndex()).toBe(0);
    expect(slides.every((slide) => slide.getAttribute("alt") === "")).toBe(true);
    expect(toggle().hidden).toBe(true);
  });

  it("pasa a la siguiente cada tanto y vuelve a la primera después de la última", () => {
    emulateReducedMotion(false);
    stop = mountSlideshow(show());
    const total = show().querySelectorAll(".slideshow-slide").length;
    expect(toggle().hidden).toBe(false);
    expect(toggle().getAttribute("aria-pressed")).toBe("false");

    vi.advanceTimersByTime(SLIDE_INTERVAL);
    expect(currentIndex()).toBe(1);
    vi.advanceTimersByTime(SLIDE_INTERVAL * (total - 1));
    expect(currentIndex()).toBe(0);
  });

  it("el botón las frena y las vuelve a pasar", () => {
    emulateReducedMotion(false);
    stop = mountSlideshow(show());
    expect(toggle().textContent?.trim()).toBe("Pausar las fotos");

    toggle().click();
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    vi.advanceTimersByTime(SLIDE_INTERVAL * 3);
    expect(currentIndex()).toBe(0);

    toggle().click();
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    vi.advanceTimersByTime(SLIDE_INTERVAL);
    expect(currentIndex()).toBe(1);
  });

  it("con 'reducir movimiento' arrancan quietas", () => {
    emulateReducedMotion(true);
    stop = mountSlideshow(show());
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    vi.advanceTimersByTime(SLIDE_INTERVAL * 3);
    expect(currentIndex()).toBe(0);
  });
});
