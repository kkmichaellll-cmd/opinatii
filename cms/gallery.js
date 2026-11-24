import { rows, images, el, watchPage } from "./common.js";
const menu = document.querySelector("#mobile-menu"),
  toggle = document.querySelector(".menu-toggle");
toggle.onclick = () => {
  menu.showModal();
  toggle.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
};
menu.querySelector(".menu-close").onclick = () => menu.close();
menu.onclose = () => {
  toggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
  toggle.focus();
};
const content = document.querySelector("#gallery-content"),
  viewer = document.querySelector("#viewer"),
  full = document.querySelector("#full-photo");
let categories = [],
  photos = [],
  visible = [],
  current = null,
  version = 0,
  viewVersion = 0;
function categoryId() {
  return new URL(location.href).searchParams.get("category");
}
async function showPhoto(p) {
  if (!p) return;
  current = p.id;
  const seq = ++viewVersion;
  if (!viewer.open) viewer.showModal();
  full.removeAttribute("src");
  full.alt = "Loading photograph…";
  document.querySelector("#photo-index").textContent =
    visible.findIndex((x) => x.id === p.id) + 1 + " / " + visible.length;
  try {
    const urls = await images([p], "full");
    if (seq === viewVersion) {
      full.src = urls.get(p.id);
      full.alt = p.label;
    }
  } catch {
    if (seq === viewVersion) full.alt = "Photograph could not be loaded.";
  }
}
function move(step) {
  const ix = visible.findIndex((p) => p.id === current);
  showPhoto(visible[(ix + step + visible.length) % visible.length]);
}
document.querySelector("#close-viewer").onclick = () => viewer.close();
viewer.onclose = () => {
  current = null;
  viewVersion++;
};
document.querySelector("#prev-photo").onclick = () => move(-1);
document.querySelector("#next-photo").onclick = () => move(1);
viewer.onkeydown = (e) => {
  if (e.key === "ArrowLeft") move(-1);
  if (e.key === "ArrowRight") move(1);
};
let signature = "";
async function render() {
  const seq = ++version;
  const cat = categories.find((c) => c.id === categoryId());
  visible = cat ? photos.filter((p) => p.category_id === cat.id) : [];
  if (viewer.open && !visible.some((p) => p.id === current)) viewer.close();
  const items = cat
    ? visible
    : categories
        .map((c) => ({
          c,
          p:
            photos.find((p) => p.category_id === c.id && p.cover) ||
            photos.find((p) => p.category_id === c.id),
        }))
        .filter((pair) => pair.p);
  const urls = await images(cat ? items : items.map((x) => x.p), "preview");
  if (seq !== version) return;
  const key = JSON.stringify([cat, items, [...urls.values()]]);
  if (key === signature) return;
  signature = key;
  const grid = el("div", { class: "collection-grid" });
  for (const entry of items) {
    const p = cat ? entry : entry.p;
    const img = el("img", {
      src: urls.get(p.id),
      alt: cat ? p.label : "",
      loading: "lazy",
      decoding: "async",
    });
    if (cat)
      grid.append(
        el("button", { class: "photo-tile", onclick: () => showPhoto(p) }, img),
      );
    else
      grid.append(
        el(
          "a",
          { class: "collection-tile", href: "/gallery?category=" + entry.c.id },
          img,
          el("h2", {}, entry.c.name),
        ),
      );
  }
  const header = cat
    ? el(
        "div",
        { class: "collection-caption" },
        el("a", { href: "/gallery" }, "← All collections"),
        el("h2", {}, cat.name),
      )
    : el("h2", { class: "collection-caption" }, "Collections");
  content.replaceChildren(
    header,
    items.length ? grid : el("p", {}, "No published photographs yet."),
  );
  content.setAttribute("aria-busy", "false");
}
watchPage(
  async () => {
    [categories, photos] = await Promise.all([
      rows("op_categories", (q) => q, "created_at"),
      rows("op_photos", (q) => q.eq("published", true)),
    ]);
    await render();
  },
  () => {
    signature = "";
    if (viewer.open) viewer.close();
    content.setAttribute("aria-busy", "false");
    content.replaceChildren(
      el("p", {}, "The gallery could not be loaded."),
      el(
        "button",
        { class: "button", onclick: () => location.reload() },
        "Try again",
      ),
    );
  },
);
