// Sin imports: lo usan vite.config.ts y el cliente.

const WHATSAPP_NUMBER_PATTERN = /^[1-9][0-9]{7,14}$/;
// "AGS-" y cuatro caracteres del alfabeto de whatsapp.ts (sin 0, O, 1 ni I).
export const ORDER_CODE_PATTERN = /^AGS-[A-HJ-NP-Z2-9]{4}$/;

export function isValidWhatsAppNumber(value: string | undefined): boolean {
  return typeof value === "string" && WHATSAPP_NUMBER_PATTERN.test(value);
}

// Devuelve la dirección https:// sin barra final (puede tener ruta, como en GitHub Pages) o null.
export function normalizeSiteUrl(value: string | undefined): string | null {
  if (typeof value !== "string" || !value.startsWith("https://") || /\s/.test(value)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hasExtras =
    url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "" || /[?#]/.test(value);
  if (url.protocol !== "https:" || url.hostname === "" || hasExtras) {
    return null;
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
