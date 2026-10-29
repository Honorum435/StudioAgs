import "./styles.css";
import { business } from "./business";
import { createOrderStore, type StorageLike } from "./cart";
import { products } from "./catalog";
import { mountCatalogView } from "./catalog-view";
import { createOverlays } from "./overlays";
import { renderPage } from "./templates";
import { createOrderCode } from "./whatsapp";

// Arranque: la cáscara llega prerenderizada en #app y no se vuelve a pintar.

function localStorageOrNull(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("No se encontró el contenedor principal de la tienda.");
}

// Solo si la página no pasó por el plugin de prerender de vite.config.ts.
if (!root.hasAttribute("data-prerendered")) {
  root.innerHTML = renderPage({ business, catalog: products });
}

// Único almacén del pedido: lo comparten la vista del catálogo y la del pedido.
export const orderStore = createOrderStore({
  createCode: createOrderCode,
  storage: localStorageOrNull(),
});

// Un solo coordinador de capas para la ficha y, después, el panel del pedido.
const overlays = createOverlays();

mountCatalogView({ root, store: orderStore, overlays });
