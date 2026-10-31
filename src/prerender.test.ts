import { describe, expect, it } from "vitest";
import { businessValue, example, type BusinessInfo } from "./business";
import { products, type CatalogProduct } from "./catalog";
import {
  SHARE_IMAGE,
  SITE_TITLE,
  headTags,
  injectApp,
  jsonLd,
  pendingFields,
  productHeadTags,
  productJsonLd,
  renderDocument,
  renderProductDocument,
  serializeForScript,
  type HeadTag,
} from "./prerender";

const siteUrl = "https://studioags.com.ar";

const completeBusiness: BusinessInfo = {
  pickupArea: "Retiro en Palermo, CABA.",
  shipping: "Envíos a todo el país.",
  paymentMethods: ["Transferencia bancaria", "Efectivo"],
  instagramHandle: "studioags",
  responseTime: "Respondemos en el día.",
  exchangePolicy: "Te mandamos una muestra antes de imprimir.",
  pricesUpdatedAt: { year: 2026, month: 7, day: 14 },
};

const completeCatalog: CatalogProduct[] = products.map((product) => ({
  ...product,
  leadTime: businessValue(product.leadTime),
}));

interface JsonLdItem {
  "@type": string;
  name: string;
  image: string;
  offers: Record<string, unknown>;
}

function graph(text: string): { store: Record<string, unknown>; list: Record<string, unknown>; items: JsonLdItem[] } {
  const data = JSON.parse(text) as { "@context": string; "@graph": Array<Record<string, unknown>> };
  expect(data["@context"]).toBe("https://schema.org");
  const store = data["@graph"].find((node) => node["@type"] === "Store")!;
  const list = data["@graph"].find((node) => node["@type"] === "ItemList")!;
  const items = (list.itemListElement as Array<{ item: JsonLdItem }>).map((entry) => entry.item);
  return { store, list, items };
}

function find(tags: HeadTag[], key: string, value: string): HeadTag | undefined {
  return tags.find((tag) => tag.attrs?.[key] === value);
}

describe("página de un producto", () => {
  it("arma título, descripción, canonical y Open Graph con la dirección del producto", () => {
    const tags = productHeadTags("pizarra-orma", { siteUrl, business: completeBusiness });
    const pizarra = products.find((item) => item.id === "pizarra-orma")!;
    const url = "https://studioags.com.ar/producto/pizarra-orma/";
    expect(tags.find((tag) => tag.tag === "title")?.children).toBe("Pizarra OrMa — StudioAGS");
    expect(find(tags, "name", "description")?.attrs?.content).toBe(pizarra.description);
    expect(find(tags, "rel", "canonical")?.attrs?.href).toBe(url);
    expect(find(tags, "property", "og:url")?.attrs?.content).toBe(url);
    expect(find(tags, "property", "og:title")?.attrs?.content).toBe("Pizarra OrMa — StudioAGS");
    expect(find(tags, "property", "og:image")?.attrs?.content).toBe(`${siteUrl}/${SHARE_IMAGE.path}`);
  });

  it("describe la tienda y el producto con su página y su oferta", () => {
    const data = JSON.parse(productJsonLd("tarjetas", { siteUrl, business: completeBusiness })) as {
      "@graph": Array<Record<string, unknown>>;
    };
    const item = data["@graph"].find((node) => node["@type"] === "Product")!;
    expect(data["@graph"].some((node) => node["@type"] === "Store")).toBe(true);
    expect(item.url).toBe("https://studioags.com.ar/producto/tarjetas/");
    expect((item.offers as Record<string, unknown>)["@type"]).toBe("AggregateOffer");
  });

  it("la lista del inicio apunta a la página de cada producto", () => {
    const { items } = graph(jsonLd({ siteUrl, business: completeBusiness }));
    expect(items.map((item) => (item as unknown as { url: string }).url)).toEqual(
      products.map((item) => `${siteUrl}/producto/${item.id}/`),
    );
  });

  it("falla con un mensaje claro si el producto no existe", () => {
    expect(() => renderProductDocument("no-existe")).toThrow('No hay un producto "no-existe" en el catálogo.');
  });
});

describe("jsonLd", () => {
  it("es JSON válido con la tienda y los 8 productos en ARS", () => {
    const { store, list, items } = graph(jsonLd({ siteUrl, business: completeBusiness }));

    expect(store.name).toBe("StudioAGS");
    expect(store.currenciesAccepted).toBe("ARS");
    expect(store.paymentAccepted).toBe("Transferencia bancaria, Efectivo");
    expect(store.sameAs).toEqual(["https://www.instagram.com/studioags/"]);
    expect(list.numberOfItems).toBe(8);
    expect(items.map((item) => item.name)).toEqual(products.map((product) => product.name));
    for (const item of items) {
      expect(item["@type"]).toBe("Product");
      expect(item.offers.priceCurrency).toBe("ARS");
      expect(item.image.startsWith(`${siteUrl}/images/`)).toBe(true);
    }
  });

  it("usa AggregateOffer con rango de precios y Offer cuando hay un solo precio", () => {
    const { items } = graph(jsonLd({ siteUrl }));
    const byName = (name: string) => items.find((item) => item.name === name)!;

    expect(byName("Tarjetas personales").offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: 13300,
      highPrice: 99000,
      offerCount: 20,
      priceCurrency: "ARS",
    });
    expect(byName("Entre Flores").offers).toMatchObject({ "@type": "Offer", price: 35000, priceCurrency: "ARS" });
  });

  it("un </script> dentro de un nombre sale como \\u003c/script> y no cierra la etiqueta", () => {
    const name = "Tarjetas</script><script>alert(1)</script>";
    const catalog = products.map((product) => (product.id === "tarjetas" ? { ...product, name } : product));
    const output = jsonLd({ siteUrl, catalog });

    expect(output).toContain("\\u003c/script>");
    expect(output).not.toContain("<");
    expect(graph(output).items.find((item) => item.name === name)).toBeDefined();
  });

  it("serializeForScript escapa cada < y conserva el valor", () => {
    const value = { text: "<!-- a </script> b <" };
    const output = serializeForScript(value);
    expect(output).toBe('{"text":"\\u003c!-- a \\u003c/script> b \\u003c"}');
    expect(JSON.parse(output)).toEqual(value);
  });
});

describe("headTags", () => {
  it("arma canonical, Open Graph y Twitter con URLs absolutas del sitio", () => {
    const tags = headTags({ siteUrl, business: completeBusiness });
    const image = `${siteUrl}/${SHARE_IMAGE.path}`;

    expect(tags.find((tag) => tag.tag === "title")?.children).toBe(SITE_TITLE);
    expect(find(tags, "rel", "canonical")?.attrs?.href).toBe(`${siteUrl}/`);
    expect(find(tags, "property", "og:url")?.attrs?.content).toBe(`${siteUrl}/`);
    expect(find(tags, "property", "og:image")?.attrs?.content).toBe(image);
    expect(find(tags, "property", "og:image:width")?.attrs?.content).toBe("1200");
    expect(find(tags, "property", "og:image:height")?.attrs?.content).toBe("630");
    expect(find(tags, "property", "og:locale")?.attrs?.content).toBe("es_AR");
    expect(find(tags, "name", "twitter:card")?.attrs?.content).toBe("summary_large_image");
    expect(find(tags, "name", "twitter:image")?.attrs?.content).toBe(image);
    expect(find(tags, "name", "description")?.attrs?.content).toBeTruthy();

    const script = tags.find((tag) => tag.tag === "script")!;
    expect(script.attrs?.type).toBe("application/ld+json");
    expect(graph(script.children!).list.numberOfItems).toBe(8);
  });

  it("usa la URL que recibe, también la de la vista previa local", () => {
    const tags = headTags({ siteUrl: "http://localhost:4173" });
    expect(find(tags, "property", "og:url")?.attrs?.content).toBe("http://localhost:4173/");
    expect(find(tags, "property", "og:image")?.attrs?.content).toBe("http://localhost:4173/images/compartir.jpg");
  });

  it("escapa el título, que Vite inserta sin escapar", () => {
    const title = headTags({ siteUrl }).find((tag) => tag.tag === "title")!;
    expect(title.children).not.toMatch(/[<>]/);
  });
});

describe("renderDocument e injectApp", () => {
  it("renderiza los 8 productos con los datos reales por defecto", () => {
    const html = renderDocument();
    expect(html.match(/<article class="product-card"/g)).toHaveLength(8);
    expect(html).toContain("Precios actualizados al 14 de julio de 2026");
  });

  it("usa el catálogo y los datos que recibe", () => {
    const html = renderDocument({ business: completeBusiness, catalog: completeCatalog.slice(0, 2) });
    expect(html.match(/<article class="product-card"/g)).toHaveLength(2);
    expect(html).toContain(completeBusiness.shipping as string);
  });

  it("reemplaza el #app vacío por la cáscara marcada como prerenderizada", () => {
    const html = '<body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>';
    expect(injectApp(html, "<main>hola</main>")).toBe(
      '<body><div id="app" data-prerendered><main>hola</main>\n</div><script type="module" src="/src/main.ts"></script></body>',
    );
  });

  it("falla con un mensaje claro si index.html no tiene el #app vacío", () => {
    expect(() => injectApp('<body><div id="app">x</div></body>', "<main></main>")).toThrow(
      /index\.html tiene que tener <div id="app"><\/div>/,
    );
  });
});

describe("pendingFields", () => {
  it("lista los datos de ejemplo del negocio y del catálogo", () => {
    const pending = pendingFields();
    expect(pending.business).toContain("shipping");
    expect(pending.catalog).toContain("tarjetas.leadTime");
  });

  it("devuelve listas vacías con los datos completos", () => {
    expect(pendingFields({ business: completeBusiness, catalog: completeCatalog })).toEqual({
      business: [],
      catalog: [],
    });
  });

  it("nombra solo lo que sigue pendiente", () => {
    const pending = pendingFields({
      business: { ...completeBusiness, responseTime: example("En el día.") },
      catalog: completeCatalog.map((product) =>
        product.id === "laminas" ? { ...product, leadTime: example(businessValue(product.leadTime)) } : product,
      ),
    });
    expect(pending).toEqual({ business: ["responseTime"], catalog: ["laminas.leadTime"] });
  });
});
