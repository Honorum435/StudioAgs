import { afterEach, describe, expect, it, vi } from "vitest";
import { example, type CalendarDate } from "./business";
import {
  DRAFT_LIFETIME,
  IDEA_MAX_LENGTH,
  MAX_QUANTITY,
  SENT_LIFETIME,
  STORAGE_KEY,
  STORAGE_VERSION,
  createOrderStore,
  noticeMessage,
  type OrderStoreOptions,
  type StorageLike,
} from "./cart";
import { products, type CatalogProduct } from "./catalog";
import { addBusinessDays, parseIsoDate, toIsoDate } from "./format";
import { createMemoryStorage } from "./test-utils";
import { ORDER_CODE_PATTERN } from "./validation";
import { createOrderCode } from "./whatsapp";

const HOUR = 60 * 60 * 1000;
const PRICES_DATE: CalendarDate = { year: 2026, month: 7, day: 14 };
const CODES = ["AGS-K7QX", "AGS-M3RT", "AGS-P9WZ", "AGS-H2DC"];

const tarjetas200 = { cantidad: "200", faz: "doble-faz", terminacion: "laminado" };
const tarjetas100 = { cantidad: "100", faz: "simple-faz", terminacion: "sin-laminar" };
const vinilosBlanco = { material: "blanco", laca: "sin-laca" };

// Fotos: de 1 a 3 días hábiles; Tarjetas: plazo pendiente, de ejemplo hasta 5.
const leadTimeCatalog: readonly CatalogProduct[] = products.map((item) =>
  item.id === "fotos"
    ? { ...item, leadTime: { min: 1, max: 3, text: "De 1 a 3 días hábiles" } }
    : item.id === "tarjetas"
      ? { ...item, leadTime: example({ min: 3, max: 5, text: "De 3 a 5 días hábiles" }) }
      : item,
);

function product(id: string): CatalogProduct {
  const found = products.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No existe el producto ${id}`);
  }
  return found;
}

// Reloj, almacenamiento y códigos controlados; open() crea un almacén nuevo sobre el mismo
// almacenamiento, como una recarga de la página.
function harness(overrides: Partial<OrderStoreOptions> = {}) {
  const env = {
    // Miércoles 14/10/2026, 10:00 hora local.
    now: new Date(2026, 9, 14, 10, 0),
    storage: createMemoryStorage() as StorageLike,
    issued: [] as string[],
  };
  const open = (more: Partial<OrderStoreOptions> = {}) =>
    createOrderStore({
      storage: env.storage,
      now: () => env.now,
      pricesUpdatedAt: PRICES_DATE,
      createCode: () => {
        const code = CODES[env.issued.length % CODES.length];
        env.issued.push(code);
        return code;
      },
      ...overrides,
      ...more,
    });
  const later = (milliseconds: number) => {
    env.now = new Date(env.now.getTime() + milliseconds);
  };
  return { env, open, later };
}

function confirmedStore() {
  const setup = harness();
  const store = setup.open();
  store.add("tarjetas", tarjetas200);
  store.add("fotos", { formato: "polaroid" }, [], 3);
  store.updateForm({ name: "Ana", delivery: "retiro" });
  store.confirm();
  return { ...setup, store };
}

function stored(storage: StorageLike): Record<string, unknown> {
  return JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
}

describe("líneas del pedido", () => {
  it("sumar dos veces la misma combinación sin adicionales da una línea con cantidad 2", () => {
    const store = harness().open();
    const first = store.add("tarjetas", tarjetas200);
    const second = store.add("tarjetas", tarjetas200);

    expect(first).toBe("tarjetas-200-doble-faz-laminado");
    expect(second).toBe(first);
    expect(store.getState().lines).toEqual([
      {
        id: "tarjetas-200-doble-faz-laminado",
        productId: "tarjetas",
        combinationId: "tarjetas-200-doble-faz-laminado",
        quantity: 2,
        addOnIds: [],
      },
    ]);
  });

  it("combinaciones distintas dan líneas distintas, en el orden en que se sumaron", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.add("tarjetas", tarjetas100);
    store.add("entre-flores", {});

    expect(store.getState().lines.map((line) => line.id)).toEqual([
      "tarjetas-200-doble-faz-laminado",
      "tarjetas-100-simple-faz-sin-laminar",
      "entre-flores",
    ]);
  });

  it("calcula el subtotal con el precio de cada combinación (AE1: Tarjetas 200 · doble faz · laminado)", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.add("fotos", { formato: "polaroid" }, [], 3);

    const summary = store.getSummary();
    expect(summary.lines[0].total).toBe(26300);
    expect(summary.lines[1].total).toBe(2400);
    expect(summary.subtotal).toBe(28700);
    expect(summary.quantity).toBe(4);
  });

  it("no suma nada con un producto, una opción o un adicional que no existen", () => {
    const store = harness().open();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.add("no-existe", {})).toBeNull();
    expect(store.add("tarjetas", { ...tarjetas200, cantidad: "150" })).toBeNull();
    expect(store.add("tarjetas", { cantidad: "200" })).toBeNull();
    expect(store.add("vinilos", vinilosBlanco, ["calendarios-notas-con-iman"])).toBeNull();
    expect(store.getState().lines).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("decrementar en 1 no cambia nada", () => {
    const store = harness().open();
    const id = store.add("tarjetas", tarjetas200)!;
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.decrement(id)).toBe(false);
    expect(store.getState().lines[0].quantity).toBe(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("incrementa y decrementa de a uno, sin pasar de 99", () => {
    const store = harness().open();
    const id = store.add("tarjetas", tarjetas200)!;

    expect(store.increment(id)).toBe(true);
    expect(store.increment(id)).toBe(true);
    expect(store.decrement(id)).toBe(true);
    expect(store.getState().lines[0].quantity).toBe(2);

    store.setQuantity(id, MAX_QUANTITY);
    expect(store.increment(id)).toBe(false);
    expect(store.getState().lines[0].quantity).toBe(99);
  });

  it("quitar la línea la elimina", () => {
    const store = harness().open();
    const id = store.add("tarjetas", tarjetas200)!;
    store.add("entre-flores", {});

    expect(store.removeLine(id)).toBe(true);
    expect(store.getState().lines.map((line) => line.id)).toEqual(["entre-flores"]);
    expect(store.removeLine(id)).toBe(false);
  });

  it("fijar 0 o 120 queda en 1 o 99", () => {
    const store = harness().open();
    const id = store.add("tarjetas", tarjetas200, [], 5)!;

    store.setQuantity(id, 0);
    expect(store.getState().lines[0].quantity).toBe(1);
    store.setQuantity(id, 120);
    expect(store.getState().lines[0].quantity).toBe(99);
    store.setQuantity(id, -3);
    expect(store.getState().lines[0].quantity).toBe(1);
  });

  it("fijar una cantidad con decimales la trunca y un valor que no es número no cambia nada", () => {
    const store = harness().open();
    const id = store.add("tarjetas", tarjetas200, [], 5)!;

    store.setQuantity(id, 3.7);
    expect(store.getState().lines[0].quantity).toBe(3);
    expect(store.setQuantity(id, Number.NaN)).toBe(false);
    expect(store.getState().lines[0].quantity).toBe(3);
  });

  it("sumar con cantidad respeta el tope de 99", () => {
    const store = harness().open();
    store.add("fotos", { formato: "polaroid" }, [], 98);
    store.add("fotos", { formato: "polaroid" }, [], 5);
    store.add("tarjetas", tarjetas200, [], 0);

    expect(store.getState().lines.map((line) => line.quantity)).toEqual([99, 1]);
  });

  it("quitar un producto borra también sus adicionales", () => {
    const store = harness().open();
    const id = store.add("vinilos", vinilosBlanco, ["vinilos-maqueta", "vinilos-corte-individual"])!;

    expect(store.getSummary().lines[0].addOns.map((addOn) => addOn.id)).toEqual([
      "vinilos-maqueta",
      "vinilos-corte-individual",
    ]);
    store.removeLine(id);
    expect(store.getState().lines).toEqual([]);
    expect(store.getSummary().subtotal).toBe(0);
  });

  it("quitar un adicional deja el producto", () => {
    const store = harness().open();
    const id = store.add("vinilos", vinilosBlanco, ["vinilos-maqueta", "vinilos-corte-individual"])!;

    expect(store.removeAddon(id, "vinilos-maqueta")).toBe(true);
    const [line] = store.getSummary().lines;
    expect(line.id).toBe(id);
    expect(line.addOns.map((addOn) => addOn.id)).toEqual(["vinilos-corte-individual"]);
    expect(line.total).toBe(14500 + 2500);
    expect(store.removeAddon(id, "vinilos-maqueta")).toBe(false);
  });

  it("los adicionales van una vez por línea, con cantidad fija, aunque se vuelva a sumar", () => {
    const store = harness().open();
    store.add("vinilos", vinilosBlanco, ["vinilos-maqueta"]);
    store.add("vinilos", vinilosBlanco, ["vinilos-corte-individual", "vinilos-maqueta"]);

    const [line] = store.getSummary().lines;
    expect(line.quantity).toBe(2);
    expect(line.addOns.map((addOn) => addOn.id)).toEqual(["vinilos-maqueta", "vinilos-corte-individual"]);
    expect(line.total).toBe(2 * 14500 + 2500 + 2500);
  });

  it("avisa a cada suscriptor con el estado nuevo y deja de avisar al desuscribirse", () => {
    const store = harness().open();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.add("tarjetas", tarjetas200);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(store.getState());

    unsubscribe();
    store.add("tarjetas", tarjetas200);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("formulario y validación", () => {
  it("AE4: sin nombre, confirmar falla señalando el nombre y no asigna código", () => {
    const { open, env } = harness();
    const store = open();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ delivery: "retiro" });

    const result = store.confirm();
    expect(result.valid).toBe(false);
    expect(result.code).toBeNull();
    expect(result.errors.map((issue) => [issue.field, issue.code])).toEqual([["name", "required"]]);
    expect(result.errors[0].message).toBe("Escribí tu nombre.");
    expect(store.getState().status).toBe("borrador");
    expect(store.getState().code).toBeNull();
    expect(env.issued).toEqual([]);
  });

  it("AE4: sin entrega, confirmar falla señalando la entrega", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana" });

    const result = store.confirm();
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.field)).toEqual(["delivery"]);
    expect(store.getState().code).toBeNull();
  });

  it("señala todos los campos que faltan en el orden del formulario", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "   " });

    expect(store.validate().errors.map((issue) => issue.field)).toEqual(["name", "delivery"]);
  });

  it("con envío y sin localidad también falla; con localidad pasa", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "envio", locality: "  " });

    const result = store.confirm();
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => [issue.field, issue.message])).toEqual([
      ["locality", "Escribí la localidad para el envío."],
    ]);
    expect(store.getState().code).toBeNull();

    store.updateForm({ locality: "Rosario" });
    expect(store.confirm().valid).toBe(true);
  });

  it("con retiro la localidad no hace falta", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "retiro" });

    expect(store.validate()).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it("un pedido vacío no se puede confirmar", () => {
    const store = harness().open();
    store.updateForm({ name: "Ana", delivery: "retiro" });

    const result = store.confirm();
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.field)).toEqual(["lines"]);
  });

  it("ignora una forma de entrega desconocida", () => {
    const store = harness().open();
    expect(store.updateForm({ delivery: "moto" as never })).toBe(false);
    expect(store.getState().form.delivery).toBeNull();
  });

  it("AE3: un pedido solo con Láminas no pide ninguna idea", () => {
    const store = harness().open();
    store.add("laminas", { tamano: "a4" });
    store.add("laminas", { tamano: "a3" });

    expect(store.getSummary().ideas).toEqual([]);
    expect(store.setIdea("laminas", "Algo")).toBe(false);
    expect(store.getState().form.ideas).toEqual({});
  });

  it("pide una idea por producto personalizable, aunque tenga varias líneas", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.add("laminas", { tamano: "a4" });
    store.add("tarjetas", tarjetas100);
    store.add("fotos", { formato: "polaroid" });

    expect(store.getSummary().ideas.map((idea) => idea.product.id)).toEqual(["tarjetas", "fotos"]);
    expect(store.getSummary().photoProducts.map((item) => item.id)).toEqual(["fotos"]);
  });

  it("una idea de 800 caracteres queda en 500", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);

    expect(store.setIdea("tarjetas", "a".repeat(800))).toBe(true);
    expect(store.getState().form.ideas.tarjetas).toHaveLength(IDEA_MAX_LENGTH);
    expect(store.getSummary().ideas[0].text).toBe("a".repeat(500));
  });

  it("al recortar una idea no parte un emoji", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.setIdea("tarjetas", `${"a".repeat(499)}🌼 y más`);

    expect(store.getState().form.ideas.tarjetas).toBe("a".repeat(499));
  });

  it("no guarda ideas de productos que no están en el pedido y borra la idea al quitar el producto", () => {
    const store = harness().open();
    const id = store.add("tarjetas", tarjetas200)!;

    expect(store.setIdea("fotos", "Fotos de la boda")).toBe(false);
    store.setIdea("tarjetas", "Logo en verde");
    expect(store.getState().form.ideas).toEqual({ tarjetas: "Logo en verde" });

    store.removeLine(id);
    expect(store.getState().form.ideas).toEqual({});
  });

  describe("con el reloj en hora local de Buenos Aires", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("el 28 a las 23:30 hoy es el 28 y una fecha del 27 es inválida", () => {
      vi.stubEnv("TZ", "America/Argentina/Buenos_Aires");
      const now = new Date(2026, 9, 28, 23, 30);
      // En UTC ya es el 29: si "hoy" se calculara en UTC, el 28 quedaría en el pasado.
      expect(now.toISOString().startsWith("2026-10-29")).toBe(true);

      const store = harness({ now: () => now }).open();
      store.add("tarjetas", tarjetas200);
      store.updateForm({ name: "Ana", delivery: "retiro", date: "2026-10-27" });

      expect(store.today()).toEqual({ year: 2026, month: 10, day: 28 });
      expect(store.validate().errors.map((issue) => [issue.field, issue.code])).toEqual([["date", "past"]]);

      store.updateForm({ date: "2026-10-28" });
      const result = store.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  it("una fecha anterior al plazo más largo del pedido produce solo un aviso", () => {
    // Un plazo pendiente cuenta con su valor de ejemplo.
    const store = harness({ catalog: leadTimeCatalog }).open();
    store.add("fotos", { formato: "polaroid" });
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "retiro", date: "2026-10-16" });

    expect(store.earliestDate()).toEqual({ year: 2026, month: 10, day: 21 });
    const result = store.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((issue) => [issue.field, issue.code])).toEqual([["date", "beforeLeadTime"]]);
    expect(result.warnings[0].message).toContain("5 días hábiles");
    expect(store.confirm().code).not.toBeNull();
  });

  it("desde el plazo más largo en adelante no hay aviso", () => {
    const store = harness({ catalog: leadTimeCatalog }).open();
    store.add("fotos", { formato: "polaroid" });
    store.updateForm({ name: "Ana", delivery: "retiro", date: "2026-10-19" });

    expect(store.earliestDate()).toEqual({ year: 2026, month: 10, day: 19 });
    expect(store.validate().warnings).toEqual([]);
  });

  it("una fecha que no existe es inválida y sin fecha no hay error", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "retiro", date: "2026-02-30" });
    expect(store.validate().errors.map((issue) => [issue.field, issue.code])).toEqual([["date", "invalid"]]);

    store.updateForm({ date: "" });
    expect(store.validate().valid).toBe(true);
  });
});

describe("fechas", () => {
  it("cuenta días hábiles salteando el fin de semana", () => {
    const friday = { year: 2026, month: 10, day: 16 };
    expect(addBusinessDays(friday, 1)).toEqual({ year: 2026, month: 10, day: 19 });
    expect(addBusinessDays(friday, 0)).toEqual(friday);
    expect(addBusinessDays({ year: 2026, month: 12, day: 30 }, 3)).toEqual({ year: 2027, month: 1, day: 4 });
  });

  it("lee y escribe AAAA-MM-DD sin pasar por Date", () => {
    expect(parseIsoDate("2026-10-28")).toEqual({ year: 2026, month: 10, day: 28 });
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("28/10/2026")).toBeNull();
    expect(toIsoDate({ year: 2026, month: 3, day: 5 })).toBe("2026-03-05");
  });
});

describe("estados del pedido", () => {
  it("confirmar asigna un código AGS- con cuatro caracteres del alfabeto permitido", () => {
    const store = harness({ createCode: () => createOrderCode() }).open();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "retiro" });

    const result = store.confirm();
    expect(result.valid).toBe(true);
    expect(result.code).toMatch(ORDER_CODE_PATTERN);
    expect(store.getState()).toMatchObject({ status: "confirmado", code: result.code });
  });

  it("cambiar una cantidad vuelve a borrador sin código y marca que el pedido cambió", () => {
    const { store } = confirmedStore();
    expect(store.getState().code).toBe("AGS-K7QX");

    store.increment("fotos-polaroid");
    expect(store.getState()).toMatchObject({ status: "borrador", code: null, changedSinceConfirm: true });
  });

  it("cambiar el nombre vuelve a borrador sin código", () => {
    const { store } = confirmedStore();
    store.updateForm({ name: "Ana María" });
    expect(store.getState()).toMatchObject({ status: "borrador", code: null, changedSinceConfirm: true });
  });

  it("sumar un producto, quitar un adicional o cambiar una idea también vuelve a borrador", () => {
    const { store } = confirmedStore();
    store.add("entre-flores", {});
    expect(store.getState().status).toBe("borrador");

    store.confirm();
    store.setIdea("tarjetas", "Logo");
    expect(store.getState().status).toBe("borrador");
  });

  it("un cambio que no cambia nada deja el pedido confirmado", () => {
    const { store } = confirmedStore();
    expect(store.updateForm({ name: "Ana", delivery: "retiro" })).toBe(false);
    expect(store.decrement("tarjetas-200-doble-faz-laminado")).toBe(false);
    expect(store.getState()).toMatchObject({ status: "confirmado", code: "AGS-K7QX" });
  });

  it("volver a confirmar después de un cambio genera otro código", () => {
    const { store } = confirmedStore();
    store.updateForm({ name: "Ana María" });

    const result = store.confirm();
    expect(result.code).toBe("AGS-M3RT");
    expect(store.getState()).toMatchObject({ status: "confirmado", code: "AGS-M3RT", changedSinceConfirm: false });
  });

  it("sin confirmar no se puede marcar como enviado", () => {
    const store = harness().open();
    store.add("tarjetas", tarjetas200);
    expect(store.markSent("whatsapp")).toBe(false);
    expect(store.getState().status).toBe("borrador");
  });

  it("abrir WhatsApp o copiar pasa a enviado y reenviar sin cambios conserva el código", () => {
    const { store, later, env } = confirmedStore();

    expect(store.markSent("whatsapp")).toBe(true);
    expect(store.getState()).toMatchObject({ status: "enviado", code: "AGS-K7QX", sentVia: "whatsapp" });

    later(HOUR);
    expect(store.markSent("copy")).toBe(true);
    expect(store.confirm().code).toBe("AGS-K7QX");
    expect(store.getState()).toMatchObject({
      status: "enviado",
      code: "AGS-K7QX",
      sentVia: "copy",
      sentAt: env.now.getTime(),
    });
    expect(env.issued).toEqual(["AGS-K7QX"]);
  });

  it("un cambio después de enviar vuelve a borrador sin código", () => {
    const { store } = confirmedStore();
    store.markSent("whatsapp");
    store.updateForm({ delivery: "envio", locality: "Rosario" });

    expect(store.getState()).toMatchObject({
      status: "borrador",
      code: null,
      sentVia: null,
      sentAt: null,
      changedSinceConfirm: true,
    });
  });

  it("quitar el último producto deja el pedido vacío, sin código ni aviso de cambio", () => {
    const { store } = confirmedStore();
    store.removeLine("tarjetas-200-doble-faz-laminado");
    store.removeLine("fotos-polaroid");

    expect(store.getState()).toMatchObject({
      lines: [],
      status: "borrador",
      code: null,
      changedSinceConfirm: false,
    });
  });

  it("ya lo envié · vaciar deja el pedido vacío y borra lo guardado", () => {
    const { store, env } = confirmedStore();
    store.setIdea("fotos", "Fotos del viaje");
    store.confirm();
    store.markSent("whatsapp");
    const listener = vi.fn();
    store.subscribe(listener);

    store.clear();
    expect(store.getState()).toEqual({
      lines: [],
      form: { name: "", delivery: null, locality: "", date: "", ideas: {} },
      status: "borrador",
      code: null,
      sentVia: null,
      sentAt: null,
      changedSinceConfirm: false,
      notices: [],
    });
    expect(env.storage.getItem(STORAGE_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("persistencia", () => {
  it("AE2: guardar y restaurar devuelve las mismas líneas, cantidades, formulario y estado", () => {
    const { store, open } = confirmedStore();
    store.setIdea("fotos", "Fotos del viaje a Bariloche");
    store.updateForm({ date: "2026-10-30" });
    store.confirm();

    const restored = open();
    expect(restored.getState()).toEqual(store.getState());
    expect(restored.getState()).toMatchObject({ status: "confirmado", code: "AGS-M3RT" });
    expect(restored.getState().lines.map((line) => [line.id, line.quantity])).toEqual([
      ["tarjetas-200-doble-faz-laminado", 1],
      ["fotos-polaroid", 3],
    ]);
  });

  it("restaura un pedido enviado con su código y cómo se envió", () => {
    const { store, open } = confirmedStore();
    store.markSent("copy");

    expect(open().getState()).toEqual(store.getState());
    expect(open().getState()).toMatchObject({ status: "enviado", sentVia: "copy", code: "AGS-K7QX" });
  });

  it("restaura los adicionales de cada línea", () => {
    const { open } = harness();
    const store = open();
    store.add("vinilos", vinilosBlanco, ["vinilos-corte-individual"]);

    expect(open().getSummary().lines[0].addOns.map((addOn) => addOn.id)).toEqual(["vinilos-corte-individual"]);
  });

  it("guarda con versión y fecha de precios", () => {
    const { store, env } = confirmedStore();
    const data = stored(env.storage);

    expect(data.version).toBe(STORAGE_VERSION);
    expect(data.pricesUpdatedAt).toEqual(PRICES_DATE);
    expect(data.savedAt).toBe(env.now.getTime());
    expect(store.getState().status).toBe("confirmado");
  });

  it("con el reloj a 31 días, restaurar un borrador devuelve un pedido vacío", () => {
    const { open, later, env } = harness();
    open().add("tarjetas", tarjetas200);

    later(31 * 24 * HOUR);
    expect(open().getState().lines).toEqual([]);
    expect(env.storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("a los 29 días el borrador sigue y restaurar no renueva el vencimiento", () => {
    const { open, later } = harness();
    open().add("tarjetas", tarjetas200);

    later(29 * 24 * HOUR);
    expect(open().getState().lines).toHaveLength(1);
    later(2 * 24 * HOUR);
    expect(open().getState().lines).toEqual([]);
  });

  it("un pedido confirmado también vence a los 30 días", () => {
    const { open, later } = confirmedStore();
    later(DRAFT_LIFETIME + 1);
    expect(open().getState().lines).toEqual([]);
  });

  it("con el reloj a 49 horas de enviado, restaurar devuelve un pedido vacío", () => {
    const { store, open, later, env } = confirmedStore();
    store.markSent("whatsapp");

    later(49 * HOUR);
    expect(open().getState().lines).toEqual([]);
    expect(env.storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("a las 47 horas de enviado el pedido sigue", () => {
    const { store, open, later } = confirmedStore();
    store.markSent("whatsapp");

    later(SENT_LIFETIME - HOUR);
    expect(open().getState()).toMatchObject({ status: "enviado", code: "AGS-K7QX" });
  });

  it("una versión distinta devuelve un pedido vacío y descarta lo guardado", () => {
    const { store, open, env } = confirmedStore();
    expect(store.getState().lines).toHaveLength(2);
    env.storage.setItem(STORAGE_KEY, JSON.stringify({ ...stored(env.storage), version: STORAGE_VERSION + 1 }));

    expect(open().getState().lines).toEqual([]);
    expect(env.storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    ["un JSON corrupto", "{lineas: ["],
    ["un valor que no es un objeto", "[1, 2]"],
    ["una cantidad que no es un número", JSON.stringify({ version: STORAGE_VERSION, lines: [{ quantity: "2" }] })],
  ])("%s devuelve un pedido vacío sin romper", (_case, raw) => {
    const { open, env } = harness();
    env.storage.setItem(STORAGE_KEY, raw);

    expect(() => open()).not.toThrow();
    expect(open().getState().lines).toEqual([]);
  });

  it("un pedido guardado con una cantidad fuera de rango se descarta", () => {
    const { open, env } = confirmedStore();
    const data = stored(env.storage) as { lines: { quantity: number }[] };
    data.lines[0].quantity = 500;
    env.storage.setItem(STORAGE_KEY, JSON.stringify(data));

    expect(open().getState().lines).toEqual([]);
  });

  it("un almacenamiento que lanza error devuelve un pedido vacío y el pedido sigue en memoria", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    const store = harness({ storage: broken }).open();

    expect(store.getState().lines).toEqual([]);
    expect(() => store.add("tarjetas", tarjetas200)).not.toThrow();
    expect(store.getState().lines).toHaveLength(1);
    expect(() => store.clear()).not.toThrow();
  });

  it("sin almacenamiento el pedido vive solo en memoria", () => {
    const store = harness({ storage: null }).open();
    store.add("tarjetas", tarjetas200);
    expect(store.getState().lines).toHaveLength(1);
  });

  it("restaurar con una combinación que ya no existe la descarta, informa cuál y vuelve a borrador sin código", () => {
    const tarjetas = product("tarjetas");
    const retired = {
      ...tarjetas.combinations[0],
      id: "tarjetas-150-simple-faz-sin-laminar",
      values: { cantidad: "150", faz: "simple-faz", terminacion: "sin-laminar" },
      label: "150 · Simple faz · Sin laminar",
    };
    const oldCatalog = products.map((item) =>
      item.id === "tarjetas"
        ? {
            ...item,
            groups: item.groups.map((group) =>
              group.id === "cantidad" ? { ...group, options: [...group.options, { id: "150", label: "150" }] } : group,
            ),
            combinations: [...item.combinations, retired],
          }
        : item,
    );
    const { open } = harness();
    const before = open({ catalog: oldCatalog });
    before.add("tarjetas", retired.values);
    before.add("fotos", { formato: "polaroid" }, [], 2);
    before.updateForm({ name: "Ana", delivery: "retiro" });
    before.confirm();
    before.markSent("whatsapp");

    const after = open();
    expect(after.getState()).toMatchObject({ status: "borrador", code: null, sentVia: null, sentAt: null });
    expect(after.getState().lines.map((line) => [line.id, line.quantity])).toEqual([["fotos-polaroid", 2]]);
    expect(after.getState().notices).toEqual([
      {
        kind: "dropped",
        items: [{ kind: "line", product: "Tarjetas personales", label: "150 · Simple faz · Sin laminar" }],
      },
    ]);
    expect(noticeMessage(after.getState().notices[0])).toBe(
      "Sacamos lo que ya no está en el catálogo: Tarjetas personales (150 · Simple faz · Sin laminar).",
    );
  });

  it("restaurar con un adicional que ya no existe lo descarta y deja el producto", () => {
    const oldCatalog = products.map((item) =>
      item.id === "vinilos"
        ? { ...item, addOns: [...item.addOns, { id: "vinilos-troquel", label: "Troquel", price: 3000, unit: "por pliego" }] }
        : item,
    );
    const { open } = harness();
    open({ catalog: oldCatalog }).add("vinilos", vinilosBlanco, ["vinilos-maqueta", "vinilos-troquel"]);

    const after = open();
    expect(after.getState().lines[0].addOnIds).toEqual(["vinilos-maqueta"]);
    expect(after.getState().notices).toEqual([
      { kind: "dropped", items: [{ kind: "addOn", product: "Vinilos impresos", label: "Troquel" }] },
    ]);
    expect(noticeMessage(after.getState().notices[0])).toContain("Troquel de Vinilos impresos");
  });

  it("restaurar un pedido confirmado con otra fecha de precios avisa y lo vuelve a borrador", () => {
    const { open } = confirmedStore();
    const current = { year: 2026, month: 11, day: 1 };

    const after = open({ pricesUpdatedAt: current });
    expect(after.getState()).toMatchObject({ status: "borrador", code: null });
    expect(after.getState().lines).toHaveLength(2);
    expect(after.getState().notices).toEqual([{ kind: "prices", previous: PRICES_DATE, current }]);
    expect(noticeMessage(after.getState().notices[0])).toBe(
      "Actualizamos los precios al 1/11/2026: revisá el subtotal.",
    );
  });

  it("con la misma fecha de precios y todo disponible no hay avisos", () => {
    const { open } = confirmedStore();
    expect(open().getState().notices).toEqual([]);
  });

  it("los avisos de restauración siguen pendientes al recargar hasta tocar Entendido", () => {
    const { open } = confirmedStore();
    const current = { year: 2026, month: 11, day: 1 };
    open({ pricesUpdatedAt: current });

    const reloaded = open({ pricesUpdatedAt: current });
    expect(reloaded.getState().notices).toHaveLength(1);

    const listener = vi.fn();
    reloaded.subscribe(listener);
    reloaded.acknowledgeNotices();
    expect(reloaded.getState().notices).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(open({ pricesUpdatedAt: current }).getState().notices).toEqual([]);
  });

  it("si todo lo guardado se descartó, el pedido queda vacío pero conserva el aviso", () => {
    const oldCatalog = [
      ...products,
      {
        ...product("laminas"),
        id: "stickers",
        name: "Stickers",
        combinations: [{ ...product("laminas").combinations[0], id: "stickers-a3-plus" }],
      },
    ];
    const { open } = harness();
    const before = open({ catalog: oldCatalog });
    expect(before.add("stickers", { tamano: "a3-plus" })).toBe("stickers-a3-plus");

    const after = open();
    expect(after.getState().lines).toEqual([]);
    expect(after.getState().notices).toHaveLength(1);
  });

  it("restaura las ideas y el formulario de entrega", () => {
    const { open } = harness();
    const store = open();
    store.add("tarjetas", tarjetas200);
    store.updateForm({ name: "Ana", delivery: "envio", locality: "Rosario", date: "2026-11-02" });
    store.setIdea("tarjetas", "Logo en verde");

    expect(open().getState().form).toEqual({
      name: "Ana",
      delivery: "envio",
      locality: "Rosario",
      date: "2026-11-02",
      ideas: { tarjetas: "Logo en verde" },
    });
  });

  it("un pedido sin productos ni datos no deja nada guardado", () => {
    const { open, env } = harness();
    const store = open();
    const id = store.add("tarjetas", tarjetas200)!;
    expect(env.storage.getItem(STORAGE_KEY)).not.toBeNull();

    store.removeLine(id);
    expect(env.storage.getItem(STORAGE_KEY)).toBeNull();
  });
});
