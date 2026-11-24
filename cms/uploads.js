import { db, bucket, check } from "./common.js";
export async function optimize(file) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  )
    throw Error("Choose a JPEG, PNG, WebP or AVIF photograph.");
  if (file.size > 40 * 1024 * 1024)
    throw Error("Each original must be 40 MB or smaller.");
  const image = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  async function encode(edge, quality) {
    const ratio = Math.min(1, edge / Math.max(image.width, image.height)),
      c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(image.width * ratio));
    c.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, c.width, c.height);
    try {
      return await new Promise((ok, fail) =>
        c.toBlob(
          (b) =>
            b?.type === "image/webp"
              ? ok(b)
              : fail(Error("WebP encoding is unavailable in this browser.")),
          "image/webp",
          quality,
        ),
      );
    } finally {
      c.width = c.height = 1;
    }
  }
  try {
    return [await encode(800, 0.83), await encode(2560, 0.89)];
  } finally {
    image.close();
  }
}
async function upload(path, blob, progress) {
  const { session } = check(await db.auth.getSession());
  if (!session) throw Error("Your session ended. Sign in again.");
  return new Promise((ok, fail) => {
    const x = new XMLHttpRequest();
    x.open("POST", OP_URL + "/storage/v1/object/" + bucket + "/" + path);
    x.setRequestHeader("apikey", OP_KEY);
    x.setRequestHeader("Authorization", "Bearer " + session.access_token);
    x.setRequestHeader("Content-Type", "image/webp");
    x.timeout = 180000;
    x.upload.onprogress = (e) => progress(e.loaded);
    x.onload = () =>
      x.status >= 200 && x.status < 300
        ? ok()
        : fail(
            Error("Upload failed (" + x.status + "). Retry the photograph."),
          );
    x.onerror = x.ontimeout = () =>
      fail(
        Error("The upload connection was interrupted. Retry the photograph."),
      );
    x.send(blob);
  });
}
export async function savePhoto(entry, cat, replacing, progress, published) {
  const { file } = entry;
  // A response can be lost after the metadata transaction commits.
  if (entry.lastAsset) {
    const existing = check(
      await db
        .from("op_photos")
        .select("asset")
        .eq("id", replacing?.id || entry.id)
        .maybeSingle(),
    );
    if (existing?.asset === entry.lastAsset) {
      progress(1);
      return;
    }
  }
  const [preview, full] = await optimize(file);
  const asset = crypto.randomUUID();
  check(
    await db
      .from("op_cleanup")
      .insert({
        asset,
        after_time: new Date(Date.now() + 86400000).toISOString(),
      }),
  );
  entry.lastAsset = asset;
  const total = preview.size + full.size;
  await upload(asset + "/preview.webp", preview, (n) => progress(n / total));
  await upload(asset + "/full.webp", full, (n) =>
    progress((preview.size + n) / total),
  );
  if (replacing) {
    let update = db
      .from("op_photos")
      .update({ asset, original: null })
      .eq("id", replacing.id);
    update = replacing.asset
      ? update.eq("asset", replacing.asset)
      : update.is("asset", null);
    check(await update.select("id").single());
  } else
    check(
      await db.from("op_photos").insert({
        id: entry.id,
        asset,
        category_id: cat,
        label:
          file.name
            .replace(/\.[^.]+$/, "")
            .trim()
            .slice(0, 250) || "Photograph",
        published,
      }),
    );
}
export async function cleanStorage() {
  const expired = check(
    await db
      .from("op_cleanup")
      .select("asset")
      .lte("after_time", new Date().toISOString())
      .limit(100),
  );
  for (const { asset } of expired) {
    check(
      await db.storage
        .from(bucket)
        .remove(["preview", "full"].map((k) => asset + "/" + k + ".webp")),
    );
    check(await db.from("op_cleanup").delete().eq("asset", asset));
  }
}
