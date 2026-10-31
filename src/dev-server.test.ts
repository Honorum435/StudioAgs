import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, createServer, type Logger, type ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// La guardia de publicación en `npm run dev`: con datos incompletos solo avisa, no frena.

const root = fileURLToPath(new URL("..", import.meta.url));
const configFile = join(root, "vite.config.ts");
const isolatedEnvKeys = ["VITE_WHATSAPP_NUMBER", "VITE_SITE_URL", "NODE_ENV"];

let workDir = "";
let savedEnv: Record<string, string | undefined> = {};
let server: ViteDevServer | null = null;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "studioags-dev-"));
  savedEnv = Object.fromEntries(isolatedEnvKeys.map((key) => [key, process.env[key]]));
  for (const key of isolatedEnvKeys) {
    delete process.env[key];
  }
});

afterEach(async () => {
  await server?.close();
  server = null;
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

describe("servidor de desarrollo", { timeout: 60_000 }, () => {
  it("con datos incompletos arranca igual y solo avisa lo que falta", async () => {
    const envDir = join(workDir, "env");
    await mkdir(envDir);
    await writeFile(join(envDir, ".env"), "");

    const warnings: string[] = [];
    const silent = createLogger("silent");
    const logger: Logger = {
      ...silent,
      warn: (message) => warnings.push(message),
      warnOnce: (message) => warnings.push(message),
    };

    // Sin escuchar en un puerto, sin vigilar archivos ni buscar dependencias para optimizar.
    const starting = createServer({
      root,
      configFile,
      mode: "development",
      envDir,
      cacheDir: join(workDir, "cache"),
      publicDir: false,
      customLogger: logger,
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, ws: false, watch: null },
    });
    await expect(starting).resolves.toBeDefined();
    server = await starting;

    expect(server.config.mode).toBe("development");
    const log = warnings.join("\n");
    expect(log).toContain("Faltan datos para publicar la tienda");
    expect(log).toMatch(/Falta VITE_WHATSAPP_NUMBER/);
    expect(log).toMatch(/Falta VITE_SITE_URL/);
  });

  it("sirve la página de cada producto en /producto/<id>/", async () => {
    const envDir = join(workDir, "env");
    await mkdir(envDir);
    await writeFile(join(envDir, ".env"), "");
    server = await createServer({
      root,
      configFile,
      mode: "development",
      envDir,
      cacheDir: join(workDir, "cache"),
      publicDir: false,
      customLogger: createLogger("silent"),
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, ws: false, watch: null },
    });
    const http: Server = createHttpServer(server.middlewares);
    await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
    const { port } = http.address() as AddressInfo;
    try {
      const page = await fetch(`http://127.0.0.1:${port}/producto/calendarios/`);
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain('<base href="../../">');
      expect(html).toContain('<h1 id="producto-detalle-titulo">Calendarios</h1>');
      expect(html).toContain("<title>Calendarios — StudioAGS</title>");

      const withoutSlash = await fetch(`http://127.0.0.1:${port}/producto/calendarios`, { redirect: "manual" });
      expect(withoutSlash.status).toBe(301);
      expect(withoutSlash.headers.get("location")).toBe("/producto/calendarios/");
    } finally {
      await new Promise((done) => http.close(done));
    }
  });
});
