// Lo que el panel suma a Sveltia CMS para que Aixa pueda crear y editar productos enteros:
// - La tabla de precios: una fila por cada combinación de las opciones que cambian el precio, que
//   se arma sola al tocar las opciones y no deja guardar mientras falte un precio.
// - Al guardar, los códigos (id) de los grupos, las opciones y los adicionales nuevos. Después no
//   cambian aunque cambie el nombre: los pedidos guardados en el navegador de la clienta los usan.
// Las reglas son las de src/catalog.ts (slugify y priceRowLabel): si cambian allá, cambian acá.
(() => {
  const CMS = window.CMS;
  const { createElement: h, useEffect, useImperativeHandle, useRef } = CMS.React;

  const SINGLE_PRICE = "Precio único";
  const DEFAULT_UNIT = "por unidad";

  // Sveltia pasa algunos valores como Immutable: acá se trabaja siempre con objetos comunes.
  const plain = (value) => (value && typeof value.toJS === "function" ? value.toJS() : value);
  const list = (value) => (Array.isArray(plain(value)) ? plain(value) : []);

  function slugify(text) {
    return String(text ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Los grupos que cambian el precio, con los nombres de sus opciones.
  function pricedGroups(groups) {
    return list(groups)
      .filter((group) => group && group.changesPrice !== false)
      .map((group) => list(group.options).map((option) => (option && option.label) || ""));
  }

  // Cada combinación como lista de nombres, una opción por grupo.
  function combinations(priced) {
    return priced.reduce((paths, labels) => paths.flatMap((path) => labels.map((label) => [...path, label])), [[]]);
  }

  const rowLabel = (parts) => parts.join(" · ") || SINGLE_PRICE;
  // Para reconocer una fila aunque se hayan reordenado los grupos.
  const partsKey = (parts) => [...parts].sort().join("\u0000");

  // Las filas que tiene que haber, en orden y sin repetir.
  function rowLabels(groups) {
    return [...new Set(combinations(pricedGroups(groups)).map(rowLabel))];
  }

  // Si se cambió el nombre de una opción (no se agregó, borró ni reordenó), su precio la sigue.
  function renamedRows(before, after) {
    const old = pricedGroups(before);
    const now = pricedGroups(after);
    if (old.length !== now.length) {
      return new Map();
    }
    const perGroup = now.map((labels, index) => {
      const previous = old[index];
      const renames = new Map();
      if (previous.length === labels.length) {
        previous.forEach((label, position) => {
          const next = labels[position];
          if (label !== next && !labels.includes(label) && !previous.includes(next)) {
            renames.set(label, next);
          }
        });
      }
      return renames;
    });
    const rows = new Map();
    if (perGroup.every((renames) => renames.size === 0)) {
      return rows;
    }
    for (const parts of combinations(old)) {
      const renamed = parts.map((label, index) => perGroup[index].get(label) ?? label);
      if (rowLabel(parts) !== rowLabel(renamed)) {
        rows.set(rowLabel(renamed), rowLabel(parts));
      }
    }
    return rows;
  }

  // La unidad más usada en las filas que ya están, para no tener que escribirla en cada una.
  function usualUnit(rows) {
    const counts = new Map();
    for (const row of rows) {
      if (row.unit) {
        counts.set(row.unit, (counts.get(row.unit) ?? 0) + 1);
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEFAULT_UNIT;
  }

  // Las filas justas para las opciones de ahora, con los precios que ya había.
  function normalizeRows(rows, groups, renames) {
    const byLabel = new Map(rows.map((row) => [row.label, row]));
    const byParts = new Map(rows.map((row) => [partsKey(String(row.label).split(" · ")), row]));
    const unit = usualUnit(rows);
    return combinations(pricedGroups(groups))
      .filter((parts, index, all) => all.findIndex((other) => rowLabel(other) === rowLabel(parts)) === index)
      .map((parts) => {
        const label = rowLabel(parts);
        const found = byLabel.get(label) ?? byLabel.get(renames.get(label)) ?? byParts.get(partsKey(parts));
        return { label, price: found?.price ?? null, unit: found?.unit || unit };
      });
  }

  const validPrice = (price) => Number.isInteger(price) && price > 0;

  function missingPrices(rows) {
    return rows.filter((row) => !validPrice(row.price) || !String(row.unit ?? "").trim()).map((row) => row.label);
  }

  // minWidth 0: sin eso los campos no se achican y en el celular la tabla se sale de la pantalla.
  const cell = {
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    height: "var(--sui-textbox-height, 36px)",
    padding: "0 8px",
    border: "1px solid var(--sui-textbox-border-color, #888)",
    borderRadius: "var(--sui-textbox-border-radius, 4px)",
    background: "var(--sui-textbox-background-color, transparent)",
    color: "var(--sui-textbox-foreground-color, inherit)",
    font: "inherit",
  };

  function PriceTable(props) {
    const { entry, onChange, forID } = props;
    const groups = plain(entry?.getIn(["data", "groups"])) ?? [];
    const groupsKey = JSON.stringify(groups);
    const value = list(props.value);
    const previousGroups = useRef(groups);
    const latest = useRef({ rows: value, groups });
    latest.current = { rows: value, groups };

    // Cada vez que cambian las opciones, la tabla se acomoda sola y guarda lo que corresponde.
    useEffect(() => {
      const renames = renamedRows(previousGroups.current, groups);
      previousGroups.current = groups;
      const rows = normalizeRows(value, groups, renames);
      if (JSON.stringify(rows) !== JSON.stringify(value)) {
        onChange(rows);
      }
    }, [groupsKey, JSON.stringify(value)]);

    useImperativeHandle(
      props.ref,
      () => ({
        isValid: () => {
          const rows = normalizeRows(latest.current.rows, latest.current.groups, new Map());
          const missing = missingPrices(rows);
          if (rows.length === 0) {
            return { error: { message: "Cada grupo de opciones necesita al menos una opción." } };
          }
          if (missing.length === 0) {
            return true;
          }
          const names = missing.slice(0, 3).map((label) => `«${label}»`).join(", ");
          const more = missing.length > 3 ? ` y ${missing.length - 3} más` : "";
          return { error: { message: `Falta el precio (un número entero, sin puntos) o la unidad de ${names}${more}.` } };
        },
      }),
      [],
    );

    const rows = normalizeRows(value, groups, new Map());
    const update = (index, change) => {
      onChange(rows.map((row, position) => (position === index ? { ...row, ...change } : row)));
    };

    if (rows.length === 0) {
      return h("p", { style: { margin: 0 } }, "Agregá al menos una opción en cada grupo para cargar los precios.");
    }

    return h(
      "div",
      {
        id: forID,
        style: {
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.3fr)",
          gap: "8px 10px",
          alignItems: "center",
          maxWidth: "100%",
        },
      },
      h("span", { style: { fontSize: "var(--sui-font-size-small, 12px)", opacity: 0.75 } }, "Opción"),
      h("span", { style: { fontSize: "var(--sui-font-size-small, 12px)", opacity: 0.75 } }, "Precio ($)"),
      h("span", { style: { fontSize: "var(--sui-font-size-small, 12px)", opacity: 0.75 } }, "Unidad"),
      ...rows.flatMap((row, index) => {
        const name = `${row.label}`;
        const priceMissing = !validPrice(row.price);
        return [
          h("span", { key: `l-${name}`, style: { overflowWrap: "anywhere" } }, name),
          h("input", {
            key: `p-${name}`,
            type: "number",
            inputMode: "numeric",
            min: 1,
            step: 1,
            "aria-label": `Precio de ${name}`,
            "aria-invalid": priceMissing,
            value: row.price ?? "",
            style: { ...cell, ...(priceMissing && { borderColor: "var(--sui-error-border-color, #d33)" }) },
            onChange: (event) => {
              const text = event.target.value.replace(/[^\d]/g, "");
              update(index, { price: text === "" ? null : Number(text) });
            },
          }),
          h("input", {
            key: `u-${name}`,
            type: "text",
            "aria-label": `Unidad de ${name}`,
            value: row.unit ?? "",
            style: cell,
            onChange: (event) => update(index, { unit: event.target.value }),
          }),
        ];
      }),
    );
  }

  CMS.registerFieldType({ name: "precios", controlComponent: PriceTable });

  // El código guardado o, si falta, uno que sale del nombre; si se repite, con -2, -3…
  function assignIds(items, prefix, fallback) {
    const used = new Set();
    for (const item of items) {
      const base = String(item.id ?? "").trim() || `${prefix}${slugify(item.label) || fallback}`;
      let id = base;
      for (let n = 2; used.has(id); n++) {
        id = `${base}-${n}`;
      }
      used.add(id);
      item.id = id;
    }
  }

  CMS.registerEventListener({
    name: "preSave",
    handler: ({ entry }) => {
      if (entry.get("collection") !== "productos") {
        return undefined;
      }
      const data = entry.get("data");
      const slug = entry.get("slug") || slugify(data.get("name"));
      const groups = list(data.get("groups"));
      assignIds(groups, "", "opciones");
      for (const group of groups) {
        group.options = list(group.options);
        assignIds(group.options, "", "opcion");
      }
      const addOns = list(data.get("addOns"));
      assignIds(addOns, `${slug}-`, "adicional");
      // Solo las filas de precio de las opciones de ahora.
      const prices = normalizeRows(list(data.get("prices")), groups, new Map());
      return data.set("groups", groups).set("addOns", addOns).set("prices", prices);
    },
  });

  CMS.init();
})();
