import { db, el, check } from "./common.js";
import { btn, field, note, textInput } from "./ui.js";
import { gallery } from "./manage-gallery.js";
import { pricing } from "./manage-pricing.js";
import { cleanStorage } from "./uploads.js";
const main = document.querySelector("#studio"),
  nav = document.querySelector("#admin-nav");
let active = "Gallery",
  generation = 0,
  authorized = false;
function login(message = "") {
  authorized = false;
  ++generation;
  nav.hidden = true;
  nav.replaceChildren();
  main.inert = false;
  main.setAttribute("aria-busy", "false");
  if (document.querySelector("#editor").open)
    document.querySelector("#editor").close();
  const email = textInput("", {
      type: "email",
      autocomplete: "username",
      required: true,
    }),
    password = textInput("", {
      type: "password",
      autocomplete: "current-password",
      required: true,
    });
  const status = el("p", { class: "form-error", role: "alert" }, message);
  const submit = el("button", { class: "primary", type: "submit" }, "Sign in");
  const form = el(
    "form",
    { class: "login" },
    el("p", { class: "eyebrow" }, "OPINATII PHOTOGRAPHY"),
    el("h1", {}, "Studio sign in"),
    field("Email address", email),
    field("Password", password),
    status,
    submit,
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = "Signing in…";
    status.textContent = "";
    try {
      check(
        await db.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value,
        }),
      );
      await enter();
    } catch (e) {
      status.textContent = e.message;
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  };
  main.replaceChildren(form);
}
async function refresh(page = active) {
  const token = ++generation;
  active = page;
  main.inert = true;
  main.setAttribute("aria-busy", "true");
  nav
    .querySelectorAll("button")
    .forEach((b) =>
      b.getAttribute("aria-label") === page
        ? b.setAttribute("aria-current", "page")
        : b.removeAttribute("aria-current"),
    );
  try {
    if (!check(await db.rpc("op_admin"))) {
      await db.auth.signOut({ scope: "local" });
      login("Administrator access is required.");
      return;
    }
    const content = await (page === "Gallery" ? gallery : pricing)({
      refresh: () => refresh(page),
      mutate,
    });
    if (token === generation && authorized) main.replaceChildren(content);
  } catch (e) {
    if (token === generation) {
      main.replaceChildren(
        el("p", {}, e.message),
        btn("Try again", () => refresh()),
      );
      note(e.message, true);
    }
  } finally {
    if (token === generation) {
      main.inert = false;
      main.setAttribute("aria-busy", "false");
    }
  }
}
async function mutate(fn, message) {
  main.inert = true;
  nav.inert = true;
  try {
    check(await fn());
    await refresh();
    note(message);
    cleanStorage().catch(() =>
      note("Saved. Storage cleanup will retry at the next sign-in.", true),
    );
  } finally {
    main.inert = false;
    nav.inert = false;
  }
}
async function enter() {
  if (!check(await db.rpc("op_admin"))) {
    await db.auth.signOut({ scope: "local" });
    login("Administrator access is required.");
    return;
  }
  authorized = true;
  nav.hidden = false;
  nav.replaceChildren(
    btn("Gallery", () => refresh("Gallery"), "gallery"),
    btn("Pricing", () => refresh("Pricing"), "pricing"),
    btn(
      "Logout",
      async () => {
        try {
          check(await db.auth.signOut({ scope: "local" }));
          login();
        } catch (e) {
          note(e.message, true);
        }
      },
      "logout",
    ),
  );
  await refresh("Gallery");
  cleanStorage().catch(() =>
    note("Storage cleanup will retry after your next change.", true),
  );
}
db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") login();
});
try {
  const { session } = check(await db.auth.getSession());
  if (session) await enter();
  else login();
} catch (e) {
  login(e.message);
}
