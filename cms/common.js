import { createClient } from "@supabase/supabase-js";
export const bucket = "opinatii-gallery";
export const db = createClient(OP_URL, OP_KEY, {
  auth: {
    persistSession: location.pathname.startsWith("/admin"),
    storage: sessionStorage,
    autoRefreshToken: location.pathname.startsWith("/admin"),
    detectSessionInUrl: false,
  },
});
export function check(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function rows(table, filter = (q) => q, order = "position") {
  const out = [];
  for (let start = 0; ; start += 100) {
    const page = check(
      await filter(db.from(table).select("*"))
        .order(order)
        .order("id")
        .range(start, start + 99),
    );
    out.push(...page);
    if (page.length < 100) return out;
  }
}
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else if (value !== false && value != null)
      node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children);
  return node;
}
const cache = new Map();
export async function images(photos, size) {
  const urls = new Map();
  const paths = [];
  for (const p of photos) {
    if (p.original) {
      const px =
        size === "preview"
          ? 480
          : p.original.startsWith("footer-")
            ? 960
            : 1600;
      urls.set(p.id, "/assets/" + p.original + "-" + px + ".webp");
      continue;
    }
    const path = p.asset + "/" + size + ".webp";
    const hit = cache.get(path);
    if (hit && hit.until > Date.now()) urls.set(p.id, hit.url);
    else paths.push([p.id, path]);
  }
  for (let i = 0; i < paths.length; i += 80) {
    const chunk = paths.slice(i, i + 80);
    const signed = check(
      await db.storage.from(bucket).createSignedUrls(
        chunk.map((x) => x[1]),
        300,
      ),
    );
    signed.forEach((x, j) => {
      if (!x.signedUrl) throw Error("Could not load a photograph.");
      urls.set(chunk[j][0], x.signedUrl);
      cache.set(chunk[j][1], { url: x.signedUrl, until: Date.now() + 210000 });
    });
  }
  return urls;
}
export function watchPage(load, fail) {
  let busy = false;
  const run = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      await load();
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  };
  run();
  setInterval(run, 30000);
  document.addEventListener("visibilitychange", run);
  window.addEventListener("pageshow", run);
  return run;
}
