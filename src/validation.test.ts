import { describe, expect, it } from "vitest";
import { isValidWhatsAppNumber, normalizeSiteUrl } from "./validation";

describe("isValidWhatsAppNumber", () => {
  it("acepta un número internacional de 13 dígitos", () => {
    expect(isValidWhatsAppNumber("5491123456789")).toBe(true);
  });

  it("acepta los extremos de 8 y 15 dígitos", () => {
    expect(isValidWhatsAppNumber("12345678")).toBe(true);
    expect(isValidWhatsAppNumber("123456789012345")).toBe(true);
  });

  it.each([
    ["vacío", ""],
    ["sin definir", undefined],
    ["con +", "+5491123456789"],
    ["con espacios", "549 11 2345 6789"],
    ["con guiones", "549-11-2345-6789"],
    ["con menos de 8 dígitos", "1234567"],
    ["con más de 15 dígitos", "1234567890123456"],
    ["con 0 adelante", "01123456789"],
    ["con letras", "54911abc56789"],
    ["con un salto de línea al final", "5491123456789\n"],
  ])("rechaza un número %s", (_case, value) => {
    expect(isValidWhatsAppNumber(value)).toBe(false);
  });
});

describe("normalizeSiteUrl", () => {
  it("acepta un origen https", () => {
    expect(normalizeSiteUrl("https://studioags.com.ar")).toBe("https://studioags.com.ar");
  });

  it("acepta la barra final y devuelve el origen sin ella", () => {
    expect(normalizeSiteUrl("https://studioags.com.ar/")).toBe("https://studioags.com.ar");
  });

  it("conserva el puerto", () => {
    expect(normalizeSiteUrl("https://localhost:4173")).toBe("https://localhost:4173");
  });

  it("acepta una carpeta, como en GitHub Pages, sin la barra final", () => {
    expect(normalizeSiteUrl("https://honorum435.github.io/StudioAgs/")).toBe("https://honorum435.github.io/StudioAgs");
  });

  it.each([
    ["vacía", ""],
    ["sin definir", undefined],
    ["sin esquema", "studioags.com.ar"],
    ["con http", "http://studioags.com.ar"],
    ["con consulta", "https://studioags.com.ar?ref=ig"],
    ["con ancla", "https://studioags.com.ar#catalogo"],
    ["con usuario", "https://dueña@studioags.com.ar"],
    ["con espacios", " https://studioags.com.ar"],
    ["sin barras", "https:studioags.com.ar"],
  ])("rechaza una URL %s", (_case, value) => {
    expect(normalizeSiteUrl(value)).toBeNull();
  });
});
