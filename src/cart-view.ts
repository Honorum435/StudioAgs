import { business, businessValue } from "./business";
import {
  IDEA_MAX_LENGTH,
  MAX_QUANTITY,
  MIN_QUANTITY,
  clampQuantity,
  noticeMessage,
  toIsoDate,
  type FormIssue,
  type OrderField,
  type OrderState,
  type OrderStore,
  type OrderSummary,
  type ResolvedLine,
} from "./cart";
import type { CatalogProduct } from "./catalog";
import { formatPrice } from "./format";
import { bumpBadge, popNumber, scrollToTarget } from "./motion";
import type { Overlays } from "./overlays";
import {
  ORDER_CHANGED_NOTE,
  ORDER_UPDATED_NOTE,
  TOTAL_NOTE,
  cartAddon,
  cartContent,
  cartCountContent,
  cartLine,
  checkoutContent,
  ideaBlock,
  manualCopyContent,
  restoreNotice,
  sentQuestion,
  stickyBarSummary,
  type CheckoutStage,
  type StickyBarMessage,
} from "./templates";
import { buildOrderMessage, buildWhatsAppLink } from "./whatsapp";

// Islas del pedido: panel, contador del encabezado y barra fija. El panel se crea una vez por
// estado (vacío o con productos) y después se actualiza en su lugar, sin perder el foco.

export const ORDER_LAYER = "pedido";
// El contador de las ideas aparece recién cerca del máximo.
export const IDEA_COUNTER_FROM = 400;

export interface CartViewOptions {
  root: HTMLElement;
  store: OrderStore;
  overlays: Overlays;
  // Sin un número válido no hay enlace a WhatsApp: solo "Copiar pedido".
  whatsappNumber?: string;
}

export interface CartView {
  destroy(): void;
}

type ActionHandler = (element: HTMLElement) => void;
type FormControl = HTMLInputElement | HTMLTextAreaElement;

interface Keyed {
  key: string;
  create: () => Element;
}

const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "tel", "url", "number", "password", "date"]);

const fieldIds: Record<Exclude<OrderField, "lines">, string> = {
  name: "pedido-nombre",
  delivery: "pedido-entrega",
  locality: "pedido-localidad",
  date: "pedido-fecha",
};

function isTextField(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) {
    return true;
  }
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

function setText(element: Element | null | undefined, text: string): void {
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
}

function setHidden(element: HTMLElement | null | undefined, hidden: boolean): void {
  if (element && element.hidden !== hidden) {
    element.hidden = hidden;
  }
}

function setDescribedBy(element: Element | null, ids: readonly (string | null)[]): void {
  const value = ids.filter(Boolean).join(" ");
  if (!element) {
    return;
  }
  if (value) {
    element.setAttribute("aria-describedby", value);
  } else {
    element.removeAttribute("aria-describedby");
  }
}

// "Inactivo" sin disabled: el botón conserva el foco (por ejemplo "–" al llegar a 1).
function setInert(button: Element | null, inert: boolean): void {
  if (!button) {
    return;
  }
  if (inert) {
    button.setAttribute("aria-disabled", "true");
  } else {
    button.removeAttribute("aria-disabled");
  }
}

function isInert(element: Element): boolean {
  return element.getAttribute("aria-disabled") === "true";
}

function errorSummary(errors: readonly FormIssue[]): string {
  const count = errors.length === 1 ? "un dato" : `${errors.length} datos`;
  return `Revisá ${count}: ${errors.map((issue) => issue.message).join(" ")}`;
}

function counterText(length: number): string {
  const left = IDEA_MAX_LENGTH - length;
  if (left <= 0) {
    return `Llegaste al máximo de ${IDEA_MAX_LENGTH} caracteres.`;
  }
  return left === 1 ? "Te queda 1 carácter." : `Te quedan ${left} caracteres.`;
}

// Productos con bloque de idea o de fotos, en el orden de las líneas.
function ideaProducts(summary: OrderSummary): CatalogProduct[] {
  const seen = new Set<string>();
  return summary.lines.flatMap(({ product }) => {
    if (seen.has(product.id) || !(product.personalizable || product.needsPhotos)) {
      return [];
    }
    seen.add(product.id);
    return [product];
  });
}

export function mountCartView(options: CartViewOptions): CartView {
  const { root, store, overlays, whatsappNumber } = options;
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;

  const dialog = root.querySelector<HTMLDialogElement>("dialog#cart-dialog");
  const content = root.querySelector<HTMLElement>("[data-cart-content]");
  const notices = root.querySelector<HTMLElement>("[data-cart-notices]");
  const live = root.querySelector<HTMLElement>("[data-cart-live]");
  const restoreRegion = root.querySelector<HTMLElement>("[data-cart-restore]");
  const trigger = root.querySelector<HTMLButtonElement>(".cart-trigger");
  const count = root.querySelector<HTMLElement>("[data-cart-count]");
  const triggerNote = root.querySelector<HTMLElement>("[data-cart-trigger-note]");
  const bar = root.querySelector<HTMLElement>("[data-sticky-bar]");
  const barSummary = bar?.querySelector<HTMLElement>(".sticky-bar-summary") ?? null;

  const painted = { count: "", bar: "", restore: "", checkout: "" };
  // Cantidad que muestra el contador; null hasta la hidratación, que restaura sin animar.
  let paintedQuantity: number | null = null;
  let previous: OrderState | null = null;
  // Los campos que marcó el último "Continuar": se desmarcan solos al corregirlos.
  let flagged = new Set<OrderField>();
  let typing = false;

  function fromHtml(html: string): Element {
    const template = doc.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild!;
  }

  // Deja en el contenedor un hijo por clave, en orden, reutilizando los que ya estaban.
  function reconcile(container: Element, items: readonly Keyed[], keyOf: (element: HTMLElement) => string | undefined) {
    const wanted = new Set(items.map((item) => item.key));
    const existing = new Map<string, Element>();
    for (const child of Array.from(container.children) as HTMLElement[]) {
      const key = keyOf(child);
      if (key === undefined || !wanted.has(key) || existing.has(key)) {
        child.remove();
      } else {
        existing.set(key, child);
      }
    }
    const result = new Map<string, Element>();
    let before: Element | null = null;
    for (const item of items) {
      const element = existing.get(item.key) ?? item.create();
      const expected: Element | null = before ? before.nextElementSibling : container.firstElementChild;
      if (element !== expected) {
        container.insertBefore(element, expected);
      }
      result.set(item.key, element);
      before = element;
    }
    return result;
  }

  function announce(message: string): void {
    if (!live) {
      return;
    }
    // El mismo texto dos veces seguidas no se vuelve a leer: se alterna un espacio duro.
    live.textContent = live.textContent === message ? `${message} ` : message;
  }

  function control<T extends Element>(selector: string): T | null {
    return content?.querySelector<T>(selector) ?? null;
  }

  function emptyButton(): HTMLElement | null {
    return control<HTMLElement>('[data-action="browse-products"]');
  }

  function findLine(lineId: string | undefined): ResolvedLine | undefined {
    return store.getSummary().lines.find((line) => line.id === lineId);
  }

  function checkoutStage(state: OrderState, summary: OrderSummary): CheckoutStage {
    if (state.status === "borrador" || state.code === null) {
      return { kind: "draft", changed: state.changedSinceConfirm };
    }
    const link = buildWhatsAppLink(whatsappNumber, buildOrderMessage(summary));
    if (state.status === "confirmado") {
      return { kind: "confirmed", code: state.code, link };
    }
    return { kind: "sent", code: state.code, via: state.sentVia ?? "whatsapp", link };
  }

  function barMessage(state: OrderState): StickyBarMessage {
    if (state.notices.length > 0) {
      return { text: ORDER_UPDATED_NOTE, alert: true };
    }
    if (state.status === "enviado" && state.sentVia) {
      return { text: sentQuestion(state.sentVia), alert: true };
    }
    return { text: TOTAL_NOTE, alert: false };
  }

  function paintHeader(state: OrderState, summary: OrderSummary): void {
    if (count) {
      const html = cartCountContent(summary.quantity);
      if (html !== painted.count) {
        count.innerHTML = html;
        painted.count = html;
      }
      count.classList.toggle("is-empty", summary.quantity === 0);
      if (paintedQuantity !== null && summary.quantity > paintedQuantity) {
        bumpBadge(count);
      }
    }
    paintedQuantity = summary.quantity;
    const note = state.notices.length > 0;
    if (triggerNote) {
      // El punto separa la nota del contador en el nombre del botón.
      const html = note ? `<span class="visually-hidden">. </span>${ORDER_UPDATED_NOTE}` : "";
      if (triggerNote.innerHTML !== html) {
        triggerNote.innerHTML = html;
      }
      setHidden(triggerNote, !note);
    }
    trigger?.classList.toggle("has-note", note);
  }

  // Oculta con una capa abierta o con un campo de texto enfocado (el teclado ya ocupa la pantalla).
  function paintBar(state: OrderState = store.getState(), summary: OrderSummary = store.getSummary()): void {
    if (!bar) {
      return;
    }
    const active = summary.quantity > 0;
    bar.toggleAttribute("data-active", active);
    setHidden(bar, !active || overlays.current() !== null || typing);
    const html = stickyBarSummary(summary, barMessage(state));
    if (barSummary && html !== painted.bar) {
      barSummary.innerHTML = html;
      painted.bar = html;
    }
  }

  function paintRestore(state: OrderState): void {
    if (!restoreRegion) {
      return;
    }
    const html = state.notices.length > 0 ? restoreNotice(state.notices.map(noticeMessage)) : "";
    if (html === painted.restore) {
      return;
    }
    restoreRegion.innerHTML = html;
    painted.restore = html;
    if (html && dialog?.open) {
      scrollToTarget(notices, { block: "nearest" });
    }
  }

  function patchLine(item: Element, line: ResolvedLine): void {
    setText(item.querySelector("[data-line-total]"), formatPrice(line.combination.price * line.quantity));
    const input = item.querySelector<HTMLInputElement>("[data-quantity]");
    if (input && input !== doc.activeElement && input.value !== String(line.quantity)) {
      input.value = String(line.quantity);
    }
    setInert(item.querySelector('[data-action="decrement"]'), line.quantity <= MIN_QUANTITY);
    setInert(item.querySelector('[data-action="increment"]'), line.quantity >= MAX_QUANTITY);
    const addOns = item.querySelector<HTMLElement>(".cart-addons");
    if (addOns) {
      reconcile(
        addOns,
        line.addOns.map((addOn) => ({ key: addOn.id, create: () => fromHtml(cartAddon(line, addOn)) })),
        (element) => element.dataset.addonId,
      );
      setHidden(addOns, line.addOns.length === 0);
    }
  }

  function paintLines(summary: OrderSummary): void {
    const list = control<HTMLElement>("[data-cart-lines]");
    if (!list) {
      return;
    }
    const items = reconcile(
      list,
      summary.lines.map((line) => ({ key: line.id, create: () => fromHtml(cartLine(line)) })),
      (element) => element.dataset.lineId,
    );
    summary.lines.forEach((line) => patchLine(items.get(line.id)!, line));
    const subtotal = formatPrice(summary.subtotal);
    content?.querySelectorAll<HTMLElement>("[data-cart-subtotal]").forEach((element) => {
      // Con el panel cerrado no se ve: cambia sin animación.
      if (element.textContent !== subtotal) {
        if (dialog?.open) {
          popNumber(element, subtotal);
        } else {
          element.textContent = subtotal;
        }
      }
    });
  }

  function setValue(input: FormControl | null, value: string): void {
    if (input && input !== doc.activeElement && input.value !== value) {
      input.value = value;
    }
  }

  function paintIssue(field: Exclude<OrderField, "lines">, issue: FormIssue | undefined): string | null {
    const target =
      field === "delivery"
        ? control<HTMLElement>('[data-field="delivery"]')
        : control<HTMLElement>(`#${fieldIds[field]}`);
    const message = control<HTMLElement>(`[data-field-error="${field}"]`);
    if (target) {
      if (issue) {
        target.setAttribute("aria-invalid", "true");
      } else {
        target.removeAttribute("aria-invalid");
      }
    }
    setText(message, issue?.message ?? "");
    setHidden(message, !issue);
    return issue && message ? message.id : null;
  }

  function paintForm(state: OrderState): void {
    const { form } = state;
    setValue(control<HTMLInputElement>("#pedido-nombre"), form.name);
    setValue(control<HTMLInputElement>("#pedido-localidad"), form.locality);
    const date = control<HTMLInputElement>("#pedido-fecha");
    setValue(date, form.date);
    if (date) {
      // El mínimo depende del día de quien mira: se calcula acá y no en el prerender.
      const min = toIsoDate(store.today());
      if (date.min !== min) {
        date.min = min;
      }
    }
    content?.querySelectorAll<HTMLInputElement>('input[data-form-field="delivery"]').forEach((radio) => {
      radio.checked = radio.value === form.delivery;
    });
    setHidden(control<HTMLElement>('[data-field="locality"]'), form.delivery !== "envio");

    const hint = control<HTMLElement>("[data-delivery-hint]");
    const hintText =
      form.delivery === "retiro"
        ? businessValue(business.pickupArea)
        : form.delivery === "envio"
          ? businessValue(business.shipping)
          : "";
    setText(hint, hintText);
    setHidden(hint, hintText === "");

    const validation = store.validate();
    const issueFor = (field: OrderField) =>
      flagged.has(field) ? validation.errors.find((issue) => issue.field === field) : undefined;
    setDescribedBy(control("#pedido-nombre"), [paintIssue("name", issueFor("name"))]);
    setDescribedBy(control('[data-field="delivery"]'), [
      hintText ? "pedido-entrega-ayuda" : null,
      paintIssue("delivery", issueFor("delivery")),
    ]);
    setDescribedBy(control("#pedido-localidad"), [paintIssue("locality", issueFor("locality"))]);

    const warning = validation.warnings.find((issue) => issue.field === "date");
    const warningElement = control<HTMLElement>("[data-date-warning]");
    setText(warningElement, warning?.message ?? "");
    setHidden(warningElement, !warning);
    setDescribedBy(date, [warning ? "pedido-fecha-aviso" : null, paintIssue("date", issueFor("date"))]);
  }

  function paintCounter(area: HTMLTextAreaElement): void {
    const counter = area.parentElement?.querySelector<HTMLElement>("[data-idea-counter]");
    const length = area.value.length;
    const show = length >= IDEA_COUNTER_FROM;
    setText(counter, show ? counterText(length) : "");
    setHidden(counter, !show);
  }

  function paintIdeas(state: OrderState, summary: OrderSummary): void {
    const section = control<HTMLElement>("[data-cart-ideas-section]");
    const list = control<HTMLElement>("[data-cart-ideas]");
    if (!section || !list) {
      return;
    }
    const products = ideaProducts(summary);
    setHidden(section, products.length === 0);
    reconcile(
      list,
      products.map((product) => ({ key: product.id, create: () => fromHtml(ideaBlock(product)) })),
      (element) => element.dataset.ideaProduct,
    );
    list.querySelectorAll<HTMLTextAreaElement>("textarea[data-idea]").forEach((area) => {
      setValue(area, state.form.ideas[area.dataset.idea ?? ""] ?? "");
      paintCounter(area);
    });
  }

  function focusCheckout(): void {
    control<HTMLElement>("[data-checkout-focus]")?.focus();
  }

  function paintCheckout(state: OrderState, summary: OrderSummary): void {
    const container = control<HTMLElement>("[data-checkout]");
    if (!container) {
      return;
    }
    const html = checkoutContent(checkoutStage(state, summary));
    if (html === painted.checkout) {
      return;
    }
    const active = doc.activeElement;
    const hadFocus = !active || active === doc.body || container.contains(active);
    const first = painted.checkout === "";
    container.innerHTML = html;
    painted.checkout = html;
    // Si el foco estaba en el paso anterior (por ejemplo "Continuar"), pasa al aviso del nuevo.
    if (!first && hadFocus && dialog?.open) {
      focusCheckout();
    }
  }

  function paintContent(state: OrderState, summary: OrderSummary): void {
    if (!content) {
      return;
    }
    if (summary.lines.length === 0) {
      if (!content.querySelector(".cart-empty")) {
        content.innerHTML = cartContent(summary);
        painted.checkout = "";
      }
      return;
    }
    if (!content.querySelector("[data-cart-lines]")) {
      content.innerHTML = cartContent(summary);
      painted.checkout = "";
    }
    paintLines(summary);
    paintForm(state);
    paintIdeas(state, summary);
    paintCheckout(state, summary);
  }

  // Única función de actualización de las islas del pedido: la usan la hidratación y los cambios.
  function paint(): void {
    const state = store.getState();
    const summary = store.getSummary();
    paintHeader(state, summary);
    paintBar(state, summary);
    paintRestore(state);
    paintContent(state, summary);
    const reopened = previous !== null && previous.status !== "borrador" && state.status === "borrador";
    if (reopened && state.changedSinceConfirm && state.lines.length > 0) {
      announce(ORDER_CHANGED_NOTE);
    }
    previous = state;
  }

  function announceQuantity(lineId: string): void {
    const line = findLine(lineId);
    if (line) {
      announce(`Cantidad de ${line.product.name}: ${line.quantity}`);
    }
  }

  function commitQuantity(input: HTMLInputElement): void {
    const lineId = input.dataset.lineId ?? "";
    const line = store.getState().lines.find((item) => item.id === lineId);
    if (!line) {
      return;
    }
    const raw = input.value.trim();
    if (!/^\d+$/.test(raw)) {
      input.value = String(line.quantity);
      return;
    }
    const value = clampQuantity(Number(raw));
    input.value = String(value);
    if (store.setQuantity(lineId, value)) {
      announceQuantity(lineId);
    }
  }

  function focusField(field: OrderField): void {
    if (field === "lines") {
      control<HTMLElement>("[data-cart-lines]")?.focus();
      return;
    }
    if (field === "delivery") {
      const radios = Array.from(
        content?.querySelectorAll<HTMLInputElement>('input[data-form-field="delivery"]') ?? [],
      );
      (radios.find((radio) => radio.checked) ?? radios[0])?.focus();
      return;
    }
    control<HTMLElement>(`#${fieldIds[field]}`)?.focus();
  }

  function clearOrder(message: string): void {
    flagged = new Set();
    store.clear();
    announce(message);
    emptyButton()?.focus();
  }

  // Copia con respaldos: API del portapapeles dentro del gesto, execCommand y, si nada anda,
  // el texto seleccionado para copiarlo a mano.
  function execCopy(text: string): boolean {
    const host = dialog ?? root;
    const active = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    const buffer = doc.createElement("textarea");
    buffer.value = text;
    buffer.readOnly = true;
    buffer.tabIndex = -1;
    buffer.className = "copy-buffer";
    buffer.setAttribute("aria-hidden", "true");
    host.append(buffer);
    buffer.select();
    buffer.setSelectionRange(0, text.length);
    let copied = false;
    try {
      copied = typeof doc.execCommand === "function" && doc.execCommand("copy");
    } catch {
      copied = false;
    }
    buffer.remove();
    active?.focus({ preventScroll: true });
    return copied;
  }

  async function writeClipboard(text: string): Promise<boolean> {
    const clipboard = win.navigator?.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      try {
        await clipboard.writeText(text);
        return true;
      } catch {
        // Sin permiso (pasa en algunos navegadores integrados): sigue el respaldo.
      }
    }
    return execCopy(text);
  }

  function showManualCopy(text: string): void {
    const container = control<HTMLElement>("[data-checkout]");
    if (!container) {
      return;
    }
    if (!container.querySelector("[data-manual-copy]")) {
      container.insertAdjacentHTML("beforeend", manualCopyContent());
    }
    const area = container.querySelector<HTMLTextAreaElement>("[data-manual-copy-text]");
    if (area) {
      area.value = text;
      area.focus();
      area.select();
    }
  }

  async function copyOrder(): Promise<void> {
    const message = buildOrderMessage(store.getSummary());
    control("[data-manual-copy]")?.remove();
    if (await writeClipboard(message)) {
      announce("Pedido copiado");
      store.markSent("copy");
    } else {
      showManualCopy(message);
    }
  }

  async function browseProducts(): Promise<void> {
    // Primero se cierra (y vuelve el historial); recién después se desplaza la página.
    await overlays.close(ORDER_LAYER);
    const heading = doc.getElementById("catalog-title");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) {
        heading.tabIndex = -1;
      }
      heading.focus({ preventScroll: true });
    }
    scrollToTarget(doc.getElementById("catalogo"), { block: "start" });
  }

  // Un manejador por data-action.
  const actions: Record<string, ActionHandler> = {
    "open-cart"(element) {
      if (overlays.open(ORDER_LAYER, { opener: element }) && dialog && store.getState().notices.length > 0) {
        dialog.scrollTop = 0;
      }
    },
    "close-cart"() {
      void overlays.close(ORDER_LAYER);
    },
    "browse-products"() {
      void browseProducts();
    },
    increment(element) {
      const line = findLine(element.dataset.lineId);
      if (!line) {
        return;
      }
      if (isInert(element)) {
        announce(`Llegaste al máximo de ${MAX_QUANTITY}.`);
      } else if (store.increment(line.id)) {
        announceQuantity(line.id);
      }
    },
    decrement(element) {
      const line = findLine(element.dataset.lineId);
      if (!line) {
        return;
      }
      if (isInert(element)) {
        announce(`Ya está en ${MIN_QUANTITY}. Para sacarlo, tocá Quitar.`);
      } else if (store.decrement(line.id)) {
        announceQuantity(line.id);
      }
    },
    "remove-line"(element) {
      const line = findLine(element.dataset.lineId);
      if (!line) {
        return;
      }
      const buttons = Array.from(content?.querySelectorAll<HTMLElement>('[data-action="remove-line"]') ?? []);
      const index = buttons.indexOf(element);
      const next = buttons[index + 1] ?? buttons[index - 1] ?? null;
      if (!store.removeLine(line.id)) {
        return;
      }
      announce(`Quitaste ${line.product.name}`);
      (next?.isConnected ? next : emptyButton())?.focus();
    },
    "remove-addon"(element) {
      const line = findLine(element.dataset.lineId);
      const addOn = line?.addOns.find((item) => item.id === element.dataset.addonId);
      const item = element.closest(".cart-item");
      if (!line || !addOn || !item) {
        return;
      }
      const siblings = Array.from(item.querySelectorAll<HTMLElement>('[data-action="remove-addon"]'));
      const index = siblings.indexOf(element);
      const next =
        siblings[index + 1] ?? siblings[index - 1] ?? item.querySelector<HTMLElement>('[data-action="remove-line"]');
      if (!store.removeAddon(line.id, addOn.id)) {
        return;
      }
      announce(`Quitaste ${addOn.label} de ${line.product.name}`);
      next?.focus();
    },
    checkout() {
      const result = store.confirm();
      if (result.valid) {
        flagged = new Set();
        // El foco pasa al aviso de WhatsApp; el resumen de errores anterior no tiene que quedar.
        if (live) {
          live.textContent = "";
        }
        return;
      }
      flagged = new Set(result.errors.map((issue) => issue.field));
      paint();
      announce(errorSummary(result.errors));
      if (result.errors[0]) {
        focusField(result.errors[0].field);
      }
    },
    "open-whatsapp"() {
      // Después del clic: el enlace tiene que seguir en su lugar mientras abre WhatsApp.
      win.setTimeout(() => store.markSent("whatsapp"), 0);
    },
    "copy-order"() {
      void copyOrder();
    },
    "sent-clear"() {
      clearOrder("Listo, vaciamos el pedido. ¡Gracias!");
    },
    "clear-order"() {
      clearOrder("Vaciaste el pedido.");
    },
    "acknowledge-notices"() {
      store.acknowledgeNotices();
      (control<HTMLElement>("[data-cart-lines]") ?? emptyButton())?.focus();
    },
  };

  function onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const element = target?.closest<HTMLElement>("[data-action]");
    const handler = element ? actions[element.dataset.action ?? ""] : undefined;
    if (!element || !handler || (element instanceof HTMLButtonElement && element.disabled)) {
      return;
    }
    handler(element);
  }

  function onFormInput(target: EventTarget | null): void {
    if (target instanceof HTMLTextAreaElement && target.dataset.idea) {
      store.setIdea(target.dataset.idea, target.value);
      paintCounter(target);
      return;
    }
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const field = target.dataset.formField;
    if (field === "name" || field === "locality" || field === "date") {
      store.updateForm({ [field]: target.value });
    } else if (field === "delivery" && target.checked && (target.value === "retiro" || target.value === "envio")) {
      store.updateForm({ delivery: target.value });
    }
  }

  function onInput(event: Event): void {
    onFormInput(event.target);
  }

  function onChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.hasAttribute("data-quantity")) {
      commitQuantity(target);
      return;
    }
    onFormInput(target);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (event.key === "Enter" && target instanceof HTMLInputElement && target.hasAttribute("data-quantity")) {
      event.preventDefault();
      commitQuantity(target);
    }
  }

  function onFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.hasAttribute("data-manual-copy-text")) {
      target.select();
    }
    if (isTextField(target) !== typing) {
      typing = isTextField(target);
      paintBar();
    }
  }

  function onFocusOut(event: FocusEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.hasAttribute("data-quantity") && target.isConnected) {
      commitQuantity(target);
    }
    if (isTextField(event.relatedTarget) !== typing) {
      typing = isTextField(event.relatedTarget);
      paintBar();
    }
  }

  if (dialog) {
    overlays.register(ORDER_LAYER, dialog);
  }
  const unsubscribeStore = store.subscribe(paint);
  const unsubscribeOverlays = overlays.subscribe(() => paintBar());
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("focusout", onFocusOut);

  // Hidratación: pinta panel, contador y barra con lo guardado y habilita el botón del pedido.
  paint();
  if (trigger) {
    trigger.disabled = false;
  }

  return {
    destroy() {
      unsubscribeStore();
      unsubscribeOverlays();
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onChange);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
    },
  };
}
