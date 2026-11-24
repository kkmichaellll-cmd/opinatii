import { rows, watchPage } from "./common.js";
let previous;
watchPage(
  async () => {
    const data = await rows("op_packages", (q) => q.eq("published", true));
    const serialized = JSON.stringify(data);
    if (serialized !== previous) {
      window.dispatchEvent(
        new CustomEvent("opinatii-prices", { detail: { rows: data } }),
      );
      previous = serialized;
    }
  },
  () => {
    previous = null;
    window.dispatchEvent(
      new CustomEvent("opinatii-prices", { detail: { error: true } }),
    );
  },
);
