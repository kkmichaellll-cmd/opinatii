/*! Uses @jsquash/webp and libwebp. See webp-encoder-LICENSE.txt and libwebp-LICENSE.txt. */
import createEncoder from "@jsquash/webp/codec/enc/webp_enc.js";
import wasmUrl from "@jsquash/webp/codec/enc/webp_enc.wasm";
import { defaultOptions } from "@jsquash/webp/meta.js";

// The uploader sends one resized image at a time and releases this worker after each file.
let encoder;
self.onmessage = async ({ data: { pixels, width, height, quality } }) => {
  try {
    encoder ??= createEncoder({
      locateFile: () => new URL(wasmUrl, self.location.href).href,
    });
    const codec = await encoder;
    const bytes = codec.encode(pixels, width, height, {
      ...defaultOptions,
      quality: Math.round(quality * 100),
      low_memory: 1,
    });
    if (!bytes?.byteLength) throw new Error("Empty encoded image");
    self.postMessage({ blob: new Blob([bytes], { type: "image/webp" }) });
  } catch {
    self.postMessage({
      error:
        "Could not prepare the photograph for upload. Check your connection and retry.",
    });
  }
};
