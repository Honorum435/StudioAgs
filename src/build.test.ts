import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createLogger, type InlineConfig, type Logger } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { studioAgs } from "../vite.config";
import { businessValue, example, type BusinessInfo } from "./business";
import { products, type CatalogProduct } from "./catalog";

const root = fileURLToPath(new URL("..", import.meta.url));
const configFile = join(root, "vite.config.ts");
const isolatedEnvKeys = ["VITE_WHATSAPP_NUMBER", "VITE_SITE_URL", "NODE_ENV"];

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

const completeBusiness: BusinessInfo = {
  pickupArea: "Retiro en Parana, Entre Ríos.",
  shipping: "Envíos a todo el país.",
  paymentMethods: ["Transferencia bancaria"],
  instagramHandle: "studioags",
  responseTime: "Respondemos en el día.",
  exchangePolicy: "Te mandamos una muestra antes de imprimir.",
  pricesUpdatedAt: { year: 2026, month: 7, day: 14 },
};

const completeCatalog: CatalogProduct[] = products.map((product) => ({
  ...product,
  leadTime: businessValue(product.leadTime),
}));

interface BuildCase {
  env: Record<string, string>;
  mode?: string;
  // Sin datos propios usa vite.config.ts tal cual, con src/business.ts y src/catalog.ts reales.
  business?: BusinessInfo;
  catalog?: readonly CatalogProduct[];
}

let workDir = "";
let savedEnv: Record<string, string | undefined> = {};

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "studioags-build-"));
  savedEnv = Object.fromEntries(isolatedEnvKeys.map((key) => [key, process.env[key]]));
  for (const key of isolatedEnvKeys) {
    delete process.env[key];
  }
});

afterEach(async () => {
  for (const key of isolatedEnvKeys) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  await rm(workDir, { recursive: true, force: true });
});

// Vite escribe las comillas simples de los atributos como entidades; el navegador las decodifica.
function decodeAttribute(value: string): string {
  return value.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function outDir(): string {
  return join(workDir, "dist");
}

async function runBuild({ env, mode, business, catalog }: BuildCase): Promise<{ html: string; warnings: string[] }> {
  const envDir = join(workDir, "env");
  await mkdir(envDir);
  const envFile = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  await writeFile(join(envDir, ".env"), `${envFile.join("\n")}\n`);

  const warnings: string[] = [];
  const silent = createLogger("silent");
  const logger: Logger = {
    ...silent,
    warn: (message) => warnings.push(message),
    warnOnce: (message) => warnings.push(message),
  };

  const config: InlineConfig = {
    root,
    configFile: business || catalog ? false : configFile,
    plugins: business || catalog ? studioAgs({ business, catalog }) : [],
    mode,
    envDir,
    cacheDir: join(workDir, "cache"),
    publicDir: false,
    customLogger: logger,
    build: { outDir: outDir(), emptyOutDir: true },
  };
  await build(config);

  const html = await readFile(join(outDir(), "index.html"), "utf8");
  return { html, warnings };
}

describe("build", { timeout: 60_000 }, () => {
  it("falla sin VITE_WHATSAPP_NUMBER y nombra la variable", async () => {
    await expect(runBuild({ env: { VITE_SITE_URL: "https://studioags.com.ar" } })).rejects.toThrow(
      /Falta VITE_WHATSAPP_NUMBER/,
    );
    expect(existsSync(join(outDir(), "index.html"))).toBe(false);
  });

  it("falla con un número inválido", async () => {
    await expect(
      runBuild({
        env: { VITE_WHATSAPP_NUMBER: "+54 9 11 2345-6789", VITE_SITE_URL: "https://studioags.com.ar" },
        business: completeBusiness,
      }),
    ).rejects.toThrow(/VITE_WHATSAPP_NUMBER \("\+54 9 11 2345-6789"\) no es válido/);
  });

  it("falla sin VITE_SITE_URL", async () => {
    const result = runBuild({
      env: { VITE_WHATSAPP_NUMBER: "5491123456789" },
      business: completeBusiness,
    });
    await expect(result).rejects.toThrow(/Falta VITE_SITE_URL/);
    await expect(result).rejects.not.toThrow(/VITE_WHATSAPP_NUMBER/);
  });

  it("falla con una URL http://", async () => {
    await expect(
      runBuild({
        env: { VITE_WHATSAPP_NUMBER: "5491123456789", VITE_SITE_URL: "http://studioags.com.ar" },
        business: completeBusiness,
      }),
    ).rejects.toThrow(/VITE_SITE_URL \("http:\/\/studioags\.com\.ar"\) no es válido/);
  });

  it("falla si quedan datos de ejemplo en el negocio y los nombra", async () => {
    await expect(
      runBuild({
        env: { VITE_WHATSAPP_NUMBER: "5491123456789", VITE_SITE_URL: "https://studioags.com.ar" },
        business: { ...completeBusiness, shipping: example("Envíos a coordinar.") },
      }),
    ).rejects.toThrow(/src\/business\.ts todavía tiene datos de ejemplo: shipping\./);
  });

  it("falla si quedan plazos de ejemplo en el catálogo y los nombra", async () => {
    const catalog = completeCatalog.map((product) =>
      product.id === "tarjetas"
        ? { ...product, leadTime: example(businessValue(product.leadTime)) }
        : product,
    );
    const result = runBuild({
      env: { VITE_WHATSAPP_NUMBER: "5491123456789", VITE_SITE_URL: "https://studioags.com.ar" },
      business: completeBusiness,
      catalog,
    });
    await expect(result).rejects.toThrow(
      /src\/catalog\.ts todavía tiene datos de ejemplo: tarjetas\.leadTime\./,
    );
    await expect(result).rejects.not.toThrow(/src\/business\.ts todavía/);
  });

  it("en modo prueba arma sin número, avisa y agrega noindex", async () => {
    const { html, warnings } = await runBuild({ env: {}, mode: "prueba" });

    expect(warnings.join("\n")).toMatch(/Falta VITE_WHATSAPP_NUMBER/);
    expect(warnings.join("\n")).toContain("http://localhost:4173");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain('<meta property="og:url" content="http://localhost:4173/">');
    expect(html).toContain('<div id="app" data-prerendered>');
  });

  it("con todos los datos arma la página con la CSP antes del primer <link>", async () => {
    const { html, warnings } = await runBuild({
      env: { VITE_WHATSAPP_NUMBER: "5491123456789", VITE_SITE_URL: "https://studioags.com.ar" },
      business: completeBusiness,
      catalog: completeCatalog,
    });

    const cspTag = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
    expect(cspTag).not.toBeNull();
    expect(decodeAttribute(cspTag![1])).toBe(CSP);
    expect(html).toMatch(/<head>\s*<meta http-equiv="Content-Security-Policy"/);
    expect(cspTag!.index).toBeLessThan(html.indexOf("<link"));
    expect(html).not.toContain("noindex");
    expect(warnings).toEqual([]);
  });

  it("deja el catálogo dentro de #app, con metadatos de URL absoluta y la CSP", async () => {
    const { html } = await runBuild({
      env: { VITE_WHATSAPP_NUMBER: "5491123456789", VITE_SITE_URL: "https://studioags.com.ar" },
      business: completeBusiness,
      catalog: completeCatalog,
    });

    expect(html).toContain('<html lang="es-AR">');
    expect(html.match(/<div id="app"/g)).toHaveLength(1);
    const appStart = html.indexOf('<div id="app" data-prerendered>');
    expect(appStart).toBeGreaterThan(-1);
    const app = html.slice(appStart, html.indexOf("</body>"));
    expect(app.match(/<article class="product-card"/g)).toHaveLength(8);
    for (const product of completeCatalog) {
      expect(app).toContain(`<h3 id="producto-${product.id}-titulo">${product.name}</h3>`);
    }
    expect(app).toContain("Precios actualizados al 14 de julio de 2026");

    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain('<link rel="canonical" href="https://studioags.com.ar/">');
    expect(head).toContain('<meta property="og:url" content="https://studioags.com.ar/">');
    expect(head).toContain('<meta property="og:image" content="https://studioags.com.ar/images/compartir.jpg">');
    expect(head).toContain('<meta name="twitter:image" content="https://studioags.com.ar/images/compartir.jpg">');
    expect(head).toContain('<link rel="icon" href="favicon.svg" type="image/svg+xml"');
    expect(head).toMatch(/<meta http-equiv="Content-Security-Policy" content="[^"]+">/);

    const ld = /<script type="application\/ld\+json">([^<]*)<\/script>/.exec(head);
    expect(ld).not.toBeNull();
    const data = JSON.parse(ld![1]) as { "@graph": Array<{ "@type": string; numberOfItems?: number }> };
    expect(data["@graph"].find((node) => node["@type"] === "ItemList")?.numberOfItems).toBe(8);
  });
});
