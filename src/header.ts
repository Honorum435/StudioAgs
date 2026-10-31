import { windowOf } from "./dom";

// Encabezado: el menú desplegable del celu y el buscador. El menú se abre con el botón y se
// cierra con Escape, tocando afuera, eligiendo un enlace o al pasar a la compu, donde el menú
// siempre está a la vista. El buscador lleva a productos/?q=, que catalog-view.ts lee al montar.

const OPEN = "is-menu-open";
const DESKTOP = "(min-width: 768px)";

export function mountHeader(header: HTMLElement): () => void {
  const win = windowOf(header);
  const doc = header.ownerDocument;
  const toggle = header.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  const menu = header.querySelector<HTMLElement>(".header-menu");
  const search = header.querySelector<HTMLFormElement>("[data-header-search]");

  function setOpen(open: boolean, { focusToggle = false } = {}): void {
    header.classList.toggle(OPEN, open);
    toggle?.setAttribute("aria-expanded", String(open));
    toggle?.querySelector(".visually-hidden")?.replaceChildren(open ? "Cerrar menú" : "Menú");
    if (open) {
      menu?.querySelector<HTMLInputElement>("input[type='search']")?.focus({ preventScroll: true });
    } else if (focusToggle) {
      toggle?.focus({ preventScroll: true });
    }
  }

  const isOpen = () => header.classList.contains(OPEN);

  function onToggle(): void {
    setOpen(!isOpen());
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false, { focusToggle: true });
    }
  }

  function onPointerDown(event: PointerEvent): void {
    const target = event.target instanceof Node ? event.target : null;
    if (isOpen() && target && !menu?.contains(target) && !toggle?.contains(target)) {
      setOpen(false);
    }
  }

  function onMenuClick(event: MouseEvent): void {
    if (event.target instanceof Element && event.target.closest("a[href]")) {
      setOpen(false);
    }
  }

  function onResize(): void {
    if (isOpen() && typeof win.matchMedia === "function" && win.matchMedia(DESKTOP).matches) {
      setOpen(false);
    }
  }

  // La CSP no deja enviar formularios: la dirección se arma acá y relativa al <base> de la página.
  function onSearch(event: SubmitEvent): void {
    event.preventDefault();
    if (!search) {
      return;
    }
    const query = search.querySelector<HTMLInputElement>("input[name='q']")?.value.trim() ?? "";
    const url = new URL(search.getAttribute("action") ?? "productos/", doc.baseURI);
    if (query) {
      url.searchParams.set("q", query);
    }
    win.location.assign(url.href);
  }

  toggle?.addEventListener("click", onToggle);
  menu?.addEventListener("click", onMenuClick);
  search?.addEventListener("submit", onSearch);
  doc.addEventListener("keydown", onKeyDown);
  doc.addEventListener("pointerdown", onPointerDown);
  win.addEventListener("resize", onResize);
  header.classList.add("has-menu");

  return () => {
    toggle?.removeEventListener("click", onToggle);
    menu?.removeEventListener("click", onMenuClick);
    search?.removeEventListener("submit", onSearch);
    doc.removeEventListener("keydown", onKeyDown);
    doc.removeEventListener("pointerdown", onPointerDown);
    win.removeEventListener("resize", onResize);
    header.classList.remove("has-menu", OPEN);
  };
}
