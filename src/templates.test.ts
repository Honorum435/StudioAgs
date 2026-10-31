// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { business, businessValue } from "./business";
import type { ResolvedLine } from "./cart";
import { products, resolveSelection, type CatalogProduct } from "./catalog";
import { formatPrice } from "./format";
import {
  CARD_IMAGE_SIZES,
  TOTAL_NOTE,
  addButtonContent,
  cardPrice,
  cartContent,
  cartCountContent,
  initialResolved,
  renderPage,
  renderProductPage,
  stickyBarContent,
  type CartSummary,
} from "./templates";
import { squash } from "./test-utils";

function product(id: string): CatalogProduct {
  const found = products.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No existe el producto ${id}`);
  }
  return found;
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
}

function text(element: Element | null): string {
  return squash(element?.textContent ?? "");
}

// Aproximación al nombre accesible: aria-label o el texto que no está en aria-hidden.
function accessibleName(element: Element): string {
  const label = element.getAttribute("aria-label");
  if (label) {
    return label;
  }
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      parts.push(node.textContent ?? "");
    } else if (node.nodeType === 1 && (node as Element).getAttribute("aria-hidden") !== "true") {
      node.childNodes.forEach(walk);
    }
  };
  element.childNodes.forEach(walk);
  return squash(parts.join(""));
}

const page = renderPage({ business, catalog: products });
const doc = parse(page);

function card(id: string): Element {
  const element = doc.getElementById(`producto-${id}`);
  if (!element) {
    throw new Error(`No se renderizó la tarjeta de ${id}`);
  }
  return element;
}

function line(productId: string, selection: Record<string, string>, quantity: number, addOnIds: string[] = []): ResolvedLine {
  const item = product(productId);
  const resolved = resolveSelection(item, selection, addOnIds);
  if (!resolved) {
    throw new Error("Selección inválida");
  }
  const baseTotal = resolved.combination.price * quantity;
  return {
    id: resolved.combination.id,
    product: item,
    combination: resolved.combination,
    quantity,
    addOns: resolved.addOns,
    baseTotal,
    total: baseTotal + resolved.addOns.reduce((sum, addOn) => sum + addOn.price, 0),
  };
}

const filledCart: CartSummary = (() => {
  const lines = [
    line("tarjetas", { cantidad: "200", faz: "doble-faz", terminacion: "laminado" }, 2),
    line("vinilos", { material: "blanco", laca: "sin-laca" }, 1, ["vinilos-maqueta"]),
  ];
  return {
    lines,
    quantity: lines.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: lines.reduce((sum, item) => sum + item.total, 0),
  };
})();

describe("página prerenderizada", () => {
  it("muestra los 8 productos con nombre, precio inicial con unidad, plazo y marca de personalizable", () => {
    expect(doc.querySelectorAll("article.product-card")).toHaveLength(8);

    for (const item of products) {
      const element = card(item.id);
      const resolved = initialResolved(item);
      expect(text(element.querySelector("h3"))).toBe(item.name);
      expect(text(element.querySelector(".product-price-amount"))).toBe(formatPrice(resolved.total));
      expect(text(element.querySelector(".product-price-unit"))).toBe(resolved.combination.unit);
      expect(text(element.querySelector(".product-lead-time")).toLowerCase()).toContain(
        businessValue(item.leadTime).text.toLowerCase(),
      );
      expect(element.querySelector(".product-category") !== null).toBe(item.personalizable);
    }

    expect(text(card("tarjetas").querySelector("[data-card-price]"))).toBe(`${formatPrice(13300)} pack de 100`);
    expect(text(card("vinilos").querySelector("[data-card-price]"))).toBe(`${formatPrice(14500)} por pliego`);
    expect(text(card("laminas").querySelector(".product-category"))).toBe("");
  });

  it("pone la franja de confianza bajo el título del catálogo y el bloque completo debajo", () => {
    const catalog = doc.getElementById("catalogo")!;
    const strip = catalog.querySelector(".trust-strip")!;
    const items = [...strip.querySelectorAll("li")].map(text);
    expect(items).toEqual([
      "Producción: de 1 a 5 días hábiles, según el producto",
      "Te mandamos una muestra antes de imprimir",
      "Precios actualizados al 14 de julio de 2026",
    ]);
    expect(strip.compareDocumentPosition(catalog.querySelector(".section-heading")!)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(strip.compareDocumentPosition(catalog.querySelector(".product-grid")!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const trust = doc.getElementById("antes-de-pedir")!;
    expect(catalog.compareDocumentPosition(trust)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect([...trust.querySelectorAll("dt")].map(text)).toEqual([
      "Plazos",
      "Envíos y retiro",
      "Pagos",
      "Muestra y cambios",
      "Contacto",
    ]);
    const answers = [...trust.querySelectorAll("dd")].map(text);
    expect(answers[1]).toContain(businessValue(business.shipping));
    expect(answers[1]).toContain(businessValue(business.pickupArea));
    for (const method of businessValue(business.paymentMethods)) {
      expect(answers[2]).toContain(method);
    }
    expect(answers[3]).toBe(businessValue(business.exchangePolicy));
    expect(answers[4]).toContain(businessValue(business.responseTime));
    expect(trust.querySelector("a")?.getAttribute("href")).toBe("https://www.instagram.com/__studioags/");
  });

  it("ofrece pedidos personalizados entre el catálogo y el bloque de confianza", () => {
    const block = doc.getElementById("pedidos-personalizados")!;
    expect(text(block.querySelector("h2"))).toBe("¿Tenés una idea?");
    const button = block.querySelector<HTMLAnchorElement>("[data-custom-order]")!;
    expect(button.getAttribute("href")).toBe("https://www.instagram.com/__studioags/");
    expect(button.getAttribute("target")).toBe("_blank");
    expect(accessibleName(button)).toBe("Contanos tu idea (se abre en otra pestaña)");
    expect(doc.getElementById("catalogo")!.compareDocumentPosition(block)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(block.compareDocumentPosition(doc.getElementById("antes-de-pedir")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("aclara junto a los precios que el total final se confirma por WhatsApp", () => {
    expect(text(doc.querySelector(".price-note"))).toMatch(/^El total final se confirma por WhatsApp/);
    expect(text(parse(cartContent(filledCart)).querySelector(".cart-summary"))).toContain(TOTAL_NOTE);
    expect(text(parse(stickyBarContent(filledCart)).body)).toContain(TOTAL_NOTE);
  });

  it("arma el encabezado, el aviso sin JavaScript, la ficha, el panel vacío, la barra y la región viva", () => {
    expect(doc.querySelectorAll(".site-header")).toHaveLength(1);
    expect(page).toMatch(/<noscript>[\s\S]*JavaScript[\s\S]*https:\/\/www\.instagram\.com\/__studioags\/[\s\S]*<\/noscript>/);
    expect(page.indexOf("<noscript>")).toBeGreaterThan(page.indexOf("</header>"));
    expect(page.indexOf("<noscript>")).toBeLessThan(page.indexOf("<main>"));
    expect(doc.querySelector("dialog#ficha-dialog [data-action='close-ficha']")).not.toBeNull();

    const cart = doc.querySelector("dialog#cart-dialog")!;
    expect(cart.hasAttribute("open")).toBe(false);
    expect(text(cart.querySelector("[data-cart-content] h3"))).toBe("Tu pedido empieza acá.");
    expect(cart.querySelector("[data-cart-notices]")).not.toBeNull();

    const bar = doc.querySelector("[data-sticky-bar]")!;
    expect(bar.hasAttribute("hidden")).toBe(true);
    const announcer = doc.querySelector("[data-announcer]")!;
    expect(announcer.getAttribute("role")).toBe("status");
    expect(cart.contains(announcer)).toBe(false);

    const trigger = doc.querySelector(".cart-trigger")!;
    expect(trigger.hasAttribute("disabled")).toBe(true);
    expect(accessibleName(trigger)).toBe("Mi pedido , vacío");
  });

  it("mantiene el HTML en el orden en que se ve", () => {
    const order = [
      "site-header",
      "hero",
      "value-strip",
      "catalog-section",
      "custom-order",
      "trust-section",
      "how-section",
      "process-section",
      "site-footer",
    ].map((name) => page.indexOf(`class="${name}"`));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(page.indexOf('class="filter-list"')).toBeLessThan(page.indexOf('class="search-field"'));
  });
});

describe("así preparamos tu pedido", () => {
  it("muestra los cuatro pasos con su foto cuadrada, texto alternativo y carga diferida", () => {
    const section = doc.getElementById("asi-lo-preparamos")!;
    expect(text(section.querySelector("h2"))).toBe("Así preparamos tu pedido.");
    const steps = [...section.querySelectorAll(".process-step")];
    expect(steps.map((step) => text(step.querySelector("h3")))).toEqual([
      "Sellamos a mano",
      "Papel madera e hilo",
      "Listo para regalar",
      "En su bolsa",
    ]);
    steps.forEach((step, index) => {
      const image = step.querySelector("img")!;
      expect(image.getAttribute("src")).toBe(`images/foto-proceso-${index + 1}-1200.webp`);
      expect(image.getAttribute("alt")).not.toBe("");
      expect(image.getAttribute("loading")).toBe("lazy");
      expect([image.getAttribute("width"), image.getAttribute("height")]).toEqual(["1200", "1200"]);
    });
  });
});

describe("precio desde", () => {
  it("avisa el mínimo solo cuando las opciones cambian el precio", () => {
    for (const item of products) {
      const prices = item.combinations.map((combination) => combination.price);
      const note = card(item.id).querySelector(".product-from");
      if (Math.min(...prices) === Math.max(...prices)) {
        expect(note).toBeNull();
      } else {
        expect(text(note)).toBe(`Desde ${squash(formatPrice(Math.min(...prices)))}, según la opción`);
      }
    }
    expect(text(card("calendarios").querySelector(".product-from"))).toBe(`Desde ${squash(formatPrice(21000))}, según la opción`);
    expect(card("entre-flores").querySelector(".product-from")).toBeNull();
  });
});

describe("página de un producto", () => {
  const calendarios = product("calendarios");
  const productDoc = parse(renderProductPage({ business, catalog: products }, calendarios));
  const detail = productDoc.querySelector("article.product-page")!;

  it("tiene un solo h1 con el nombre, el camino al catálogo y el salto al producto", () => {
    expect(productDoc.querySelectorAll("h1")).toHaveLength(1);
    expect(text(productDoc.querySelector("h1"))).toBe("Calendarios");
    expect(productDoc.querySelector(".breadcrumb a")?.getAttribute("href")).toBe("#catalogo");
    expect(text(productDoc.querySelector('.breadcrumb [aria-current="page"]'))).toBe("Calendarios");
    const skip = productDoc.querySelector(".skip-link")!;
    expect(skip.getAttribute("href")).toBe("producto/calendarios/#producto-detalle");
  });

  it("el detalle es una isla con precio, opciones, adicionales y botón de sumar deshabilitados", () => {
    expect(detail.hasAttribute("data-product-island")).toBe(true);
    expect(detail.getAttribute("data-product-id")).toBe("calendarios");
    expect(text(detail.querySelector("[data-card-price]"))).toBe(text(parse(cardPrice(initialResolved(calendarios))).body));
    expect(detail.querySelectorAll('fieldset[data-group="formato"] input[type="radio"]')).toHaveLength(8);
    expect(detail.querySelectorAll('.addon-group input[type="checkbox"]')).toHaveLength(1);
    const add = detail.querySelector<HTMLButtonElement>('[data-action="add"]')!;
    expect(add.disabled).toBe(true);
    expect(add.dataset.productId).toBe("calendarios");
    expect(detail.querySelector('[data-action="open-ficha"]')).not.toBeNull();
  });

  it("la galería muestra la primera foto y deja las demás ocultas, con una miniatura por foto", () => {
    const photos = [...detail.querySelectorAll<HTMLElement>("[data-gallery-photo]")];
    expect(photos).toHaveLength((calendarios.gallery?.length ?? 0) + 2);
    expect(photos.map((photo) => photo.hidden)).toEqual(photos.map((_photo, index) => index > 0));
    expect(photos[0].querySelector("img")?.getAttribute("fetchpriority")).toBe("high");
    expect(photos.slice(1).every((photo) => photo.querySelector("img")?.getAttribute("loading") === "lazy")).toBe(true);
    expect(photos[photos.length - 1].classList.contains("is-contained")).toBe(true);

    const thumbs = [...detail.querySelectorAll<HTMLButtonElement>('[data-action="show-photo"]')];
    expect(thumbs).toHaveLength(photos.length);
    expect(thumbs.every((thumb) => thumb.disabled)).toBe(true);
    expect(thumbs.map((thumb) => thumb.getAttribute("aria-pressed"))).toEqual(
      thumbs.map((_thumb, index) => String(index === 0)),
    );
    expect(text(thumbs[1])).toBe(`Foto 2 de ${photos.length}`);
  });

  it("ofrece los tres productos que siguen en el catálogo, dando la vuelta al final", () => {
    const related = [...productDoc.querySelectorAll<HTMLElement>(".related-section .product-card")];
    expect(related.map((card) => card.dataset.productId)).toEqual(["fotos", "pizarra-orma", "entre-flores"]);
    const last = parse(renderProductPage({ business, catalog: products }, product("laminas")));
    expect(
      [...last.querySelectorAll<HTMLElement>(".related-section .product-card")].map((card) => card.dataset.productId),
    ).toEqual(["calendarios", "fotos", "pizarra-orma"]);
  });

  it("en el inicio la foto y el nombre de cada tarjeta llevan a su página", () => {
    for (const item of products) {
      const element = card(item.id);
      const image = element.querySelector(".product-image-wrap")!;
      expect(image.getAttribute("href")).toBe(`producto/${item.id}/`);
      expect(image.getAttribute("tabindex")).toBe("-1");
      expect(image.getAttribute("aria-hidden")).toBe("true");
      expect(element.querySelector("h3 a")?.getAttribute("href")).toBe(`producto/${item.id}/`);
    }
    expect(doc.querySelector(".skip-link")?.getAttribute("href")).toBe("#catalogo");
  });
});

describe("copy", () => {
  it("usa 'cariño' como mucho dos veces y no repite la numeración", () => {
    expect(page.match(/cariño/gi)?.length ?? 0).toBeLessThanOrEqual(2);
    expect(page).not.toMatch(/catálogo recibido/i);
    expect(page).not.toMatch(/con intención/i);
    expect(page.match(/>01</g)).toHaveLength(1);
    expect(doc.querySelector(".value-index")).toBeNull();
  });
});

describe("escape", () => {
  it("escapa un <script> en el nombre del producto", () => {
    const hostile = `<script>alert("x")</script>`;
    const catalog = products.map((item) => (item.id === "tarjetas" ? { ...item, name: hostile } : item));
    const html = renderPage({ business, catalog });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    const parsed = parse(html);
    expect(parsed.querySelectorAll("script")).toHaveLength(0);
    expect(text(parsed.getElementById("producto-tarjetas")!.querySelector("h3"))).toBe(hostile);
  });
});

describe("sin estilos en línea", () => {
  it("ninguna plantilla emite atributos style", () => {
    const vinyl = product("vinilos");
    const withAddOn = resolveSelection(vinyl, { material: "blanco", laca: "sin-laca" }, ["vinilos-maqueta"])!;
    const outputs = [
      page,
      cardPrice(withAddOn),
      addButtonContent(vinyl, withAddOn),
      cartCountContent(3),
      cartContent(filledCart),
      cartContent({ lines: [], quantity: 0, subtotal: 0 }),
      stickyBarContent(filledCart),
    ];
    for (const html of outputs) {
      expect(html).not.toMatch(/\sstyle\s*=/i);
    }
    expect(doc.querySelectorAll("[style]")).toHaveLength(0);
  });
});

describe("controles antes de hidratar", () => {
  it("cada botón de sumar tiene un nombre distinto con el producto y viene deshabilitado", () => {
    const buttons = [...doc.querySelectorAll<HTMLButtonElement>('button[data-action="add"]')];
    expect(buttons).toHaveLength(8);

    const names = buttons.map(accessibleName);
    expect(new Set(names).size).toBe(8);
    for (const [index, item] of products.entries()) {
      const button = buttons[index];
      expect(button.dataset.productId).toBe(item.id);
      expect(button.hasAttribute("disabled")).toBe(true);
      expect(text(button.querySelector(".add-button-label"))).toBe("Sumar");
      expect(names[index]).toBe(`Sumar ${item.name}, ${formatPrice(initialResolved(item).total)}`);
    }
  });

  it("las opciones son radios deshabilitados, con la primera marcada y sin autocompletar", () => {
    const tarjetas = card("tarjetas");
    const groups = [...tarjetas.querySelectorAll("fieldset.option-group")];
    expect(groups.map((group) => group.getAttribute("data-group"))).toEqual(["cantidad", "faz", "terminacion"]);
    for (const group of groups) {
      const radios = [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
      expect(radios.length).toBeGreaterThan(1);
      expect(radios.filter((radio) => radio.hasAttribute("checked"))).toEqual([radios[0]]);
      expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    }
    expect(text(groups[0].querySelector("legend"))).toBe("Cantidad de Tarjetas personales");

    const controls = [...doc.querySelectorAll<HTMLInputElement>('.product-card input')];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.hasAttribute("disabled")).toBe(true);
      expect(control.getAttribute("autocomplete")).toBe("off");
    }
    expect(card("entre-flores").querySelector("fieldset")).toBeNull();
  });

  it("los adicionales son casillas deshabilitadas con su precio, separadas de las opciones", () => {
    const addOns = [...card("vinilos").querySelectorAll(".addon-group .addon")];
    expect(addOns.map(text)).toEqual([
      `Maqueta + ${formatPrice(2500)} cada 5 diseños`,
      `Corte individual + ${formatPrice(2500)} por pliego`,
    ]);
    for (const addOn of addOns) {
      const input = addOn.querySelector('input[type="checkbox"]')!;
      expect(input.hasAttribute("disabled")).toBe(true);
      expect(input.closest(".option-group")).toBeNull();
    }
    expect(card("tarjetas").querySelector(".addon-group")).toBeNull();
  });

  it("'Ver ficha' es un enlace común a la página de 1800 px, con el producto en el nombre", () => {
    for (const item of products) {
      const link = card(item.id).querySelector<HTMLAnchorElement>("a.ficha-link")!;
      expect(link.getAttribute("href")).toBe(`images/ficha-${item.id}-1800.webp`);
      expect(link.dataset.action).toBe("open-ficha");
      expect(link.dataset.productId).toBe(item.id);
      expect(accessibleName(link)).toBe(`Ver ficha de ${item.name}`);
    }
  });

  it("explica cómo mandar las fotos solo en los productos que las llevan", () => {
    for (const item of products) {
      const help = card(item.id).querySelector("details.photo-help");
      expect(help !== null).toBe(item.needsPhotos);
      if (help && item.photoInstructions) {
        expect(text(help)).toContain(item.photoInstructions.howToSend);
      }
    }
  });
});

describe("imágenes", () => {
  it("cada foto de tarjeta lleva srcset con los anchos del catálogo, sizes, width, height y carga diferida", () => {
    for (const item of products) {
      const image = card(item.id).querySelector("img.product-image")!;
      const spec = item.images.card;
      const candidates = (image.getAttribute("srcset") ?? "").split(", ");
      expect(candidates).toEqual(spec.widths.map((width) => `images/${spec.base}-${width}.webp ${width}w`));
      expect(image.getAttribute("sizes")).toBe(CARD_IMAGE_SIZES);
      expect(image.getAttribute("width")).toBe(String(spec.width));
      expect(image.getAttribute("height")).toBe(String(spec.height));
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.getAttribute("alt")).toBe(item.imageAlt);
      expect(image.hasAttribute("fetchpriority")).toBe(false);
    }
  });

  it("solo la imagen principal del hero tiene prioridad alta", () => {
    const priority = [...doc.querySelectorAll('[fetchpriority="high"]')];
    expect(priority).toHaveLength(1);
    expect(priority[0].closest(".hero-photo-main")).not.toBeNull();
    expect(priority[0].getAttribute("srcset")).toContain("images/hero-bitacoras-800.webp 800w");

    const small = doc.querySelector(".hero-photo-small img")!;
    expect(small.getAttribute("srcset")).toContain("images/hero-fotos-434.webp 434w");
    expect(small.hasAttribute("sizes")).toBe(true);
  });
});

describe("islas del cliente", () => {
  it("el precio muestra la unidad y avisa cuando suma adicionales", () => {
    const tarjetas = resolveSelection(product("tarjetas"), {
      cantidad: "200",
      faz: "doble-faz",
      terminacion: "laminado",
    })!;
    expect(text(parse(cardPrice(tarjetas)).body)).toBe(`${formatPrice(26300)} pack de 200`);

    const vinilos = resolveSelection(product("vinilos"), { material: "blanco", laca: "sin-laca" }, [
      "vinilos-maqueta",
    ])!;
    expect(text(parse(cardPrice(vinilos)).body)).toBe(`${formatPrice(17000)} por pliego, con adicionales`);
  });

  it("el botón de sumar refleja la elección y conserva el producto en el nombre accesible", () => {
    const tarjetas = resolveSelection(product("tarjetas"), {
      cantidad: "200",
      faz: "doble-faz",
      terminacion: "laminado",
    })!;
    const button = parse(`<button>${addButtonContent(product("tarjetas"), tarjetas)}</button>`).querySelector("button")!;
    expect(text(button.querySelector(".add-button-price"))).toBe(`· ${formatPrice(26300)}`);
    expect(button.querySelector(".add-button-price")?.getAttribute("aria-hidden")).toBe("true");
    expect(accessibleName(button)).toBe(`Sumar Tarjetas personales, ${formatPrice(26300)}`);
  });

  it("el contador dice la cantidad a lectores sin repetir el número", () => {
    expect(text(parse(cartCountContent(0)).querySelector(".visually-hidden"))).toBe(", vacío");
    expect(text(parse(cartCountContent(1)).querySelector(".visually-hidden"))).toBe(", 1 producto");
    expect(text(parse(cartCountContent(3)).querySelector(".visually-hidden"))).toBe(", 3 productos");
    expect(parse(cartCountContent(3)).querySelector('[aria-hidden="true"]')?.textContent).toBe("3");
  });

  it("el panel muestra el estado vacío o las líneas con sus adicionales y el subtotal", () => {
    const empty = parse(cartContent({ lines: [], quantity: 0, subtotal: 0 }));
    expect(text(empty.querySelector("h3"))).toBe("Tu pedido empieza acá.");
    expect(empty.querySelector('[data-action="browse-products"]')).not.toBeNull();

    const filled = parse(cartContent(filledCart));
    const items = [...filled.querySelectorAll(".cart-item")];
    expect(items.map((item) => item.getAttribute("data-line-id"))).toEqual([
      "tarjetas-200-doble-faz-laminado",
      "vinilos-blanco-sin-laca",
    ]);
    expect(text(items[0].querySelector(".cart-item-price"))).toBe(formatPrice(26300 * 2));
    const addOn = items[1].querySelector(".cart-addon")!;
    expect(text(addOn.querySelector(".cart-addon-name"))).toBe("Maqueta");
    expect(text(addOn.querySelector(".cart-addon-price"))).toBe(`+ ${formatPrice(2500)} cada 5 diseños`);
    expect(text(addOn.querySelector("[data-action=\"remove-addon\"]"))).toBe("Quitar Maqueta de Vinilos impresos (Blanco · Sin laca)");
    expect(text(items[0].querySelector("[data-action=\"remove-line\"]"))).toBe(
      "Quitar Tarjetas personales (200 · Doble faz · Laminado mate o brillo)",
    );
    expect(text(filled.querySelector(".cart-summary strong"))).toBe(formatPrice(26300 * 2 + 14500 + 2500));
  });

  it("la barra fija muestra cantidad, subtotal y el acceso al pedido", () => {
    const bar = parse(stickyBarContent(filledCart));
    expect(text(bar.querySelector(".sticky-bar-count"))).toBe("3 productos");
    expect(text(bar.querySelector(".sticky-bar-subtotal"))).toBe(formatPrice(filledCart.subtotal));
    expect(bar.querySelector('button[data-action="open-cart"]')).not.toBeNull();
  });
});
