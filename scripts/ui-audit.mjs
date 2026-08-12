/**
 * Does it *look* right? — the half `browser-check.mjs` deliberately does not answer.
 *
 * That script proves a page renders: no redirect, no console error, no empty
 * shell. It has no opinion about appearance, and `MODULE_PARITY_PLAN.md` § 5 is
 * explicit that the table work — the zebra stripe, the hover, the header fill,
 * one font size per column — was *"reasoned about from classes and contrast
 * ratios"* and never seen. This measures the three things that reasoning can get
 * wrong.
 *
 * **Contrast, computed rather than assumed.** Every visible text node is walked,
 * its effective background found by climbing ancestors until something is not
 * transparent, and the WCAG ratio worked out. AA wants 4.5:1 for body text and
 * 3:1 for large text. A token that looked fine in a palette can fail once it is
 * layered on a card on a wash.
 *
 * **Both themes.** Everything shipped this month was looked at in dark mode, if
 * at all. `dark:` variants are written by hand, one per element, and a missing
 * one is invisible until someone switches.
 *
 * **A narrow viewport.** The rule that matters is not "does it look nice at
 * 375px" but "does the page scroll sideways", which is a concrete, measurable
 * defect: `documentElement.scrollWidth > innerWidth` means content is
 * unreachable on a phone.
 *
 *   CHECK_EMAIL=… CHECK_PASSWORD=… node --experimental-websocket scripts/ui-audit.mjs
 */

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FRONTEND = "http://localhost:3001";
const API = "http://localhost:8002/api/v1";
const EMAIL = process.env.CHECK_EMAIL;
const PASSWORD = process.env.CHECK_PASSWORD;
const SHOTS = process.env.SHOTS || join(tmpdir(), "pmp-ui-audit");

if (!EMAIL || !PASSWORD) {
  console.error("Set CHECK_EMAIL and CHECK_PASSWORD to a seeded account.");
  process.exit(2);
}

const PAGES = [
  "/dashboard",
  "/dashboard/users",
  "/dashboard/roles",
  "/dashboard/activity",
  "/dashboard/invitations",
  "/dashboard/api-credentials",
  "/dashboard/feature-flags",
  "/dashboard/configuration",
  "/dashboard/health",
  "/dashboard/ai-assistant",
  "/dashboard/api-consumers",
  "/dashboard/webhooks",
  "/dashboard/api-docs",
  "/dashboard/worker",
  "/settings/profile",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- CDP (same minimal client as browser-check.mjs) ---------------------------

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
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
  async evaluate(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
}

async function connect() {
  const profile = mkdtempSync(join(tmpdir(), "pmp-audit-"));
  const chrome = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--remote-debugging-port=9334",
      `--user-data-dir=${profile}`,
      "--no-first-run",
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
      const res = await fetch("http://127.0.0.1:9334/json/list");
      target = (await res.json()).find((t) => t.type === "page");
    } catch {}
  }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  return { chrome, cdp: new CDP(ws) };
}

// --- The measurement, run inside the page ------------------------------------

const AUDIT = `(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map((v) => parseFloat(v));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  // Climb until something is actually painted. A transparent background means
  // the colour behind it is what the text really sits on.
  const backdrop = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.5) return bg;
      node = node.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  };

  const failures = [];
  let checked = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length > 0) continue;               // leaf nodes carry the text
    const text = (el.textContent || "").trim();
    if (!text) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") continue;

    const fg = parse(style.color);
    if (!fg || fg.a < 0.5) continue;
    const bg = backdrop(el);
    const size = parseFloat(style.fontSize);
    const weight = parseInt(style.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = large ? 3 : 4.5;
    const got = ratio(fg, bg);
    checked++;
    if (got < required) {
      failures.push({
        text: text.slice(0, 40),
        ratio: Math.round(got * 100) / 100,
        required,
        size,
        color: style.color,
        background: "rgb(" + bg.r + "," + bg.g + "," + bg.b + ")",
        tag: el.tagName.toLowerCase(),
      });
    }
  }

  return {
    checked,
    failures: failures.slice(0, 8),
    failureCount: failures.length,
    overflows: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
})()`;

// --- Run ---------------------------------------------------------------------

const { chrome, cdp } = await connect();
const findings = [];

try {
  mkdirSync(SHOTS, { recursive: true });
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await cdp.send("Page.navigate", { url: `${FRONTEND}/login` });
  await sleep(2500);
  const login = await cdp.evaluate(`
    fetch("${API}/auth/login", { method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASSWORD)} })
    }).then(r => r.status)`);
  if (login !== 200) throw new Error(`sign in failed: ${login}`);
  console.log(`signed in as ${EMAIL}\n`);

  for (const theme of ["dark", "light"]) {
    console.log(`--- ${theme} mode, 1440px ---`);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    for (const path of PAGES) {
      await cdp.send("Page.navigate", { url: FRONTEND + path });
      await sleep(1200);
      // Set the preference the way the app stores it, then reload so the hook
      // picks it up exactly as it would for a real user.
      await cdp.evaluate(`localStorage.setItem("theme", ${JSON.stringify(theme)})`);
      await cdp.send("Page.reload");
      await sleep(2600);

      const result = await cdp.evaluate(AUDIT);
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(
        join(SHOTS, `${theme}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}.png`),
        Buffer.from(shot.data, "base64")
      );

      const problems = [];
      if (result.failureCount) problems.push(`${result.failureCount}/${result.checked} contrast`);
      if (result.overflows) problems.push(`scrolls sideways (${result.scrollWidth}px)`);
      if (problems.length) {
        findings.push({ theme, path, ...result });
        console.log(`  WARN ${path.padEnd(38)} ${problems.join(" · ")}`);
        for (const f of result.failures.slice(0, 3)) {
          console.log(`         ${f.ratio}:1 (needs ${f.required}) ${f.color} on ${f.background} — "${f.text}"`);
        }
      } else {
        console.log(`  ok   ${path.padEnd(38)} ${result.checked} text nodes`);
      }
    }
  }

  console.log(`\n--- dark mode, 375px (does anything scroll sideways) ---`);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 375, height: 812, deviceScaleFactor: 2, mobile: true,
  });
  await cdp.evaluate(`localStorage.setItem("theme", "dark")`);
  for (const path of PAGES) {
    await cdp.send("Page.navigate", { url: FRONTEND + path });
    await sleep(2200);
    const result = await cdp.evaluate(AUDIT);
    if (result.overflows) {
      findings.push({ theme: "mobile", path, ...result });
      console.log(`  WARN ${path.padEnd(38)} ${result.scrollWidth}px wide in a ${result.innerWidth}px viewport`);
    } else {
      console.log(`  ok   ${path}`);
    }
  }
} catch (err) {
  console.error("HARNESS ERROR:", err.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
}

console.log(`\n${"=".repeat(60)}`);
console.log(`${findings.length} page/theme combinations with findings`);
console.log(`screenshots: ${SHOTS}`);
