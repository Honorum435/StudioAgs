# StudioAGS

Tienda catálogo responsive en TypeScript, preparada para armar pedidos por WhatsApp.

## Empezar

```sh
npm install
npm run dev
```

Para comprobar y compilar para producción:

```sh
npm run build
npm run preview
```

## Configurar WhatsApp

Antes de publicar, editá `src/config.ts` y completá `WHATSAPP_NUMBER` con el número internacional, solo dígitos y sin `+`, espacios ni guiones.

Los productos, opciones y precios están en `src/catalog.ts`. Las imágenes optimizadas se generaron a partir del catálogo compartido.
