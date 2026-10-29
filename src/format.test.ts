import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, formatPrice } from "./format";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatPrice", () => {
  it("separa los miles con punto y pone un espacio duro después de $", () => {
    expect(formatPrice(26300)).toBe("$ 26.300");
    expect(formatPrice(1000000)).toBe("$ 1.000.000");
  });

  it("no agrega separador por debajo de mil", () => {
    expect(formatPrice(800)).toBe("$ 800");
    expect(formatPrice(0)).toBe("$ 0");
  });

  it("redondea a pesos enteros, sin decimales", () => {
    expect(formatPrice(2499.6)).toBe("$ 2.500");
  });

  it("no depende de Intl ni de la configuración regional", () => {
    vi.spyOn(Intl, "NumberFormat").mockImplementation(() => {
      throw new Error("Intl no disponible");
    });
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(() => {
      throw new Error("toLocaleString no disponible");
    });
    expect(formatPrice(99000)).toBe("$ 99.000");
  });
});

describe("escapeHtml", () => {
  it("neutraliza <, >, &, comillas dobles y simples", () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;",
    );
  });

  it("deja igual el texto sin caracteres especiales", () => {
    expect(escapeHtml("Láminas A3+ · 7.000")).toBe("Láminas A3+ · 7.000");
  });
});
