/**
 * A browser pass over every screen — all 43 routes: signed-in indexes and
 * forms, redirect aliases, detail/edit screens on live record ids, and the
 * signed-out pages (visited last, after the session is dropped).
 *
 * `UI_PATTERNS.md` has said since 2026-08-06 that nothing has been checked on
 * screen since the Viho migration, and every entry in DAILY_CHANGES since has
 * repeated it as the largest gap in confidence. The plan blames a missing
 * Chrome-DevTools-Protocol harness. Chrome is installed on this host, so the
 * harness is the missing part, not the browser.
 *
 * Zero dependencies: node's WebSocket (behind --experimental-websocket) speaking
 * CDP to headless Chrome. No Playwright, no Puppeteer, no browser download.
 *
 * For each page it records: where it ended up (a redirect to /login means the
 * session was lost), console errors, failed network requests, whether the
 * sidebar and a heading actually rendered, and how much text is on screen — a
 * client-rendered page that throws during hydration leaves an empty shell, which
 * is exactly the failure that fetching HTML cannot see.
 *
 *   CHECK_EMAIL=… CHECK_PASSWORD=… node --experimental-websocket scripts/browser-check.mjs
 *
 * Requires the stack to be up (docker compose up -d) and Chrome on the host.
 * Node 20 needs --experimental-websocket for the WebSocket global; 22+ does not.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FRONTEND = "http://localhost:3001";
const API = "http://localhost:8002/api/v1";
// From the environment, never hardcoded: this repository is public, and a
// working credential in a committed file is a working credential on GitHub.
// The roster in backend/seed_users.json has them for a local run.
const EMAIL = process.env.CHECK_EMAIL;
const PASSWORD = process.env.CHECK_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error(
    "Set CHECK_EMAIL and CHECK_PASSWORD to a seeded account, e.g.\n" +
      "  CHECK_EMAIL=root@example.com CHECK_PASSWORD=... node --experimental-websocket scripts/browser-check.mjs"
  );
  process.exit(2);
}
// Screenshots land outside the repo by default: they are a debugging aid, not
// an artefact, and a folder of PNGs is not something to commit. Override with
// SHOTS=… when you want them somewhere specific.
const SHOTS = process.env.SHOTS || join(tmpdir(), "pmp-browser-check");

const PAGES = [
  ["/dashboard", "Dashboard"],
  ["/dashboard/users", "Users"],
  ["/dashboard/roles", "Roles"],
  ["/dashboard/activity", "Activity"],
  ["/dashboard/invitations", "Invitations"],
  ["/dashboard/data-access", "Data Access"],
  ["/dashboard/api-credentials", "API Credentials"],
  ["/dashboard/api-credentials/providers", "Providers"],
  ["/dashboard/feature-flags", "Feature Flags"],
  ["/dashboard/search", "Search"],
  ["/dashboard/configuration", "Configuration"],
  ["/dashboard/security", "Security"],
  ["/dashboard/errors", "Error"],
  ["/dashboard/health", "Health"],
  ["/dashboard/recycle-bin", "Recycle"],
  ["/dashboard/branding", "Branding"],
  ["/dashboard/ai-assistant", "AI Assistant"],
  ["/dashboard/api-consumers", "Platform API"],
  ["/dashboard/webhooks", "Webhooks"],
  ["/dashboard/api-docs", "API Documentation"],
  ["/dashboard/worker", "Background Jobs"],
  ["/settings/profile", "Profile"],
  ["/settings/password", "Password"],
  ["/settings/appearance", "Appearance"],
  // --- Added 2026-08-12 by the "core 100%" audit -------------------------
  // The list above covered 24 of the app's 43 routes, and every one it covered
  // was an index. **The forms and detail screens had still never been opened**
  // — which is the wrong half to skip: an index that throws shows an empty
  // table, while a form that throws loses whatever was typed into it.
  ["/dashboard/users/new", "User"],
  ["/dashboard/roles/new", "Role"],
  ["/dashboard/roles/matrix", "Matrix"],
  ["/dashboard/invitations/new", "Invit"],
];

/**
 * Routes that render nothing of their own — each is a `redirect()` to a real
 * screen, kept for old bookmarks and muscle memory.
 *
 * They cannot sit in PAGES: "ended up on a different URL" is a FAIL there,
 * because for a real screen it means the session broke. Here the redirect
 * target IS the pass condition — an alias that stops forwarding is a broken
 * bookmark. The text probe matches the *destination* page, since that is the
 * only thing the browser ever shows.
 */
const ALIASES = [
  ["/dashboard/profile", "/settings/profile", "Profile"],
  ["/settings", "/settings/profile", "Profile"],
  ["/dashboard/add-user", "/dashboard/users/new", "User"],
  ["/dashboard/all-users", "/dashboard/users", "User"],
];

/**
 * Screens whose URL contains a real record id, resolved after sign-in.
 *
 * Hardcoding an id would make the pass depend on a particular database, and a
 * seeded id that no longer exists renders the "not found" branch — which is a
 * page that loads cleanly and proves nothing about the page under test.
 */
const DYNAMIC = [
  ["/dashboard/users/{user}", "User"],
  ["/dashboard/users/{user}/edit", "User"],
  ["/dashboard/roles/{role}", "Role"],
  ["/dashboard/roles/{role}/edit", "Role"],
];

/**
 * Signed-out screens, visited **before** the session exists.
 *
 * They cannot go in the list above: every one of them redirects to the
 * dashboard once a cookie is present, so a pass that ran them after sign-in
 * would report success without ever rendering them.
 */
const PUBLIC_PAGES = [
  // The root path is a middleware redirect to /sign-in — unconditionally, so
  // this pass (not the signed-in one) is where it can be observed.
  ["/", "Sign", "/sign-in"],
  ["/sign-in", "Sign"],
  ["/sign-up", "Sign"],
  ["/forgot-password", "Password"],
  ["/reset-password", "Password"],
  ["/verify-email", "Verif"],
  ["/accept-invitation", "Invit"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- CDP ---------------------------------------------------------------------

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 30000);
    });
  }

  /** Events since the marker, so each page starts from a clean slate. */
  drain() {
    const events = this.events;
    this.events = [];
    return events;
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text + " " + (result.exceptionDetails.exception?.description ?? ""));
    }
    return result.result.value;
  }
}

async function connect() {
  const profile = mkdtempSync(join(tmpdir(), "pmp-chrome-"));
  const chrome = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--remote-debugging-port=9333",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const res = await fetch("http://127.0.0.1:9333/json/list");
      const targets = await res.json();
      target = targets.find((t) => t.type === "page");
    } catch {
      /* chrome not up yet */
    }
  }
  if (!target) throw new Error("Chrome did not expose a page target");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return { chrome, cdp: new CDP(ws) };
}

// --- The pass ----------------------------------------------------------------

const results = [];

function record(page, status, detail = "") {
  results.push({ page, status, detail });
  const mark = status === "PASS" ? "PASS" : status === "WARN" ? "WARN" : "FAIL";
  console.log(`${mark}  ${page.padEnd(42)} ${detail}`);
}

const { chrome, cdp } = await connect();

try {
  mkdirSync(SHOTS, { recursive: true });
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Log.enable");

  // --- Sign in -------------------------------------------------------------
  console.log("--- signing in ---");
  await cdp.send("Page.navigate", { url: `${FRONTEND}/login` });
  await sleep(2500);

  // Through the app's own origin so the httpOnly cookie lands where the app
  // expects it. Cookies ignore ports, so a cookie set by :8002 is sent from the
  // page on :3001 — which is exactly how the running app works.
  const login = await cdp.evaluate(`
    fetch("${API}/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASSWORD)} })
    }).then(async r => ({ status: r.status, body: (await r.text()).slice(0, 200) }))
  `);
  if (login.status !== 200) {
    record("sign in", "FAIL", `${login.status} ${login.body}`);
    throw new Error("cannot sign in; the rest of the pass would be meaningless");
  }
  record("sign in", "PASS", `${login.status} as ${EMAIL}`);

  // --- Every page ----------------------------------------------------------
  // Extracted from the loop below when the public and dynamic passes were added
  // (2026-08-12), so all three run *identical* checks. Three copies of this that
  // drifted would be worse than not checking the extra screens at all: the pass
  // would still be green while quietly testing less.
  //
  // `signedOut` relaxes the two assertions that only hold behind the sidebar —
  // a login form legitimately has no sidebar and little text. `expect` is for
  // routes whose whole job is to land somewhere else: the URL assertion checks
  // the destination instead of the requested path.
  async function check(path, expected, { signedOut = false, expect = path } = {}) {
    cdp.drain();
    const failedRequests = [];
    const consoleErrors = [];

    await cdp.send("Page.navigate", { url: FRONTEND + path });
    await sleep(3000);

    for (const event of cdp.drain()) {
      if (event.method === "Network.responseReceived") {
        const { status, url } = event.params.response;
        // The assistant availability probe 403s for a disabled integration by
        // design, and the widget is built to stay silent about it.
        if (status >= 400 && !url.includes("/ai/availability")) {
          failedRequests.push(`${status} ${url.replace(FRONTEND, "").replace(API, "api")}`);
        }
      }
      if (event.method === "Runtime.consoleAPICalled" && event.params.type === "error") {
        consoleErrors.push(
          (event.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160)
        );
      }
      if (event.method === "Runtime.exceptionThrown") {
        consoleErrors.push(
          "uncaught: " + (event.params.exceptionDetails?.exception?.description ?? "").slice(0, 160)
        );
      }
    }

    // `document.body?.` because the read can land mid-navigation, where there is
    // no body yet — that crashed the whole pass, not just the page under test.
    const readState = () =>
      cdp.evaluate(`(() => ({
      url: location.pathname,
      title: document.title,
      text: (document.body?.innerText || "").trim(),
      hasSidebar: !!document.querySelector("aside, nav"),
      headings: Array.from(document.querySelectorAll("h1,h2")).map(h => h.innerText.trim()).slice(0, 4),
    }))()`);

    let state = await readState();
    // Poll before judging — up to three more reads, 2.5s apart. A dev server
    // compiling a cold route serves the shell late, and a streamed redirect()
    // swaps the URL only after hydration; measured on 2026-08-13, the alias
    // redirect landed between 4s and 5s on a freshly restarted dev server. A
    // real failure fails identically on every reading, and a healthy page
    // passes the first check, so green runs never wait.
    for (
      let attempt = 0;
      attempt < 3 && (state.url !== expect || state.text.length < (signedOut ? 30 : 120));
      attempt++
    ) {
      await sleep(2500);
      state = await readState();
    }

    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(SHOTS, path.replace(/[^a-zA-Z0-9]+/g, "_") + ".png"), Buffer.from(shot.data, "base64"));

    const problems = [];
    if (state.url !== expect) problems.push(`redirected to ${state.url}`);
    if (!signedOut && !state.hasSidebar) problems.push("no sidebar");
    // A sign-in form is legitimately sparse; an authenticated screen is not.
    const floor = signedOut ? 30 : 120;
    if (state.text.length < floor) problems.push(`only ${state.text.length} chars of text`);
    if (!state.text.toLowerCase().includes(expected.toLowerCase()))
      problems.push(`"${expected}" not on the page`);
    if (consoleErrors.length) problems.push(`${consoleErrors.length} console error(s): ${consoleErrors[0]}`);
    if (failedRequests.length) problems.push(`${failedRequests.length} failed request(s): ${failedRequests[0]}`);

    if (problems.length === 0) {
      record(path, "PASS", `${state.text.length} chars · ${state.headings[0] ?? ""}`);
    } else {
      record(path, problems.some((p) => p.includes("redirect") || p.includes("no sidebar") || p.includes("chars of text")) ? "FAIL" : "WARN", problems.join(" | "));
    }
  }

  console.log("\n--- pages ---");
  for (const [path, expected] of PAGES) {
    await check(path, expected);
  }

  // --- Redirect aliases -----------------------------------------------------
  console.log("\n--- redirect aliases ---");
  for (const [path, destination, expected] of ALIASES) {
    await check(path, expected, { expect: destination });
  }

  // --- Screens that need a real record id ----------------------------------
  console.log("\n--- detail and edit screens ---");
  const ids = await cdp.evaluate(`
    Promise.all([
      fetch("${API}/users?per_page=1", { credentials: "include" }).then(r => r.json()),
      fetch("${API}/roles", { credentials: "include" }).then(r => r.json()),
    ]).then(([users, roles]) => ({
      user: (users.items || users.data || [])[0]?.id ?? null,
      role: (Array.isArray(roles) ? roles : roles.items || [])[0]?.id ?? null,
    }))
  `);
  if (!ids.user || !ids.role) {
    record("resolve ids", "WARN", `could not resolve a user/role id (${JSON.stringify(ids)})`);
  } else {
    record("resolve ids", "PASS", `user ${String(ids.user).slice(0, 8)} · role ${ids.role}`);
    for (const [template, expected] of DYNAMIC) {
      await check(template.replace("{user}", ids.user).replace("{role}", ids.role), expected);
    }
  }

  // --- Signed out ----------------------------------------------------------
  // Last, and after the cookie is dropped: every one of these redirects to the
  // dashboard while a session exists, so running them earlier would report a
  // pass without ever rendering the page.
  console.log("\n--- signed out ---");
  await cdp.evaluate(`fetch("${API}/auth/logout", { method: "POST", credentials: "include" }).then(r => r.status)`);
  await cdp.send("Network.clearBrowserCookies");
  for (const [path, expected, destination] of PUBLIC_PAGES) {
    await check(path, expected, { signedOut: true, expect: destination ?? path });
  }
} catch (err) {
  console.error("\nHARNESS ERROR:", err.message);
  results.push({ page: "harness", status: "FAIL", detail: err.message });
} finally {
  chrome.kill();
}

const pass = results.filter((r) => r.status === "PASS").length;
const warn = results.filter((r) => r.status === "WARN").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${"=".repeat(60)}\n${pass} passed, ${warn} warnings, ${fail} failed`);
console.log(`screenshots: ${SHOTS}`);
process.exit(fail ? 1 : 0);
