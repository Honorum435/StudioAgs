// Sin imports: lo usan vite.config.ts y el cliente.

const WHATSAPP_NUMBER_PATTERN = /^[1-9][0-9]{7,14}$/;

export function isValidWhatsAppNumber(value: string | undefined): boolean {
  return typeof value === "string" && WHATSAPP_NUMBER_PATTERN.test(value);
}

// Devuelve el origen (https://dominio[:puerto]) o null si no es un origen https:// sin ruta.
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
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    /[?#]/.test(value);

  return url.protocol === "https:" && url.hostname !== "" && !hasExtras ? url.origin : null;
}

export function isValidSiteUrl(value: string | undefined): boolean {
  return normalizeSiteUrl(value) !== null;
}
