// Shared config for the QA scripts (walkthrough, revisi-test, audit, shots, probe, dbg).
// Everything is overridable by env so the repo stays portable across machines:
//   SENJA_URL  — page under test (default http://localhost:5173/)
//   SENJA_OUT  — screenshot output dir (default ./playtest, git-ignored)
//   PUPPETEER_EXECUTABLE_PATH — path to a Chrome/Chromium binary
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH || CANDIDATES.find((p) => fs.existsSync(p));

export const OUT =
  process.env.SENJA_OUT || fileURLToPath(new globalThis.URL("./playtest", import.meta.url));

// named BASE_URL, not URL: a top-level `const URL` would shadow the global URL
// class for the whole module and make the `new URL` above a TDZ error.
export const BASE_URL = process.env.SENJA_URL || "http://localhost:5173/";

// Appends QA-only query params (e.g. ?lowfx=1) to SENJA_URL or the default.
export function pageUrl(search = "") {
  if (!search) return BASE_URL;
  return BASE_URL + (BASE_URL.includes("?") ? "&" : "?") + search.replace(/^\?/, "");
}

export const LAUNCH_ARGS = [
  "--no-sandbox",
  "--enable-unsafe-swiftshader",
  "--use-gl=angle",
  "--use-angle=swiftshader",
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
  return OUT;
}

export function launchOptions(extra = {}) {
  if (!CHROME) {
    throw new Error(
      "Chrome/Chromium tidak ditemukan. Set PUPPETEER_EXECUTABLE_PATH ke binary Chrome."
    );
  }
  return { executablePath: CHROME, headless: "new", args: LAUNCH_ARGS, ...extra };
}
