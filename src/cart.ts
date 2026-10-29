import { business, businessValue, type CalendarDate } from "./business";
import {
  products,
  resolveSelection,
  type AddOn,
  type CatalogProduct,
  type Combination,
  type Selection,
} from "./catalog";

// Módulo puro: no toca el DOM al importarse. Almacenamiento, reloj y generador de código se inyectan.

export type DeliveryMethod = "retiro" | "envio";
export type OrderStatus = "borrador" | "confirmado" | "enviado";
export type SentVia = "whatsapp" | "copy";

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;
export const IDEA_MAX_LENGTH = 500;
export const STORAGE_KEY = "studioags-pedido";
export const STORAGE_VERSION = 1;

const HOUR = 60 * 60 * 1000;
export const DRAFT_LIFETIME = 30 * 24 * HOUR;
export const SENT_LIFETIME = 48 * HOUR;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface OrderLine {
  // El id de la combinación: una línea por combinación.
  id: string;
  productId: string;
  combinationId: string;
  quantity: number;
  // Sublíneas de adicionales, cada una con cantidad fija 1.
  addOnIds: readonly string[];
}

export interface OrderForm {
  name: string;
  delivery: DeliveryMethod | null;
  locality: string;
  // Valor de un <input type="date">: "AAAA-MM-DD" o vacío.
  date: string;
  // Id del producto personalizable → idea.
  ideas: Readonly<Record<string, string>>;
}

export type FormPatch = Partial<Omit<OrderForm, "ideas">>;

export interface DroppedItem {
  kind: "line" | "addOn";
  product: string;
  label: string;
}

export type RestoreNotice =
  | { kind: "dropped"; items: readonly DroppedItem[] }
  | { kind: "prices"; previous: CalendarDate; current: CalendarDate };

export interface OrderState {
  lines: readonly OrderLine[];
  form: OrderForm;
  status: OrderStatus;
  code: string | null;
  sentVia: SentVia | null;
  sentAt: number | null;
  // Se cambió algo después de tocar "Continuar": el panel avisa que hay que volver a tocarlo.
  changedSinceConfirm: boolean;
  notices: readonly RestoreNotice[];
}

export interface ResolvedLine {
  id: string;
  product: CatalogProduct;
  combination: Combination;
  quantity: number;
  addOns: readonly AddOn[];
  total: number;
}

export interface OrderIdea {
  product: CatalogProduct;
  text: string;
}

export interface OrderSummary {
  code: string | null;
  lines: readonly ResolvedLine[];
  quantity: number;
  subtotal: number;
  form: OrderForm;
  // Un campo de idea por producto personalizable del pedido, en el orden de las líneas.
  ideas: readonly OrderIdea[];
  photoProducts: readonly CatalogProduct[];
}

export type OrderField = "lines" | "name" | "delivery" | "locality" | "date";
export type IssueCode = "empty" | "required" | "invalid" | "past" | "beforeLeadTime";

export interface FormIssue {
  field: OrderField;
  code: IssueCode;
  message: string;
}

export interface OrderValidation {
  valid: boolean;
  // En el orden del formulario: el primero es el que recibe el foco.
  errors: readonly FormIssue[];
  warnings: readonly FormIssue[];
}

export interface ConfirmResult extends OrderValidation {
  code: string | null;
}

export interface OrderStoreOptions {
  createCode: () => string;
  // Sin definir usa localStorage si existe; null deja el pedido solo en memoria.
  storage?: StorageLike | null;
  now?: () => Date;
  catalog?: readonly CatalogProduct[];
  pricesUpdatedAt?: CalendarDate;
}

export interface OrderStore {
  getState(): OrderState;
  subscribe(listener: (state: OrderState) => void): () => void;
  add(productId: string, selection: Selection, addOnIds?: readonly string[], quantity?: number): string | null;
  increment(lineId: string): boolean;
  decrement(lineId: string): boolean;
  setQuantity(lineId: string, value: number): boolean;
  removeLine(lineId: string): boolean;
  removeAddon(lineId: string, addOnId: string): boolean;
  clear(): void;
  updateForm(patch: FormPatch): boolean;
  setIdea(productId: string, text: string): boolean;
  validate(): OrderValidation;
  confirm(): ConfirmResult;
  markSent(via: SentVia): boolean;
  acknowledgeNotices(): void;
  getSummary(): OrderSummary;
  today(): CalendarDate;
  earliestDate(): CalendarDate | null;
}

// Fechas: siempre año, mes y día literales en hora local; nunca se parsea "AAAA-MM-DD" con Date.

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isCalendarDate(value: unknown): value is CalendarDate {
  if (!isRecord(value)) {
    return false;
  }
  const { year, month, day } = value;
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    (year as number) >= 1000 &&
    (year as number) <= 9999 &&
    (month as number) >= 1 &&
    (month as number) <= 12 &&
    (day as number) >= 1 &&
    (day as number) <= daysInMonth(year as number, month as number)
  );
}

export function calendarDateOf(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isCalendarDate(date) ? date : null;
}

export function toIsoDate({ year, month, day }: CalendarDate): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatCalendarDate({ year, month, day }: CalendarDate): string {
  return `${day}/${month}/${year}`;
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return (a.year - b.year) * 10000 + (a.month - b.month) * 100 + (a.day - b.day);
}

// Días hábiles: de lunes a viernes, sin feriados.
export function addBusinessDays(date: CalendarDate, days: number): CalendarDate {
  const cursor = new Date(Date.UTC(date.year, date.month - 1, date.day));
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
    }
  }
  return { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_QUANTITY;
  }
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(value)));
}

// Recorta sin partir un emoji (par sustituto) al final.
export function capText(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const last = text.charCodeAt(max - 1);
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? max - 1 : max);
}

export function createMemoryStorage(): StorageLike {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, String(value));
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

export function noticeMessage(notice: RestoreNotice): string {
  if (notice.kind === "prices") {
    return `Actualizamos los precios al ${formatCalendarDate(notice.current)}: revisá el subtotal.`;
  }
  const items = notice.items.map((item) => {
    if (item.kind === "addOn") {
      return `${item.label} de ${item.product}`;
    }
    return item.label ? `${item.product} (${item.label})` : item.product;
  });
  return `Sacamos lo que ya no está en el catálogo: ${items.join(", ")}.`;
}

const emptyForm: OrderForm = { name: "", delivery: null, locality: "", date: "", ideas: {} };

function emptyState(): OrderState {
  return {
    lines: [],
    form: emptyForm,
    status: "borrador",
    code: null,
    sentVia: null,
    sentAt: null,
    changedSinceConfirm: false,
    notices: [],
  };
}

function backToDraft(state: OrderState): OrderState {
  return { ...state, status: "borrador", code: null, sentVia: null, sentAt: null };
}

function isBlank(state: OrderState): boolean {
  const { form } = state;
  return (
    state.lines.length === 0 &&
    state.notices.length === 0 &&
    form.name === "" &&
    form.delivery === null &&
    form.locality === "" &&
    form.date === "" &&
    Object.keys(form.ideas).length === 0
  );
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function sortedAddOnIds(product: CatalogProduct, ids: readonly string[]): string[] {
  return product.addOns.filter((addOn) => ids.includes(addOn.id)).map((addOn) => addOn.id);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function mergeLine(
  lines: readonly OrderLine[],
  product: CatalogProduct,
  combination: Combination,
  addOnIds: readonly string[],
  quantity: number,
): OrderLine[] {
  const existing = lines.find((line) => line.id === combination.id);
  if (!existing) {
    const line: OrderLine = {
      id: combination.id,
      productId: product.id,
      combinationId: combination.id,
      quantity: clampQuantity(quantity),
      addOnIds: sortedAddOnIds(product, addOnIds),
    };
    return [...lines, line];
  }
  const merged: OrderLine = {
    ...existing,
    quantity: clampQuantity(existing.quantity + quantity),
    addOnIds: sortedAddOnIds(product, [...existing.addOnIds, ...addOnIds]),
  };
  return lines.map((line) => (line === existing ? merged : line));
}

// Un aviso pendiente por tipo: se suman los descartes y se conserva la fecha de precios original.
function mergeNotice(previous: RestoreNotice, notice: RestoreNotice): RestoreNotice {
  if (previous.kind === "dropped" && notice.kind === "dropped") {
    return { kind: "dropped", items: [...previous.items, ...notice.items] };
  }
  if (previous.kind === "prices" && notice.kind === "prices") {
    return { ...notice, previous: previous.previous };
  }
  return notice;
}

function mergeNotices(current: readonly RestoreNotice[], added: readonly RestoreNotice[]): RestoreNotice[] {
  return added.reduce<RestoreNotice[]>((notices, notice) => {
    const previous = notices.find((item) => item.kind === notice.kind);
    return previous
      ? notices.map((item) => (item === previous ? mergeNotice(previous, notice) : item))
      : [...notices, notice];
  }, [...current]);
}

// Persistencia: formato versionado y validación estricta de la forma al restaurar.

interface StoredLine {
  productId: string;
  combinationId: string;
  quantity: number;
  addOns: { id: string; label: string }[];
  // Nombres al momento de guardar, para avisar qué se descartó si el producto ya no existe.
  name: string;
  label: string;
}

interface StoredOrder {
  version: number;
  savedAt: number;
  pricesUpdatedAt: CalendarDate;
  status: OrderStatus;
  code: string | null;
  sentVia: SentVia | null;
  sentAt: number | null;
  changedSinceConfirm: boolean;
  lines: StoredLine[];
  form: OrderForm;
  notices: RestoreNotice[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function isStoredLine(value: unknown): value is StoredLine {
  return (
    isRecord(value) &&
    isString(value.productId) &&
    isString(value.combinationId) &&
    Number.isInteger(value.quantity) &&
    (value.quantity as number) >= MIN_QUANTITY &&
    (value.quantity as number) <= MAX_QUANTITY &&
    Array.isArray(value.addOns) &&
    value.addOns.every((addOn) => isRecord(addOn) && isString(addOn.id) && isString(addOn.label)) &&
    isString(value.name) &&
    isString(value.label)
  );
}

function isStoredForm(value: unknown): value is OrderForm {
  return (
    isRecord(value) &&
    isString(value.name) &&
    (value.delivery === null || isOneOf(value.delivery, ["retiro", "envio"] as const)) &&
    isString(value.locality) &&
    isString(value.date) &&
    isRecord(value.ideas) &&
    Object.values(value.ideas).every(isString)
  );
}

function isDroppedItem(value: unknown): value is DroppedItem {
  return (
    isRecord(value) &&
    isOneOf(value.kind, ["line", "addOn"] as const) &&
    isString(value.product) &&
    isString(value.label)
  );
}

function isNotice(value: unknown): value is RestoreNotice {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind === "dropped") {
    return Array.isArray(value.items) && value.items.every(isDroppedItem);
  }
  return value.kind === "prices" && isCalendarDate(value.previous) && isCalendarDate(value.current);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseStoredOrder(raw: string): StoredOrder | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== STORAGE_VERSION) {
    return null;
  }
  const valid =
    isTimestamp(data.savedAt) &&
    isCalendarDate(data.pricesUpdatedAt) &&
    isOneOf(data.status, ["borrador", "confirmado", "enviado"] as const) &&
    (data.code === null || (isString(data.code) && /^[A-Z0-9-]{1,16}$/.test(data.code))) &&
    (data.sentVia === null || isOneOf(data.sentVia, ["whatsapp", "copy"] as const)) &&
    (data.sentAt === null || isTimestamp(data.sentAt)) &&
    typeof data.changedSinceConfirm === "boolean" &&
    Array.isArray(data.lines) &&
    data.lines.every(isStoredLine) &&
    isStoredForm(data.form) &&
    Array.isArray(data.notices) &&
    data.notices.every(isNotice);
  return valid ? (data as unknown as StoredOrder) : null;
}

const issueMessages = {
  linesEmpty: "Sumá al menos un producto.",
  nameRequired: "Escribí tu nombre.",
  deliveryRequired: "Elegí retiro o envío.",
  localityRequired: "Escribí la localidad para el envío.",
  dateInvalid: "Revisá la fecha.",
  datePast: "Elegí una fecha desde hoy.",
};

function leadTimeMessage(days: number): string {
  return `Puede que no llegue para esa fecha: algunos productos tardan hasta ${days} días hábiles. Podés seguir igual y lo vemos por WhatsApp.`;
}

export function createOrderStore(options: OrderStoreOptions): OrderStore {
  const catalog = options.catalog ?? products;
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => new Date());
  const pricesUpdatedAt = options.pricesUpdatedAt ?? businessValue(business.pricesUpdatedAt);
  const listeners = new Set<(state: OrderState) => void>();

  const findProduct = (id: string) => catalog.find((product) => product.id === id);

  function resolveLine(line: OrderLine): ResolvedLine | null {
    const product = findProduct(line.productId);
    const combination = product?.combinations.find((item) => item.id === line.combinationId);
    if (!product || !combination) {
      return null;
    }
    const addOns = product.addOns.filter((addOn) => line.addOnIds.includes(addOn.id));
    const total = addOns.reduce((sum, addOn) => sum + addOn.price, combination.price * line.quantity);
    return { id: line.id, product, combination, quantity: line.quantity, addOns, total };
  }

  function ideaProducts(lines: readonly OrderLine[]): CatalogProduct[] {
    const ids = [...new Set(lines.map((line) => line.productId))];
    return ids.flatMap((id) => {
      const product = findProduct(id);
      return product?.personalizable ? [product] : [];
    });
  }

  // Las ideas solo se guardan para productos personalizables que siguen en el pedido.
  function pruneIdeas(form: OrderForm, lines: readonly OrderLine[]): OrderForm {
    const allowed = new Set(ideaProducts(lines).map((product) => product.id));
    const entries = Object.entries(form.ideas).filter(([id, text]) => allowed.has(id) && text !== "");
    if (entries.length === Object.keys(form.ideas).length) {
      return form;
    }
    return { ...form, ideas: Object.fromEntries(entries) };
  }

  function discardStored(): void {
    try {
      storage?.removeItem(STORAGE_KEY);
    } catch {
      // Sin almacenamiento el pedido sigue en memoria.
    }
  }

  function save(): void {
    if (!storage) {
      return;
    }
    if (isBlank(state)) {
      discardStored();
      return;
    }
    const stored: StoredOrder = {
      version: STORAGE_VERSION,
      savedAt: now().getTime(),
      pricesUpdatedAt,
      status: state.status,
      code: state.code,
      sentVia: state.sentVia,
      sentAt: state.sentAt,
      changedSinceConfirm: state.changedSinceConfirm,
      lines: state.lines.flatMap((line) => {
        const resolved = resolveLine(line);
        if (!resolved) {
          return [];
        }
        return [
          {
            productId: line.productId,
            combinationId: line.combinationId,
            quantity: line.quantity,
            addOns: resolved.addOns.map((addOn) => ({ id: addOn.id, label: addOn.label })),
            name: resolved.product.name,
            label: resolved.combination.label,
          },
        ];
      }),
      form: state.form,
      notices: [...state.notices],
    };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Cuota llena o almacenamiento bloqueado: el pedido sigue en memoria.
    }
  }

  function restore(): OrderState {
    let raw: string | null;
    try {
      raw = storage ? storage.getItem(STORAGE_KEY) : null;
    } catch {
      return emptyState();
    }
    if (raw === null) {
      return emptyState();
    }

    const stored = parseStoredOrder(raw);
    if (!stored) {
      discardStored();
      return emptyState();
    }

    const nowMs = now().getTime();
    const expired =
      stored.status === "enviado" && stored.sentAt !== null
        ? nowMs - stored.sentAt > SENT_LIFETIME
        : nowMs - stored.savedAt > DRAFT_LIFETIME;
    if (expired) {
      discardStored();
      return emptyState();
    }

    const dropped: DroppedItem[] = [];
    let lines: OrderLine[] = [];
    for (const item of stored.lines) {
      const product = findProduct(item.productId);
      const combination = product?.combinations.find((entry) => entry.id === item.combinationId);
      if (!product || !combination) {
        dropped.push({ kind: "line", product: item.name, label: item.label });
        continue;
      }
      const addOnIds: string[] = [];
      for (const addOn of item.addOns) {
        if (product.addOns.some((entry) => entry.id === addOn.id)) {
          addOnIds.push(addOn.id);
        } else {
          dropped.push({ kind: "addOn", product: product.name, label: addOn.label });
        }
      }
      lines = mergeLine(lines, product, combination, addOnIds, item.quantity);
    }

    const added: RestoreNotice[] = [];
    if (dropped.length > 0) {
      added.push({ kind: "dropped", items: dropped });
    }
    if (compareDates(stored.pricesUpdatedAt, pricesUpdatedAt) !== 0) {
      added.push({ kind: "prices", previous: stored.pricesUpdatedAt, current: pricesUpdatedAt });
    }

    const ideas = Object.fromEntries(
      Object.entries(stored.form.ideas).map(([id, text]) => [id, capText(text, IDEA_MAX_LENGTH)]),
    );
    let restored: OrderState = {
      lines,
      form: pruneIdeas({ ...stored.form, ideas }, lines),
      status: stored.status,
      code: stored.code,
      sentVia: stored.sentVia,
      sentAt: stored.sentAt,
      changedSinceConfirm: lines.length > 0 && stored.changedSinceConfirm,
      notices: mergeNotices(stored.notices, added),
    };

    const sent = restored.sentVia !== null && restored.sentAt !== null;
    const unsent = restored.sentVia === null && restored.sentAt === null;
    const consistent =
      lines.length > 0 &&
      (restored.status === "borrador"
        ? restored.code === null && unsent
        : restored.code !== null && (restored.status === "confirmado" ? unsent : sent));
    if (added.length > 0 || !consistent) {
      restored = backToDraft(restored);
    }

    if (added.length > 0) {
      state = restored;
      save();
    }
    return restored;
  }

  // restore() puede guardar el pedido corregido, y save() lee state.
  let state: OrderState = emptyState();
  state = restore();

  function notify(): void {
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  function commit(next: OrderState): void {
    state = next;
    save();
    notify();
  }

  // Todo cambio en líneas o formulario vuelve a borrador y descarta el código.
  function commitContent(lines: readonly OrderLine[], form: OrderForm): void {
    let next: OrderState = { ...state, lines, form: pruneIdeas(form, lines) };
    if (next.status !== "borrador") {
      next = { ...backToDraft(next), changedSinceConfirm: true };
    }
    if (lines.length === 0) {
      next = { ...next, changedSinceConfirm: false };
    }
    commit(next);
  }

  function updateLine(lineId: string, change: (line: OrderLine) => OrderLine | null): boolean {
    const line = state.lines.find((item) => item.id === lineId);
    if (!line) {
      return false;
    }
    const updated = change(line);
    if (updated === line) {
      return false;
    }
    const lines =
      updated === null
        ? state.lines.filter((item) => item !== line)
        : state.lines.map((item) => (item === line ? updated : item));
    commitContent(lines, state.form);
    return true;
  }

  function setLineQuantity(lineId: string, quantity: number): boolean {
    return updateLine(lineId, (line) => {
      const value = clampQuantity(quantity);
      return value === line.quantity ? line : { ...line, quantity: value };
    });
  }

  function longestLeadTime(): number {
    return state.lines.reduce((longest, line) => {
      const product = findProduct(line.productId);
      return product ? Math.max(longest, businessValue(product.leadTime).max) : longest;
    }, 0);
  }

  function today(): CalendarDate {
    return calendarDateOf(now());
  }

  function earliestDate(): CalendarDate | null {
    const days = longestLeadTime();
    return state.lines.length === 0 ? null : addBusinessDays(today(), days);
  }

  function validate(): OrderValidation {
    const { form } = state;
    const errors: FormIssue[] = [];
    const warnings: FormIssue[] = [];

    if (state.lines.length === 0) {
      errors.push({ field: "lines", code: "empty", message: issueMessages.linesEmpty });
    }
    if (form.name.trim() === "") {
      errors.push({ field: "name", code: "required", message: issueMessages.nameRequired });
    }
    if (form.delivery === null) {
      errors.push({ field: "delivery", code: "required", message: issueMessages.deliveryRequired });
    } else if (form.delivery === "envio" && form.locality.trim() === "") {
      errors.push({ field: "locality", code: "required", message: issueMessages.localityRequired });
    }

    const rawDate = form.date.trim();
    if (rawDate !== "") {
      const date = parseIsoDate(rawDate);
      const earliest = earliestDate();
      if (!date) {
        errors.push({ field: "date", code: "invalid", message: issueMessages.dateInvalid });
      } else if (compareDates(date, today()) < 0) {
        errors.push({ field: "date", code: "past", message: issueMessages.datePast });
      } else if (earliest && compareDates(date, earliest) < 0) {
        warnings.push({ field: "date", code: "beforeLeadTime", message: leadTimeMessage(longestLeadTime()) });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    add(productId, selection, addOnIds = [], quantity = 1) {
      const product = findProduct(productId);
      const resolved = product ? resolveSelection(product, selection, addOnIds) : null;
      if (!product || !resolved) {
        return null;
      }
      const { combination } = resolved;
      const before = state.lines.find((line) => line.id === combination.id);
      const lines = mergeLine(state.lines, product, combination, addOnIds, quantity);
      const after = lines.find((line) => line.id === combination.id)!;
      const changed =
        !before || before.quantity !== after.quantity || !sameIds(before.addOnIds, after.addOnIds);
      if (changed) {
        commitContent(lines, state.form);
      }
      return combination.id;
    },

    increment: (lineId) => {
      const line = state.lines.find((item) => item.id === lineId);
      return line ? setLineQuantity(lineId, line.quantity + 1) : false;
    },

    decrement: (lineId) => {
      const line = state.lines.find((item) => item.id === lineId);
      return line ? setLineQuantity(lineId, line.quantity - 1) : false;
    },

    setQuantity: (lineId, value) => (Number.isFinite(value) ? setLineQuantity(lineId, value) : false),

    removeLine: (lineId) => updateLine(lineId, () => null),

    removeAddon: (lineId, addOnId) =>
      updateLine(lineId, (line) =>
        line.addOnIds.includes(addOnId)
          ? { ...line, addOnIds: line.addOnIds.filter((id) => id !== addOnId) }
          : line,
      ),

    // "Ya lo envié · vaciar pedido" y vaciar: borra también lo guardado.
    clear() {
      state = emptyState();
      discardStored();
      notify();
    },

    updateForm(patch) {
      const form: OrderForm = { ...state.form };
      let changed = false;
      for (const key of ["name", "locality", "date"] as const) {
        const value = patch[key];
        if (typeof value === "string" && value !== form[key]) {
          form[key] = value;
          changed = true;
        }
      }
      const { delivery } = patch;
      if (
        delivery !== undefined &&
        (delivery === null || isOneOf(delivery, ["retiro", "envio"] as const)) &&
        delivery !== form.delivery
      ) {
        form.delivery = delivery;
        changed = true;
      }
      if (changed) {
        commitContent(state.lines, form);
      }
      return changed;
    },

    setIdea(productId, text) {
      if (!ideaProducts(state.lines).some((product) => product.id === productId)) {
        return false;
      }
      const value = capText(text, IDEA_MAX_LENGTH);
      if (value === (state.form.ideas[productId] ?? "")) {
        return false;
      }
      const ideas = { ...state.form.ideas, [productId]: value };
      commitContent(state.lines, { ...state.form, ideas });
      return true;
    },

    validate,

    confirm() {
      const result = validate();
      if (!result.valid) {
        return { ...result, code: null };
      }
      if (state.status !== "borrador" && state.code !== null) {
        return { ...result, code: state.code };
      }
      const code = options.createCode();
      commit({ ...state, status: "confirmado", code, changedSinceConfirm: false });
      return { ...result, code };
    },

    markSent(via) {
      if (state.status === "borrador" || state.code === null) {
        return false;
      }
      commit({ ...state, status: "enviado", sentVia: via, sentAt: now().getTime() });
      return true;
    },

    acknowledgeNotices() {
      if (state.notices.length > 0) {
        commit({ ...state, notices: [] });
      }
    },

    getSummary() {
      const lines = state.lines.flatMap((line) => resolveLine(line) ?? []);
      const photoProducts = [...new Set(lines.map((line) => line.product))].filter(
        (product) => product.needsPhotos,
      );
      return {
        code: state.code,
        lines,
        quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
        subtotal: lines.reduce((sum, line) => sum + line.total, 0),
        form: state.form,
        ideas: ideaProducts(state.lines).map((product) => ({
          product,
          text: state.form.ideas[product.id] ?? "",
        })),
        photoProducts,
      };
    },

    today,
    earliestDate,
  };
}
