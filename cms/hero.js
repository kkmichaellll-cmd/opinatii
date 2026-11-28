import { el, rows, images, watchPage } from "./common.js";
import { heroCategory } from "./gallery-options.js";

const reel = document.querySelector(".hero-reel");
const track = reel.querySelector(".carousel-track");
const fallback = reel.querySelector("template");
let signature;
watchPage(async () => {
  const photos = await rows("op_photos", q =>
    q.eq("category_id", heroCategory).eq("published", true));
  const urls = await images(photos, "full");
  const key = JSON.stringify(photos.map(p => [p.id, p.label, urls.get(p.id)]));
  if (key === signature) return;
  const group = el("div", { class: "carousel-group" });
  const originals = new Map(Array.from(fallback.content.querySelectorAll("img"),
    img => [img.getAttribute("src"), img]));
  for (const p of photos) {
    const template = originals.get("assets/" + p.original + "-960.webp");
    const img = template ? template.cloneNode() : el("img", { src: urls.get(p.id), decoding: "async" });
    img.alt = p.label;
    group.append(el("figure", { class: "carousel-photo" }, img));
  }
  const repeat = group.cloneNode(true);
  repeat.setAttribute("aria-hidden", "true");
  repeat.inert = true;
  // Fill wide screens when only a few slides are published.
  if (photos.length && photos.length < 5) {
    const copies = Math.ceil(5 / photos.length);
    for (let i = 1; i < copies; i++) {
      for (const slide of Array.from(repeat.children)) {
        const copy = slide.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        group.append(copy);
      }
    }
    repeat.replaceChildren(...Array.from(group.children, slide => slide.cloneNode(true)));
  }
  track.replaceChildren(group, repeat);
  reel.hidden = !photos.length;
  signature = key;
}, () => {
  if (signature === undefined && !track.childElementCount)
    track.append(fallback.content.cloneNode(true));
});
