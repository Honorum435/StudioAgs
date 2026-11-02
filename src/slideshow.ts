import { windowOf } from "./dom";

// Fotos que se van pasando solas, una por vez, como las de Preguntas frecuentes. El fundido lo
// hace styles.css con la clase is-current. El botón las frena y las vuelve a pasar; con "reducir
// movimiento" arrancan quietas y se pasan solo si la persona toca el botón.

export const SLIDE_INTERVAL = 4500;
const CURRENT = "is-current";

export function mountSlideshow(show: HTMLElement): () => void {
  const win = windowOf(show);
  const slides = [...show.querySelectorAll<HTMLElement>(".slideshow-slide")];
  const toggle = show.querySelector<HTMLButtonElement>("[data-slideshow-toggle]");
  if (slides.length < 2 || !toggle) {
    return () => {};
  }

  let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains(CURRENT)));
  let timer: number | undefined;

  function next(): void {
    slides[current].classList.remove(CURRENT);
    current = (current + 1) % slides.length;
    slides[current].classList.add(CURRENT);
  }

  function setPlaying(playing: boolean): void {
    win.clearInterval(timer);
    timer = playing ? win.setInterval(next, SLIDE_INTERVAL) : undefined;
    toggle!.setAttribute("aria-pressed", String(!playing));
  }

  const onToggle = () => setPlaying(timer === undefined);
  toggle.addEventListener("click", onToggle);
  toggle.hidden = false;
  const reduced = typeof win.matchMedia === "function" && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setPlaying(!reduced);

  return () => {
    win.clearInterval(timer);
    toggle.removeEventListener("click", onToggle);
  };
}
