---
date: 2026-10-28
topic: pulido-ux-ui-studioags
---

# Pulido UX/UI de StudioAGS

## Resumen

Pulido completo de la tienda de StudioAGS manteniendo su estilo editorial actual: tipografía, contraste, responsive, estados de interacción y movimiento, seguridad y vista previa al compartir. El pedido por WhatsApp pasa a llegar completo y ordenado, la página suma un bloque de confianza y cada colección tiene "Ver ficha" con la página del catálogo ampliada. El objetivo es que la página quede lista para publicar.

---

## Problem Frame

La tienda tiene una base sólida (flujo catálogo → pedido → WhatsApp, voseo cálido, `<dialog>` nativo, reduced motion), pero "se ve sin retocar". La investigación (cinco agentes: competencia argentina, referencias internacionales, buenas prácticas de venta por WhatsApp, crítica UX/UI y auditoría de accesibilidad/SEO) coincide en que el problema no es una cosa grande sino muchas chicas sumadas:

- Las imágenes de producto son páginas enteras del catálogo PDF recortadas, con texto y número de página.
- Hay textos de 9–10 px, contrastes por debajo de AA y las itálicas de Libre Bodoni no cargan (se ven en Georgia y saltan al cargar).
- Tarjetas personales tiene un desplegable de 20 opciones y el precio no cambia al elegir.
- La personalización nunca se pide, el carrito se borra al recargar y los avisos de error quedan tapados por el panel del pedido.
- Al compartir el link no aparece vista previa y la página llega vacía sin JavaScript.
- Faltan los datos que casi todas las tiendas argentinas del rubro muestran: plazos, envíos o retiro, medios de pago, Instagram.
- El copy repite "cariño" cuatro veces, usa voz de desarrollador ("catálogo recibido") y duplica la numeración 01/02/03 en dos secciones.

La página todavía no está publicada (el número de WhatsApp está vacío). La dueña es una sola persona que recibe y cierra cada pedido por WhatsApp.

---

## Actors

- A1. Clienta o cliente: llega mayormente desde Instagram en el celular; compra para regalar o para su emprendimiento (tarjetas, vinilos).
- A2. Dueña de StudioAGS: recibe el pedido por WhatsApp, confirma disponibilidad y precio, manda la muestra antes de imprimir y mantiene el catálogo.

---

## Key Decisions

- **Se mantiene la identidad editorial actual.** Libre Bodoni + Public Sans, papel, coral, stickers del hero. Se descartó adoptar la estética pop del catálogo PDF; la consecuencia aceptada es que la web y el PDF o Instagram se van a seguir viendo distintos.
- **WhatsApp es el único cierre.** No hay pago online; Mercado Pago queda para cuando la dueña lo decida.
- **"Ver ficha" en lugar de fichas completas por producto.** Resuelve las fotos chicas mostrando la página del catálogo ampliada, sin multiplicar las páginas que hay que pulir.
- **Las fotos salen del PDF.** No hay fotos propias ni sesión nueva; se recortan las fotos reales que hay dentro de las páginas del catálogo, a partir del PDF original en alta resolución.
- **Filtros por intención en vez de por categoría.** Los 8 filtros actuales muestran una tarjeta cada uno; se reemplazan por Para regalar · Para tu marca · Para decorar · Para organizarte, más Todo.
- **Se publica solo cuando todo está pulido.** Responsive, seguridad, flujos principales, CSS e interacciones terminados son condición de salida, no mejoras posteriores.
- **Movimiento sutil y artesanal.** Pocas microinteracciones con propósito; todo hover tiene su equivalente al tocar y todo respeta "reducir movimiento".

---

## Requirements

**Identidad visual y copy**

- R1. Se conservan paleta, tipografías y personalidad actuales; las itálicas reales de Libre Bodoni cargan y el texto no cambia de forma al terminar de cargar.
- R2. Ningún texto de lectura queda por debajo de 14 px; los campos de formulario usan 16 px en celular para que iOS no haga zoom.
- R3. Todos los pares texto/fondo cumplen contraste AA (4,5:1 texto normal) y los bordes de controles y el badge del pedido llegan a 3:1.
- R4. El copy se revisa: voseo cálido y concreto, "cariño" como mucho una o dos veces, sin voz de desarrollador, sin numeraciones duplicadas y sin anglicismos ("con intención").

**Catálogo y tarjetas de producto**

- R5. Cada colección muestra como imagen principal una foto real recortada del catálogo, nítida en pantallas de alta densidad, nunca la página entera.
- R6. Cada tarjeta tiene "Ver ficha", que abre la página completa del catálogo ampliable; se navega con teclado y se cierra con Escape o tocando afuera.
- R7. Las opciones se eligen con botones agrupados por atributo en lugar de un desplegable (Tarjetas: cantidad · faz · terminación); los adicionales (maqueta, corte individual, notas con imán) se presentan separados de las variantes.
- R8. El precio se actualiza al elegir una opción y el botón de sumar refleja la elección; se aclara la unidad cuando corresponde.
- R9. Cada tarjeta indica si el producto es personalizable y su plazo de producción.
- R10. Los filtros son Todo · Para regalar · Para tu marca · Para decorar · Para organizarte; un producto puede aparecer en más de uno y la búsqueda se mantiene.
- R11. Filtrar o buscar no hace parpadear ni saltar la página, no pierde el foco y no anuncia el contador en cada tecla.

**Pedido y WhatsApp**

- R12. El pedido se conserva al recargar la página o al volver de WhatsApp.
- R13. En celular, cuando hay productos en el pedido, hay un acceso fijo con cantidad y subtotal.
- R14. Antes de enviar, el pedido pide nombre, retiro o envío (con localidad si es envío), fecha en que lo necesita y, por cada producto personalizable, un campo "Contanos tu idea". Solo nombre y forma de entrega son obligatorios.
- R15. El mensaje de WhatsApp llega ordenado: saludo, código de pedido, una línea por producto con opción, cantidad y precio, subtotal estimado, datos de entrega, ideas de personalización y aviso de que las fotos se mandan por el chat.
- R16. Antes de abrir WhatsApp se avisa que solo falta tocar Enviar; si WhatsApp no se puede abrir (computadora sin la app, navegador interno de Instagram), hay una alternativa para copiar el pedido.
- R17. Después de abrir WhatsApp, el panel ofrece vaciar el pedido o volver a enviarlo.
- R18. Todos los avisos y errores del pedido se ven dentro del panel del pedido.
- R19. Cambiar cantidades no pierde el foco del teclado y la nueva cantidad se anuncia a lectores de pantalla.

**Confianza**

- R20. Un bloque visible informa plazos de producción, envíos y retiro, medios de pago, la promesa de mandar una muestra antes de imprimir, la política de cambios para productos personalizados, Instagram y tiempo de respuesta.
- R21. Junto a los precios aparece "Precios actualizados al [fecha]" y que el total final se confirma por WhatsApp.
- R22. Los productos que llevan fotos explican cómo mandarlas (cantidad, calidad mínima, enviarlas como documento).

**Interacción y movimiento**

- R23. Todo elemento interactivo tiene estados hover, foco y presionado coherentes entre sí; en pantallas táctiles hay una respuesta al tocar equivalente al hover.
- R24. Microinteracciones puntuales: confirmación en el botón al sumar al pedido, contador del pedido que reacciona, cambio de precio animado, indicador que se desliza en el selector de opciones e inclinación sutil de las polaroids del hero en computadora. Sin efectos de carga simulados.
- R25. Con "reducir movimiento" activado, las animaciones pasan a cambios instantáneos o fundidos breves, incluido el desplazamiento suave.

**Responsive y accesibilidad**

- R26. La página funciona sin scroll horizontal en 360, 390, 768, 1024 y 1280 px o más, y el orden visual coincide con el orden de navegación por teclado.
- R27. Los controles principales tienen un área táctil de al menos 44 px.
- R28. Cumple WCAG 2.2 AA: foco visible en todos los controles (incluido el buscador), regiones vivas sin ruido y nombres accesibles únicos en cada botón de sumar.

**Compartir, buscadores y rendimiento**

- R29. Al compartir el link en WhatsApp o Instagram aparecen imagen, título y descripción.
- R30. El contenido principal está disponible para buscadores y vistas previas sin esperar a JavaScript.
- R31. La página tiene favicon, idioma es-AR y datos estructurados de la tienda y sus productos con precios en ARS.
- R32. Las imágenes se sirven al tamaño adecuado para cada pantalla y la primera pantalla carga rápido en una conexión móvil.

**Seguridad y robustez**

- R33. La página no se puede preparar para publicar sin un número de WhatsApp válido; el error lo ve quien publica, nunca la clienta.
- R34. Todo texto que entra a la página o al mensaje se escapa, y la página solo carga recursos propios, Google Fonts y el enlace a WhatsApp.
- R35. No quedan dependencias sin uso.

---

## Key Flows

- F1. Pedido desde Instagram en el celular
  - **Trigger:** A1 toca el link de la bio de Instagram.
  - **Actors:** A1, A2
  - **Steps:** ve el hero y entra al catálogo; filtra "Para regalar"; abre "Ver ficha" de Fotos; elige la opción con botones y ve el precio; suma al pedido; toca el acceso fijo; completa nombre, entrega, fecha e idea; toca "Continuar por WhatsApp"; lee el aviso; WhatsApp abre con el mensaje armado; toca Enviar y manda las fotos por el chat.
  - **Outcome:** A2 recibe un pedido completo sin tener que hacer preguntas básicas.
  - **Covered by:** R5–R10, R12–R16, R22
- F2. Volver después de WhatsApp
  - **Trigger:** A1 vuelve a la pestaña de la tienda después de abrir WhatsApp.
  - **Actors:** A1
  - **Steps:** el pedido sigue ahí; el panel ofrece vaciarlo o volver a enviarlo.
  - **Outcome:** no se pierde el pedido si el envío no se concretó, y se puede empezar de cero si sí.
  - **Covered by:** R12, R17
- F3. Pedido desde una computadora sin WhatsApp
  - **Trigger:** A1 toca "Continuar por WhatsApp" en una computadora.
  - **Actors:** A1
  - **Steps:** se abre WhatsApp Web; si no puede usarlo, copia el pedido con un toque y lo manda por otro medio.
  - **Outcome:** el pedido no se pierde por falta de la app.
  - **Covered by:** R16

---

## Acceptance Examples

- AE1. **Covers R7, R8.** Given Tarjetas personales, when se elige 200 unidades · doble faz · laminado, then el precio muestra $26.300 y el botón de sumar refleja esa opción.
- AE2. **Covers R12.** Given un pedido con dos productos, when se recarga la página, then el pedido conserva ambos productos con sus cantidades.
- AE3. **Covers R14.** Given un pedido que solo tiene Láminas, when se abre el pedido, then no aparece ningún campo "Contanos tu idea".
- AE4. **Covers R14.** Given un pedido sin nombre o sin forma de entrega, when se toca "Continuar por WhatsApp", then el panel marca el campo faltante y no abre WhatsApp.
- AE5. **Covers R16, R18.** Given una computadora sin WhatsApp, when se toca "Continuar por WhatsApp", then el panel ofrece copiar el pedido y el aviso se ve dentro del panel.
- AE6. **Covers R25.** Given "reducir movimiento" activado, when se suma un producto, then el contador y el botón cambian sin animación de rebote ni desplazamiento suave.
- AE7. **Covers R33.** Given el número de WhatsApp vacío, when se prepara la página para publicar, then el proceso falla con un mensaje claro.

---

## Success Criteria

- La dueña manda el link sin dudar: la página se ve terminada en celular y en computadora.
- No quedan hallazgos críticos ni importantes de la auditoría de accesibilidad y de la crítica UX/UI.
- Lighthouse en celular da 90 o más en rendimiento, accesibilidad, buenas prácticas y SEO.
- Un pedido de prueba llega a WhatsApp con todos los datos necesarios para cotizar sin preguntas extra.

---

## Scope Boundaries

- Mercado Pago o cualquier pago online: queda para cuando la dueña lo decida.
- Fichas completas por producto con link propio.
- Vista previa en vivo de la personalización ("probalo con tu nombre").
- Sesión de fotos nueva.
- Cambio de identidad hacia la estética pop del catálogo.
- Prueba social (fotos de clientas, capturas de chats, reseñas): queda para cuando haya material.
- Hosting, dominio y publicación: este trabajo llega hasta que la página quede lista para publicar.

---

## Dependencies / Assumptions

- La dueña tiene que pasar: número de WhatsApp, zona de retiro y si hace envíos, plazos de producción por producto, medios de pago (y si hay descuento por transferencia), usuario de Instagram, horario o tiempo de respuesta, política de cambios y el PDF original del catálogo en alta resolución.
- Mientras esos datos no lleguen, se trabaja con textos de ejemplo claramente marcados; la página no se publica con ellos.
- Supuesto: la página todavía no está publicada y no tiene clientas usándola.
- Supuesto: el público mezcla gente que regala con emprendedores que compran tarjetas y vinilos.
- A verificar con un contador: si corresponde la leyenda de precios sin impuestos nacionales (Ley 27.743, Res. SIC 4/2025).

---

## Outstanding Questions

**Antes de publicar (las responde la dueña)**

- Qué productos son personalizables y qué se personaliza en cada uno.
- En qué filtro o filtros por intención va cada producto.
- Si las fotos recortadas del PDF alcanzan calidad suficiente una vez que llegue el original.

**Deferred to Planning**

- Cómo recortar y exportar las fotos del PDF para que se vean nítidas.
- Cómo dejar el contenido visible sin JavaScript sin perder la edición simple del catálogo.
- Qué recetas de la carpeta `transitions/` se usan para cada microinteracción.

---

## Sources

- Código actual: `src/main.ts` (render, carrito, mensaje de WhatsApp), `src/styles.css` (tokens y breakpoints), `src/catalog.ts` (productos y precios), `src/config.ts` (número de WhatsApp), `index.html` (metadatos y fuentes).
- Recetas de movimiento: `transitions/number-pop-in.md`, `transitions/text-states-swap.md`, `transitions/notification-badge.md`, `transitions/tabs-sliding.md`, `transitions/card-tilt.md`.
- Botones en vez de desplegables para variantes: https://baymard.com/research-articles/use-buttons-for-size-selection
- Desplegables con pocas opciones: https://nngroup.com/articles/dropdown-list
- Imágenes con escala: https://baymard.com/research-articles/in-scale-product-images
- Pagos y cuotas en Argentina (CACE 2025): https://mercado.com.ar/tendencias/comercio-electronico-el-estudio-anual-de-cace-midio-34-033-238-millones-en-2025
- Vender por WhatsApp: https://www.tiendanube.com/blog/como-vender-por-whatsapp/
- Click to Chat: https://faq.whatsapp.com/5913398998672934
- Referencias del rubro: https://fotoink.com.ar/productos/polaroids (plazos por producto), https://musartcreaciones.mitiendanube.com (muestra antes de imprimir), https://freestyledeco.com.ar/laminas-solas/ (packs con precio decreciente)
- Opciones en pasos y tabla de escalones: https://www.moo.com/us/business-cards/original
- Navegación por ocasión y regalo: https://www.papier.com
