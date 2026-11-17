import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCatalog, products, type ProductContent } from "./catalog";

// Lee los contenido/*.json de verdad (no la copia de los tests): es lo que edita el panel.
const files = readdirSync("contenido").filter((name) => name.endsWith(".json"));
const real: Record<string, ProductContent> = Object.fromEntries(
  files.map((name) => [name.replace(/\.json$/, ""), JSON.parse(readFileSync(`contenido/${name}`, "utf8"))]),
);

describe("contenido/", () => {
  it("hay un archivo por producto y arma el catálogo sin errores", () => {
    expect(Object.keys(real).sort(), "los archivos de contenido/ no coinciden con los productos").toEqual(
      products.map((product) => product.id).sort(),
    );
    expect(() => buildCatalog(real)).not.toThrow();
  });

  it("cada precio es un entero mayor que 0 y cada producto tiene al menos una foto", () => {
    for (const [id, content] of Object.entries(real)) {
      for (const { label, price } of [...content.prices, ...(content.addOns ?? [])]) {
        expect(Number.isInteger(price) && price > 0, `contenido/${id}.json: el precio de «${label}» tiene que ser un entero mayor que 0`).toBe(true);
      }
      expect(content.gallery.length, `contenido/${id}.json: falta al menos una foto en la galería`).toBeGreaterThan(0);
    }
  });

  it("cada foto existe en public/; las de las opciones pueden quedar sin foto", () => {
    for (const [id, content] of Object.entries(real)) {
      for (const { src } of content.gallery) {
        expect(src && existsSync(`public${src}`), `contenido/${id}.json: no existe public${src}`).toBe(true);
      }
      for (const { src } of content.optionPhotos ?? []) {
        expect(!src || existsSync(`public${src}`), `contenido/${id}.json: no existe public${src}`).toBe(true);
      }
    }
  });
});
