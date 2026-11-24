import { db, el, rows } from "./common.js";
import {
  btn,
  field,
  formDialog,
  note,
  option,
  textInput,
  tools,
} from "./ui.js";
const services = {
  weddings: "Weddings",
  events: "Events",
  portraits: "Studio & Portraits",
  editorial: "Editorial",
};
let service = "weddings",
  days = 1;
export async function pricing({ refresh, mutate }) {
  const duration = service === "weddings" ? days : 0;
  const packages = await rows("op_packages", (q) =>
    q.eq("service", service).eq("days", duration),
  );
  const sel = el(
    "select",
    {},
    ...Object.entries(services).map(([id, name]) =>
      option(id, name, id === service),
    ),
  );
  sel.onchange = () => {
    service = sel.value;
    refresh();
  };
  const filters = el(
    "div",
    { class: "filters" },
    field("Photography category", sel),
  );
  if (duration) {
    const s = el(
      "select",
      {},
      option(1, "One day", days === 1),
      option(2, "Two days", days === 2),
    );
    s.onchange = () => {
      days = Number(s.value);
      refresh();
    };
    filters.append(field("Wedding coverage", s));
  }
  function edit(p) {
    const name = textInput(p?.name, { required: true, maxlength: 160 }),
      price = textInput(p?.price),
      description = el("textarea", {}, p?.description || ""),
      published = el("input", { type: "checkbox", checked: p?.published });
    const list = el("div", { class: "edit-form" });
    function feature(value) {
      const input = textInput(value, {
        "aria-label": "Package feature",
        required: true,
      });
      const row = el("div", { class: "feature" }, input);
      row.append(
        btn(
          "Move feature earlier",
          () => {
            if (row.previousElementSibling)
              list.insertBefore(row, row.previousElementSibling);
            sync();
          },
          "up",
          "",
          true,
        ),
        btn(
          "Move feature later",
          () => {
            if (row.nextElementSibling)
              list.insertBefore(row.nextElementSibling, row);
            sync();
          },
          "down",
          "",
          true,
        ),
        btn(
          "Remove feature",
          () => {
            if (confirm("Remove this feature from the package?")) {
              row.remove();
              sync();
            }
          },
          "trash",
          "",
          true,
        ),
      );
      list.append(row);
      sync();
      return input;
    }
    function sync() {
      [...list.children].forEach((row, i) => {
        const [a, b] = row.querySelectorAll("button");
        a.disabled = i === 0;
        b.disabled = i === list.children.length - 1;
      });
    }
    (p?.inclusions || []).forEach(feature);
    formDialog(
      p ? "Edit package" : "New package",
      [
        el(
          "p",
          { class: "muted" },
          services[service] +
            (duration ? " · " + duration + " day coverage" : ""),
        ),
        field("Package name", name),
        field("Price", price),
        field("Description", description),
        el("h3", {}, "Package features"),
        list,
        btn("Add feature", () => feature("").focus(), "plus"),
        el("label", { class: "check" }, published, "Published"),
      ],
      async () => {
        const data = {
          name: name.value.trim(),
          price: price.value.trim(),
          description: description.value.trim(),
          inclusions: [...list.querySelectorAll("input")].map((x) =>
            x.value.trim(),
          ),
          published: published.checked,
        };
        if (!data.name || data.inclusions.some((v) => !v))
          throw Error("Enter a package name and fill in every feature.");
        const save = () =>
          p
            ? db
                .from("op_packages")
                .update(data)
                .eq("id", p.id)
                .eq("revision", p.revision)
                .select("id")
                .maybeSingle()
            : db
                .from("op_packages")
                .insert({ ...data, service, days: duration })
                .select("id")
                .single();
        await mutate(async () => {
          const r = await save();
          if (!r.error && !r.data)
            throw Error(
              "This package changed in another session. Close this form and reopen Pricing to load the latest version.",
            );
          return r;
        }, "Package saved.");
      },
    );
  }
  const root = el(
    "section",
    {},
    el(
      "div",
      { class: "heading-row" },
      el("h1", {}, "Pricing"),
      btn("New package", () => edit(null), "plus", "primary"),
    ),
    filters,
  );
  const act = (fn, msg) => () =>
    mutate(fn, msg).catch((e) => note(e.message, true));
  packages.forEach((p, i) => {
    const controls = tools();
    for (const step of [-1, 1]) {
      const b = btn(
        step < 0 ? "Move earlier" : "Move later",
        act(
          () => db.rpc("op_shift", { kind: "package", item: p.id, step }),
          "Order saved.",
        ),
        step < 0 ? "up" : "down",
        "",
        true,
      );
      b.disabled = step < 0 ? i === 0 : i === packages.length - 1;
      controls.append(b);
    }
    controls.append(
      btn("Edit", () => edit(p), "edit"),
      btn(
        p.published ? "Unpublish" : "Publish",
        act(
          () =>
            db
              .from("op_packages")
              .update({ published: !p.published })
              .eq("id", p.id)
              .eq("revision", p.revision)
              .select("id")
              .single(),
          "Publication updated.",
        ),
        "eye",
      ),
      btn(
        "Delete " + p.name,
        () =>
          formDialog(
            "Delete this package?",
            [el("p", {}, p.name)],
            () =>
              mutate(
                () =>
                  db
                    .from("op_packages")
                    .delete()
                    .eq("id", p.id)
                    .eq("revision", p.revision)
                    .select("id")
                    .single(),
                "Package deleted.",
              ),
            "Delete",
            true,
          ),
        "trash",
        "",
        true,
      ),
    );
    root.append(
      el(
        "article",
        { class: "package-row" },
        el(
          "div",
          {},
          el("h3", {}, p.name),
          el(
            "p",
            { class: "muted" },
            (p.price || "Pricing to be confirmed") +
              " · " +
              (p.published ? "Published" : "Draft"),
          ),
        ),
        controls,
      ),
    );
  });
  if (!packages.length)
    root.append(el("p", {}, "No packages in this collection yet."));
  return root;
}
