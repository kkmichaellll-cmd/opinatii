import { db, bucket, check } from "./common.js";
import { optimize } from "./optimize-photo.js";
export { optimize };

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
