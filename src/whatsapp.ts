import { IDEA_MAX_LENGTH, type OrderSummary, type ResolvedLine } from "./cart";
import { lineName } from "./catalog";
import { capText, formatCalendarDate, formatPrice, parseIsoDate } from "./format";
import { isValidWhatsAppNumber } from "./validation";

// Módulo puro: código de pedido, mensaje y link de Click to Chat.

export const ORDER_CODE_PREFIX = "AGS-";
// Sin 0, O, 1 ni I, que se confunden al dictarlos o copiarlos.
export const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ORDER_CODE_LENGTH = 4;
// Largo de link a partir del cual algunos navegadores y la app recortan el texto.
export const WHATSAPP_URL_LIMIT = 2000;

export interface WhatsAppLink {
  url: string;
  tooLong: boolean;
}

export function createOrderCode(random: () => number = Math.random): string {
  let code = ORDER_CODE_PREFIX;
  for (let index = 0; index < ORDER_CODE_LENGTH; index += 1) {
    const position = Math.floor(random() * ORDER_CODE_ALPHABET.length);
    code += ORDER_CODE_ALPHABET[Math.min(ORDER_CODE_ALPHABET.length - 1, Math.max(0, position))];
  }
  return code;
}

// Reemplaza los pares sustitutos sueltos, que harían fallar encodeURIComponent.
function toWellFormed(text: string): string {
  let result = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += text[index] + text[index + 1];
        index += 1;
        continue;
      }
      result += "�";
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      result += "�";
    } else {
      result += text[index];
    }
  }
  return result;
}

const formattingLookalikes: Record<string, string> = {
  "*": "＊",
  _: "＿",
  "~": "～",
  "`": "｀",
};

// WhatsApp convierte *texto*, _texto_, ~texto~ y `texto` en formato: en lo que escribe la clienta
// se cambian por signos parecidos que no dan formato.
export function neutralizeFormatting(text: string): string {
  return text.replace(/[*_~`]/g, (character) => formattingLookalikes[character]);
}

function customerLine(text: string): string {
  return neutralizeFormatting(toWellFormed(text).replace(/\s+/g, " ").trim());
}

function customerParagraph(text: string, max: number): string {
  const normalized = toWellFormed(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n\s*/g, "\n")
    .trim();
  return neutralizeFormatting(capText(normalized, max).trim());
}

function lineText(line: ResolvedLine): string[] {
  const { product, combination, quantity } = line;
  const price =
    quantity > 1
      ? `${formatPrice(combination.price)} c/u = ${formatPrice(line.baseTotal)}`
      : formatPrice(combination.price);
  return [
    `- ${quantity} x ${lineName(product, combination)}, ${combination.unit}: ${price}`,
    ...line.addOns.map((addOn) => `  + ${addOn.label}, ${addOn.unit}: ${formatPrice(addOn.price)}`),
  ];
}

export function buildOrderMessage(summary: OrderSummary): string {
  const { form } = summary;
  const blocks: string[][] = [];

  const header = ["¡Hola, StudioAGS! Quiero hacer este pedido."];
  if (summary.code) {
    header.push(`Código de pedido: ${summary.code}`);
  }
  blocks.push(header);

  blocks.push(summary.lines.flatMap(lineText));
  blocks.push([`Subtotal estimado: ${formatPrice(summary.subtotal)}`]);

  const delivery: string[] = [];
  const name = customerLine(form.name);
  if (name) {
    delivery.push(`Nombre: ${name}`);
  }
  if (form.delivery === "retiro") {
    delivery.push("Entrega: retiro");
  } else if (form.delivery === "envio") {
    const locality = customerLine(form.locality);
    delivery.push(locality ? `Entrega: envío a ${locality}` : "Entrega: envío");
  }
  const date = parseIsoDate(form.date.trim());
  if (date) {
    delivery.push(`Lo necesito para el ${formatCalendarDate(date)}`);
  }
  blocks.push(delivery);

  const ideas = summary.ideas.flatMap(({ product, text }) => {
    const idea = customerParagraph(text, IDEA_MAX_LENGTH);
    return idea ? [`- ${product.name}: ${idea.replace(/\n/g, "\n  ")}`] : [];
  });
  if (ideas.length > 0) {
    blocks.push(["Ideas:", ...ideas]);
  }

  const closing: string[] = [];
  if (summary.photoProducts.length > 0) {
    closing.push("Les mando las fotos por este chat, como documento para que no pierdan calidad.");
  }
  closing.push("¿Me confirman disponibilidad y el total final? ¡Gracias!");
  blocks.push(closing);

  return blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join("\n"))
    .join("\n\n");
}

// Sin número válido no hay link: el panel ofrece solo copiar el pedido.
export function buildWhatsAppLink(number: string | undefined, message: string): WhatsAppLink | null {
  if (!isValidWhatsAppNumber(number)) {
    return null;
  }
  const url = `https://wa.me/${number}?text=${encodeURIComponent(toWellFormed(message))}`;
  return { url, tooLong: url.length > WHATSAPP_URL_LIMIT };
}
