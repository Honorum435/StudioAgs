import type { ProductContent } from "./catalog";
import archivoBajonero from "../contenido/archivo-bajonero.json";
import bitacoras from "../contenido/bitacoras.json";
import calendarios from "../contenido/calendarios.json";
import complementos from "../contenido/complementos.json";
import dtfTextil from "../contenido/dtf-textil.json";
import entreFlores from "../contenido/entre-flores.json";
import fotos from "../contenido/fotos.json";
import granFormato from "../contenido/gran-formato.json";
import laminas from "../contenido/laminas.json";
import minijuegos from "../contenido/minijuegos.json";
import pizarraOrma from "../contenido/pizarra-orma.json";
import tarjetas from "../contenido/tarjetas.json";
import vinilos from "../contenido/vinilos.json";

// Lo que edita el panel (precios, fotos y textos de cada producto); tsc revisa que cada archivo tenga la forma de ProductContent.
const content: Record<string, ProductContent> = {
  "archivo-bajonero": archivoBajonero,
  bitacoras,
  calendarios,
  complementos,
  "dtf-textil": dtfTextil,
  "entre-flores": entreFlores,
  fotos,
  "gran-formato": granFormato,
  laminas,
  minijuegos,
  "pizarra-orma": pizarraOrma,
  tarjetas,
  vinilos,
};

export default content;
