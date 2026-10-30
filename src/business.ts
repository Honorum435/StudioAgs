// Datos del negocio. Lo que todavía no confirmó la dueña va envuelto en `example(...)`:
// el build estricto no publica mientras quede alguno. Para confirmar un dato, sacá el `example(...)`.

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface ExampleValue<T> {
  readonly pending: true;
  readonly value: T;
}

export type BusinessField<T> = T | ExampleValue<T>;

export interface BusinessInfo {
  pickupArea: BusinessField<string>;
  shipping: BusinessField<string>;
  paymentMethods: BusinessField<readonly string[]>;
  instagramHandle: BusinessField<string>;
  responseTime: BusinessField<string>;
  exchangePolicy: BusinessField<string>;
  pricesUpdatedAt: BusinessField<CalendarDate>;
}

export function example<T>(value: T): ExampleValue<T> {
  return { pending: true, value };
}

export function isExample<T>(field: BusinessField<T>): field is ExampleValue<T> {
  return (
    typeof field === "object" &&
    field !== null &&
    !Array.isArray(field) &&
    (field as Partial<ExampleValue<T>>).pending === true &&
    "value" in field
  );
}

export function businessValue<T>(field: BusinessField<T>): T {
  return isExample(field) ? field.value : field;
}

export function listPendingFields(info: BusinessInfo): (keyof BusinessInfo)[] {
  return (Object.keys(info) as (keyof BusinessInfo)[]).filter((key) => isExample(info[key]));
}

export const business: BusinessInfo = {
  pickupArea: example("Retiro sin cargo en Paraná, Entre Ríos, coordinando día y horario por WhatsApp."),
  shipping: example(
    "Envíos a todo el país por correo. El costo lo pagás vos y te lo pasamos antes de despachar.",
  ),
  paymentMethods: example(["Transferencia bancaria", "Efectivo al retirar"]),
  instagramHandle: "__studioags",
  responseTime: example("Respondemos de lunes a viernes de 10 a 18 h, casi siempre en el mismo día."),
  exchangePolicy: example(
    "Antes de imprimir te mandamos una muestra para que la apruebes. Como cada pedido es personalizado, no hacemos cambios por gusto; si llega con una falla de impresión, lo reponemos sin costo.",
  ),
  pricesUpdatedAt: example({ year: 2026, month: 7, day: 14 }),
};
