import { business } from "./business";
import type { StorageLike } from "./cart";
import { products } from "./catalog";
import { renderPage, renderSitePage } from "./templates";

// Ayudas compartidas por los tests. No termina en .test.ts, así que Vitest no la corre sola,
// y ningún módulo de la tienda la importa.

export function createMemoryStorage(): StorageLike {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, String(value));
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

// Solo espacios ASCII: el espacio duro de los precios tiene que llegar intacto.
export function squash(value: string | null | undefined): string {
  return (value ?? "").replace(/[ \t\n\r\f]+/g, " ").trim();
}

export function nextPopState(): Promise<PopStateEvent> {
  return new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
}

// La cáscara prerenderizada con los datos reales, como la deja el HTML del build: por defecto la
// página de Productos, que tiene el catálogo. Devuelve #app.
export function mountShell(page: "inicio" | "productos" = "productos"): HTMLElement {
  const data = { business, catalog: products };
  const markup = page === "inicio" ? renderPage(data) : renderSitePage(data, "productos");
  document.body.innerHTML = `<div id="app" data-prerendered>${markup}</div>`;
  return document.querySelector<HTMLElement>("#app")!;
}
