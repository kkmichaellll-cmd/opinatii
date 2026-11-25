import { el } from "./common.js";
import { icon } from "./icons.js";
export { icon };
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
