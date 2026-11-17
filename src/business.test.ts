import { describe, expect, it } from "vitest";
import { business, businessValue, example, listPendingFields, type BusinessInfo } from "./business";

const complete: BusinessInfo = {
  pickupArea: "Retiro en Parana, Entre Ríos.",
  shipping: "Envíos a todo el país.",
  paymentMethods: ["Transferencia bancaria"],
  instagramHandle: "studioags",
  email: "hola@studioags.com.ar",
  responseTime: "Respondemos en el día.",
  exchangePolicy: "Te mandamos una muestra antes de imprimir.",
  featuredProducts: ["calendarios", "tarjetas"],
};

describe("listPendingFields", () => {
  it("devuelve una lista vacía con los datos completos", () => {
    expect(listPendingFields(complete)).toEqual([]);
  });

  it("nombra cada campo que conserva la marca de ejemplo", () => {
    const info: BusinessInfo = {
      ...complete,
      shipping: example("Envíos a coordinar."),
      email: example("hola@ejemplo.com"),
    };
    expect(listPendingFields(info)).toEqual(["shipping", "email"]);
  });

  it("marca como pendiente una lista de ejemplo, pero no una lista confirmada", () => {
    expect(listPendingFields({ ...complete, paymentMethods: example(["Efectivo"]) })).toEqual([
      "paymentMethods",
    ]);
  });

  it("solo nombra campos que existen en los datos del negocio", () => {
    const keys = Object.keys(business);
    expect(listPendingFields(business).every((field) => keys.includes(field))).toBe(true);
  });
});

describe("businessValue", () => {
  it("devuelve el valor con o sin marca de ejemplo", () => {
    expect(businessValue(example("Retiro en Palermo"))).toBe("Retiro en Palermo");
    expect(businessValue("Retiro en Palermo")).toBe("Retiro en Palermo");
  });

  it("cada dato actual tiene un valor no vacío", () => {
    const values = Object.values(business).map((field) => businessValue(field));
    for (const value of values) {
      if (typeof value === "string" || Array.isArray(value)) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
