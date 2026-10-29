/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from "vite";
import type { BusinessInfo } from "./src/business";
import type { CatalogProduct } from "./src/catalog";
import { headTags, injectApp, pendingFields, renderDocument, type PendingFields } from "./src/prerender";
import { isValidWhatsAppNumber, normalizeSiteUrl } from "./src/validation";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
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
    const rule =
      "tiene que ser el número en formato internacional, solo dígitos y sin +, espacios ni guiones (por ejemplo 5491123456789).";
    problems.push(
      whatsappNumber === ""
        ? `Falta VITE_WHATSAPP_NUMBER: ${rule}`
        : `El valor de VITE_WHATSAPP_NUMBER (${JSON.stringify(whatsappNumber)}) no es válido: ${rule}`,
    );
  }

  if (siteUrl === null) {
    const rule =
      "tiene que ser la dirección pública de la tienda, con https:// y sin ruta (por ejemplo https://studioags.com.ar).";
    problems.push(
      rawSiteUrl === ""
        ? `Falta VITE_SITE_URL: ${rule}`
        : `El valor de VITE_SITE_URL (${JSON.stringify(rawSiteUrl)}) no es válido: ${rule}`,
    );
  }

  if (pending.business.length > 0) {
    problems.push(`src/business.ts todavía tiene datos de ejemplo: ${pending.business.join(", ")}.`);
  }

  if (pending.catalog.length > 0) {
    problems.push(`src/catalog.ts todavía tiene datos de ejemplo: ${pending.catalog.join(", ")}.`);
  }

  return {
    strict: command === "build" && mode !== TEST_BUILD_MODE,
    siteUrl: siteUrl ?? LOCAL_PREVIEW_URL,
    siteUrlFallback: siteUrl === null,
    problems,
  };
}

export function studioAgs(options: StudioAgsOptions = {}): Plugin[] {
  let isPreview = false;
  let testBuild = false;
  // Se resuelven una sola vez y los usan la guardia y el prerender (canonical y Open Graph).
  let settings: PublishSettings = {
    strict: false,
    siteUrl: LOCAL_PREVIEW_URL,
    siteUrlFallback: true,
    problems: [],
  };

  const publishGuard: Plugin = {
    name: "studioags:publish-guard",
    config(_config, env) {
      isPreview = env.isPreview === true;
    },
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir, "VITE_");
      settings = resolvePublishSettings(config.command, config.mode, env, pendingFields(options));

      if (isPreview || (config.command === "serve" && config.mode === "test")) {
        return;
      }
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

  // En desarrollo y en los builds: la cáscara va en #app y los metadatos en el head.
  const prerender: Plugin = {
    name: "studioags:prerender",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const tags: HtmlTagDescriptor[] = headTags({ ...options, siteUrl: settings.siteUrl }).map((tag) => ({
          ...tag,
          injectTo: "head",
        }));
        return { html: injectApp(html, renderDocument(options)), tags };
      },
    },
  };

  // La CSP rompería los estilos en línea que inyecta Vite en desarrollo: solo va en los builds.
  const buildHtml: Plugin = {
    name: "studioags:build-html",
    apply: "build",
    configResolved(config) {
      testBuild = config.mode === TEST_BUILD_MODE;
    },
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
        if (testBuild) {
          tags.push({ tag: "meta", attrs: { name: "robots", content: "noindex" }, injectTo: "head" });
        }
        return tags;
      },
    },
  };

  return [publishGuard, prerender, buildHtml];
}

export default defineConfig({
  plugins: [studioAgs()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
