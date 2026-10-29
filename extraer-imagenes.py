"""Genera las imágenes de la tienda a partir del PDF original del catálogo.

Uso:
    python extraer-imagenes.py RUTA/AL/catalogo.pdf [CARPETA_DE_SALIDA]
    python extraer-imagenes.py RUTA/AL/catalogo.pdf --listar PAGINA

La carpeta de salida es public/images (junto a este script) si no se indica otra. Necesita PyMuPDF y Pillow.

Nunca amplía: las fotos embebidas se extraen a su resolución original y los recortes de
página se renderizan a 300 dpi (o a la densidad real de las fotos que caen en el recorte,
si es menor). Cada archivo sale a 400 px y al menor entre 800 px y el ancho nativo del
recorte; si el recorte mide menos de 400 px, sale una sola vez a su ancho nativo. Las
fichas son la página entera a 300 dpi achicada a 1800 y 1200 px. Al terminar imprime, por
producto, el ancho nativo del recorte frente a lo que pide la tarjeta a 2× (~1040 px) y
los anchos y altos que hay que declarar en src/catalog.ts.
"""

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image


@dataclass(frozen=True)
class Foto:
    """Foto embebida: página (desde 1) e índice en page.get_images() (ver --listar).

    El recorte toma la proporción del destino, centrado en (cx, cy) como fracción de la
    foto, y con zoom 1 es lo más grande posible; con zoom 2 mide la mitad.
    """

    pagina: int
    indice: int
    cx: float = 0.5
    cy: float = 0.5
    zoom: float = 1.0


@dataclass(frozen=True)
class Recorte:
    """Recorte de la página renderizada: caja (x0, y0, x1, y1) en puntos del PDF."""

    pagina: int
    caja: tuple[float, float, float, float]


# ---------------------------------------------------------------------------
# Dirección de arte (PDF 14-7-2026.pdf, 36 páginas de 613 × 860 pt)
# ---------------------------------------------------------------------------

# Foto de la tarjeta del catálogo, en 4:3: la tarjeta la muestra con object-fit: cover
# entre 1,3:1 y 2:1, así que lo importante va en la franja central.
TARJETAS: dict[str, Foto | Recorte] = {
    # Calendario verde sobre la mesa, con fibrones y stickers (1111 px de ancho).
    "calendarios": Foto(11, 9, cy=0.52),
    # Gatito sobre la cama, la foto de ejemplo del formato 13 × 18 (585 px).
    "fotos": Foto(13, 0, cy=0.6),
    # Pizarra colgada con polaroids, tiras, fotos y pinzas (617 px).
    "pizarra-orma": Foto(17, 7, cy=0.43),
    # Cuadro "Te amo" con verbenas prensadas (512 px).
    "entre-flores": Foto(20, 268, cy=0.42),
    # Pliego de stickers impresos y troquelados (369 px). Las cuatro fotos de la página
    # están separadas por papel y texto: un recorte más amplio no suma foto, solo margen.
    # Alternativa sin los códigos QR del cliente: índice 2 (brillo de la laca en blanco).
    "vinilos": Foto(23, 1, cy=0.5),
    # Tarjeta amarilla de StudioAGS sobre otras de colores (679 px).
    "tarjetas": Foto(26, 1, cy=0.5),
    # Las tapas no son fotos sueltas sino un mosaico sin juntas: dos filas de diseños de
    # la página 29 renderizadas a la densidad de las tapas (~299 dpi).
    "bitacoras": Recorte(29, (37.6, 136.4, 443.5, 440.85)),
    # Cada foto mide 364 px: recorte más amplio con dos fotos juntas de la página 34.
    "laminas": Recorte(34, (303.3, 101.1, 481.1, 234.5)),
}

# Polaroids del hero, en 4:5.
HERO: dict[str, Foto | Recorte] = {
    # La foto de ejemplo del formato polaroid (542 px).
    "fotos": Foto(13, 5, cx=0.56, cy=0.5),
    # Cuatro tapas de la página 30 (naranjas, chica con plantas, limones, gato negro).
    "bitacoras": Recorte(30, (37.6, 289, 252.6, 557.75)),
}

# Página de "Ver ficha" de cada producto (las mismas que usaba la web).
FICHAS: dict[str, int] = {
    "calendarios": 8,
    "fotos": 13,
    "pizarra-orma": 17,
    "entre-flores": 20,
    "vinilos": 23,
    "tarjetas": 26,
    "bitacoras": 29,
    "laminas": 34,
}

# Imagen para compartir: fotos en fila sobre el color del papel de la web, sin texto.
COMPARTIR: list[Foto] = [
    Foto(11, 9, cx=0.42, cy=0.56),  # calendario
    Foto(20, 268, cx=0.5, cy=0.5),  # Entre Flores
    Foto(26, 1, cx=0.62, cy=0.5),  # tarjetas
]

# ---------------------------------------------------------------------------

PAPEL = (0xFB, 0xF8, 0xF2)  # --paper de src/styles.css
DPI_PAGINA = 300
ANCHO_CHICO = 400
ANCHO_MAXIMO = 800
NECESIDAD_2X = 1040  # la tarjeta mide hasta 520 px CSS en una columna
ANCHOS_FICHA = (1200, 1800)
COMPARTIR_TAMANO = (1200, 630)
COMPARTIR_MARGEN = 48
COMPARTIR_ESPACIO = 24
COMPARTIR_MAXIMO_KB = 300
CALIDAD_WEBP = 80


@dataclass
class Fuente:
    imagen: Image.Image
    descripcion: str


def pixmap_a_imagen(pix: fitz.Pixmap) -> Image.Image:
    if pix.colorspace is None or pix.colorspace.n != 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    if pix.alpha:
        pix = fitz.Pixmap(pix, 0)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def recorte_proporcional(ancho: int, alto: int, proporcion: float, foto: Foto) -> tuple[int, int, int, int]:
    """Caja más grande con la proporción pedida, centrada en (cx, cy) y dentro de la foto."""
    w = min(ancho, alto * proporcion) / foto.zoom
    h = w / proporcion
    w, h = int(w), int(round(w / proporcion))
    if h > alto:
        h = alto
        w = int(h * proporcion)
    x0 = min(max(round(foto.cx * ancho - w / 2), 0), ancho - w)
    y0 = min(max(round(foto.cy * alto - h / 2), 0), alto - h)
    return x0, y0, x0 + w, y0 + h


def fuente_foto(doc: fitz.Document, foto: Foto, proporcion: float) -> Fuente:
    page = doc[foto.pagina - 1]
    imagenes = page.get_images(full=True)
    if foto.indice >= len(imagenes):
        raise SystemExit(f"La página {foto.pagina} tiene {len(imagenes)} imágenes; no existe la {foto.indice}.")
    xref = imagenes[foto.indice][0]
    original = pixmap_a_imagen(fitz.Pixmap(doc, xref))
    caja = recorte_proporcional(original.width, original.height, proporcion, foto)
    return Fuente(
        original.crop(caja),
        f"p{foto.pagina} foto {foto.indice} ({original.width}×{original.height})",
    )


def densidad_de_fotos(page: fitz.Page, caja: fitz.Rect) -> float | None:
    """La menor densidad (dpi) de las fotos que ocupan una parte apreciable de la caja."""
    densidades = []
    for info in page.get_image_info():
        rect = fitz.Rect(info["bbox"])
        comun = rect & caja
        if comun.is_empty or comun.get_area() < 0.02 * caja.get_area() or rect.width <= 0:
            continue
        densidades.append(info["width"] / rect.width * 72)
    return min(densidades) if densidades else None


def renderizar(page: fitz.Page, caja: fitz.Rect | None, dpi: float) -> Image.Image:
    zoom = dpi / 72
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=caja, alpha=False)
    return pixmap_a_imagen(pix)


def fuente_recorte(doc: fitz.Document, recorte: Recorte, proporcion: float) -> Fuente:
    page = doc[recorte.pagina - 1]
    caja = fitz.Rect(recorte.caja)
    dpi = min(DPI_PAGINA, densidad_de_fotos(page, caja) or DPI_PAGINA)
    imagen = renderizar(page, caja, dpi)
    # Se ajusta al centro a la proporción exacta; nunca se rellena.
    imagen = imagen.crop(recorte_proporcional(imagen.width, imagen.height, proporcion, Foto(0, 0)))
    return Fuente(imagen, f"p{recorte.pagina} recorte {recorte.caja} a {dpi:.0f} dpi")


def obtener(doc: fitz.Document, origen: Foto | Recorte, proporcion: float) -> Fuente:
    if isinstance(origen, Foto):
        return fuente_foto(doc, origen, proporcion)
    return fuente_recorte(doc, origen, proporcion)


def achicar(imagen: Image.Image, ancho: int, proporcion: float | None = None) -> Image.Image:
    alto = round(ancho / proporcion) if proporcion else round(ancho * imagen.height / imagen.width)
    if ancho > imagen.width or alto > imagen.height:
        raise AssertionError(f"Se intentó ampliar {imagen.size} a {ancho}×{alto}.")
    if (ancho, alto) == imagen.size:
        return imagen.copy()
    return imagen.resize((ancho, alto), Image.LANCZOS)


def anchos_de_foto(nativo: int) -> list[int]:
    return sorted({min(ANCHO_CHICO, nativo), min(ANCHO_MAXIMO, nativo)})


def guardar_webp(imagen: Image.Image, ruta: Path) -> None:
    imagen.save(ruta, "WEBP", quality=CALIDAD_WEBP, method=6)


def generar_foto(doc, origen, proporcion: float, base: str, salida: Path) -> dict:
    fuente = obtener(doc, origen, proporcion)
    nativo = fuente.imagen.width
    archivos = []
    for ancho in anchos_de_foto(nativo):
        imagen = achicar(fuente.imagen, ancho, proporcion)
        ruta = salida / f"{base}-{ancho}.webp"
        guardar_webp(imagen, ruta)
        archivos.append((ruta, imagen.size))
    return {"base": base, "fuente": fuente.descripcion, "nativo": nativo, "archivos": archivos}


def generar_ficha(doc, producto: str, pagina: int, salida: Path) -> dict:
    imagen = renderizar(doc[pagina - 1], None, DPI_PAGINA)
    archivos = []
    for ancho in ANCHOS_FICHA:
        achicada = achicar(imagen, ancho)
        ruta = salida / f"ficha-{producto}-{ancho}.webp"
        guardar_webp(achicada, ruta)
        archivos.append((ruta, achicada.size))
    return {"base": f"ficha-{producto}", "fuente": f"p{pagina} a {DPI_PAGINA} dpi", "nativo": imagen.width, "archivos": archivos}


def generar_compartir(doc, salida: Path) -> Path:
    ancho_total, alto_total = COMPARTIR_TAMANO
    n = len(COMPARTIR)
    ancho = (ancho_total - 2 * COMPARTIR_MARGEN - (n - 1) * COMPARTIR_ESPACIO) // n
    alto = alto_total - 2 * COMPARTIR_MARGEN
    lienzo = Image.new("RGB", COMPARTIR_TAMANO, PAPEL)
    sobrante = ancho_total - 2 * COMPARTIR_MARGEN - (n - 1) * COMPARTIR_ESPACIO - n * ancho
    x = COMPARTIR_MARGEN + sobrante // 2
    for foto in COMPARTIR:
        fuente = fuente_foto(doc, foto, ancho / alto)
        # Si la foto no alcanza para el cuadro, falla: hay que achicar el cuadro, no ampliarla.
        if fuente.imagen.width < ancho or fuente.imagen.height < alto:
            raise AssertionError(f"{fuente.descripcion} no alcanza para un cuadro de {ancho}×{alto}.")
        lienzo.paste(fuente.imagen.resize((ancho, alto), Image.LANCZOS), (x, COMPARTIR_MARGEN))
        x += ancho + COMPARTIR_ESPACIO
    ruta = salida / "compartir.jpg"
    for calidad in (85, 80, 75, 70, 65, 60):
        lienzo.save(ruta, "JPEG", quality=calidad, optimize=True, progressive=True)
        if ruta.stat().st_size < COMPARTIR_MAXIMO_KB * 1024:
            break
    else:
        raise SystemExit("compartir.jpg no baja de 300 KB.")
    return ruta


def validar_pagina(doc: fitz.Document, pagina: int, origen: str) -> None:
    if not 1 <= pagina <= doc.page_count:
        raise SystemExit(f"{origen}: la página {pagina} no existe; el PDF tiene de la 1 a la {doc.page_count}.")


def listar(doc: fitz.Document, pagina: int) -> None:
    validar_pagina(doc, pagina, "--listar")
    page = doc[pagina - 1]
    for indice, imagen in enumerate(page.get_images(full=True)):
        xref, _, ancho, alto = imagen[:4]
        for rect in page.get_image_rects(xref):
            dpi = ancho / rect.width * 72 if rect.width else 0
            print(
                f"índice {indice:3d}  {ancho}×{alto} px  en ({rect.x0:.0f}, {rect.y0:.0f}, "
                f"{rect.x1:.0f}, {rect.y1:.0f}) pt  ~{dpi:.0f} dpi"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera las imágenes de la tienda desde el PDF del catálogo.")
    parser.add_argument("pdf", type=Path, help="ruta al PDF original del catálogo")
    parser.add_argument(
        "salida", type=Path, nargs="?", default=Path(__file__).parent / "public" / "images", help="carpeta de salida"
    )
    parser.add_argument("--listar", type=int, metavar="PAGINA", help="lista las imágenes embebidas de una página")
    args = parser.parse_args()

    if not args.pdf.is_file():
        raise SystemExit(f"No existe el PDF {args.pdf}.")
    doc = fitz.open(args.pdf)
    if args.listar is not None:
        listar(doc, args.listar)
        return
    if not args.salida.is_dir():
        raise SystemExit(f"No existe la carpeta {args.salida}.")

    # Antes de escribir nada: cada página de la dirección de arte tiene que existir en este PDF.
    paginas = [
        *((f"TARJETAS[{producto!r}]", origen.pagina) for producto, origen in TARJETAS.items()),
        *((f"HERO[{producto!r}]", origen.pagina) for producto, origen in HERO.items()),
        *((f"FICHAS[{producto!r}]", pagina) for producto, pagina in FICHAS.items()),
        *((f"COMPARTIR[{indice}]", foto.pagina) for indice, foto in enumerate(COMPARTIR)),
    ]
    for origen, pagina in paginas:
        validar_pagina(doc, pagina, origen)

    tarjetas = {producto: generar_foto(doc, origen, 4 / 3, producto, args.salida) for producto, origen in TARJETAS.items()}
    heroes = {producto: generar_foto(doc, origen, 4 / 5, f"hero-{producto}", args.salida) for producto, origen in HERO.items()}
    fichas = {producto: generar_ficha(doc, producto, pagina, args.salida) for producto, pagina in FICHAS.items()}
    compartir = generar_compartir(doc, args.salida)

    print(f"Tarjetas (a 2× piden ~{NECESIDAD_2X} px; nunca salen de más de {ANCHO_MAXIMO} px):")
    for producto, dato in tarjetas.items():
        nativo = dato["nativo"]
        cubre = "cubre 2×" if nativo >= NECESIDAD_2X else f"no cubre 2× ({nativo / (NECESIDAD_2X / 2):.2f}×)"
        anchos = ", ".join(f"{w}×{h}" for _, (w, h) in dato["archivos"])
        print(f"  {producto:13s} {dato['fuente']:48s} recorte {nativo:4d} px de {NECESIDAD_2X}: {cubre:22s} -> {anchos}")
    print("Hero (polaroid principal ~260 px CSS, chica ~160 px CSS):")
    for producto, dato in heroes.items():
        anchos = ", ".join(f"{w}×{h}" for _, (w, h) in dato["archivos"])
        print(f"  {producto:13s} {dato['fuente']:48s} recorte {dato['nativo']:4d} px -> {anchos}")
    print("Fichas:")
    for producto, dato in fichas.items():
        anchos = ", ".join(f"{w}×{h}" for _, (w, h) in dato["archivos"])
        print(f"  {producto:13s} {dato['fuente']:48s} -> {anchos}")
    print(f"Compartir: {compartir.name} {COMPARTIR_TAMANO[0]}×{COMPARTIR_TAMANO[1]}, {compartir.stat().st_size / 1024:.0f} KB")

    total = sum(
        ruta.stat().st_size
        for grupo in (tarjetas, heroes, fichas)
        for dato in grupo.values()
        for ruta, _ in dato["archivos"]
    ) + compartir.stat().st_size
    print(f"Peso total: {total / 1024:.0f} KB")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    main()
