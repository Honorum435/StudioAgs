// Vienen del entorno (.env o el hosting); el build estricto ya comprobó que sean válidos.
export const WHATSAPP_NUMBER: string = import.meta.env.VITE_WHATSAPP_NUMBER ?? "";
