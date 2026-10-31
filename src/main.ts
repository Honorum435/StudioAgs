import "./styles.css";
import { business } from "./business";
import { createOrderStore } from "./cart";
import { mountCartView } from "./cart-view";
import { products } from "./catalog";
import { mountCatalogView } from "./catalog-view";
import { WHATSAPP_NUMBER } from "./config";
import { compactOnScroll, enableTouchActive, tilt } from "./motion";
import { createOverlays } from "./overlays";
import { renderPage } from "./templates";
import { CUSTOM_ORDER_MESSAGE, buildWhatsAppLink, createOrderCode } from "./whatsapp";

// Arranque: la cáscara llega prerenderizada en #app y no se vuelve a pintar; el cliente solo
// conecta las islas (tarjetas y pedido) y al final saca la marca data-prerendered.

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("No se encontró el contenedor principal de la tienda.");
}

// Solo si la página no pasó por el plugin de prerender de vite.config.ts.
if (!root.hasAttribute("data-prerendered")) {
  root.innerHTML = renderPage({ business, catalog: products });
}

// Único almacén del pedido: lo comparten la vista del catálogo y la del pedido. Guarda en
// localStorage si el navegador lo deja; si no, el pedido queda en memoria.
export const orderStore = createOrderStore({ createCode: createOrderCode });

// Un solo coordinador de capas para la ficha y el panel del pedido.
export const overlays = createOverlays();

mountCatalogView({ root, store: orderStore, overlays });
mountCartView({ root, store: orderStore, overlays, whatsappNumber: WHATSAPP_NUMBER });

// Con número de WhatsApp, "Contanos tu idea" abre el chat en vez de Instagram.
const customOrderLink = buildWhatsAppLink(WHATSAPP_NUMBER, CUSTOM_ORDER_MESSAGE);
const customOrderButton = root.querySelector<HTMLAnchorElement>("[data-custom-order]");
if (customOrderLink && customOrderButton) {
  customOrderButton.href = customOrderLink.url;
}

enableTouchActive(document);
const header = root.querySelector<HTMLElement>(".site-header");
if (header) {
  compactOnScroll(header);
}
const heroArt = root.querySelector<HTMLElement>(".hero-art");
if (heroArt) {
  tilt(heroArt);
}

root.removeAttribute("data-prerendered");
