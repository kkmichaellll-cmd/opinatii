// The bucket accepts up to 6 MiB per WebP derivative (see 01-schema.sql).
const maxStoredBytes = 6 * 1024 * 1024;
let tryNativeWebP = true;

async function nativeWebP(canvas, quality) {
  if (!tryNativeWebP || typeof canvas.toBlob !== "function") return null;
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  ).catch(() => null);
  if (blob?.type === "image/webp" && blob.size) return blob;
  // A browser without a WebP encoder usually returns a PNG instead.
  if (blob && blob.type !== "image/webp") tryNativeWebP = false;
  return null;
}

function encodePixels(worker, imageData, quality) {
  return new Promise((resolve, reject) => {
    worker.onerror = worker.onmessageerror = () =>
      reject(
        new Error(
          "The photo encoder could not load. Reload the admin page and retry.",
        ),
      );
    worker.onmessage = ({ data }) => {
      if (data.error) reject(new Error(data.error));
      else resolve(data.blob);
    };
    const { data: pixels, width, height } = imageData;
    worker.postMessage({ pixels, width, height, quality }, [pixels.buffer]);
  });
}

export async function optimize(file) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  )
    throw new Error("Choose a JPEG, PNG, WebP or AVIF photograph.");
  if (file.size > 40 * 1024 * 1024)
    throw new Error("Each original must be 40 MB or smaller.");

  const image = new Image();
  const source = URL.createObjectURL(file);
  let worker;

  async function encodeAt(edge, quality) {
    const scale = Math.min(
      1,
      edge / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    try {
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error(
          "Insufficient memory to resize the photograph. Try a smaller copy.",
        );
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (!worker) {
        const blob = await nativeWebP(canvas, quality);
        if (blob) return blob;
      }
      worker ??= new Worker("/cms/webp-encoder.js", { type: "module" });
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      return encodePixels(worker, imageData, quality);
    } finally {
      canvas.width = canvas.height = 1;
    }
  }

  async function fit(edge, quality) {
    let result = await encodeAt(edge, quality);
    while (result.size > maxStoredBytes) {
      edge = Math.floor(edge * 0.8);
      result = await encodeAt(edge, quality);
    }
    return result;
  }

  try {
    image.src = source;
    await image.decode().catch(() => {
      throw new Error(
        "Could not read this photograph. Try another JPEG, PNG, WebP or AVIF file.",
      );
    });
    return [await fit(800, 0.83), await fit(2560, 0.89)];
  } finally {
    worker?.terminate();
    image.removeAttribute("src");
    URL.revokeObjectURL(source);
  }
}
