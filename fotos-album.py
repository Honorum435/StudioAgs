"""Genera las fotos de la galería de cada producto a partir del álbum de la dueña.

Uso:
    python fotos-album.py CARPETA [CARPETA ...]

Cada CARPETA es un lugar donde buscar las fotos: el zip del álbum de Google Fotos ya
descomprimido (fotos HEIC y JPG de iPhone) y las fotos que mandó por WhatsApp (los zip ya
descomprimidos o la carpeta de Descargas). Cada foto se busca en las carpetas en ese orden.
Escribe en public/images, junto a este script. Necesita Pillow, y ffmpeg en el PATH para leer
las HEIC.

Cada foto sale cuadrada, como el cuadro de la galería, a 1200 y 600 px en WebP, sin ampliar
nunca: si el cuadrado mide menos de 1200 (las de WhatsApp miden 960), el archivo mayor tiene
esa medida. Las fotos marcadas para no recortar salen enteras, con el mismo ancho. Al terminar
imprime lo que hay que declarar en `gallery` de src/catalog.ts.

Las fotos de cada opción (la que aparece al elegir, por ejemplo, el minijuego rosa) siguen la
numeración de la galería de su producto, después de las de la galería, y se declaran en `photo`
de la opción. Las de las capturas de colores de los calendarios salen enteras.

Los productos que todavía no tienen fotos llevan una imagen provisoria con el logo, en una
combinación del kit, a 800 y 400 px (PROVISORIAS).
"""

import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

ANCHOS = (1200, 600)


@dataclass(frozen=True)
class Foto:
    """Foto del álbum y, si hace falta, la zona a usar (fracciones de la foto ya derecha).

    El cuadrado es el más grande que entra en la zona, centrado en ella. Con recortar=False
    sale la zona entera, sin cuadrar (por defecto, la foto entera).
    """

    archivo: str
    zona: tuple[float, float, float, float] = (0.0, 0.0, 1.0, 1.0)
    recortar: bool = True


def captura(numero: int) -> Foto:
    """Una de las capturas de colores de los calendarios que mandó la dueña el 30/10/2026, entera."""
    sufijo = f" ({numero})" if numero else ""
    return Foto(f"WhatsApp Image 2026-10-30 at 2.29.36 PM{sufijo}.jpeg", recortar=False)


def del_05_11(hora: str, zona: tuple[float, float, float, float] = (0.0, 0.0, 1.0, 1.0), recortar: bool = False) -> Foto:
    """Foto de los zip que mandó la dueña el 05/11/2026 (bajonero, marcos y A5 en stock), entera
    dentro de la zona: son fotos apaisadas o con el producto lejos de los bordes."""
    return Foto(f"WhatsApp Image 2026-11-05 at {hora}.jpeg", zona, recortar)


def whatsapp(hora: str, zona: tuple[float, float, float, float] = (0.0, 0.0, 1.0, 1.0), recortar: bool = True) -> Foto:
    """Foto que mandó la dueña por WhatsApp el 02/11/2026, por la hora del nombre."""
    return Foto(f"WhatsApp Image 2026-11-02 at {hora}.jpeg", zona, recortar)


# Las eligió la dueña en el chat del 02/11/2026. Sin personajes de otros a la vista.
GALERIAS: dict[str, list[Foto]] = {
    # El de La Carmela y el de 2027 son calendarios personalizados; el de 2027 deja afuera el
    # cuaderno de al lado.
    "calendarios": [
        Foto("IMG_5944.HEIC"),
        Foto("IMG_6386.HEIC"),
        whatsapp("10.36.49 AM", (0.0, 0.0, 1.0, 0.8)),
        whatsapp("10.41.51 AM", (0.3, 0.15, 1.0, 0.55)),
        # Las de cada formato: el clásico rojo de julio, el clásico con notas rosa, el único
        # rosa, el semanal grande y el chico (los dos de la misma foto), el acrílico y el de
        # imán en la heladera. El de doce meses sale del PDF (extraer-imagenes.py).
        Foto("D57B5CDA-FFB3-45A1-8BB9-7BD967900AA7.jpg", (0.05, 0.0, 0.75, 1.0)),
        Foto("IMG_6058.HEIC", (0.1, 0.05, 0.95, 0.95)),
        Foto("IMG_7288.HEIC"),
        Foto("IMG_6386.HEIC", (0.3, 0.0, 1.0, 0.5)),
        Foto("IMG_6386.HEIC", (0.0, 0.38, 1.0, 1.0)),
        Foto("IMG_0706.HEIC"),
        Foto("IMG_7979.HEIC", (0.4, 0.0, 1.0, 0.55)),
        # Las de cada color: los abanicos cálido, intenso, frío y monocromo, y la captura pastel.
        Foto("IMG_5942.HEIC"),
        Foto("IMG_5944.HEIC", (0.0, 0.25, 1.0, 1.0)),
        Foto("IMG_5945.HEIC"),
        Foto("IMG_5943.HEIC"),
        captura(2),
    ],
    # La de la pizarra gris va entera, como pidió la dueña.
    "pizarra-orma": [
        Foto("IMG_1269.JPG"),
        whatsapp("10.26.58 AM", recortar=False),
    ],
    # La foto principal: los cuadernos, sin la tapa de arriba que tiene un personaje ajeno.
    "bitacoras": [
        whatsapp("10.39.04 AM", (0.0, 0.3, 1.0, 1.0)),
        # A5 en stock (05/11/2026): las anilladas con el sol y las de dibujos, las tapas de la fila
        # de arriba (la de abajo tiene una tapa con un personaje ajeno) y, de la foto que mandó por
        # el chat, solo la fila del medio (arriba y abajo hay personajes ajenos).
        del_05_11("4.44.48 PM", (0.05, 0.12, 0.95, 0.92)),
        del_05_11("4.44.47 PM (1)", (0.05, 0.12, 0.95, 0.92)),
        del_05_11("4.44.47 PM", (0.0, 0.03, 1.0, 0.49)),
        Foto("a5-en-stock-chat.jpg", (0.05, 0.325, 0.97, 0.61), recortar=False),
    ],
    "complementos": [
        whatsapp("10.37.34 AM"),
        whatsapp("10.37.47 AM"),
        Foto("IMG_0701.HEIC"),
        # Los marcos con imán (05/11/2026): para polaroid, para foto cuadrada y para tira.
        del_05_11("4.57.44 PM (1)"),
        del_05_11("4.57.44 PM"),
        del_05_11("4.57.45 PM"),
    ],
    # El Archivo bajonero (05/11/2026): solo la tapa y la página del top, sin la de al lado,
    # que tiene el dedo encima, como pidió la dueña.
    "archivo-bajonero": [
        del_05_11("4.47.49 PM", (0.12, 0.04, 0.88, 0.98)),
        del_05_11("4.47.48 PM (1)", (0.04, 0.17, 0.505, 0.70)),
    ],
    # Tarjetería para emprendimientos: Maika, las tarjetas de StudioAGS, Aura, Las Reinas y Luz Sosa.
    "tarjetas": [
        whatsapp("10.35.29 AM"),
        whatsapp("9.44.34 AM (3)"),
        whatsapp("10.36.00 AM"),
        whatsapp("10.36.29 AM"),
        whatsapp("10.36.29 AM (1)"),
    ],
    "vinilos": [
        whatsapp("10.35.47 AM"),
    ],
    "laminas": [
        whatsapp("10.41.16 AM"),
    ],
    # Todos los colores, el abanico en la mano, la búsqueda de objetos a medio jugar y el naranja
    # en las piedras.
    "minijuegos": [
        Foto("IMG_0052.PNG"),
        Foto("IMG_0149.HEIC"),
        Foto("IMG_1136.HEIC", (0.0, 0.15, 1.0, 0.85)),
        Foto("IMG_1146.HEIC", (0.2, 0.5, 1.0, 1.0)),
        # Las de los colores que no tienen foto propia en la galería: el rosa con sus dos
        # fibrones y el verde, de la foto de todos los colores. Del amarillo no hay foto.
        Foto("IMG_0105.HEIC"),
        Foto("IMG_0052.PNG", (0.35, 0.45, 1.0, 1.0)),
    ],
    # No tiene galería: el imán de 10 × 10 en la heladera, para la opción. Las demás opciones
    # salen del PDF (extraer-imagenes.py).
    "fotos": [
        Foto("IMG_0700.HEIC", (0.0, 0.0, 1.0, 0.5)),
    ],
    # La remera de StudioAGS, sin la cara, y la de "Campeón mundial": dos cuadros de los videos
    # de las remeras del 02/11/2026, bajados con estos nombres.
    "dtf-textil": [
        whatsapp("10.45.55 AM (1)", (0.0, 0.28, 1.0, 0.88)),
        Foto("remera-campeon-perchero.jpg", (0.0, 0.2, 1.0, 0.85)),
        Foto("remera-campeon-detalle.jpg"),
    ],
    # No es un producto: las fotos de "Así preparamos tu pedido", en el orden de los pasos.
    "proceso": [
        Foto("IMG_5911.HEIC"),
        Foto("IMG_5935.HEIC"),
        Foto("IMG_7040.HEIC"),
        Foto("IMG_7029.HEIC"),
    ],
    # No es un producto: Comunidad AGS, pedidos que ya se entregaron.
    "comunidad": [
        whatsapp("10.43.53 AM"),
        whatsapp("10.31.06 AM"),
        whatsapp("10.40.11 AM"),
        whatsapp("10.33.33 AM"),
        whatsapp("10.45.55 AM"),
        whatsapp("10.42.59 AM", (0.0, 0.35, 0.85, 1.0)),
        Foto("IMG_7287.HEIC"),
        Foto("IMG_0706.HEIC"),
    ],
    # No es un producto: el puesto de la feria, del chat del 02/11/2026 (bajadas con estos nombres).
    # Los carteles van enteros en la polaroid del inicio; el equipo, en el arco de Nosotros, sin
    # las láminas y los stickers de abajo.
    "stand": [
        Foto("stand-carteles.jpg", recortar=False),
        Foto("stand-equipo.jpg", (0.0, 0.08, 1.0, 0.78)),
    ],
}


# Producto sin fotos → (fondo, logo), como las combinaciones de las tarjetas de la marca.
PROVISORIAS: dict[str, tuple[str, str]] = {
    "gran-formato": ("#ffd812", "#2eaa54"),
}


def provisoria(fondo: str, color: str, logo: Image.Image) -> Image.Image:
    imagen = Image.new("RGB", (800, 800), fondo)
    marca = logo.copy()
    marca.thumbnail((440, 440))
    tinta = Image.new("RGB", marca.size, color)
    imagen.paste(tinta, ((800 - marca.width) // 2, (800 - marca.height) // 2), marca.getchannel("A"))
    return imagen


def buscar(carpetas: list[Path], archivo: str) -> Path:
    for carpeta in carpetas:
        if (carpeta / archivo).exists():
            return carpeta / archivo
    sys.exit(f"No está {archivo} en ninguna de las carpetas.")


def abrir(ruta: Path, temporal: Path) -> Image.Image:
    if ruta.suffix.lower() != ".heic":
        return ImageOps.exif_transpose(Image.open(ruta)).convert("RGB")
    if shutil.which("ffmpeg") is None:
        sys.exit("Para leer fotos HEIC hace falta ffmpeg en el PATH.")
    png = temporal / f"{ruta.stem}.png"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(ruta), "-frames:v", "1", str(png)],
        check=True,
    )
    return Image.open(png).convert("RGB")


def zona(imagen: Image.Image, fracciones: tuple[float, float, float, float]) -> Image.Image:
    ancho, alto = imagen.size
    caja = (
        round(fracciones[0] * ancho),
        round(fracciones[1] * alto),
        round(fracciones[2] * ancho),
        round(fracciones[3] * alto),
    )
    return imagen if caja == (0, 0, ancho, alto) else imagen.crop(caja)


def cuadrado(imagen: Image.Image, zona: tuple[float, float, float, float]) -> Image.Image:
    ancho, alto = imagen.size
    izquierda, arriba, derecha, abajo = (
        zona[0] * ancho,
        zona[1] * alto,
        zona[2] * ancho,
        zona[3] * alto,
    )
    lado = min(derecha - izquierda, abajo - arriba)
    cx, cy = (izquierda + derecha) / 2, (arriba + abajo) / 2
    caja = (round(cx - lado / 2), round(cy - lado / 2), round(cx + lado / 2), round(cy + lado / 2))
    return imagen.crop(caja)


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    carpetas = [Path(carpeta) for carpeta in sys.argv[1:]]
    salida = Path(__file__).parent / "public" / "images"
    salida.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as carpeta:
        temporal = Path(carpeta)
        for producto, fotos in GALERIAS.items():
            print(f"{producto}:")
            for numero, foto in enumerate(fotos, start=1):
                imagen = abrir(buscar(carpetas, foto.archivo), temporal)
                recorte = cuadrado(imagen, foto.zona) if foto.recortar else zona(imagen, foto.zona)
                base = f"foto-{producto}-{numero}"
                anchos = sorted({min(ancho, recorte.width) for ancho in ANCHOS})
                for ancho in anchos:
                    alto = round(recorte.height * ancho / recorte.width)
                    recorte.resize((ancho, alto), Image.LANCZOS).save(
                        salida / f"{base}-{ancho}.webp", quality=80, method=6
                    )
                print(f"  {base}: anchos {anchos}, {recorte.width} × {recorte.height}")

    logo = Image.open(Path(__file__).parent / "src" / "logo-studioags.png").convert("RGBA")
    for producto, (fondo, color) in PROVISORIAS.items():
        imagen = provisoria(fondo, color, logo)
        for ancho in (400, 800):
            imagen.resize((ancho, ancho), Image.LANCZOS).save(salida / f"{producto}-{ancho}.webp", quality=80, method=6)
        print(f"{producto}: provisoria, anchos [400, 800], 800 × 800")


if __name__ == "__main__":
    main()
