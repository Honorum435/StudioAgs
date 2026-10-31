"""Recorta las caritas de la hoja de identidad y arma el fondo de caritas de la página.

Uso:
    python caritas.py RUTA/A/Identidad.jpg [CARPETA_PARA_LAS_CARAS]

Identidad.jpg es la hoja del kit de marca (CMYK, con su perfil de color). Guarda en src/ las
dos baldosas del fondo: carita-fondo.webp (azul suave, para los fondos claros) y
carita-fondo-clara.webp (blanca, para las franjas de color), y las caritas de la franja de
beneficios del inicio (carita-<número>.webp). Si se indica una carpeta, guarda ahí también las
siete caras recortadas en PNG con fondo transparente. Necesita Pillow.

Los colores y la opacidad del dibujo son los de --faces-ink y --faces-light en src/styles.css,
con los que tokens.test.ts prueba el contraste: si cambian acá, cambiarlos también allá.
"""

import io
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageCms, ImageFilter

Image.MAX_IMAGE_PIXELS = None

# Cajas de cada cara en la hoja (2481 px de ancho), en orden de lectura.
CAJAS = [
    (0, 5105, 810, 5870),  # 1 azul, pelito parado y ojos cerrados: la del fondo
    (900, 5105, 1440, 5885),  # 2 azul chiquita
    (1545, 5105, 2445, 5870),  # 3 verde, rulos arriba
    (180, 5960, 1260, 6725),  # 4 rosa, rulos a los costados
    (1305, 5975, 2235, 6725),  # 5 amarilla, flequillo
    (180, 6845, 1485, 7685),  # 6 azul, pelo largo
    (1560, 6845, 2235, 7685),  # 7 amarilla, gorrito
]
CARA_DEL_FONDO = 0

# (nombre, color, opacidad) de cada baldosa: igual que --faces-ink y --faces-light.
BALDOSAS = [
    ("carita-fondo.webp", (61, 119, 188), 0.15),
    ("carita-fondo-clara.webp", (255, 255, 255), 0.45),
]
# Caritas de la franja de beneficios (números de CAJAS, desde 1), en un cuadrado al doble de los
# 46 px con que se ven.
ICONOS = (1, 3, 4, 5, 6)
LADO_ICONO = 92
LADO = 440  # baldosa al doble de su tamaño en pantalla (220 px), para pantallas nítidas
ANCHO_CARA = 150  # 75 px en pantalla
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
    tonos = sorted(v for v, s in zip(menos.getdata(), saturacion.getdata()) if s > SATURACION_TRAZO)
    fuerte = 255 - tonos[len(tonos) // 20]
    lejania = menos.point(lambda v: max(0, min(255, round((255 - v) * 255 / fuerte))))
    alfa = ImageChops.multiply(lejania, trazo.filter(ImageFilter.MaxFilter(5)))
    cara = pedazo.copy()
    cara.putalpha(alfa)
    return cara.crop(alfa.getbbox())


def baldosa(cara: Image.Image, color: tuple[int, int, int], opacidad: float) -> Image.Image:
    """Dos copias de la cara en diagonal y un poco giradas, para que al repetirse no se vea una grilla."""
    chica = cara.resize((ANCHO_CARA, round(cara.height * ANCHO_CARA / cara.width)), Image.LANCZOS)
    tinta = Image.new("RGBA", chica.size, (*color, 0))
    tinta.putalpha(chica.getchannel("A").point(lambda v: round(v * opacidad)))
    salida = Image.new("RGBA", (LADO, LADO), (*color, 0))
    for (x, y), giro in (((LADO * 0.25, LADO * 0.25), 8), ((LADO * 0.75, LADO * 0.75), -10)):
        girada = tinta.rotate(giro, resample=Image.BICUBIC, expand=True)
        salida.alpha_composite(girada, (round(x - girada.width / 2), round(y - girada.height / 2)))
    return salida


def icono(cara: Image.Image) -> Image.Image:
    """La cara entera, centrada en un cuadrado transparente."""
    escala = LADO_ICONO / max(cara.size)
    chica = cara.resize((round(cara.width * escala), round(cara.height * escala)), Image.LANCZOS)
    salida = Image.new("RGBA", (LADO_ICONO, LADO_ICONO), (0, 0, 0, 0))
    salida.alpha_composite(chica, ((LADO_ICONO - chica.width) // 2, (LADO_ICONO - chica.height) // 2))
    return salida


def main() -> None:
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    hoja = hoja_srgb(Path(sys.argv[1]))
    caras = [recortar(hoja, caja) for caja in CAJAS]

    src = Path(__file__).parent / "src"
    for nombre, color, opacidad in BALDOSAS:
        baldosa(caras[CARA_DEL_FONDO], color, opacidad).save(src / nombre, "WEBP", lossless=True, method=6)
        print(src / nombre)
    for numero in ICONOS:
        icono(caras[numero - 1]).save(src / f"carita-{numero}.webp", "WEBP", lossless=True, method=6)
        print(src / f"carita-{numero}.webp")

    if len(sys.argv) == 3:
        carpeta = Path(sys.argv[2])
        carpeta.mkdir(parents=True, exist_ok=True)
        for numero, cara in enumerate(caras, start=1):
            cara.save(carpeta / f"carita-{numero}.png")
        print(f"{len(caras)} caras en {carpeta}")


if __name__ == "__main__":
    main()
