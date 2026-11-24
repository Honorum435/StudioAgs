/// <reference types="vite/client" />
import type { ProductFile } from "./catalog";

// Lo que edita el panel: un archivo por producto en contenido/, con el id como nombre. Vite junta
// todos los .json, así un producto nuevo del panel entra solo, sin tocar el código.
//
// vite.config.ts no pasa por Vite y ahí import.meta.glob no existe: antes de importar el catálogo,
// src/contenido-node.ts lee la carpeta con fs y la deja en globalThis.contenidoStudioAgs.
declare global {
  var contenidoStudioAgs: Record<string, ProductFile> | undefined;
}

function byId(files: Record<string, ProductFile>): Record<string, ProductFile> {
  return Object.fromEntries(
    Object.entries(files).map(([path, file]) => [path.replace(/^.*\//, "").replace(/\.json$/, ""), file]),
  );
}

const content: Record<string, ProductFile> =
  globalThis.contenidoStudioAgs ??
  byId(import.meta.glob<ProductFile>("../contenido/*.json", { eager: true, import: "default" }));

export default content;
