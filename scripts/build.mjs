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
  entryPoints: ["cms/admin.js", "cms/gallery.js", "cms/prices.js"],
  bundle: true,
  minify: true,
  outdir: "dist/cms",
  target: "es2022",
  format: "esm",
  define: { OP_URL: JSON.stringify(url.origin), OP_KEY: JSON.stringify(key) },
});
await writeFile("dist/robots.txt", "User-agent: *\nDisallow: /admin\n");
