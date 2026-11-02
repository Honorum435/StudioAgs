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
    la foto sale entera y la zona no se usa.
    """

    archivo: str
    zona: tuple[float, float, float, float] = (0.0, 0.0, 1.0, 1.0)
    recortar: bool = True


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
    ],
    # La de la pizarra gris va entera, como pidió la dueña.
    "pizarra-orma": [
        Foto("IMG_1269.JPG"),
        whatsapp("10.26.58 AM", recortar=False),
    ],
    # La foto principal: los cuadernos, sin la tapa de arriba que tiene un personaje ajeno.
    "bitacoras": [
        whatsapp("10.39.04 AM", (0.0, 0.3, 1.0, 1.0)),
    ],
    "complementos": [
        whatsapp("10.37.34 AM"),
        whatsapp("10.37.47 AM"),
        Foto("IMG_0701.HEIC"),
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
}


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
                recorte = cuadrado(imagen, foto.zona) if foto.recortar else imagen
                base = f"foto-{producto}-{numero}"
                anchos = sorted({min(ancho, recorte.width) for ancho in ANCHOS})
                for ancho in anchos:
                    alto = round(recorte.height * ancho / recorte.width)
                    recorte.resize((ancho, alto), Image.LANCZOS).save(
                        salida / f"{base}-{ancho}.webp", quality=80, method=6
                    )
                print(f"  {base}: anchos {anchos}, {recorte.width} × {recorte.height}")


if __name__ == "__main__":
    main()
