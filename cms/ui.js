import { el } from "./common.js";
const paths = {
  gallery: "M3 4h18v16H3z M3 16l5-6 5 5 3-3 5 5 M16 8h.01",
  pricing: "M3 4h9l9 9-8 8-10-10z M8 8h.01",
  logout: "M10 4H4v16h6 M9 12h12 M17 8l4 4-4 4",
  plus: "M12 5v14 M5 12h14",
  edit: "M4 20l5-1L21 7l-4-4L5 15z M14 6l4 4",
  trash: "M3 6h18 M8 6V3h8v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7",
  up: "M5 15l7-7 7 7",
  down: "M5 9l7 7 7-7",
  upload: "M12 16V3 M6 9l6-6 6 6 M4 16v5h16v-5",
  star: "M12 3l3 6 6 1-4.5 4.5 1 6-5.5-3-5.5 3 1-6L3 10l6-1z",
  move: "M3 12h17 M14 5l7 7-7 7",
  eye: "M2 12q10-15 20 0-10 15-20 0z M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
  replace:
    "M4 10a8 8 0 0 1 14-5l2 3 M20 3v5h-5 M20 14a8 8 0 0 1-14 5l-2-3 M4 21v-5h5",
};
export function icon(name) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg"),
    p = document.createElementNS(ns, "path");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }))
    svg.setAttribute(k, v);
  p.setAttribute("d", paths[name]);
  svg.append(p);
  return svg;
}
export function btn(label, fn, symbol, cls = "", compact = false) {
  const b = el("button", {
    type: "button",
    class: cls + (compact ? " icon" : ""),
    title: label,
    "aria-label": label,
    onclick: fn,
  });
  if (symbol) b.append(icon(symbol));
  if (!compact) b.append(label);
  return b;
}
export const tools = (...items) => el("div", { class: "tools" }, ...items);
export const field = (label, node) => el("label", {}, label, node);
export const option = (value, label, selected = false) =>
  el("option", { value, selected }, label);
export const textInput = (value = "", attrs = {}) =>
  el("input", { value, ...attrs });
export function note(message, error = false) {
  const n = document.querySelector("#notice");
  n.textContent = message;
  n.classList.toggle("error", error);
  n.setAttribute("role", error ? "alert" : "status");
  clearTimeout(note.timer);
  note.timer = setTimeout(() => (n.textContent = ""), error ? 12000 : 4500);
}
export function formDialog(
  title,
  fields,
  submit,
  save = "Save",
  danger = false,
) {
  const dialog = document.querySelector("#editor"),
    error = el("p", { class: "form-error", role: "alert" });
  const cancel = btn("Cancel", () => dialog.close());
  const confirm = el(
    "button",
    { type: "submit", class: danger ? "danger" : "primary" },
    save,
  );
  const form = el(
    "form",
    { class: "edit-form" },
    el("h2", {}, title),
    ...fields,
    error,
    el("div", { class: "actions" }, cancel, confirm),
  );
  let pending = false;
  dialog.oncancel = (e) => {
    if (pending) e.preventDefault();
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (pending) return;
    pending = true;
    form.inert = true;
    error.textContent = "";
    try {
      await submit();
      dialog.close();
    } catch (e) {
      error.textContent = e.message;
    } finally {
      pending = false;
      form.inert = false;
    }
  };
  dialog.replaceChildren(form);
  dialog.showModal();
}
