# Pendientes de StudioAGS

Lo que queda después del pulido (`plan-pulido.md`). Nada de esto bloquea probar la tienda; lo de "Antes de publicar" sí bloquea `npm run build`.

## Antes de publicar (los responde la dueña)

- Número de WhatsApp y URL del sitio en `.env` (ver `.env.example`).
- Datos del negocio en `src/business.ts`: zona de retiro, envíos, medios de pago, Instagram, tiempo de respuesta, política de cambios y fecha de precios. Al confirmar cada uno, sacarle el `example(...)`.
- Plazos de producción en `src/catalog.ts` para Calendarios, Pizarra OrMa, Entre Flores, Tarjetas, Bitácoras y Láminas (marcados con `pendingLeadTime()`).
- Qué productos son personalizables y en qué intención va cada uno (hoy hay un reparto por defecto).
- Extras de Tarjetas que aparecen en el PDF (puntas redondeadas, agujereado) y la cantidad de fotos que trae la Pizarra OrMa.
- Permiso para usar en la web la foto de Vinilos con los stickers y QR de un cliente (el script tiene una alternativa anotada).
- Fotos reales de Vinilos, Entre Flores, Fotos y Láminas: las del PDF no llegan a verse nítidas en pantallas de alta densidad.

## Verificar en dispositivos reales

- Navegador de Instagram en iOS y Android, sobre una vista previa HTTPS: copiar el pedido, abrir WhatsApp y que el pedido guardado sobreviva al cerrar y volver a abrir el link.
- Un pedido real a un número de prueba.
- Vista previa del link en WhatsApp e Instagram con un validador de Open Graph.
- Lighthouse en celular sobre la salida de `npm run build`.
- En iOS, después de confirmar, tocar + o – en el panel: el foco podría saltar a "Continuar".

## Pendientes conocidos de la revisión de código (aceptados)

| Prioridad | Archivo | Hallazgo |
|---|---|---|
| P2 | `src/cart.ts` | El estado del pedido son cinco campos sueltos (`status`, `code`, `sentVia`, `sentAt`, `changedSinceConfirm`); conviene un tipo por estado para que las combinaciones imposibles no compilen. |
| P2 | `src/cart-view.ts`, `src/catalog-view.ts` | Los elementos que crea la plantilla se buscan como opcionales; si alguno falta, la vista falla en silencio. Conviene un `required(root, selector)` que avise. |
| P2 | `src/styles.css` | Unas 2.600 líneas en un solo archivo; dividir por secciones (catálogo, diálogos, movimiento) y que la guardia de contraste lea todos. |
| P2 | `src/cart.ts` | La validación del pedido guardado vive dentro del almacén y termina en un doble cast; moverla a un módulo puro con un type guard. |

## Ideas para después

- Mercado Pago o pago online.
- Fichas con link propio por producto.
- Un precio por combinación en los datos estructurados (hoy van mínimo y máximo).
- Medir de dónde llegan los pedidos (por ejemplo `?ref=ig`).
- Alojar las fuentes en el propio sitio.
