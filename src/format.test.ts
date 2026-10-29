import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, formatLongDate, formatPrice } from "./format";

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

describe("formatLongDate", () => {
  it("escribe el día, el mes en palabras y el año", () => {
    expect(formatLongDate({ year: 2026, month: 7, day: 14 })).toBe("14 de julio de 2026");
    expect(formatLongDate({ year: 2027, month: 1, day: 1 })).toBe("1 de enero de 2027");
    expect(formatLongDate({ year: 2026, month: 12, day: 31 })).toBe("31 de diciembre de 2026");
  });
});
