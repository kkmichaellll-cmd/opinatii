import test from "node:test";
import assert from "node:assert/strict";
import { optimize } from "../cms/optimize-photo.js";

test("native WebP stays on the fast path and a PNG response switches both photo sizes to the worker", async (t) => {
  const nativeWebP = new Blob(["native"], { type: "image/webp" });
  const fallbackWebP = new Blob(["encoded"], { type: "image/webp" });
  let canvasResult = nativeWebP;
  let nativeCalls = 0;
  let terminated = 0;
  const jobs = [];
  const globals = {
    Image: class {
      naturalWidth = 4000;
      naturalHeight = 3000;
      async decode() {}
      removeAttribute() {}
    },
    document: {
      createElement() {
        return {
          getContext: () => ({
            drawImage() {},
            getImageData(x, y, width, height) {
              return { width, height, data: new Uint8ClampedArray(4) };
            },
          }),
          toBlob(callback) {
            nativeCalls++;
            callback(canvasResult);
          },
        };
      },
    },
    Worker: class {
      postMessage({ width, height, quality }) {
        jobs.push([width, height, quality]);
        this.onmessage({ data: { blob: fallbackWebP } });
      }
      terminate() {
        terminated++;
      }
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    });
  }

  const file = new Blob(["input"], { type: "image/jpeg" });
  const native = await optimize(file);
  assert.ok(native.every((blob) => blob === nativeWebP));
  assert.equal(nativeCalls, 2);
  assert.equal(jobs.length, 0);

  canvasResult = new Blob(["fallback from canvas"], { type: "image/png" });
  const result = await optimize(file);
  assert.ok(result.every((blob) => blob === fallbackWebP));
  assert.equal(nativeCalls, 3);
  assert.deepEqual(jobs, [
    [800, 600, 0.83],
    [2560, 1920, 0.89],
  ]);
  assert.equal(terminated, 1);
});
