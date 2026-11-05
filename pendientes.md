# Pendientes de StudioAGS

Lo que queda después del pulido (`plan-pulido.md`). Nada de esto bloquea probar la tienda; lo de "Antes de publicar" sí bloquea `npm run build`.

## Pedidos de Aixa (chat del 30/10/2026)

Lo que pidió después de ver el sitio con el kit de marca.

**Estructura:**
- **Inicio y catálogo separados:** una página de inicio y una pestaña aparte para el catálogo. Hecho: el catálogo está en `productos/` (ver los pedidos del 31/10).
- **Destacar la personalización:** que "Lo personalizamos con tu nombre, tu logo o tus fotos" resalte más. Hecho: la franja rosa y el bloque "¿Tenés una idea?".
- **Ficha por producto:** al tocar un producto se abre su página, con galería, descripción, opciones y precio, como en Mupe. Hecho: cada producto tiene su página en `producto/<id>/`. Falta que Aixa:
  - mire las fotos elegidas: 4 de calendarios, 1 de la pizarra negra y 1 de bitácoras, con solo las tapas propias;
  - mande textos más largos para cada producto (van en `details`).
- **Foto por opción:** que la foto cambie al elegir una opción.
- **Sobre nosotros:** una foto de Aixa con el negro y una biografía. La página `nosotros/` ya está, con un texto provisorio y la foto de la pizarra. Faltan la foto de ellos y su texto.
- **Contacto:** una pestaña con el mail (elstudioags@gmail.com), el Instagram (@__studioags) y los WhatsApp de Aixa y del negro. La página `contacto/` ya tiene el mail y el Instagram. El botón "Escribinos" abre WhatsApp cuando esté el número; hasta entonces lleva a Instagram. Los números están en el chat; confirmar cuáles se publican.
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

## Pedidos de Aixa (mensajes y audios del 31/10/2026)

Mandó una página de papelería de ejemplo, con círculos de categorías, más vendidos y formas curvas.

**Lo que pidió:**
- **Formas:** que no todo sea un rectángulo de color.
- **Marca de agua:** "studio ags" repetido de fondo en la franja azul, con el logo en blanco y el fondo del color. Como alternativas nombró rayas, cuadrados o las caritas. Puede que ella mande el diseño como imagen.
- **Páginas:** los productos en otra página. En el inicio, algo como los círculos y los más vendidos. Arriba, Productos, Nosotros y Contacto; en Productos, "para regalar" y "para emprendedores".
- **Fuente:** probar con solo Bristol.
- **Textos:** que los escribamos nosotros, con un poco de chamuyo.

**Qué quedó:**
- **Páginas:**
  - el inicio (hero, franja rosa, cuatro círculos por uso, más vendidos, adelanto de Nosotros y "¿Tenés una idea?");
  - Productos, con el catálogo y "Cómo comprar";
  - Nosotros, con la presentación y "Así preparamos tu pedido";
  - Contacto, con las tarjetas, "Antes de pedir" y "¿Tenés una idea?".
- **Menú:** Productos, Nosotros y Contacto, con la página actual marcada. En el celu de "Mi pedido" queda la bolsita con el número.
- **Formas:**
  - olas entre las franjas;
  - "¿Tenés una idea?" como tarjeta azul redondeada con el logo repetido en blanco suave;
  - la foto de Nosotros en forma de arco.
- **Fuente:** todos los títulos en Bristol y en mayúsculas. Hemis salió del sitio y vuelve con git si la quieren. Bristol tiene ¿, ¡, Ñ y las tildes.

**Falta que Aixa:**
- **Más vendidos:** diga cuáles son. Hoy son de ejemplo: Calendarios, Fotos para guardar, Bitácoras y Láminas (`featuredProducts` en `src/business.ts`).
- **Textos de Nosotros y del adelanto:** los apruebe o los cambie. Son provisorios y no dicen nada que no sepamos.
- **Formas y marca de agua:** diga si le gustan. Si manda su propio fondo, reemplaza al logo repetido. Las caritas ya están recortadas del kit (ver abajo).
- **Usos:** confirme las líneas cortas de cada círculo y las fotos elegidas (Entre Flores, Tarjetas, Pizarra OrMa y Calendarios). Para no mostrar la marca de un cliente, no se usó la foto de Vinilos.

## Fondo de caritas, cursor y estructura como Mupe (31/10/2026)

**Lo que pidió el primo:**
- recortar las caras del kit y repetir una de fondo en toda la página;
- un cursor animado como el de mupecuadernos.com.ar;
- analizar esa tienda página por página y hacer la nuestra muy parecida.

**Qué tiene Mupe:**
- **Arriba:** una barra de avisos que corre y el encabezado en dos filas (buscador, logo al medio, cuenta y carrito; abajo, el menú con submenús). En el celu, menú hamburguesa.
- **Inicio:**
  - el banner grande;
  - cinco íconos de beneficios;
  - "Hola hola" con la foto de la dueña;
  - novedades;
  - cuatro categorías en foto;
  - un banner para mayoristas y otro de agendas;
  - personalizados;
  - el feed de Instagram;
  - el pie rosa con la dirección, el logo y las redes.
- **Tienda:** un aviso de plazos arriba, "Mostrando N resultados", "Ordenar por", la grilla con etiquetas de descuento y sin stock, y la paginación.
- **Producto:**
  - la galería, el camino y las estrellas;
  - la lista de lo que trae, el precio con cuotas y con transferencia, y el recuadro "Importante" de plazos;
  - las opciones (tipo de hoja, subir archivo, nombre en la tapa, color y letra) y el calculador de envío;
  - las reseñas y los "Top elegidos".
- **Páginas:**
  - Nosotras, con su historia y fotos de la familia;
  - Preguntas frecuentes, desplegables con una foto;
  - Contacto, con un formulario, el local y un mapa;
  - Mayoristas, con un registro;
  - gift cards.
- **Además:** el botón flotante de WhatsApp, el cartel de suscripción con cupón, "Un regalo para vos", el cambio ARS/USD y el cursor animado.

**Qué quedó en StudioAGS:**
- **Fondo de caritas:**
  - las siete caras recortadas de `Identidad.jpg` con `caritas.py`;
  - la azul de pelito parado se repite de fondo en toda la página: en azul suave sobre el crema y el rosa clarito, en blanco sobre las franjas de color;
  - el encabezado, la tarjeta azul, las tarjetas y el pie quedan lisos;
  - la prueba de contraste mide el texto sobre las caritas.
- **Cursor:**
  - un círculo azul que sigue al mouse con un poco de demora y un punto en la punta;
  - sobre botones y enlaces el círculo se achica y el punto crece, como en Mupe;
  - solo con mouse y sin "reducir movimiento".
- **Barra de avisos:** corre arriba de todo con datos que ya están en la página: personalizados, retiro en Paraná, envíos a todo el país, muestra antes de imprimir y pedido por WhatsApp.
- **Encabezado:**
  - en la compu, el buscador, el logo al medio y "Mi pedido", con el menú abajo;
  - en el celu, menú hamburguesa con el buscador y las páginas;
  - el buscador lleva a `productos/?q=...`.
- **Inicio:**
  - la franja rosa con cinco beneficios, cada uno con una carita;
  - un banner "¿Tenés un emprendimiento?" que abre Productos filtrado;
  - un banner destacado de Calendarios.
- **Todas las páginas:** la tira de fotos de Instagram (seis fotos del álbum, que llevan al perfil), el pie en tres columnas y el botón flotante "Escribinos". Ese botón va a Instagram, y a WhatsApp cuando esté el número.
- **Productos:** "Ordenar por" (destacados, menor y mayor precio, nombre).
- **Preguntas frecuentes** (`preguntas-frecuentes/`): diez preguntas desplegables con las respuestas de los mismos datos que "Antes de pedir", y una foto.

**Lo que no se copió, y por qué:**
- **Suscripción con cupón y "Un regalo para vos":** hace falta un servicio de mails, y el cupón lo decide Aixa.
- **Cuentas, registro de mayoristas y gift cards:** necesitan un servidor.
- **Cuotas, precio con transferencia, descuentos y envío gratis desde un monto:** son decisiones de precios de Aixa. No se inventan.
- **Reseñas y estrellas:** solo con reseñas reales.
- **Cambio ARS/USD, calculador de envío y mapa:** no hay envíos al exterior ni local a la calle.
- **Submenús por categoría:** con ocho productos no hacen falta; los usos ya filtran.
- **Textos y fotos de Mupe:** solo se tomó la estructura. Los textos y fotos son de StudioAGS.

**Falta que Aixa:**
- **Avisos de arriba y Preguntas frecuentes:** los revise. Salen de los datos que todavía son de ejemplo (envíos, retiro, pagos, cambios y horarios).
- **Fotos de Instagram:** apruebe las seis, o diga cuáles prefiere.
- Los banners, la franja de beneficios y el fondo de caritas salieron el 01/11 (ver abajo).

## Colores del kit y la página de ejemplo (01/11/2026)

**Lo que pidió Aixa:**
- que las caritas no estén en todos lados;
- que los colores vayan como en las combinaciones de la hoja de identidad;
- que todo quede distribuido como la foto de la página de ejemplo que mandó (una papelería con el título rojo y azul, los círculos, los más vendidos y la franja roja de abajo).

**Las combinaciones del kit:** rosa con azul, amarillo con verde, rojo con amarillo y azul con amarillo. Ahora se usan los colores exactos de la hoja (#ECA2C8, #3D77BC, #E94E26, #FFD812, #2EAA54, #FBF9F2, #363B39 y #1E231F). Salieron el celeste, el verde claro y el naranja, que no son del kit.

**Cómo quedó:**
- **Fondo:** todo va sobre el crema liso, sin el fondo de caritas. El color está en las piezas, como en la foto.
- **Arriba:** los avisos en la franja roja y el encabezado en una fila: el logo a la izquierda, el menú al medio, y el buscador y "Mi pedido" a la derecha. En la tablet y el celu, menú hamburguesa.
- **Inicio**, en el orden de la foto:
  1. El título en rojo y azul con el botón rojo. A la derecha, las fotos sobre un panel azul con los stickers rosa y amarillo, y una mancha azul arriba a la izquierda.
  2. Los cuatro círculos por uso, en rosa, azul, amarillo y rojo.
  3. Los más vendidos, con el título en rojo, sin tarjeta.
  4. Nosotros en una tarjeta blanca con el botón rosa y una carita pegada en la foto. Al lado, una tarjeta rosa con seis trabajos que llevan a Instagram, en el lugar de la reseña de la foto.
  5. La franja roja de "¿Tenés una idea?" con la ola arriba, el botón amarillo y una mancha amarilla con la frase.
- **Pie:** sobre el crema, con el logo en rojo, las páginas y las redes. Abajo, dónde estamos y la frase.
- **Caritas:** solo en dos lugares. Una en la tarjeta de Nosotros y una en cada paso de "Cómo comprar", que van en azul, amarillo y rosa, cada uno con la carita de su combinación.
- **Contacto:** las cuatro tarjetas en amarillo, rosa, azul y verde.
- **Títulos:** en rojo, con el acento en azul.
- **Letra chica:** el rojo y el azul del kit no se leen bien de fondo. El botón rojo, los avisos y la franja roja usan un rojo un punto más oscuro (#D73E16), y los enlaces chicos, un azul más oscuro.

**Lo que salió y por qué:**
- **La franja rosa de beneficios, los dos banners y la tira de Instagram de todas las páginas:** la foto no los tiene. Los beneficios siguen en los avisos de arriba, y las fotos de Instagram, en la tarjeta rosa del inicio. Si los quiere de vuelta, están en git.
- **El logo repetido de marca de agua:** con él, la letra blanca de la franja roja no se leía bien.
- **La reseña de la foto:** no hay reseñas reales. Si Aixa manda alguna, la tarjeta rosa puede mostrarla.

**Falta que Aixa:**
- diga si le gusta cómo quedó la distribución;
- mande reseñas reales de clientas, si quiere la tarjeta como la de la foto.

## Lista de precios en grande (05/11/2026)

**Cómo quedó:** comparé la lista con el sitio, precio por precio. Cambiaron estos:
- **Calendarios clásicos** (sin y con notas): de $ 41.500 a $ 40.000.
- **Calendario de imán:** de $ 23.000 a $ 20.000. Ahora es el más barato, así que Calendarios dice "Desde $ 20.000".
- **Notas con imán** (el adicional de Calendarios): de $ 2.500 a $ 3.500.
- **Polaroid:** de $ 800 a $ 500.
- **Pizarra OrMa:** la gris de $ 50.000 a $ 35.000 y la negra de $ 60.000 a $ 40.000.

Lo demás ya estaba igual: los otros calendarios, fotos, Entre Flores, vinilos, maqueta y corte, toda la tabla de Tarjetas, Bitácoras, separadores, marco con imán y Láminas. En Láminas sumé a la nota "Encuadrado a medida, por encargue", como dice la lista.

La fecha de precios pasó a ser el 5 de noviembre de 2026 y ya no es de ejemplo. Quien tenga un pedido guardado de antes ve "Actualizamos los precios al 5 de noviembre de 2026: revisá el subtotal".

**Productos nuevos de la lista** (el primo dijo "sumá todo y que después me diga qué está mal"):
- **Minijuegos ($ 15.000):** el texto que mandó el 02/11 (más de 15 juegos reutilizables, 2 fibrones con borrador, 11,5 × 11,5 cm) y "Color": Naranja, Rosa, Celeste, Verde y Amarillo, sin cambiar el precio. Cuatro fotos del álbum: todos los colores (IMG_0052, la principal), el abanico en la mano (IMG_0149), la búsqueda de objetos sobre las piedras (IMG_1136) y el naranja en las piedras (IMG_1146). Salió la del laberinto porque tiene un dibujito que no sé si es de ellos.
- **DTF textil ($ 22.500 por m²):** "Estampado DTF para remeras o cualquier tela, con tu logo o tu diseño" y la nota "El precio es por metro cuadrado de estampado". Fotos: la remera de StudioAGS con el mate (sin la cara) y dos cuadros de los videos de la remera "Campeón mundial".
- **Gran formato (por m²):** un producto aparte con "Material" y las 10 opciones de la lista: vinilo blanco y transparente (sin laca, laca sectorizada, laca completa), lona frontlight 13 oz y blueback 150 g mate (con y sin laca). Va aparte para no cambiar Vinilos, que es por pliego. La nota dice que el vinilo de corte se cotiza aparte, porque en la lista no tiene precio.
- **Archivo bajonero + alfajor ($ 13.000):** estuvo un rato y lo sacamos (el primo lo pidió el 05/11). Si vuelve, faltan fotos y saber qué es.
- Gran formato no tiene fotos todavía: lleva una imagen provisoria con el logo (verde sobre amarillo), que arma `fotos-album.py`.
- Los cuatro tienen el plazo de ejemplo (de 3 a 5 días hábiles), como los demás que no lo informan.

**Falta que Aixa:**
- **Revise los productos nuevos** y diga qué está mal: nombres, textos, en qué filtro va cada uno y si son personalizables (hoy: DTF y Gran formato sí; Minijuegos no).
- **Fotos:** de Gran formato (lonas, banners, vidrieras).
- **DTF:** si la remera va incluida o solo el estampado, y si hay medidas fijas (por ejemplo A4 o A3) en lugar del metro cuadrado.
- **Gran formato:** si se puede pedir menos de un metro o con decimales. Hoy la cantidad va de 1 en 1, como metros enteros.
- **Vinilo de corte:** el precio.
- **3 separadores con imán a $ 3.000:** no están en la lista; siguen porque salen del cartel de la feria. Que confirme si la promo sigue.

## Colores del kit, una sola foto y cantidad (chat después de publicar el 03/11/2026)

**Lo que pidió Aixa:**
- **Horario de atención:** "de 8 a 20".
- **Colores:** "algunos cuadrados no son el mismo azul y verde", y el negro.
- **Inicio:** "queda mal la foto"; a "¿Querés que ponga solo esa foto más grande?" dijo que sí.
- **Cantidad:** poder elegir cuántos sumar ("si quieren 10 fotos, por ejemplo, ponés x10"), en Fotos, Láminas y los productos en general.
- **Calendarios:** elegir los colores (pastel, intenso, cálido, frío, y los monocromos, que son los de los emprendimientos o los personalizados). En el Único, que es una lámina, hay que elegir un color.
- **Bitácoras:** elegir las hojas: lisas, rayadas, cuadriculadas o punteadas.
- Mandó la lista de precios y la de precios por metro cuadrado. De los archivos digitales todavía no tiene nada.

**Cómo quedó:**
- **Horario:** "Respondemos de 8 a 20 h, casi siempre en el mismo día", en Contacto, Antes de pedir y Preguntas frecuentes.
- **Tarjetas de Contacto:** la azul y la verde ahora son del azul y el verde del kit, como el paso azul de "Cómo comprar". Sobre el azul la letra va en blanco y sobre el verde, en el negro del kit, porque el rosa y el amarillo no se leen ahí. Lo mismo para el "Escribinos" verde y el aviso verde del pedido. El rosa con letra azul y el amarillo con letra verde quedan como estaban.
- **Negro:** la opción elegida, el filtro activo y los botones al pasar el mouse van en el negro del kit (#1E231F) en lugar del gris oscuro de la letra.
- **Inicio:** una sola polaroid, más grande, con la foto del puesto. Salió la chica de Fotos para guardar (y sus imágenes `hero-fotos`).
- **Cantidad:** cada producto tiene "Cantidad" con − y + (de 1 a 99) arriba del botón, que dice cuántos suma y el precio de todos ("Sumar 10 · $ 15.000"). Tarjetas no lo lleva, porque ya elige 100, 200, 300, 500 o 1.000.
- **Calendarios:** "Colores": Pastel, Intenso, Cálido, Frío y Monocromo, sin cambiar el precio. La nota de la tarjeta dice que el monocromo es para emprendimientos o diseños propios y que el color del Único se elige por WhatsApp.
- **Bitácoras:** "Hojas": Lisas, Rayadas, Cuadriculadas y Punteadas, sin cambiar el precio.

**Falta que Aixa:**
- **Lista de precios en grande:** llegó el 05/11 y los precios ya están cargados (ver arriba).
- **Productos nuevos de la lista:** ya están en Productos (ver arriba).
- **Colores de los calendarios:** si manda la foto con los colores numerados, el Único puede elegir el número del color en la página en lugar de coordinarlo por WhatsApp.
- **Días de atención:** dijo de 8 a 20, pero no qué días.
- **Letra sobre el verde:** va en negro porque el amarillo no se lee sobre el verde del kit. Si la prefiere amarilla, la tarjeta tendría que volver al verde oscuro.

## Fotos del stand, formas y textos (chat del 02/11/2026, a la noche)

**Lo que pidió Aixa:**
- **Favicon:** la carita azul con los rulos rosas.
- **Inicio:** en el panel azul, "caritas de fondo tipo marca de agua" y una foto del puesto de la feria.
- **Nosotros:** la foto de los dos en el puesto ("Esta para nosotros capaz").
- **"Hecho a mano en Paraná":** en azul.
- **"Cómo comprar":** el paso azul "no está el mismo azul".
- **Formas:** mandó dos fondos de otros como ejemplo ("no son nuestros pero tan buenos"), para hacer algo así con los colores del studio, "dispersos en los bordes un poco".
- **Textos:** la descripción completa de Bitácoras ("queda más completo que solo 60 hojas"), la de los separadores con "Llevá 3 por solo $3.000", la de los minijuegos y seis frases "para no repetir siempre".
- **La carita roja:** no va repetida de fondo.

**Cómo quedó:**
- **Favicon:** la carita sobre el azul, con el trazo un poco más grueso en los tamaños chicos para que se vea en la pestaña.
- **Panel azul del inicio:** cuatro caritas del kit en blanco suave, repetidas (`caritas.py`). En la polaroid grande va el puesto con el cartel "Diseños personalizados por encargue"; la chica sigue con Fotos para guardar. La foto de Bitácoras que estaba ahí salió del inicio.
- **Nosotros:** la foto del equipo en el arco, recortada sin las láminas y los stickers de abajo.
- **"Hecho a mano en Paraná":** el título en el azul del logo.
- **Paso azul:** ahora es el mismo azul del logo y del panel del inicio. Sobre ese azul el rosa no se lee, así que la letra va en blanco.
- **Formas:** dibujé formas propias (una mancha, un destello, un sol, un arco y una onda) en los colores del kit, sin copiar los fondos de ejemplo. Asoman del costado entre una franja y otra en Inicio, Productos, Nosotros, Preguntas frecuentes, Contacto y la página de cada producto.
- **Bitácoras:** su página tiene el texto completo, con el vos de la página. La descripción corta dice "60 hojas de opalina de 120 g".
- **Complementos:** el texto de los separadores y la opción "3 separadores con imán" a $ 3.000.
- **Frases:** una distinta en el pie de cada página. Antes el pie repetía "Para que lo lindo se quede", que ya es el título de Nosotros.
- **Un arreglo de paso:** en el celu, el botón para frenar las fotos de Preguntas frecuentes aparecía arriba de todo, encima del encabezado. Ahora va en la esquina de la foto.

**Falta que Aixa:**
- **Archivos digitales:** quiere sumar plantillas para descargar o que se mandan por archivo, capaz en otra columna del menú. Falta saber cuáles serían, el precio y el formato, para no armar una página vacía.
- **Minijuegos:** ya está su texto (más de 15 juegos reutilizables, 2 fibrones con borrador, 11,5 × 11,5 cm, en varios colores). Falta el precio. (Ya está en Productos, a $ 15.000: ver arriba).
- **3 separadores a $ 3.000:** confirme que la promo es de los separadores con imán, como dice el cartel de la feria.
- **"En preguntas frecuentes y contactos se pone todo azul pero en productos nop":** no queda claro a qué se refiere. El menú y los títulos se ven iguales en las tres páginas.
- **Tarjeta azul de Contacto:** sigue en el azul oscuro con letra rosa, como pidió el 02/11. Si la quiere en el azul del logo, la letra tendría que ir en blanco. (Ya está en el azul del kit con letra blanca: ver arriba).
- **El tramo del chat de las 7:50 a las 8:00 p.m.:** no lo llegué a leer (había una captura de Nosotros).

## Combinaciones de las tarjetas y fotos nuevas (chat del 02/11/2026)

**Lo que pidió Aixa:**
- **Letras:** que sobre cada fondo de color la letra vaya en su color contrario, no en negro, como en sus tarjetas personales.
- **Contacto:** "en azul va rosa, en rosa azul, en amarillo el verde y en verde amarillo", y el "Escribinos" en verde nomás, para que no haya tantos colores.
- **Franja roja:** en la mancha amarilla, la letra naranja en vez de negra.
- **Fuente:** el texto en Creato Light.
- **Menú:** en azul, como el logo.
- **Círculos del inicio:** con la diagonal, como sus historias destacadas de Instagram (/precios, /ferias).
- **Preguntas frecuentes:** que las fotos se vayan pasando.
- **Fotos nuevas** para Pizarra OrMa (sin recortar), Calendarios, Bitácoras (la de los cuadernos como principal), Tarjetas ("tarjetería para emprendimientos") y Láminas.
- **Comunidad AGS:** pedidos entregados (las bolsas, el cuaderno rosa, los minijuegos, los imanes de La Josefa, las pizarras del cumple).
- **Complementos:** una sección con los marcos y los separadores.
- **Productos nuevos:** sumar los minijuegos, y el DTF (mandó las fotos de las remeras).

**Cómo quedó:**
- **Letras de color:** rosa con letra azul, amarillo con letra verde, azul con letra rosa y verde con letra amarilla. Va así en las tarjetas de Contacto, los pasos de "Cómo comprar", los stickers del inicio, el botón rosa, Comunidad AGS y el aviso de WhatsApp del pedido. El rosa sobre el azul del kit y el amarillo sobre el verde del kit no se leen, así que esas tarjetas usan un azul (#1D4687) y un verde (#176B33) más oscuros, como los de sus tarjetas impresas.
- **Franja roja:** el título en amarillo y, sobre el amarillo, la frase y el botón en rojo. La letra blanca sobre el rojo y los avisos de arriba quedan en blanco, porque el amarillo chico no se lee sobre el rojo.
- **El "Escribinos" de Contacto:** en verde, con la letra amarilla.
- **Texto en Creato Light:** los títulos siguen en Bristol y lo que estaba en negrita sigue igual.
- **Menú del encabezado:** en el azul del logo, apenas más oscuro para que se lea.
- **Círculos:** "/PARA REGALAR", "/PARA TU EMPRENDIMIENTO", y así.
- **Preguntas frecuentes:** pasan solas seis fotos de las galerías, con un botón para frenarlas. Con "reducir movimiento" arrancan quietas.
- **Comunidad AGS:** la tarjeta rosa del inicio, que antes decía "Lo que venimos haciendo", ahora tiene ocho pedidos entregados y sigue llevando a Instagram. También van ahí las dos de calendarios que salieron de la galería.
- **Galerías:**
  - **Calendarios:** salieron la de septiembre y la del florero, y entraron el de La Carmela y el de 2027 con los gatos.
  - **Pizarra OrMa:** la pizarra gris va primera y entera.
  - **Bitácoras:** la de los cuadernos es la principal, recortada para que no se vea la tapa con un personaje de otro. Salió la que había puesto yo.
  - **Tarjetas:** Maika, las tarjetas de StudioAGS con las caritas, Aura, Las Reinas y Luz Sosa.
  - **Vinilos:** los stickers de Maika.
  - **Láminas:** el exhibidor.
- **Complementos:** un producto nuevo con el separador clásico ($ 1.300), el separador con imán ($ 1.500) y el marco con imán ($ 5.500). Los separadores salieron de Bitácoras y el marco, de Fotos. Los precios son los del catálogo y los del cartel de la feria (IMG_9314). Como no estaba en el catálogo en PDF, no tiene "Ver ficha".

**Falta que Aixa:**
- **Mande dos fotos que citó en el chat y no llegaron en los zip:**
  - la que respondió con "Fijate de poner estos en calendario", con unos calendarios amarillos y rojos;
  - la que respondió con "Y estas, borra las q pusiste nomas", para Bitácoras.
- **Minijuegos y DTF:** precios y opciones para sumarlos a Productos. (Ya están, con los precios de la lista del 05/11: ver arriba).
- **Complementos:** confirme los precios del cartel de la feria. (Los 3 separadores a $ 3.000 ya van: ver arriba).
- **Creato Light:** diga si le gusta así o si prefiere la regular.
- **El rojo con la carita:** mandó la carita amarilla sobre el rojo del kit sin decir para qué es; preguntarle dónde la quiere. (Dijo que no va repetida de fondo).

### Ideas de la conversación con ChatGPT

Revisó la página de antes de los cambios del 30/10: varias cosas ya están hechas (páginas por producto, fotos reales, colores de la marca, bloque de pedidos personalizados) o ya estaban (precio que cambia con las opciones, contador del pedido, formulario y resumen antes de abrir WhatsApp). Lo nuevo que vale la pena:

- **Categorías por tipo de producto** en lugar de los filtros por uso: Stickers y papelería, Fotos y recuerdos, Organización, Para tu emprendimiento, Decoración, y Juegos y regalos. Lo decide Aixa.
- **Destacados o más vendidos** arriba del catálogo. Hecho en el inicio, con cuatro de ejemplo; Aixa tiene que decir cuáles son.
- **Así preparamos tu pedido:** fotos del sello, el papel kraft y los moños. Hecho, en Nosotros. Falta que Aixa confirme los textos, sobre todo "Si es un regalo, lo cerramos con moño".
- **Opiniones de clientes:** solo con opiniones reales que mande Aixa.
- **Precio "desde"** en las tarjetas, para que se note que cambia con las opciones. Hecho: "Desde $ X, según la opción" en las tarjetas y en cada página, solo cuando el precio cambia.
- **Foto en las líneas del pedido** y un **botón de WhatsApp** siempre visible (este necesita el número).
- **Instagram:** algunas fotos fijas que lleven al perfil. Un feed en vivo necesita código de Instagram, que la CSP no deja cargar.
- **Fecha de precios:** hecho, es el 5 de noviembre de 2026, el día que se cargó la lista nueva.

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
| Encabezado | Crema |
| Inicio (hero) | Celeste |
| Franja de arriba | Rosa |
| Círculos por uso | Crema, con cada círculo en rosa, celeste, verde claro y amarillo |
| Más vendidos y catálogo | Rosa clarito, con las tarjetas en blanco |
| Adelanto de Nosotros y "Así preparamos tu pedido" | Naranja claro |
| "¿Tenés una idea?" | Tarjeta azul con el logo en blanco suave |
| Tarjetas de Contacto | Rosa, celeste, verde claro y amarillo claro |
| "Antes de pedir" | Verde claro |
| "Cómo comprar" | Amarillo |
| Pie | Negro, con el logo en amarillo |

El verde y el naranja van en su versión pastel porque, en la versión plena, la letra chica no se lee. Sobre los pasteles, las volantas y los textos grises pasan a tinta. El encabezado queda fijo arriba al bajar y se achica un poco. Falta que Aixa diga si le gusta la combinación.

La hoja de identidad pide Hemis para títulos y acentos, y **Tablet Gothic Narrow** para subtítulos y textos. Aixa después eligió Creato para el texto. Si quieren Tablet Gothic Narrow, es una fuente paga: hacen falta los archivos y la licencia para web.

Tipografías que mandó la dueña: Creato Display para el texto, y Hemis o Bristol para los títulos. El "ags" del logo está dibujado a mano, no es una fuente. El 31/10 pidió probar solo con Bristol: ahora todos los títulos van en Bristol y en mayúsculas.

Qué prueba la rama `vista-marca`:
- **Paleta del kit:**
  - azul para acentos y texto de color;
  - amarillo en las franjas;
  - rosa y verde en los stickers;
  - naranja en los detalles.
- **Logo y personajes:** el logo real en el encabezado y el pie, y los personajes en "Cómo comprar".
- **Fuentes:** Creato en el texto y Bristol en todos los títulos, siempre en mayúsculas, porque en minúscula su "i" se confunde con dos puntos. Se cambia con `--display` en `src/styles.css`.
- **Fuentes propias:** se sirven desde el sitio, ya no desde Google Fonts. La CSP pasó a `font-src 'self'`.

Falta antes de pasarla a `main`:
- **Decisiones de la dueña:** que confirme si se queda solo con Bristol, y los colores.
- **Licencias:** confirmar que Bristol se puede usar en una web. Creato tiene licencia OFL.
- **Peso de las fuentes:** pasarlas de OTF a WOFF2. Hoy Creato y Bristol pesan unos 220 KB.
- **Archivos originales:** pedir el logo y los personajes en SVG o PNG con fondo transparente. Los de la rama salen de los JPEG del kit.
- **Favicon e imagen para compartir:** siguen con el estilo anterior.
- **Nombres de los tokens:** quedaron los viejos, por ejemplo `--coral-dark` ahora es azul. Renombrarlos si se adopta.

## Antes de publicar (los responde la dueña)

- Número de WhatsApp y URL del sitio en `.env` (ver `.env.example`).
- Datos del negocio en `src/business.ts`: zona de retiro, envíos, medios de pago, Instagram, tiempo de respuesta y política de cambios. Al confirmar cada uno, sacarle el `example(...)`.
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
