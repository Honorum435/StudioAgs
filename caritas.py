"""Recorta las caritas de la hoja de identidad y arma la marca de agua del panel azul del inicio.

Uso:
    python caritas.py RUTA/A/Identidad.jpg [CARPETA_PARA_LAS_CARAS]

Identidad.jpg es la hoja del kit de marca (CMYK, con su perfil de color, o ya pasada a sRGB).
Guarda en src/ la baldosa caritas-marca-de-agua.webp: cuatro caras distintas en blanco suave,
cada una un poco girada, para repetir sobre el azul. Si se indica una carpeta, guarda ahí también
las siete caras recortadas en PNG con fondo transparente. Necesita Pillow.

La pidió la dueña en el chat del 02/11/2026: "caritas de fondo tipo marca de agua".
"""

import io
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageCms, ImageFilter

Image.MAX_IMAGE_PIXELS = None

# Cajas de cada cara en la hoja (2481 px de ancho), en orden de lectura.
CAJAS = [
    (0, 5105, 810, 5870),  # 1 azul, pelito parado y ojos cerrados
    (900, 5105, 1440, 5885),  # 2 azul chiquita
    (1545, 5105, 2445, 5870),  # 3 verde, rulos arriba
    (180, 5960, 1260, 6725),  # 4 rosa, rulos a los costados
    (1305, 5975, 2235, 6725),  # 5 amarilla, flequillo
    (180, 6845, 1485, 7685),  # 6 azul, pelo largo
    (1560, 6845, 2235, 7685),  # 7 amarilla, gorrito
]

# (cara, centro en la baldosa, giro): ninguna toca el borde, así al repetirse no se cortan.
CARAS_DE_LA_BALDOSA = [
    (0, (120, 130), 8),
    (3, (400, 175), -10),
    (6, (230, 420), -6),
    (2, (465, 440), 10),
]
LADO = 560  # baldosa al doble de su tamaño en pantalla (280 px), para pantallas nítidas
TAMANO_CARA = 125  # lado del cuadrado de igual área: 62 px en pantalla, sea ancha o alta
BLANCO = (255, 255, 255)
OPACIDAD = 0.25
SATURACION_TRAZO = 40


def hoja_srgb(ruta: Path) -> Image.Image:
    hoja = Image.open(ruta)
    if hoja.mode != "CMYK":
        return hoja.convert("RGB")
    perfil = ImageCms.ImageCmsProfile(io.BytesIO(hoja.info["icc_profile"]))
    return ImageCms.profileToProfile(hoja, perfil, ImageCms.createProfile("sRGB"), outputMode="RGB")


def recortar(hoja: Image.Image, caja: tuple[int, int, int, int]) -> Image.Image:
    """La cara con fondo transparente: queda el trazo de color, sin el blanco ni el óvalo crema."""
    pedazo = hoja.crop(caja)
    r, g, b = pedazo.split()
    menos = ImageChops.darker(ImageChops.darker(r, g), b)
    saturacion = ImageChops.subtract(ImageChops.lighter(ImageChops.lighter(r, g), b), menos)
    trazo = saturacion.point(lambda v: 255 if v > SATURACION_TRAZO else 0)
    # La opacidad sale de cuánto se aleja del blanco, medida contra el tono fuerte de la cara (el
    # del percentil 5 del trazo), así la rosa no queda más pálida que las otras.
    tonos = sorted(v for v, s in zip(menos.get_flattened_data(), saturacion.get_flattened_data()) if s > SATURACION_TRAZO)
    fuerte = 255 - tonos[len(tonos) // 20]
    lejania = menos.point(lambda v: max(0, min(255, round((255 - v) * 255 / fuerte))))
    alfa = ImageChops.multiply(lejania, trazo.filter(ImageFilter.MaxFilter(5)))
    cara = pedazo.copy()
    cara.putalpha(alfa)
    return cara.crop(alfa.getbbox())


def baldosa(caras: list[Image.Image]) -> Image.Image:
    salida = Image.new("RGBA", (LADO, LADO), (*BLANCO, 0))
    for numero, (x, y), giro in CARAS_DE_LA_BALDOSA:
        cara = caras[numero]
        escala = TAMANO_CARA / (cara.width * cara.height) ** 0.5
        chica = cara.resize((round(cara.width * escala), round(cara.height * escala)), Image.LANCZOS)
        tinta = Image.new("RGBA", chica.size, (*BLANCO, 0))
        tinta.putalpha(chica.getchannel("A").point(lambda v: round(v * OPACIDAD)))
        girada = tinta.rotate(giro, resample=Image.BICUBIC, expand=True)
        salida.alpha_composite(girada, (round(x - girada.width / 2), round(y - girada.height / 2)))
    return salida


def main() -> None:
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    hoja = hoja_srgb(Path(sys.argv[1]))
    caras = [recortar(hoja, caja) for caja in CAJAS]

    destino = Path(__file__).parent / "src" / "caritas-marca-de-agua.webp"
    baldosa(caras).save(destino, "WEBP", lossless=True, method=6)
    print(destino)

    if len(sys.argv) == 3:
        carpeta = Path(sys.argv[2])
        carpeta.mkdir(parents=True, exist_ok=True)
        for numero, cara in enumerate(caras, start=1):
            cara.save(carpeta / f"carita-{numero}.png")
        print(f"{len(caras)} caras en {carpeta}")


if __name__ == "__main__":
    main()
