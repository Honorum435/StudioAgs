import { describe, expect, it } from "vitest";
import { createOrderStore, type OrderSummary } from "./cart";
import { formatPrice } from "./format";
import { ORDER_CODE_PATTERN } from "./validation";
import {
  ORDER_CODE_ALPHABET,
  WHATSAPP_URL_LIMIT,
  buildOrderMessage,
  buildWhatsAppLink,
  createOrderCode,
  neutralizeFormatting,
} from "./whatsapp";

const NUMBER = "5491123456789";
const tarjetas200 = { cantidad: "200", faz: "doble-faz", terminacion: "laminado" };

function newStore() {
  return createOrderStore({
    storage: null,
    now: () => new Date(2026, 9, 14, 10, 0),
    pricesUpdatedAt: { year: 2026, month: 7, day: 14 },
    createCode: () => "AGS-K7QX",
  });
}

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("createOrderCode", () => {
  it("arma AGS- y cuatro caracteres del alfabeto permitido", () => {
    expect(createOrderCode(sequence([0, 0.25, 0.5, 0.75]))).toBe("AGS-AJS2");
    expect(createOrderCode(() => 0)).toBe("AGS-AAAA");
    expect(createOrderCode(() => 0.9999)).toBe("AGS-9999");
  });

  it("el alfabeto no tiene 0, O, 1 ni I y no repite caracteres", () => {
    expect(ORDER_CODE_ALPHABET).not.toMatch(/[0O1I]/);
    expect(new Set(ORDER_CODE_ALPHABET).size).toBe(ORDER_CODE_ALPHABET.length);
    expect(ORDER_CODE_ALPHABET).toHaveLength(32);
  });

  it("con el azar real siempre da un código válido", () => {
    for (let index = 0; index < 500; index += 1) {
      expect(createOrderCode()).toMatch(ORDER_CODE_PATTERN);
    }
  });

  it("un azar fuera de rango no produce caracteres inválidos", () => {
    expect(createOrderCode(() => 1)).toBe("AGS-9999");
    expect(createOrderCode(() => -0.5)).toBe("AGS-AAAA");
  });
});

describe("buildOrderMessage", () => {
  it("arma el mensaje completo en el orden acordado", () => {
    const store = newStore();
    store.add("tarjetas", tarjetas200, [], 2);
    store.add("vinilos", { material: "blanco", laca: "sin-laca" }, ["vinilos-maqueta"]);
    store.add("fotos", { formato: "polaroid" }, [], 3);
    store.updateForm({ name: "  Ana  López ", delivery: "envio", locality: "Rosario", date: "2026-10-30" });
    store.setIdea("tarjetas", "Logo en verde\n\n\n\ncon letras blancas");
    store.setIdea("fotos", "Fotos del viaje");
    store.confirm();

    expect(buildOrderMessage(store.getSummary())).toBe(
      [
        "¡Hola, StudioAGS! Quiero hacer este pedido.",
        "Código de pedido: AGS-K7QX",
        "",
        `- 2 x Tarjetas personales (200 · Doble faz · Laminado mate o brillo), pack de 200: ${formatPrice(26300)} c/u = ${formatPrice(52600)}`,
        `- 1 x Vinilos impresos (Blanco · Sin laca), por pliego: ${formatPrice(14500)}`,
        `  + Maqueta, cada 5 diseños: ${formatPrice(2500)}`,
        `- 3 x Fotos para guardar (Polaroid 8 × 6,5), por unidad: ${formatPrice(800)} c/u = ${formatPrice(2400)}`,
        "",
        `Subtotal estimado: ${formatPrice(52600 + 14500 + 2500 + 2400)}`,
        "",
        "Nombre: Ana López",
        "Entrega: envío a Rosario",
        "Lo necesito para el 30/10/2026",
        "",
        "Ideas:",
        "- Tarjetas personales: Logo en verde",
        "  con letras blancas",
        "- Fotos para guardar: Fotos del viaje",
        "",
        "Les mando las fotos por este chat, como documento para que no pierdan calidad.",
        "¿Me confirman disponibilidad y el total final? ¡Gracias!",
      ].join("\n"),
    );
  });

  it("pone código, líneas, adicionales, subtotal, entrega e ideas en ese orden", () => {
    const store = newStore();
    store.add("vinilos", { material: "blanco", laca: "sin-laca" }, ["vinilos-corte-individual"]);
    store.updateForm({ name: "Ana", delivery: "retiro" });
    store.setIdea("vinilos", "Stickers para mi marca");
    store.confirm();
    const message = buildOrderMessage(store.getSummary());

    const positions = [
      "AGS-K7QX",
      "Vinilos impresos (Blanco · Sin laca)",
      "+ Corte individual",
      "Subtotal estimado",
      "Entrega: retiro",
      "Stickers para mi marca",
    ].map((part) => message.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("los precios del mensaje salen de formatPrice, sin depender de Intl", () => {
    const store = newStore();
    store.add("tarjetas", { cantidad: "1000", faz: "doble-faz", terminacion: "laminado" });
    expect(buildOrderMessage(store.getSummary())).toContain("pack de 1.000: $ 99.000");
  });

  it("AE3: un pedido solo con Láminas no lleva ideas ni aviso de fotos", () => {
    const store = newStore();
    store.add("laminas", { tamano: "a4" });
    store.updateForm({ name: "Ana", delivery: "retiro" });
    const message = buildOrderMessage(store.getSummary());

    expect(message).not.toContain("Ideas:");
    expect(message).not.toContain("fotos");
    expect(message.endsWith("¿Me confirman disponibilidad y el total final? ¡Gracias!")).toBe(true);
  });

  it("sin código, sin fecha y sin ideas escritas omite esas partes", () => {
    const store = newStore();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "retiro" });
    const message = buildOrderMessage(store.getSummary());

    expect(message).not.toContain("Código de pedido");
    expect(message).not.toContain("Lo necesito");
    expect(message).not.toContain("Ideas:");
  });

  it("una idea con *negrita*, _cursiva_ y ~tachado~ llega neutralizada", () => {
    const store = newStore();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "*Ana*", delivery: "envio", locality: "_Villa_ ~Crespo~" });
    store.setIdea("tarjetas", "*negrita* y _cursiva_ con ~tachado~ y `código`");
    const message = buildOrderMessage(store.getSummary());

    expect(message).not.toMatch(/[*_~`]/);
    expect(message).toContain("Nombre: ＊Ana＊");
    expect(message).toContain("Entrega: envío a ＿Villa＿ ～Crespo～");
    expect(message).toContain("＊negrita＊ y ＿cursiva＿ con ～tachado～ y ｀código｀");
  });

  it("una idea de 800 caracteres queda en 500", () => {
    const store = newStore();
    store.add("tarjetas", tarjetas200);
    const summary = store.getSummary();
    const longIdea: OrderSummary = { ...summary, ideas: [{ product: summary.ideas[0].product, text: "b".repeat(800) }] };

    const ideaLine = buildOrderMessage(longIdea)
      .split("\n")
      .find((line) => line.startsWith("- Tarjetas personales: "))!;
    expect(ideaLine.slice("- Tarjetas personales: ".length)).toBe("b".repeat(500));
  });

  it("un texto con un par sustituto suelto no rompe el mensaje ni el link", () => {
    const store = newStore();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana \ud83c", delivery: "retiro" });
    const message = buildOrderMessage(store.getSummary());

    expect(message).toContain("Nombre: Ana �");
    expect(() => buildWhatsAppLink(NUMBER, "texto \udc00 suelto")).not.toThrow();
  });
});

describe("neutralizeFormatting", () => {
  it("cambia solo los signos de formato de WhatsApp", () => {
    expect(neutralizeFormatting("Hola *Ana* _y_ ~Juan~, 50% off!")).toBe("Hola ＊Ana＊ ＿y＿ ～Juan～, 50% off!");
  });
});

describe("buildWhatsAppLink", () => {
  it("arma el link de wa.me con el mensaje codificado", () => {
    const message = "¡Hola! Pedido AGS-K7QX\n- 1 x Tarjetas & más #1";
    const link = buildWhatsAppLink(NUMBER, message);

    expect(link).not.toBeNull();
    expect(link!.url.startsWith(`https://wa.me/${NUMBER}?text=`)).toBe(true);
    expect(decodeURIComponent(link!.url.split("?text=")[1])).toBe(message);
    expect(link!.url).not.toMatch(/[\s#&]/);
    expect(link!.tooLong).toBe(false);
  });

  it.each([
    ["vacío", ""],
    ["sin definir", undefined],
    ["con +", "+5491123456789"],
    ["con espacios", "549 11 2345 6789"],
    ["con letras", "54911abc56789"],
  ])("con un número %s no arma link", (_case, number) => {
    expect(buildWhatsAppLink(number, "Hola")).toBeNull();
  });

  it("un pedido muy largo marca que el link supera el largo recomendado", () => {
    const store = newStore();
    store.add("calendarios", { formato: "acrilico" }, ["calendarios-notas-con-iman"]);
    store.add("fotos", { formato: "tira" }, [], 5);
    store.add("pizarra-orma", { color: "negro-mate" });
    store.add("bitacoras", { formato: "bitacora-a5" }, [], 2);
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "envio", locality: "San Carlos de Bariloche" });
    for (const idea of store.getSummary().ideas) {
      store.setIdea(idea.product.id, "Quiero algo con flores y colores pastel. ".repeat(12));
    }
    store.confirm();

    const link = buildWhatsAppLink(NUMBER, buildOrderMessage(store.getSummary()))!;
    expect(link.url.length).toBeGreaterThan(WHATSAPP_URL_LIMIT);
    expect(link.tooLong).toBe(true);
  });

  it("un pedido corto no marca el largo", () => {
    const store = newStore();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "retiro" });
    store.confirm();

    const link = buildWhatsAppLink(NUMBER, buildOrderMessage(store.getSummary()))!;
    expect(link.url.length).toBeLessThan(WHATSAPP_URL_LIMIT);
    expect(link.tooLong).toBe(false);
  });
});
