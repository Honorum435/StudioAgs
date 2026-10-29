// Coordinador de capas (ficha y pedido) e historial. Abrir agrega una entrada al historial; el
// evento close del diálogo es la única salida, venga de donde venga el cierre.

export const LAYER_STATE_KEY = "studioagsLayer";

// Si popstate no llega (no debería), close() no queda esperando para siempre.
const HISTORY_SETTLE_TIMEOUT = 600;

export interface LayerOptions {
  // Después de cerrar y de devolver el foco.
  onClose?: () => void;
}

export interface OpenOptions {
  // A dónde vuelve el foco al cerrar; por defecto, lo que estaba enfocado al abrir.
  opener?: HTMLElement | null;
}

export interface Overlays {
  register(name: string, dialog: HTMLDialogElement, options?: LayerOptions): void;
  open(name: string, options?: OpenOptions): boolean;
  // Se resuelve cuando el historial ya volvió: recién ahí conviene desplazar la página.
  close(name: string): Promise<void>;
  current(): string | null;
  subscribe(listener: (current: string | null) => void): () => void;
  destroy(): void;
}

interface Layer {
  name: string;
  dialog: HTMLDialogElement;
  options: LayerOptions;
  opener: HTMLElement | null;
  pointerDownOnBackdrop: boolean;
  // Los close() pendientes: el evento close llega después, como tarea aparte.
  closeWaiters: Array<() => void>;
  cleanup: () => void;
}

function layerOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null) {
    return null;
  }
  const value = (state as Record<string, unknown>)[LAYER_STATE_KEY];
  return typeof value === "string" ? value : null;
}

function withoutLayer(state: unknown): unknown {
  if (typeof state !== "object" || state === null) {
    return state;
  }
  const rest = { ...(state as Record<string, unknown>) };
  delete rest[LAYER_STATE_KEY];
  return Object.keys(rest).length > 0 ? rest : null;
}

// El fondo de un <dialog> modal recibe el clic como si fuera el propio diálogo, fuera de su caja.
function isBackdropEvent(dialog: HTMLDialogElement, event: MouseEvent): boolean {
  if (event.target !== dialog) {
    return false;
  }
  const box = dialog.getBoundingClientRect();
  return (
    event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
  );
}

export function createOverlays(win: Window = window): Overlays {
  const doc = win.document;
  const layers = new Map<string, Layer>();
  const listeners = new Set<(current: string | null) => void>();
  let settleWaiters: Array<() => void> = [];
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  // Una recarga con una capa marcada en el historial no la vuelve a abrir.
  if (layerOf(win.history.state)) {
    win.history.replaceState(withoutLayer(win.history.state), "");
  }

  const openLayer = (): Layer | null => [...layers.values()].find((layer) => layer.dialog.open) ?? null;

  function syncRoot(): void {
    const active = openLayer();
    const root = doc.documentElement;
    // html[data-layer] bloquea el desplazamiento de la página (styles.css).
    if (active) {
      root.dataset.layer = active.name;
    } else {
      delete root.dataset.layer;
    }
    listeners.forEach((listener) => listener(active ? active.name : null));
  }

  function settle(): void {
    if (settleTimer !== null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    const waiters = settleWaiters;
    settleWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  function goBack(): void {
    if (settleTimer !== null) {
      clearTimeout(settleTimer);
    }
    settleTimer = setTimeout(settle, HISTORY_SETTLE_TIMEOUT);
    win.history.back();
  }

  function handleClose(layer: Layer): void {
    if (layer.dialog.open) {
      // Se volvió a abrir antes de que llegara este close.
      return;
    }
    const waiters = layer.closeWaiters;
    layer.closeWaiters = [];
    // Botón, Escape, fondo, Atrás de Android o cierre programático: si la entrada sigue, se saca.
    if (layerOf(win.history.state) === layer.name) {
      // Antes de back(): hay entornos que disparan popstate en el momento.
      settleWaiters.push(...waiters);
      goBack();
    } else {
      waiters.forEach((resolve) => resolve());
    }
    const opener = layer.opener;
    layer.opener = null;
    syncRoot();
    if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
    layer.options.onClose?.();
  }

  function onPopState(event: PopStateEvent): void {
    const marked = layerOf(event.state);
    layers.forEach((layer) => {
      if (layer.dialog.open && layer.name !== marked) {
        layer.dialog.close();
      }
    });
    // Una entrada marcada a la que se llegó con Adelante no reabre nada: se limpia.
    if (marked && !layers.get(marked)?.dialog.open) {
      win.history.replaceState(withoutLayer(event.state), "");
    }
    settle();
  }

  win.addEventListener("popstate", onPopState);

  return {
    register(name, dialog, options = {}) {
      if (layers.has(name)) {
        throw new Error(`La capa ${name} ya está registrada.`);
      }
      const layer: Layer = {
        name,
        dialog,
        options,
        opener: null,
        pointerDownOnBackdrop: false,
        closeWaiters: [],
        cleanup: () => undefined,
      };
      const onClose = () => handleClose(layer);
      const onPointerDown = (event: PointerEvent) => {
        layer.pointerDownOnBackdrop = isBackdropEvent(dialog, event);
      };
      // Solo si el toque empezó y terminó en el fondo: arrastrar desde la ficha no la cierra.
      const onClick = (event: MouseEvent) => {
        const fromBackdrop = layer.pointerDownOnBackdrop && isBackdropEvent(dialog, event);
        layer.pointerDownOnBackdrop = false;
        if (fromBackdrop) {
          dialog.close();
        }
      };
      dialog.addEventListener("close", onClose);
      dialog.addEventListener("pointerdown", onPointerDown);
      dialog.addEventListener("click", onClick);
      layer.cleanup = () => {
        dialog.removeEventListener("close", onClose);
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("click", onClick);
      };
      layers.set(name, layer);
    },

    open(name, options = {}) {
      const layer = layers.get(name);
      if (!layer || layer.dialog.open || openLayer()) {
        return false;
      }
      const active = doc.activeElement;
      layer.opener = options.opener ?? (active instanceof HTMLElement && active !== doc.body ? active : null);
      layer.dialog.showModal();
      win.history.pushState({ ...(win.history.state ?? {}), [LAYER_STATE_KEY]: name }, "");
      syncRoot();
      return true;
    },

    close(name) {
      const layer = layers.get(name);
      if (!layer?.dialog.open) {
        return Promise.resolve();
      }
      const closed = new Promise<void>((resolve) => layer.closeWaiters.push(resolve));
      layer.dialog.close();
      return closed;
    },

    current: () => openLayer()?.name ?? null,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    destroy() {
      win.removeEventListener("popstate", onPopState);
      layers.forEach((layer) => {
        layer.cleanup();
        layer.closeWaiters.forEach((resolve) => resolve());
      });
      layers.clear();
      listeners.clear();
      settle();
    },
  };
}
