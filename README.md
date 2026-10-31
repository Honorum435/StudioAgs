# StudioAGS

Tienda catálogo de papelería y objetos personalizados: calendarios, fotos, tarjetas, láminas, vinilos y más. La clienta elige productos y opciones, arma el pedido en la página y lo manda por WhatsApp; no hay pagos online ni servidor. Es un sitio estático en TypeScript con Vite.

## Empezar

```sh
npm install
cp .env.example .env
npm run dev
```

Completá `.env` con dos datos (en el hosting, cargá las mismas variables en su panel):

- `VITE_WHATSAPP_NUMBER`: el número del negocio en formato internacional, solo dígitos, sin `+`, espacios ni guiones. Por ejemplo `5491123456789`.
- `VITE_SITE_URL`: la dirección pública de la tienda, con `https://` y sin barra final. Por ejemplo `https://studioags.com.ar` o, en GitHub Pages, `https://honorum435.github.io/StudioAgs`.

Sin un número válido la página no muestra el botón de WhatsApp: el pedido solo se puede copiar.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:5173. Si faltan datos, solo avisa en la consola. |
| `npm test` | Corre los tests. |
| `npm run build` | Build para publicar, en `dist/`. Es estricto: falla mientras falte algún dato. |
| `npm run build:prueba` | Build de prueba: sale aunque falten datos y lleva `noindex` para que los buscadores no la indexen. No es para publicar. |
| `npm run preview` | Sirve lo último que quedó en `dist/` en http://localhost:4173. |

## Si `npm run build` falla

El error lista lo que falta, uno por uno:

- **`VITE_WHATSAPP_NUMBER` o `VITE_SITE_URL`**: faltan o tienen otro formato. Corregí `.env` o las variables del hosting.
- **`src/business.ts todavía tiene datos de ejemplo: ...`**: los datos del negocio que la dueña todavía no confirmó (retiro, envíos, medios de pago, Instagram, horario, cambios, fecha de los precios) están envueltos en `example(...)`. Corregí el texto si hace falta y sacale el `example(...)`:

  ```ts
  instagramHandle: example("studioags"), // antes
  instagramHandle: "studioags",          // después
  ```

- **`src/catalog.ts todavía tiene datos de ejemplo: calendarios.leadTime, ...`**: son plazos de producción provisorios (`leadTime: pendingLeadTime()`). Cambialos por el plazo real, en días hábiles:

  ```ts
  leadTime: { min: 3, max: 5, text: "De 3 a 5 días hábiles" },
  ```

## Productos y precios

Todo está en `src/catalog.ts`: nombre, descripción, opciones con su precio, adicionales (`addOns`), filtros (`intents`), si se personaliza, si necesita fotos y el plazo. Cuando cambien los precios, actualizá también `pricesUpdatedAt` en `src/business.ts`: es la fecha que se muestra en la página.

Cada producto tiene además su propia página en `producto/<id>/` (por ejemplo `producto/calendarios/`), con una galería de fotos, las mismas opciones y el mismo pedido que el inicio. Se arma sola al hacer el build. Para sumar texto a una página, agregá párrafos en `details`; para sumar fotos, ver `fotos-album.py` más abajo.

## Bueno saber

- Editar `src/catalog.ts`, `src/business.ts`, `src/templates.ts` o `src/format.ts` (también `src/prerender.ts` y `src/validation.ts`) reinicia el servidor de desarrollo, porque el HTML se arma de antemano con esos archivos. Es normal: la página se recarga sola.
- El pedido queda guardado solo en el navegador de la clienta, nunca en un servidor. Un pedido sin enviar dura 30 días; uno enviado se borra a las 48 horas. Si al volver algo ya no existe en el catálogo, se saca del pedido y se le avisa.

## Imágenes

Las fotos de las tarjetas, del inicio, las fichas y `compartir.jpg` (la imagen al compartir el link) salen del PDF original del catálogo, que no está en el repo. Para regenerarlas hace falta Python con PyMuPDF y Pillow:

```sh
pip install pymupdf pillow
python extraer-imagenes.py "RUTA/AL/catalogo.pdf"
```

Escribe en `public/images/`, nunca amplía una foto y al terminar imprime los anchos y altos que hay que declarar en `src/catalog.ts`. Qué foto y qué recorte usa cada producto se elige al principio del script; `--listar PAGINA` muestra las fotos de una página del PDF.

Las fotos de la galería de cada página salen del álbum de fotos de la dueña (fotos HEIC y JPG del celular). Hace falta Pillow y [ffmpeg](https://ffmpeg.org/) para leer las HEIC:

```sh
python fotos-album.py "RUTA/AL/ALBUM_DESCOMPRIMIDO"
```

Qué fotos usa cada producto se elige al principio del script. Cada foto sale cuadrada a 1200 y 600 px; después se declara en `gallery` del producto en `src/catalog.ts`.

## Antes de publicar

- [ ] Datos completos: `.env` (o el hosting), `src/business.ts` y los plazos de `src/catalog.ts`, sin ningún `example(...)`.
- [ ] `npm test` y `npm run build` pasan sin errores.
- [ ] Un pedido de prueba de punta a punta con un número de WhatsApp de prueba en `VITE_WHATSAPP_NUMBER`: tiene que llegar con todo lo necesario para cotizar sin preguntar nada más.
- [ ] Vista previa HTTPS para probar desde el celular:
  1. `npm run preview` y un túnel HTTPS a `http://localhost:4173` (por ejemplo `cloudflared tunnel --url http://localhost:4173` o `ngrok http 4173`).
  2. Poné la URL del túnel en `VITE_SITE_URL` (podés usar un `.env.prueba`, que solo lee `build:prueba`) y corré `npm run build:prueba`.
  3. Reiniciá la vista previa dejando pasar el host del túnel, que Vite bloquea por defecto: `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=xxxx.trycloudflare.com npm run preview` (en PowerShell: `$env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="xxxx.trycloudflare.com"; npm run preview`).
  4. Abrí el link desde Instagram (un mensaje directo o la bio) en iOS y en Android: copiar el pedido, abrir WhatsApp y cerrar y volver a abrir el link con el pedido guardado.
  5. Pasá la URL por un validador de Open Graph (por ejemplo el Sharing Debugger de Meta) para ver la vista previa del link.
- [ ] Lighthouse en modo celular (Chrome DevTools → Lighthouse) sobre la versión publicada: 90 o más en rendimiento, accesibilidad, buenas prácticas y SEO. Sobre `build:prueba` el SEO baja por el `noindex`; es esperable.

## GitHub Pages

La tienda se publica sola en https://honorum435.github.io/StudioAgs/ con cada push a `main`, mediante el workflow `.github/workflows/deploy.yml`: instala, corre los tests, arma la página y la sube.

- En el repo, **Settings → Pages → Source** tiene que estar en **GitHub Actions** (no en "Deploy from a branch", que publica el código sin armar y la página queda en blanco).
- El número de WhatsApp va como variable del repo: **Settings → Secrets and variables → Actions → Variables → `VITE_WHATSAPP_NUMBER`**. Si cambiás de dominio, agregá también `VITE_SITE_URL`.
- Mientras falten los datos del negocio, el workflow publica la versión de prueba (`npm run build:prueba`, con `noindex`). Cuando estén completos, cambiá esa línea del workflow por `npm run build`.
