import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCatalog, type ProductFile } from "./catalog";

// Lee los contenido/*.json de verdad (no la copia de los tests): es lo que edita el panel, que
// puede sumar y borrar productos. Si algo de acá falla, el sitio no se vuelve a publicar.
const files = readdirSync("contenido").filter((name) => name.endsWith(".json"));
const real: Record<string, ProductFile> = Object.fromEntries(
  files.map((name) => [name.replace(/\.json$/, ""), JSON.parse(readFileSync(`contenido/${name}`, "utf8"))]),
);

describe("contenido/", () => {
  it("arma el catálogo sin errores, con al menos un producto", () => {
    expect(() => buildCatalog(real)).not.toThrow();
    expect(buildCatalog(real).length).toBeGreaterThan(0);
  });

  it("el nombre de cada archivo sirve de dirección: minúsculas, números y guiones", () => {
    for (const id of Object.keys(real)) {
      expect(id, `contenido/${id}.json: el nombre del archivo no sirve para la dirección de la página`).toMatch(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      );
    }
  });

  it("cada precio es un entero mayor que 0 y cada producto tiene al menos una foto", () => {
    for (const [id, content] of Object.entries(real)) {
      for (const { label, price } of [...content.prices, ...(content.addOns ?? [])]) {
        expect(typeof price === "number" && Number.isInteger(price) && price > 0, `contenido/${id}.json: el precio de «${label}» tiene que ser un entero mayor que 0`).toBe(true);
      }
      expect(content.gallery.length, `contenido/${id}.json: falta al menos una foto en la galería`).toBeGreaterThan(0);
    }
  });

  it("cada foto existe en public/; las de las opciones pueden quedar sin foto", () => {
    for (const [id, content] of Object.entries(real)) {
      for (const { src } of content.gallery) {
        expect(src && existsSync(`public${src}`), `contenido/${id}.json: no existe public${src}`).toBe(true);
      }
      for (const { src } of (content.groups ?? []).flatMap((group) => group.options ?? [])) {
        expect(!src || existsSync(`public${src}`), `contenido/${id}.json: no existe public${src}`).toBe(true);
      }
    }
  });
});
