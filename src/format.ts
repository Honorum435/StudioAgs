import type { CalendarDate } from "./business";

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character]);
}

// Armado a mano y no con Intl: tiene que dar el mismo texto en Node (build) y en cualquier navegador.
export function formatPrice(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}$ ${digits}`;
}

const monthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// "14 de julio de 2026", también sin Intl.
export function formatLongDate({ year, month, day }: CalendarDate): string {
  return `${day} de ${monthNames[month - 1]} de ${year}`;
}

// Fechas: siempre año, mes y día literales en hora local; nunca se parsea "AAAA-MM-DD" con Date.

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const { year, month, day } = value as Record<string, unknown>;
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    (year as number) >= 1000 &&
    (year as number) <= 9999 &&
    (month as number) >= 1 &&
    (month as number) <= 12 &&
    (day as number) >= 1 &&
    (day as number) <= daysInMonth(year as number, month as number)
  );
}

export function calendarDateOf(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isCalendarDate(date) ? date : null;
}

export function toIsoDate({ year, month, day }: CalendarDate): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatCalendarDate({ year, month, day }: CalendarDate): string {
  return `${day}/${month}/${year}`;
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return (a.year - b.year) * 10000 + (a.month - b.month) * 100 + (a.day - b.day);
}

// Días hábiles: de lunes a viernes, sin feriados.
export function addBusinessDays(date: CalendarDate, days: number): CalendarDate {
  const cursor = new Date(Date.UTC(date.year, date.month - 1, date.day));
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
    }
  }
  return { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
}

// Recorta sin partir un emoji (par sustituto) al final.
export function capText(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const last = text.charCodeAt(max - 1);
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? max - 1 : max);
}
