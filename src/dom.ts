// Ayudas compartidas por las vistas: delegación de data-action, región viva y escrituras que
// solo tocan el DOM si el valor cambió. No toca el DOM al importarse.

export type ActionHandler = (element: HTMLElement, event: MouseEvent) => void;

export function windowOf(node: Node): Window & typeof globalThis {
  return node.ownerDocument?.defaultView ?? window;
}

// Un solo oyente de clic en la raíz y un manejador por data-action. Los botones deshabilitados no
// responden; los que tienen aria-disabled sí, para que la vista explique por qué no hacen nada.
export function delegateActions(root: HTMLElement, actions: Readonly<Record<string, ActionHandler>>): () => void {
  function onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const element = target?.closest<HTMLElement>("[data-action]");
    const handler = element ? actions[element.dataset.action ?? ""] : undefined;
    if (!element || !handler || (element instanceof HTMLButtonElement && element.disabled)) {
      return;
    }
    handler(element, event);
  }
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

// El mismo texto dos veces seguidas no se vuelve a leer: se alterna un espacio duro al final.
export function announceTo(region: HTMLElement | null | undefined, message: string): void {
  if (region) {
    region.textContent = region.textContent === message ? `${message} ` : message;
  }
}

// Pone el atributo o, con null, lo saca.
export function setAttr(element: Element | null | undefined, name: string, value: string | null): void {
  if (!element) {
    return;
  }
  if (value === null) {
    element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

// Último HTML escrito con setHtml (o registrado con rememberHtml) en cada elemento.
const paintedHtml = new WeakMap<Element, string>();

// Escribe el HTML solo si cambió respecto de lo último que se pintó; devuelve si lo escribió.
// Compara contra lo pintado y no contra innerHTML, así una animación que cambia los hijos
// (por ejemplo popNumber) no provoca otra escritura.
export function setHtml(element: Element, html: string): boolean {
  const previous = paintedHtml.has(element) ? paintedHtml.get(element) : element.innerHTML;
  paintedHtml.set(element, html);
  if (previous === html) {
    return false;
  }
  element.innerHTML = html;
  return true;
}

// Registra que el elemento ya muestra este HTML (por ejemplo, el prerenderizado) sin escribirlo.
export function rememberHtml(element: Element, html: string): void {
  paintedHtml.set(element, html);
}
