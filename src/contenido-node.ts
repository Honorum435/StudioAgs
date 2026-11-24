import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProductFile } from "./catalog";

// Para vite.config.ts, que carga el catálogo en Node sin pasar por Vite: lee contenido/*.json y lo
// deja donde lo busca src/contenido.ts. Tiene que importarse antes que el catálogo.
const folder = resolve(import.meta.dirname, "../contenido");

globalThis.contenidoStudioAgs = Object.fromEntries(
  readdirSync(folder)
    .filter((name) => name.endsWith(".json"))
    .map((name) => [name.replace(/\.json$/, ""), JSON.parse(readFileSync(resolve(folder, name), "utf8")) as ProductFile]),
);
