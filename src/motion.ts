// Microinteracciones: el movimiento lo hace styles.css y este módulo solo cambia clases y variables.
// Con "reducir movimiento" todo llega al estado final al instante: sin fases, sin clases de
// animación y con desplazamiento instantáneo. No toca el DOM al importarse.

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

// Cuánto queda "¡Sumado!" antes de volver a "Sumar".
export const SWAP_HOLD = 1400;
// Respaldo de --text-swap-dur si la hoja no lo define.
export const SWAP_DURATION = 150;
// Inclinación máxima de las polaroids, en grados, en los bordes.
const TILT_MAX = 8;

const EXIT = "is-exit";
const ENTER = "is-enter-start";
const BUMP = "is-bumping";
const SNAP = "is-snapping";
const WITH_PILL = "has-pill";

function windowOf(node: Node): Window & typeof globalThis {
  return node.ownerDocument?.defaultView ?? window;
}

function matches(win: Window, query: string): boolean {
  return typeof win.matchMedia === "function" && win.matchMedia(query).matches;
}

// Se consulta en cada uso: si la persona cambia la preferencia, vale desde el próximo gesto.
export function prefersReducedMotion(win: Window = window): boolean {
  return matches(win, REDUCED_MOTION);
}

function cssTime(element: Element, name: string, fallback: number): number {
  const win = windowOf(element);
  const raw = win.getComputedStyle(element.ownerDocument.documentElement).getPropertyValue(name).trim();
  const time = /^(\d*\.?\d+)(ms|s)$/.exec(raw);
  return time ? parseFloat(time[1]) * (time[2] === "s" ? 1000 : 1) : fallback;
}

function forceReflow(element: HTMLElement): void {
  void element.offsetWidth;
}

interface Swap {
  rest: string;
  timer: number | null;
}

const swaps = new WeakMap<HTMLElement, Swap>();

// text-states-swap: la etiqueta sale hacia arriba, cambia y entra desde abajo; después de `hold`
// vuelve a su texto de reposo igual. Repetirlo durante la espera solo la alarga.
export function swapText(label: HTMLElement, text: string, hold = SWAP_HOLD): void {
  const win = windowOf(label);
  const swap = swaps.get(label) ?? { rest: label.textContent ?? "", timer: null };
  swaps.set(label, swap);
  if (swap.timer !== null) {
    win.clearTimeout(swap.timer);
    swap.timer = null;
  }

  function later(delay: number, step: () => void): void {
    swap.timer = win.setTimeout(() => {
      swap.timer = null;
      // Si la tarjeta volvió a pintar el botón, la etiqueta nueva ya muestra el reposo.
      if (label.isConnected) {
        step();
      } else {
        swaps.delete(label);
      }
    }, delay);
  }

  function change(next: string, done: () => void): void {
    if (prefersReducedMotion(win)) {
      label.classList.remove(EXIT, ENTER);
      label.textContent = next;
      done();
      return;
    }
    if (label.textContent === next) {
      label.classList.remove(EXIT);
      done();
      return;
    }
    label.classList.add(EXIT);
    later(cssTime(label, "--text-swap-dur", SWAP_DURATION), () => {
      label.textContent = next;
      label.classList.remove(EXIT);
      label.classList.add(ENTER);
      forceReflow(label);
      label.classList.remove(ENTER);
      done();
    });
  }

  change(text, () => later(hold, () => change(swap.rest, () => swaps.delete(label))));
}

const bumpable = new WeakSet<HTMLElement>();

// notification-badge: el contador vuelve a entrar. Dos seguidos reinician la animación.
export function bumpBadge(badge: HTMLElement): void {
  badge.classList.remove(BUMP);
  if (prefersReducedMotion(windowOf(badge))) {
    return;
  }
  if (!bumpable.has(badge)) {
    bumpable.add(badge);
    const settle = (event: AnimationEvent) => {
      const running = typeof badge.getAnimations === "function" ? badge.getAnimations().length : 0;
      if (event.target === badge && running === 0) {
        badge.classList.remove(BUMP);
      }
    };
    badge.addEventListener("animationend", settle);
    badge.addEventListener("animationcancel", settle);
  }
  forceReflow(badge);
  badge.classList.add(BUMP);
}

// number-pop-in: los caracteres entran desde abajo y los dos últimos llegan un poco después.
// Lectores y textContent leen el span oculto; los dígitos animados salen de data-char.
export function popNumber(element: HTMLElement, text: string): void {
  if (prefersReducedMotion(windowOf(element))) {
    element.textContent = text;
    return;
  }
  const doc = element.ownerDocument;
  const spoken = doc.createElement("span");
  spoken.className = "visually-hidden";
  spoken.textContent = text;
  const group = doc.createElement("span");
  group.className = "digit-group is-animating";
  group.setAttribute("aria-hidden", "true");
  const chars = Array.from(text);
  chars.forEach((char, index) => {
    const digit = doc.createElement("span");
    digit.className = "digit";
    digit.dataset.char = char;
    const fromEnd = chars.length - index;
    if (fromEnd <= 2) {
      digit.dataset.stagger = String(3 - fromEnd);
    }
    group.append(digit);
  });
  // Al terminar (o si se corta, por ejemplo al cerrar el panel) queda el texto simple.
  const settle = (event: AnimationEvent) => {
    if ((event.type === "animationcancel" || event.target === group.lastElementChild) && group.isConnected) {
      element.textContent = text;
    }
  };
  group.addEventListener("animationend", settle);
  group.addEventListener("animationcancel", settle);
  element.replaceChildren(spoken, group);
}

export interface SlidingIndicator {
  update(animate?: boolean): void;
  destroy(): void;
}

// tabs-sliding: la opción elegida se marca con una pieza que se desliza, solo si todas las
// opciones del grupo entran en una línea; si pasan a otra línea queda el estilo fijo.
export function slidingIndicator(list: HTMLElement): SlidingIndicator {
  const win = windowOf(list);
  const pill = list.ownerDocument.createElement("span");
  pill.className = "option-pill";
  pill.setAttribute("aria-hidden", "true");
  list.prepend(pill);

  const chips = () => Array.from(list.querySelectorAll<HTMLElement>(".option-chip"));
  let shown = false;

  function update(animate = false): void {
    // Tarjeta oculta por un filtro: el ResizeObserver avisa cuando vuelve a verse.
    if (list.offsetWidth === 0) {
      return;
    }
    const items = chips();
    const singleLine = items.length > 1 && items.every((chip) => chip.offsetTop === items[0].offsetTop);
    const selected = items.find((chip) => chip.querySelector<HTMLInputElement>("input")?.checked);
    const show = singleLine && selected !== undefined;
    list.classList.toggle(WITH_PILL, show);
    if (!show || !selected) {
      shown = false;
      return;
    }
    const snap = !animate || !shown || prefersReducedMotion(win);
    if (snap) {
      pill.classList.add(SNAP);
    }
    pill.style.setProperty("--pill-x", `${selected.offsetLeft}px`);
    pill.style.setProperty("--pill-y", `${selected.offsetTop}px`);
    pill.style.setProperty("--pill-w", `${selected.offsetWidth}px`);
    pill.style.setProperty("--pill-h", `${selected.offsetHeight}px`);
    if (snap) {
      forceReflow(pill);
      pill.classList.remove(SNAP);
    }
    shown = true;
  }

  const observer = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(() => update()) : null;
  observer?.observe(list);
  chips().forEach((chip) => observer?.observe(chip));
  update();

  return {
    update,
    destroy() {
      observer?.disconnect();
      pill.remove();
      list.classList.remove(WITH_PILL);
    },
  };
}

// card-tilt: las polaroids se inclinan hacia el puntero con un reflejo, solo con mouse. El
// puntero se sigue sobre el contenedor, que no se inclina, así los bordes no parpadean.
export function tilt(area: HTMLElement, selector = ".hero-photo"): () => void {
  const win = windowOf(area);
  // La de arriba primero: la chica tapa a la grande donde se cruzan.
  const photos = Array.from(area.querySelectorAll<HTMLElement>(selector)).reverse();

  function rest(photo: HTMLElement): void {
    if (!photo.classList.contains("is-hover")) {
      return;
    }
    photo.classList.remove("is-hover", "is-tilting");
    photo.style.setProperty("--tilt-rx", "0deg");
    photo.style.setProperty("--tilt-ry", "0deg");
  }

  function restAll(): void {
    photos.forEach(rest);
  }

  function onMove(event: PointerEvent): void {
    if (event.pointerType !== "mouse" || !matches(win, FINE_POINTER) || prefersReducedMotion(win)) {
      restAll();
      return;
    }
    // Medidas sin transformar: las del contenedor escalado se pasan a su tamaño de diseño.
    const box = area.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) {
      return;
    }
    const x = ((event.clientX - box.left) * area.offsetWidth) / box.width;
    const y = ((event.clientY - box.top) * area.offsetHeight) / box.height;
    const target = photos.find(
      (photo) =>
        x >= photo.offsetLeft &&
        x <= photo.offsetLeft + photo.offsetWidth &&
        y >= photo.offsetTop &&
        y <= photo.offsetTop + photo.offsetHeight,
    );
    photos.forEach((photo) => {
      if (photo !== target) {
        rest(photo);
      }
    });
    if (!target) {
      return;
    }
    const px = (x - target.offsetLeft) / target.offsetWidth;
    const py = (y - target.offsetTop) / target.offsetHeight;
    target.classList.add("is-hover", "is-tilting");
    target.style.setProperty("--tilt-ry", `${((px - 0.5) * TILT_MAX).toFixed(2)}deg`);
    target.style.setProperty("--tilt-rx", `${((0.5 - py) * TILT_MAX).toFixed(2)}deg`);
    target.style.setProperty("--tilt-gx", `${(px * 100).toFixed(1)}%`);
    target.style.setProperty("--tilt-gy", `${(py * 100).toFixed(1)}%`);
  }

  area.addEventListener("pointermove", onMove);
  area.addEventListener("pointerleave", restAll);
  return () => {
    area.removeEventListener("pointermove", onMove);
    area.removeEventListener("pointerleave", restAll);
    restAll();
  };
}

// Desplazamiento suave, o instantáneo con "reducir movimiento".
export function scrollToTarget(target: Element | null | undefined, options: ScrollIntoViewOptions = {}): void {
  if (!target || typeof target.scrollIntoView !== "function") {
    return;
  }
  const behavior: ScrollBehavior = prefersReducedMotion(windowOf(target)) ? "instant" : "smooth";
  target.scrollIntoView({ ...options, behavior });
}

function noop(): void {}

// Safari de iOS solo aplica :active si hay un oyente de touchstart en el camino del toque.
export function enableTouchActive(doc: Document = document): void {
  doc.addEventListener("touchstart", noop, { passive: true });
}
