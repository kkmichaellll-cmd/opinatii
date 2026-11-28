import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
const url = new URL(process.env.SUPABASE_URL || "");
const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
)
  throw Error(
    "Supply an HTTPS Supabase project URL and an sb_publishable_ key in the build environment.",
  );
await rm("dist", { recursive: true, force: true });
await mkdir("dist/cms", { recursive: true });
for (const name of [
  "assets",
  "index.html",
  "about.html",
  "about.css",
  "contact.html",
  "contact.css",
  "about.js",
  "app.js",
  "style.css",
  "pricing.html",
  "pricing.css",
  "pricing.js",
  "gallery.html",
  "admin.html",
  "cms/studio.css",
])
  await cp(name, "dist/" + name, { recursive: true });
await build({
  entryPoints: [
    "cms/admin.js",
    "cms/gallery.js",
    "cms/hero.js",
    "cms/prices.js",
    "cms/webp-encoder.js",
  ],
  bundle: true,
  minify: true,
  outdir: "dist/cms",
  loader: { ".wasm": "file" },
  target: "es2022",
  format: "esm",
  define: { OP_URL: JSON.stringify(url.origin), OP_KEY: JSON.stringify(key) },
});
await cp(
  "node_modules/@jsquash/webp/LICENSE",
  "dist/cms/webp-encoder-LICENSE.txt",
);
await cp(
  "node_modules/@jsquash/webp/codec/LICENSE.codec.md",
  "dist/cms/libwebp-LICENSE.txt",
);
await writeFile("dist/robots.txt", "User-agent: *\nDisallow: /admin\n");
