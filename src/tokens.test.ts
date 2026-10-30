import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Declaration {
  property: string;
  value: string;
}

interface CssRule {
  selector: string;
  // At-rules que envuelven la regla, de afuera hacia adentro.
  context: string[];
  declarations: Declaration[];
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
  // Color opaco que queda debajo cuando el fondo es translúcido.
  base?: string;
  min: number;
}

const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
  burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
  darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro
  ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
  lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
  mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
  mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace
  olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred
  papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
  saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey
  snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
  yellowgreen`.split(/\s+/),
);

function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const stack: Array<{ prelude: string; declarations: string[] }> = [];
  let buffer = "";
  let quote = "";
  let parens = 0;

  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (quote) {
      buffer += char;
      if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      parens += 1;
    } else if (char === ")") {
      parens -= 1;
    } else if (parens === 0 && char === "{") {
      stack.push({ prelude: buffer.trim(), declarations: [] });
      buffer = "";
      continue;
    } else if (parens === 0 && char === ";") {
      const block = stack[stack.length - 1];
      if (block && buffer.trim()) {
        block.declarations.push(buffer.trim());
      }
      buffer = "";
      continue;
    } else if (parens === 0 && char === "}") {
      const block = stack.pop();
      if (!block) {
        throw new Error("Hay una llave de cierre sin abrir.");
      }
      if (buffer.trim()) {
        block.declarations.push(buffer.trim());
      }
      buffer = "";
      if (block.declarations.length > 0) {
        rules.push({
          selector: block.prelude,
          context: stack.map((parent) => parent.prelude),
          declarations: block.declarations.map(parseDeclaration),
        });
      }
      continue;
    }
    buffer += char;
  }

  if (stack.length > 0) {
    throw new Error(`Quedó sin cerrar el bloque "${stack[stack.length - 1].prelude}".`);
  }
  return rules;
}

function parseDeclaration(text: string): Declaration {
  const colon = text.indexOf(":");
  if (colon < 0) {
    throw new Error(`No es una declaración: "${text}".`);
  }
  const property = text.slice(0, colon).trim();
  return {
    property: property.startsWith("--") ? property : property.toLowerCase(),
    value: text.slice(colon + 1).trim(),
  };
}

function describeRule(rule: CssRule): string {
  return [...rule.context, rule.selector].join(" ");
}

function readTokens(rules: CssRule[]): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const rule of rules) {
    if (rule.selector !== ":root" || rule.context.length > 0) {
      continue;
    }
    for (const { property, value } of rule.declarations) {
      if (property.startsWith("--")) {
        tokens.set(property, value);
      }
    }
  }
  return tokens;
}

function resolveValue(value: string, tokens: Map<string, string>, seen: string[] = []): string {
  return value.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
    (_match, name: string, fallback: string | undefined) => {
      if (seen.includes(name)) {
        throw new Error(`Referencia circular entre tokens: ${[...seen, name].join(" → ")}.`);
      }
      const raw = tokens.get(name) ?? fallback;
      if (raw === undefined) {
        throw new Error(`El token ${name} no está definido en :root.`);
      }
      return resolveValue(raw.trim(), tokens, [...seen, name]);
    },
  );
}

function parseColor(value: string): Rgba {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    const channel = (index: number) => parseInt(digits.slice(index, index + 2), 16);
    return { r: channel(0), g: channel(2), b: channel(4), a: digits.length === 8 ? channel(6) / 255 : 1 };
  }

  const rgb = /^rgba?\(([^)]*)\)$/.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b] = parts.slice(0, 3).map((part) => (part.endsWith("%") ? parseFloat(part) * 2.55 : parseFloat(part)));
    const alpha = parts[3];
    const a = alpha === undefined ? 1 : alpha.endsWith("%") ? parseFloat(alpha) / 100 : parseFloat(alpha);
    if (parts.length >= 3 && ![r, g, b, a].some(Number.isNaN)) {
      return { r, g, b, a };
    }
  }

  throw new Error(`La guardia no reconoce el color "${value}".`);
}

function composite(top: Rgba, bottom: Rgba): Rgba {
  if (bottom.a < 1) {
    throw new Error("El color de abajo tiene que ser opaco.");
  }
  const mix = (front: number, back: number) => front * top.a + back * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function relativeLuminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(foreground: Rgba, background: Rgba): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function toCss(value: string): string {
  return value.startsWith("--") ? `var(${value})` : value;
}

function measurePair(pair: ContrastPair, tokens: Map<string, string>): number {
  const color = (value: string) => parseColor(resolveValue(toCss(value), tokens));
  let background = color(pair.background);
  if (background.a < 1) {
    if (!pair.base) {
      throw new Error(`${pair.name}: el fondo es translúcido y falta el color que queda debajo.`);
    }
    background = composite(background, color(pair.base));
  }
  return contrastRatio(composite(color(pair.foreground), background), background);
}

function findContrastFailures(pairs: ContrastPair[], tokens: Map<string, string>): string[] {
  return pairs.flatMap((pair) => {
    const ratio = measurePair(pair, tokens);
    return ratio >= pair.min
      ? []
      : [`${pair.name}: ${pair.foreground} sobre ${pair.background} da ${ratio.toFixed(2)}:1 (mínimo ${pair.min}:1)`];
  });
}

function colorLiterals(value: string): string[] {
  const text = value.replace(/"[^"]*"|'[^']*'/g, " ").replace(/url\([^)]*\)/gi, " ");
  const hexes = text.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
  const functions = text.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/gi) ?? [];
  const names = (text.match(/(?<![\w-])-{0,2}[a-z_][\w-]*/gi) ?? []).filter((word) =>
    NAMED_COLORS.has(word.toLowerCase()),
  );
  return [...hexes, ...functions, ...names];
}

// Los colores viven en :root; @font-face no pinta nada.
function findColorLiterals(rules: CssRule[]): string[] {
  return rules
    .filter((rule) => rule.selector !== ":root" && !rule.selector.startsWith("@font-face"))
    .flatMap((rule) =>
      rule.declarations
        .filter(({ value }) => colorLiterals(value).length > 0)
        .map(({ property, value }) => `${describeRule(rule)} → ${property}: ${value}`),
    );
}

const text = (name: string, foreground: string, background: string, base?: string): ContrastPair => ({
  name,
  foreground,
  background,
  base,
  min: 4.5,
});

const nonText = (name: string, foreground: string, background: string): ContrastPair => ({
  name,
  foreground,
  background,
  min: 3,
});

// Cada unidad que sume una superficie o un estado nuevo agrega acá sus pares.
const textPairs: ContrastPair[] = [
  text("texto general y del panel sobre papel", "--ink", "--paper"),
  text("títulos, campos y botón de sumar sobre la tarjeta", "--ink", "--surface"),
  text("títulos de los pasos", "--ink", "--surface-soft"),
  text("título de Cómo comprar", "--ink", "--sand-deep"),
  text("sticker lavanda", "--ink", "--lavender"),
  text("sticker verde", "--ink", "--green"),
  text("enlace para saltar al catálogo", "--ink", "--white"),
  text("franja de valores", "--ink-soft", "--lavender"),
  text("aviso sin JavaScript", "--ink-soft", "--sand"),
  text("enlace a Instagram del aviso sin JavaScript", "--coral-dark", "--sand"),
  text("franja de confianza y medios de pago", "--ink-soft", "--paper"),
  text("respuestas del bloque de confianza", "--muted", "--paper"),
  text("categoría sobre una foto oscura", "--ink-soft", "--surface-veil", "#000000"),
  text("enlace del pie y cantidades del pedido", "--ink-soft", "--paper"),
  text("navegación, filtros y botón del pedido inactivo", "--ink-mid", "--paper"),
  text("leyendas de opciones y controles inactivos de la tarjeta", "--ink-mid", "--surface"),
  text("contador del pedido vacío y botón principal inactivo", "--ink-mid", "--sand-dark"),
  text("texto secundario sobre papel", "--muted", "--paper"),
  text("descripción, nota y buscador sobre la tarjeta", "--muted", "--surface"),
  text("texto de los pasos", "--muted", "--surface-soft"),
  text("epígrafe de la foto principal", "--muted", "--white"),
  text("volantas, acentos y enlaces coral sobre papel", "--coral-dark", "--paper"),
  text("precio de la tarjeta e instrucciones de fotos al pasar", "--coral-dark", "--surface"),
  text("volanta de Cómo comprar", "--coral-dark", "--sand-deep"),
  text("números de los pasos", "--coral-dark", "--surface-soft"),
  text("botones oscuros, filtro activo y aviso", "--white", "--ink"),
  text("botón principal al pasar y número del contador", "--white", "--coral-dark"),
  text("texto seleccionado", "--ink", "--yellow-soft"),
  text("plazo de la tarjeta y cantidad de la barra fija", "--ink-soft", "--surface"),
  text("barra fija del pedido", "--ink", "--surface"),
  text("mensajes dentro de la ficha", "--ink-soft", "--photo-bg"),
  text("indicación para ampliar la ficha", "--muted", "--paper"),
  text("botón cuadrado al pasar", "--ink", "--blush"),
  text("filtro, opción, adicional y botón cuadrado al tocar", "--ink", "--blush-deep"),
  text("precio del adicional al tocar", "--muted", "--blush-deep"),
  text("adicional al pasar", "--ink", "--blush"),
  text("precio del adicional al pasar", "--muted", "--blush"),
  text("botón de texto al tocar", "--coral-dark", "--blush"),
  text("aviso de restauración del pedido", "--ink-soft", "--sand"),
  text("título del aviso de restauración", "--ink", "--sand"),
  text("Entendido del aviso de restauración", "--coral-dark", "--sand"),
  text("nota del botón del pedido y mensajes de error de los campos", "--coral-dark", "--paper"),
  text("campos y cantidades del pedido", "--ink", "--surface"),
  text("etiquetas opcionales, ayudas y contador de los campos", "--muted", "--paper"),
  text("instrucciones de fotos del pedido", "--muted", "--surface-soft"),
  text("título de las instrucciones de fotos del pedido", "--ink", "--surface-soft"),
  text("aviso de que se abre WhatsApp y pregunta de si se envió", "--ink", "--green"),
  text("aviso de envío por WhatsApp sin configurar", "--ink", "--yellow-soft"),
  text("nota de la barra fija con aviso", "--coral-dark", "--surface"),
  text("botón secundario del pedido", "--ink", "--paper"),
  text("botón secundario del pedido al pasar", "--ink", "--blush"),
  text("botón secundario del pedido al tocar", "--ink", "--blush-deep"),
  text("botones de cantidad inactivos", "--ink-mid", "--surface"),
  text("opción elegida sobre el indicador deslizante", "--white", "--ink"),
  text("opciones sin elegir junto al indicador deslizante", "--ink", "--surface"),
  text("etiqueta ¡Sumado! del botón de sumar", "--ink", "--surface"),
  text("texto de la franja de pedidos personalizados", "--white", "--coral-dark"),
  text("volanta de pedidos personalizados", "--yellow", "--coral-dark"),
  text("botón de pedidos personalizados", "--ink", "--yellow"),
  text("botón de pedidos personalizados al pasar y al tocar", "--ink", "--white"),
];

const nonTextPairs: ContrastPair[] = [
  nonText("borde de control sobre papel", "--control-border", "--paper"),
  nonText("borde de control sobre la tarjeta", "--control-border", "--surface"),
  nonText("borde del botón principal sobre papel", "--ink", "--paper"),
  nonText("contador del pedido sobre el encabezado", "--coral-dark", "--paper"),
  nonText("anillo de foco sobre papel", "--focus-ring", "--paper"),
  nonText("anillo de foco sobre la franja azul", "--white", "--coral-dark"),
  nonText("anillo de foco sobre la tarjeta y la barra fija", "--focus-ring", "--surface"),
  nonText("anillo de foco dentro de la ficha", "--focus-ring", "--photo-bg"),
  nonText("botón de la barra fija sobre su fondo", "--ink", "--surface"),
  nonText("borde de campo con error sobre el campo", "--coral-dark", "--surface"),
  nonText("borde de campo con error sobre papel", "--coral-dark", "--paper"),
  nonText("borde del botón secundario sobre papel", "--ink", "--paper"),
  nonText("anillo del contador cuando hay avisos", "--coral-dark", "--paper"),
  nonText("borde del aviso de restauración", "--coral-dark", "--sand"),
  nonText("indicador deslizante de la opción elegida sobre la tarjeta", "--ink", "--surface"),
];

const stylesheet = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const rules = parseRules(stylesheet);
const tokens = readTokens(rules);

describe("guardia de contraste", () => {
  it.each(textPairs)("texto: $name llega a 4,5:1", (pair) => {
    expect(findContrastFailures([pair], tokens)).toEqual([]);
  });

  it.each(nonTextPairs)("borde o forma: $name llega a 3:1", (pair) => {
    expect(findContrastFailures([pair], tokens)).toEqual([]);
  });

  it("mide igual que la fórmula de WCAG", () => {
    expect(contrastRatio(parseColor("#000"), parseColor("#ffffff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor("#827a72"), parseColor("#fbf8f2"))).toBeCloseTo(3.98, 2);
  });

  it("marcaría #827a72 sobre papel nombrando el par", () => {
    const failures = findContrastFailures([text("nota de precios", "#827a72", "--paper")], tokens);

    expect(failures).toEqual(["nota de precios: #827a72 sobre --paper da 4.11:1 (mínimo 4.5:1)"]);
  });

  it("marcaría el badge con texto blanco sobre el coral claro", () => {
    expect(findContrastFailures([text("número del contador", "--white", "--coral")], tokens)).toHaveLength(1);
  });
});

describe("colores escritos a mano", () => {
  it("no hay colores literales fuera de :root", () => {
    expect(findColorLiterals(rules)).toEqual([]);
  });

  it("cada var() de la hoja apunta a un token definido", () => {
    const broken = rules.flatMap((rule) =>
      rule.declarations.flatMap(({ property, value }) => {
        try {
          resolveValue(value, tokens);
          return [];
        } catch (error) {
          return [`${describeRule(rule)} → ${property}: ${(error as Error).message}`];
        }
      }),
    );

    expect(broken).toEqual([]);
  });

  it("marca un color literal en una regla, con su selector", () => {
    expect(findColorLiterals(parseRules(".x{color:#827a72}"))).toEqual([".x → color: #827a72"]);
  });

  it("marca rgb(), hsl() y nombres de color, también dentro de @media y en sombras", () => {
    const css = `
      .a { background: rgb(0 0 0); }
      @media (max-width: 680px) { .b { border-color: hsl(0 0% 0%); } }
      .c { color: white; }
      .d { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
    `;

    expect(findColorLiterals(parseRules(css))).toEqual([
      ".a → background: rgb(0 0 0)",
      "@media (max-width: 680px) .b → border-color: hsl(0 0% 0%)",
      ".c → color: white",
      ".d → box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2)",
    ]);
  });

  it("acepta tokens, transparent, currentColor, inherit, :root y @font-face", () => {
    const css = `
      :root { --x: #ffffff; color: #000000; }
      @font-face { font-family: "Fallback"; src: local("Arial"); }
      .a { color: var(--x); background: transparent; border-color: currentColor; fill: inherit; }
      .b { white-space: nowrap; font-family: "Coral Sans", serif; animation: drawer-in 220ms ease-out; }
    `;

    expect(findColorLiterals(parseRules(css))).toEqual([]);
  });
});
