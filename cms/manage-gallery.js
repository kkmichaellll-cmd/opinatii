import { heroCategory, photoLink } from "./gallery-options.js";
import { db, el, rows, images } from "./common.js";
import {
  btn,
  icon,
  field,
  formDialog,
  note,
  option,
  textInput,
  tools,
} from "./ui.js";
import { savePhoto, cleanStorage } from "./uploads.js";
let category = "";
export async function gallery({ refresh, mutate }) {
  const cats = await rows("op_categories", (q) => q, "created_at");
  if (!cats.some((c) => c.id === category)) category = cats[0]?.id || "";
  const hero = category === heroCategory;
  const current = cats.find((c) => c.id === category);
  const photos = current
    ? await rows("op_photos", (q) => q.eq("category_id", category))
    : [];
  const urls = await images(photos, "preview"),
    selected = new Set();
  const root = el("section"),
    selector = el(
      "select",
      {},
      ...cats.map((c) => option(c.id, c.id === heroCategory ? "Homepage hero carousel" : c.name, c.id === category)),
    );
  const queue = [],
    previews = el("div", { class: "pending" });
  let replacement = null;
  function clear() {
    queue.forEach((x) => URL.revokeObjectURL(x.url));
    queue.length = 0;
    replacement = null;
  }
  const observer = new MutationObserver(() => {
    if (!root.isConnected) {
      clear();
      observer.disconnect();
    }
  });
  observer.observe(document.querySelector("#studio"), { childList: true });
  selector.onchange = () => {
    category = selector.value;
    refresh();
  };
  const act = (fn, msg) => () =>
    mutate(fn, msg).catch((e) => note(e.message, true));
  function categoryForm(edit) {
    const name = textInput(edit ? current.name : "", {
      required: true,
      maxlength: 120,
    });
    formDialog(
      edit ? "Rename category" : "New gallery category",
      [field("Category name", name)],
      async () => {
        const value = name.value.trim();
        if (!value) throw Error("Enter a category name.");
        await mutate(
          async () => {
            const q = edit
              ? db
                  .from("op_categories")
                  .update({ name: value })
                  .eq("id", category)
              : db.from("op_categories").insert({ name: value });
            const result = await q.select("id").single();
            if (result.data) category = result.data.id;
            return result;
          },
          edit ? "Category renamed." : "Category created.",
        );
      },
    );
  }
  const removeCategory = () =>
    formDialog(
      "Delete " + current.name + "?",
      [el("p", {}, "This deletes the category and all photographs in it.")],
      () =>
        mutate(
          () =>
            db
              .from("op_categories")
              .delete()
              .eq("id", category)
              .select("id")
              .single(),
          "Category deleted.",
        ),
      "Delete category",
      true,
    );
  root.append(
    el(
      "div",
      { class: "heading-row" },
      el("h1", {}, "Gallery"),
      btn("New category", () => categoryForm(false), "plus", "primary"),
    ),
  );
  if (!current) {
    root.append(el("p", {}, "Create a category to upload photographs."));
    return root;
  }
  root.append(
    el(
      "div",
      { class: "filters" },
      field("Manage photographs", selector),
      hero ? el("p", { class: "muted" }, "Published slides appear on the homepage in this order.") : tools(
        btn("Rename", () => categoryForm(true), "edit"),
        btn("Delete category", removeCategory, "trash"),
      ),
    ),
  );
  const file = el("input", {
    type: "file",
    class: "file-input",
    accept: "image/jpeg,image/png,image/webp,image/avif",
    multiple: true,
    id: "photo-files",
  });
  const drop = el(
    "div",
    { class: "drop" },
    el(
      "label",
      { for: "photo-files" },
      icon("upload"),
      "Choose photographs or drop them here",
      file,
    ),
    el("p", { class: "muted" }, "JPEG, PNG, WebP or AVIF · Up to 40 MB each"),
  );
  const publish = el("input", { type: "checkbox", checked: true }),
    bar = el("progress", { max: 100, value: 0 }),
    status = el("p", { "aria-live": "polite" });
  const staged = el(
    "div",
    { hidden: true },
    previews,
    el("label", { class: "check" }, publish, "Publish after upload"),
    bar,
    status,
  );
  function drawQueue() {
    staged.hidden = !queue.length;
    previews.replaceChildren(
      ...queue.map((x, i) =>
        el(
          "div",
          {},
          el("img", { src: x.url, alt: x.file.name }),
          btn(
            "Remove " + x.file.name,
            () => {
              URL.revokeObjectURL(x.url);
              queue.splice(i, 1);
              if (!queue.length) replacement = null;
              drawQueue();
            },
            "trash",
            "",
            true,
          ),
        ),
      ),
    );
    submit.textContent = replacement
      ? "Replace photograph"
      : "Upload " +
        queue.length +
        " photograph" +
        (queue.length === 1 ? "" : "s");
    submit.setAttribute("aria-label", submit.textContent);
    staged.querySelector("label").hidden = !!replacement;
  }
  function add(files) {
    for (const f of files) {
      if (
        !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
          f.type,
        ) ||
        f.size > 40 * 1024 * 1024
      ) {
        note("Choose supported photographs of 40 MB or smaller.", true);
        continue;
      }
      queue.push({
        file: f,
        url: URL.createObjectURL(f),
        id: crypto.randomUUID(),
      });
      if (replacement) break;
    }
    drawQueue();
  }
  file.onchange = () => {
    if (replacement) clear();
    add(file.files);
    file.value = "";
  };
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("drag");
  };
  drop.ondragleave = () => drop.classList.remove("drag");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    if (replacement) clear();
    add(e.dataTransfer.files);
  };
  const submit = btn(
    "Upload",
    async () => {
      const total = queue.length,
        wasReplacement = !!replacement;
      let done = 0;
      root.inert = true;
      document.querySelector("#admin-nav").inert = true;
      try {
        while (queue.length) {
          const entry = queue[0];
          status.textContent =
            "Processing " +
            (done + 1) +
            " of " +
            total +
            " · " +
            entry.file.name;
          await savePhoto(
            entry,
            category,
            replacement,
            (f) => (bar.value = (100 * (done + f)) / total),
            publish.checked,
          );
          URL.revokeObjectURL(entry.url);
          queue.shift();
          done++;
          bar.value = (100 * done) / total;
        }
        await refresh();
        cleanStorage().catch(() =>
          note("Storage cleanup will retry at your next sign-in.", true),
        );
        note(wasReplacement ? "Photograph replaced." : "Upload complete.");
      } catch (e) {
        drawQueue();
        status.textContent = done + " saved. " + e.message;
        note(e.message, true);
      } finally {
        root.inert = false;
        document.querySelector("#admin-nav").inert = false;
      }
    },
    null,
    "primary",
  );
  staged.append(submit);
  root.append(drop, staged);
  const bulk = btn(
    "Delete selected",
    () => remove([...selected]),
    "trash",
    "danger",
  );
  bulk.disabled = true;
  function remove(ids) {
    formDialog(
      "Delete " +
        ids.length +
        " photograph" +
        (ids.length === 1 ? "" : "s") +
        "?",
      [el("p", {}, "Deleted photographs disappear from this gallery.")],
      () =>
        mutate(
          () => db.rpc("op_delete_photos", { category, photos: ids }),
          "Photographs deleted.",
        ),
      "Delete",
      true,
    );
  }
  function move(p) {
    const dest = el(
      "select",
      {},
      ...cats.filter((c) => c.id !== category && c.id !== heroCategory).map((c) => option(c.id, c.name)),
    );
    formDialog(
      "Move photograph",
      [field("Destination category", dest)],
      () =>
        mutate(
          () =>
            db
              .from("op_photos")
              .update({ category_id: dest.value })
              .eq("id", p.id)
              .eq("category_id", category)
              .select("id")
              .single(),
          "Photograph moved.",
        ),
      "Move",
    );
  }
  function editLink(p) {
    const input = textInput(p.link_url || "", { type: "url", maxlength: 2048, placeholder: "https://example.com" });
    formDialog("Photograph link", [field("Destination URL (optional)", input),
      el("p", { class: "muted" }, "Leave blank to open the photograph in the gallery viewer.")], async () => {
      const value = input.value.trim();
      const url = photoLink(value);
      if (value && (!url || url.length > 2048)) throw Error("Enter a full http or https website address without login details.");
      await mutate(() => db.from("op_photos").update({ link_url: url }).eq("id", p.id).select("id").single(), "Photograph link saved.");
    });
  }
  const all = el("input", {
    type: "checkbox",
    "aria-label": "Select all photographs",
    disabled: !photos.length,
  });
  const boxes = [];
  function selection() {
    bulk.disabled = !selected.size;
    bulk.textContent = selected.size
      ? "Delete selected (" + selected.size + ")"
      : "Delete selected";
    all.checked = !!photos.length && selected.size === photos.length;
    all.indeterminate = selected.size > 0 && !all.checked;
  }
  all.onchange = () => {
    for (const [p, b] of boxes) {
      b.checked = all.checked;
      if (b.checked) selected.add(p.id);
      else selected.delete(p.id);
    }
    selection();
  };
  root.append(
    el(
      "div",
      { class: "section-line" },
      el("h2", {}, "Photographs"),
      tools(el("label", { class: "check" }, all, "Select all"), bulk),
    ),
  );
  const grid = el("div", { class: "photo-grid" });
  photos.forEach((p, i) => {
    const box = el("input", {
      type: "checkbox",
      "aria-label": "Select " + p.label,
    });
    boxes.push([p, box]);
    box.onchange = () => {
      if (box.checked) selected.add(p.id);
      else selected.delete(p.id);
      selection();
    };
    const controls = tools();
    for (const [label, symbol, fn, disabled] of [
      [
        "Move earlier",
        "up",
        act(
          () => db.rpc("op_shift", { kind: "photo", item: p.id, step: -1 }),
          "Order saved.",
        ),
        i === 0,
      ],
      [
        "Move later",
        "down",
        act(
          () => db.rpc("op_shift", { kind: "photo", item: p.id, step: 1 }),
          "Order saved.",
        ),
        i === photos.length - 1,
      ],
      ["Move to category", "move", () => move(p), !cats.some(c => c.id !== category && c.id !== heroCategory)],
      [
        "Set as cover",
        "star",
        act(() => db.rpc("op_cover", { photo: p.id }), "Cover saved."),
        !p.published || p.cover,
      ],
      [
        "Replace photograph",
        "replace",
        () => {
          const input = el("input", { type: "file", accept: file.accept });
          input.onchange = () => {
            if (input.files.length) {
              clear();
              replacement = p;
              add(input.files);
              staged.scrollIntoView({ block: "center" });
            }
          };
          input.click();
        },
        false,
      ],
      ["Delete photograph", "trash", () => remove([p.id]), false],
    ]) {
      if (hero && (symbol === "move" || symbol === "star")) continue;
      const b = btn(label, fn, symbol, "", true);
      b.disabled = disabled;
      controls.append(b);
    }
    grid.append(
      el(
        "article",
        { class: "photo-card" },
        el("img", { src: urls.get(p.id), alt: p.label, loading: "lazy" }),
        el(
          "div",
          { class: "card-body" },
          el("label", { class: "check" }, box, p.label),
          el(
            "p",
            { class: "muted" },
            (p.published ? "Published" : "Draft") +
              (p.cover ? " · Category cover" : ""),
          ),
          controls,
          ...(hero ? [] : [btn(p.link_url ? "Edit link" : "Add link", () => editLink(p), "edit")]),
          btn(
            p.published ? "Unpublish" : "Publish",
            act(
              () =>
                db
                  .from("op_photos")
                  .update({ published: !p.published })
                  .eq("id", p.id)
                  .select("id")
                  .single(),
              "Publication updated.",
            ),
            "eye",
          ),
        ),
      ),
    );
  });
  root.append(
    photos.length
      ? grid
      : el("p", { class: "muted" }, "This category has no photographs yet."),
  );
  return root;
}
