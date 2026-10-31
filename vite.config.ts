/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, loadEnv, normalizePath, type HtmlTagDescriptor, type Plugin } from "vite";
import type { BusinessInfo } from "./src/business";
import { products as defaultCatalog, type CatalogProduct } from "./src/catalog";
import {
  headTags,
  injectApp,
  pendingFields,
  productHeadTags,
  renderDocument,
  renderProductDocument,
  renderSitePageDocument,
  sitePageHeadTags,
  sitePages,
  type PendingFields,
  type SitePageId,
} from "./src/prerender";
import { isValidWhatsAppNumber, normalizeSiteUrl } from "./src/validation";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

export const LOCAL_PREVIEW_URL = "http://localhost:4173";

const TEST_BUILD_MODE = "prueba";

interface PublishSettings {
  strict: boolean;
  siteUrl: string;
  siteUrlFallback: boolean;
  problems: string[];
}

export interface StudioAgsOptions {
  // Para tests: reemplaza los datos de src/business.ts.
  business?: BusinessInfo;
  // Para tests: reemplaza los productos de src/catalog.ts.
  catalog?: readonly CatalogProduct[];
}

function envProblem(name: string, raw: string, rule: string): string {
  return raw === "" ? `Falta ${name}: ${rule}` : `El valor de ${name} (${JSON.stringify(raw)}) no es válido: ${rule}`;
}

function resolvePublishSettings(
  command: "build" | "serve",
  mode: string,
  env: Record<string, string>,
  pending: PendingFields,
): PublishSettings {
  const whatsappNumber = env.VITE_WHATSAPP_NUMBER ?? "";
  const rawSiteUrl = env.VITE_SITE_URL ?? "";
  const siteUrl = normalizeSiteUrl(rawSiteUrl);
  const problems: string[] = [];

  if (!isValidWhatsAppNumber(whatsappNumber)) {
    problems.push(
      envProblem(
        "VITE_WHATSAPP_NUMBER",
        whatsappNumber,
        "tiene que ser el número en formato internacional, solo dígitos y sin +, espacios ni guiones (por ejemplo 5491123456789).",
      ),
    );
  }

  if (siteUrl === null) {
    problems.push(
      envProblem(
        "VITE_SITE_URL",
        rawSiteUrl,
        "tiene que ser la dirección pública de la tienda, con https:// (por ejemplo https://studioags.com.ar o https://usuario.github.io/StudioAgs).",
      ),
    );
  }

  const pendingData: [file: string, fields: readonly string[]][] = [
    ["src/business.ts", pending.business],
    ["src/catalog.ts", pending.catalog],
  ];
  for (const [file, fields] of pendingData) {
    if (fields.length > 0) {
      problems.push(`${file} todavía tiene datos de ejemplo: ${fields.join(", ")}.`);
    }
  }

  return {
    strict: command === "build" && mode !== TEST_BUILD_MODE,
    siteUrl: siteUrl ?? LOCAL_PREVIEW_URL,
    siteUrlFallback: siteUrl === null,
    problems,
  };
}

// Cada producto tiene su página en producto/<id>/, y Productos, Nosotros y Contacto en <id>/. En
// el build son entradas virtuales en la raíz (producto-<id>.html y pagina-<id>.html, con el mismo
// index.html de plantilla) que al final se mueven a su carpeta; en desarrollo las sirve un
// middleware. El <base> hace que sus rutas relativas partan de la raíz.
const PAGE_ENTRY_FILE = /^(producto|pagina)-([^/]+)\.html$/;
const PRODUCT_BASE = "../../";
const SITE_PAGE_BASE = "../";

type InnerPage = { kind: "product"; id: string } | { kind: "site"; id: SitePageId };

function isSitePageId(id: string): id is SitePageId {
  return sitePages.some((page) => page.id === id);
}

function pageFromPath(path: string, catalog: readonly CatalogProduct[]): InnerPage | null {
  const product = /^\/producto-([^/]+)\.html$/.exec(path) ?? /^\/producto\/([^/]+)\/(?:index\.html)?$/.exec(path);
  if (product) {
    const id = product[1];
    return catalog.some((item) => item.id === id) ? { kind: "product", id } : null;
  }
  const site = /^\/pagina-([^/]+)\.html$/.exec(path) ?? /^\/([^/]+)\/(?:index\.html)?$/.exec(path);
  const id = site?.[1];
  return id && isSitePageId(id) ? { kind: "site", id } : null;
}

// Dónde queda cada entrada virtual al final del build.
function pageOutputDir(kind: string, id: string): string {
  return kind === "producto" ? `producto/${id}` : id;
}

export function studioAgs(options: StudioAgsOptions = {}): Plugin[] {
  const catalog = options.catalog ?? defaultCatalog;
  let root = process.cwd();
  let productEntries = new Set<string>();
  // Se resuelven una sola vez y los usan la guardia, el prerender (canonical y Open Graph) y el
  // HTML del build.
  let settings: PublishSettings = {
    strict: false,
    siteUrl: LOCAL_PREVIEW_URL,
    siteUrlFallback: true,
    problems: [],
  };

  const publishSettings: Plugin = {
    name: "studioags:publish-settings",
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir, "VITE_");
      settings = resolvePublishSettings(config.command, config.mode, env, pendingFields(options));
    },
  };

  // La vista previa sirve un build ya revisado y Vitest no publica nada: ahí no se revisa.
  const publishGuard: Plugin = {
    name: "studioags:publish-guard",
    apply: (_config, env) => env.isPreview !== true && !(env.command === "serve" && env.mode === "test"),
    configResolved(config) {
      if (settings.problems.length === 0) {
        return;
      }

      const list = settings.problems.map((problem) => `  - ${problem}`).join("\n");
      if (settings.strict) {
        throw new Error(
          [
            "No se puede preparar la tienda para publicar:",
            list,
            'Completá .env (copiá .env.example) o las variables del hosting y sacá los example(...) de src/business.ts y src/catalog.ts. Para una versión de prueba usá "npm run build:prueba".',
          ].join("\n"),
        );
      }

      const intro =
        config.command === "build"
          ? 'Versión de prueba con datos incompletos (lleva noindex; para publicar usá "npm run build"):'
          : "Faltan datos para publicar la tienda (en desarrollo solo se avisa):";
      const fallback = settings.siteUrlFallback
        ? `\nSin un VITE_SITE_URL válido se usa ${settings.siteUrl}.`
        : "";
      config.logger.warn(`${intro}\n${list}${fallback}`);
    },
  };

  const productPages: Plugin = {
    name: "studioags:product-pages",
    enforce: "pre",
    config(userConfig, env) {
      if (env.command !== "build") {
        return;
      }
      root = resolve(userConfig.root ?? process.cwd());
      const entries = [
        ...catalog.map((product) => `producto-${product.id}`),
        ...sitePages.map((page) => `pagina-${page.id}`),
      ].map((name) => [name, resolve(root, `${name}.html`)]);
      productEntries = new Set(entries.map(([, file]) => normalizePath(file)));
      return {
        build: { rollupOptions: { input: { index: resolve(root, "index.html"), ...Object.fromEntries(entries) } } },
      };
    },
    resolveId(id) {
      return productEntries.has(normalizePath(id)) ? normalizePath(id) : null;
    },
    load(id) {
      return productEntries.has(id) ? readFileSync(resolve(root, "index.html"), "utf8") : null;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!pageFromPath(path.endsWith("/") ? path : `${path}/`, catalog)) {
          next();
          return;
        }
        if (!path.endsWith("/")) {
          res.statusCode = 301;
          res.setHeader("Location", `${path}/`);
          res.end();
          return;
        }
        readFile(resolve(server.config.root, "index.html"), "utf8")
          .then((template) => server.transformIndexHtml(path, template, req.originalUrl))
          .then((html) => {
            res.setHeader("Content-Type", "text/html");
            res.end(html);
          })
          .catch(next);
      });
    },
  };

  // Al final del build cada página pasa a su carpeta: producto/<id>/index.html o <id>/index.html.
  const productBundle: Plugin = {
    name: "studioags:product-bundle",
    apply: "build",
    enforce: "post",
    generateBundle(_outputOptions, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        const match = PAGE_ENTRY_FILE.exec(fileName);
        if (!match || output.type !== "asset") {
          continue;
        }
        delete bundle[fileName];
        this.emitFile({ type: "asset", fileName: `${pageOutputDir(match[1], match[2])}/index.html`, source: output.source });
      }
    },
  };

  // En desarrollo y en los builds: la cáscara va en #app y los metadatos en el head.
  const prerender: Plugin = {
    name: "studioags:prerender",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const site = { ...options, siteUrl: settings.siteUrl };
        const page = pageFromPath(ctx.path, catalog);
        const head =
          page?.kind === "product"
            ? productHeadTags(page.id, site)
            : page?.kind === "site"
              ? sitePageHeadTags(page.id, site)
              : headTags(site);
        const tags: HtmlTagDescriptor[] = head.map((tag) => ({ ...tag, injectTo: "head" }));
        if (!page) {
          return { html: injectApp(html, renderDocument(options)), tags };
        }
        const base = page.kind === "product" ? PRODUCT_BASE : SITE_PAGE_BASE;
        tags.unshift({ tag: "base", attrs: { href: base }, injectTo: "head-prepend" });
        const markup =
          page.kind === "product"
            ? renderProductDocument(page.id, options)
            : renderSitePageDocument(page.id, options);
        return { html: injectApp(html, markup), tags };
      },
    },
  };

  // La CSP rompería los estilos en línea que inyecta Vite en desarrollo: solo va en los builds.
  const buildHtml: Plugin = {
    name: "studioags:build-html",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler() {
        const tags: HtmlTagDescriptor[] = [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
            injectTo: "head-prepend",
          },
        ];
        // El único build no estricto es la versión de prueba, que no se indexa.
        if (!settings.strict) {
          tags.push({ tag: "meta", attrs: { name: "robots", content: "noindex" }, injectTo: "head" });
        }
        return tags;
      },
    },
  };

  return [productPages, publishSettings, publishGuard, prerender, buildHtml, productBundle];
}

export default defineConfig({
  // Rutas relativas: la misma build sirve en un dominio propio o en una carpeta como GitHub Pages.
  base: "./",
  plugins: [studioAgs()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
