# Pendientes de StudioAGS

Lo que queda después del pulido (`plan-pulido.md`). Nada de esto bloquea probar la tienda; lo de "Antes de publicar" sí bloquea `npm run build`.

## Pedidos de Aixa (chat del 30/10/2026)

Lo que pidió después de ver el sitio con el kit de marca.

**Estructura:**
- **Inicio y catálogo separados:** una página de inicio y una pestaña aparte para el catálogo.
- **Destacar la personalización:** que "Lo personalizamos con tu nombre, tu logo o tus fotos" resalte más. Hecho: la franja rosa y el bloque "¿Tenés una idea?".
- **Ficha por producto:** al tocar un producto se abre su página, con galería, descripción, opciones y precio, como en Mupe. Hecho: cada producto tiene su página en `producto/<id>/`. Falta que Aixa:
  - mire las fotos elegidas: 4 de calendarios, 1 de la pizarra negra y 1 de bitácoras, con solo las tapas propias;
  - mande textos más largos para cada producto (van en `details`).
- **Foto por opción:** que la foto cambie al elegir una opción.
- **Sobre nosotros:** una foto de Aixa con el negro y una biografía. Faltan la foto y el texto.
- **Contacto:** una pestaña con el mail (elstudioags@gmail.com), el Instagram (@__studioags) y los WhatsApp de Aixa y del negro. Los números están en el chat; confirmar cuáles se publican.
- **Pedidos personalizados:** un bloque "¿Tenés una idea? Contanos qué imaginaste y armamos algo personalizado" con un botón.

**Diseño:**
- **Fondo:** le falta color. Proponen franjas que alternen blanco y color, con rosa, como en Mupe.
- **Colores:** que se usen todos los de la marca.
- **Botones:** el destello al tocarlos va en rosa. Hoy es amarillo.
- **Bristol:** usarla solo en mayúsculas, porque en minúscula no se entiende.
- **Identidad:** la carita es el signo de la marca, como la flor con la "m" de Mupe.
- **Filtros:** cambiar "Para tu marca" por "Para tu emprendimiento".

**Productos para sumar (cada uno por separado, para que haya más):**
- Minijuegos, que vienen con dos fibrones.
- Archivo bajonero, que viene con un alfajor.
- Imanes y marcos con imán.
- Calendario mini de imán, calendarios imantados (vienen con fibrones) y calendarios de acrílico.
- Notas con imán, que se puedan comprar sin un calendario.
- Separadores.
- Cuadros, con las medidas de las láminas (SA3, A3, A4, A5 y A6) o a medida. Faltan precios y medidas.
- Agendas, como "próximamente".
- DTF textil para remeras o cualquier tela.
- Vinilo de corte para vidrieras y stickers.

Algunas descripciones ya están en su tienda de beacons.ai/studioags.

**Archivos que mandó:**
- **Diseños en CorelDRAW (.cdr):** Identidad, Calendario imán mini, Calendario libreta (no está terminado), Calendario imán H y V mes, Calendario H semanal y Notas imán V. Ya están en Descargas. Traen vistas previas chicas (unos 256 px), que sirven para ver el diseño y sacar los colores pero no para la web. Para la web hay que pedirlos exportados a SVG o PNG con fondo transparente.
- **Colores de los calendarios:** 12 capturas con las combinaciones de color de los calendarios (cada una con los 12 meses). Sirven para la foto por opción.
- **Fotos de productos:** un álbum de Google Fotos (`studio ags-1-001.zip`); ver la tabla de abajo.
- **Inspiración:** mupecuadernos.com.ar (gift cards y "Cuaderno emprendedor") y una conversación con ChatGPT sobre cómo mejorar la página (ver abajo).

### Ideas de la conversación con ChatGPT

Revisó la página de antes de los cambios del 30/10: varias cosas ya están hechas (páginas por producto, fotos reales, colores de la marca, bloque de pedidos personalizados) o ya estaban (precio que cambia con las opciones, contador del pedido, formulario y resumen antes de abrir WhatsApp). Lo nuevo que vale la pena:

- **Categorías por tipo de producto** en lugar de los filtros por uso: Stickers y papelería, Fotos y recuerdos, Organización, Para tu emprendimiento, Decoración, y Juegos y regalos. Lo decide Aixa.
- **Destacados o más vendidos** arriba del catálogo. Aixa tendría que decir cuáles son.
- **Así preparamos tu pedido:** fotos del sello, el papel kraft y los moños. Hecho, en el inicio después de "Cómo comprar". Falta que Aixa confirme los textos, sobre todo "Si es un regalo, lo cerramos con moño".
- **Opiniones de clientes:** solo con opiniones reales que mande Aixa.
- **Precio "desde"** en las tarjetas, para que se note que cambia con las opciones. Hecho: "Desde $ X, según la opción" en las tarjetas y en cada página, solo cuando el precio cambia.
- **Foto en las líneas del pedido** y un **botón de WhatsApp** siempre visible (este necesita el número).
- **Instagram:** algunas fotos fijas que lleven al perfil. Un feed en vivo necesita código de Instagram, que la CSP no deja cargar.
- **Fecha de precios:** la del 14 de julio de 2026 es de ejemplo; Aixa tiene que confirmarla.

Lo que no conviene seguir: la paleta "lila, violeta, celeste" y la "tipografía gruesa y redondeada", que no son las de la hoja de identidad.

### Fotos del álbum (`studio ags-1-001.zip`, en Descargas)

Son 345 fotos (casi todas HEIC de iPhone) y 138 videos. Para la web hay que pasarlas a JPG; con ffmpeg funciona. Las que sirven, por producto:

| Producto | Fotos |
|---|---|
| Minijuegos | IMG_0052, IMG_0149 a 0152, IMG_1136 a 1148 (en la playa), IMG_1258 (laberinto), IMG_0728 a 0736 (jugando) |
| Calendario de heladera (rosa) | IMG_7966 a 7988, IMG_7287 a 7290 |
| Calendario mensual grande | IMG_5603 a 5613 (verde y gris), IMG_6058, 6067, 6070 (rosa) |
| Colores de los calendarios | IMG_3781, 3782, 5936, 5942 a 5945 (abanicos con todos los colores: sirven para la foto por opción) |
| Calendario semanal | IMG_6386 a 6395 (rojo, con fibrones) |
| Calendario de acrílico | IMG_0706, 0707 |
| Calendario mini de imán | IMG_1946 a 1948 |
| Notas con imán | IMG_9484 a 9489 (lila), IMG_1027, 1028 (verde, en la heladera) |
| Marcos y separadores con imán | IMG_0700, 0701, IMG_9314 (cartel con precios de la feria) |
| Pizarra con fotos | IMG_7688 a 7712, IMG_1269, IMG_1732 (pizarra negra) |
| Bitácoras y cuadernos A5 | IMG_8570 a 8574, IMG_9315, 9317 |
| Stickers | IMG_0198, 0199 (fotos), IMG_0702 a 0705 (en un termo), IMG_1858 a 1860 (logo studio ags) |
| Remeras (DTF textil) | IMG_1768 a 1770, IMG_7225 a 7227 |
| Vinilo de corte | IMG_1668 a 1680 (vidriera de La Verdu) |
| Tarjetas personales | IMG_1741 |
| Packaging y armado | IMG_5875 a 5911 (sello de la carita), IMG_5914 a 5941 (kraft), IMG_7009 a 7043 (regalos con moño y bolsas) |
| Feria y taller (para "Sobre nosotros") | IMG_0204 a 0206, IMG_9323 a 9325, IMG_5599 a 5602, IMG_7341 a 7374 |

Antes de publicar, preguntar:
- **Marcas de clientes:** si se pueden mostrar las de La Verdu, Framar, Gabi, G&P y las otras que aparecen en stickers y vinilos.
- **Personajes y logos ajenos:** las planchas de stickers con personajes, futbolistas o logos de otras marcas (IMG_9158 a 9160, IMG_9468 a 9472) es mejor no usarlas.
- **Personas:** si las que aparecen con la cara están de acuerdo.

El logo en negro de `34c632e3-…jpg` (1280 px) es más nítido que el del kit: sirve para rehacer la máscara del logo mientras llega el SVG.

## Colores y tipografía (vista previa en la rama `vista-marca`)

Las quejas de la primera revisión fueron sobre todo los colores y la tipografía. La dueña mandó su kit de marca, que no está en el repo:
- el logo "studio ags" en 8 colores;
- tres personajes dibujados con trazo de crayón sobre fondos plenos;
- un patrón con el logo repetido.

Colores de la marca, confirmados con la hoja de `Identidad.cdr`. La web usa estos mismos, salvo el azul del texto chico, que va más oscuro (`#2A5F99`) para que se lea:

| Color | Código | Como texto chico sobre fondo claro |
|---|---|---|
| Amarillo | `#FBD727` | No: solo fondo o ilustración |
| Azul | `#3D77BC` | Sí, justo (unos 4,5:1) |
| Rosa | `#ECA2C8` | No: solo fondo o ilustración |
| Verde | `#2EAA54` | Solo títulos grandes (unos 3:1) |
| Naranja | `#E94E26` | Solo títulos grandes (unos 3,8:1) |
| Gris oscuro | `#363B39` | Sí |
| Negro | `#1E231F` | Sí |
| Crema | `#FBF9F2` | Es fondo |

En la hoja, el amarillo figura como `#FFD812`, pero sus valores RGB (251, 215, 39) dan `#FBD727`, que es el que se ve en los diseños: la web usa ese. Conviene preguntarle a Aixa cuál vale.

Los calendarios suman pasteles: celeste `#ABD7DF`, naranja claro `#F9A65E`, arena `#EEE096`, verde claro `#B5D780` y lila `#CDA3CB`.

**Un color por sección:**

| Sección | Color |
|---|---|
| Encabezado, inicio y catálogo | Crema |
| Franja de arriba | Rosa |
| "¿Tenés una idea?" | Azul |
| "Antes de pedir" | Verde claro |
| "Cómo comprar" | Amarillo |
| "Así preparamos tu pedido" | Naranja claro |
| Pie | Negro, con el logo en amarillo |

El verde y el naranja van en su versión pastel porque, en la versión plena, la letra chica no se lee. Sobre los pasteles, las volantas y los textos grises pasan a tinta. El encabezado queda fijo arriba al bajar y se achica un poco. Falta que Aixa diga si le gusta la combinación.

La hoja de identidad pide Hemis para títulos y acentos, y **Tablet Gothic Narrow** para subtítulos y textos. Aixa después eligió Creato para el texto. Si quieren Tablet Gothic Narrow, es una fuente paga: hacen falta los archivos y la licencia para web.

Tipografías que mandó la dueña: Creato Display para el texto, y Hemis o Bristol para los títulos. El "ags" del logo está dibujado a mano, no es una fuente.

Qué prueba la rama `vista-marca`:
- **Paleta del kit:**
  - azul para acentos y texto de color;
  - amarillo en las franjas;
  - rosa y verde en los stickers;
  - naranja en los detalles.
- **Logo y personajes:** el logo real en el encabezado y el pie, y los personajes en "Cómo comprar".
- **Fuentes:** Creato en el texto, Hemis en los títulos y Bristol en los acentos (las palabras en azul de los títulos y los números de los pasos). Bristol no va en textos con "i" porque se confunde con dos puntos. Las dos se cambian con `--display` y `--display-accent` en `src/styles.css`.
- **Fuentes propias:** se sirven desde el sitio, ya no desde Google Fonts. La CSP pasó a `font-src 'self'`.

Falta antes de pasarla a `main`:
- **Decisiones de la dueña:** que confirme la mezcla de Hemis y Bristol, o elija una sola, y los colores.
- **Licencias:** confirmar que Hemis y Bristol se pueden usar en una web. Creato tiene licencia OFL.
- **Peso de las fuentes:** pasarlas de OTF a WOFF2. Hoy Creato y Hemis pesan unos 320 KB.
- **Archivos originales:** pedir el logo y los personajes en SVG o PNG con fondo transparente. Los de la rama salen de los JPEG del kit.
- **Favicon e imagen para compartir:** siguen con el estilo anterior.
- **Signos que le faltan a Hemis:** no tiene ¿ ¡ « ni ·. Si un título los usa, esos signos salen en la fuente de respaldo.
- **Nombres de los tokens:** quedaron los viejos, por ejemplo `--coral-dark` ahora es azul. Renombrarlos si se adopta.

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
- Un precio por combinación en los datos estructurados (hoy van mínimo y máximo).
- Medir de dónde llegan los pedidos (por ejemplo `?ref=ig`).
