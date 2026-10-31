"""Genera las fotos de la galería de cada producto a partir del álbum de la dueña.

Uso:
    python fotos-album.py CARPETA_DEL_ALBUM [CARPETA_DE_SALIDA]

CARPETA_DEL_ALBUM es el zip del álbum de Google Fotos ya descomprimido (fotos HEIC y JPG de
iPhone). La carpeta de salida es public/images (junto a este script) si no se indica otra.
Necesita Pillow, y ffmpeg en el PATH para leer las HEIC.

Cada foto sale cuadrada, como el cuadro de la galería, a 1200 y 600 px en WebP, sin ampliar
nunca. Al terminar imprime lo que hay que declarar en `gallery` de src/catalog.ts.
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

    El cuadrado es el más grande que entra en la zona, centrado en ella.
    """

    archivo: str
    zona: tuple[float, float, float, float] = (0.0, 0.0, 1.0, 1.0)


# Sin personas, marcas de clientes ni personajes de otros: revisar con la dueña antes de sumar más.
GALERIAS: dict[str, list[Foto]] = {
    "calendarios": [
        Foto("IMG_5944.HEIC"),
        Foto("IMG_7287.HEIC"),
        Foto("IMG_6386.HEIC"),
        Foto("IMG_0706.HEIC"),
    ],
    "pizarra-orma": [
        Foto("IMG_1269.JPG"),
    ],
    # Solo las tapas propias (el salchicha y el sol): las otras tienen personajes ajenos.
    "bitacoras": [
        Foto("IMG_8572.HEIC", (0.0, 0.5, 0.66, 1.0)),
    ],
}


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
    album = Path(sys.argv[1])
    salida = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent / "public" / "images"
    salida.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as carpeta:
        temporal = Path(carpeta)
        for producto, fotos in GALERIAS.items():
            print(f"{producto}:")
            for numero, foto in enumerate(fotos, start=1):
                ruta = album / foto.archivo
                if not ruta.exists():
                    sys.exit(f"No está {ruta}.")
                recorte = cuadrado(abrir(ruta, temporal), foto.zona)
                base = f"foto-{producto}-{numero}"
                anchos = [ancho for ancho in ANCHOS if ancho <= recorte.width] or [recorte.width]
                for ancho in anchos:
                    recorte.resize((ancho, ancho), Image.LANCZOS).save(
                        salida / f"{base}-{ancho}.webp", quality=80, method=6
                    )
                print(f"  {base}: anchos {sorted(anchos)}, {max(anchos)} × {max(anchos)}")


if __name__ == "__main__":
    main()
