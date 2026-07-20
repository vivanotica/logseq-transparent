import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const fail = (message) => {
  throw new Error(message);
};

const packageJson = JSON.parse(read("package.json"));
const css = read("custom.css");
const html = read("index.html");
const example = read("custom-background.example.css");

const requiredFiles = [
  packageJson.main,
  packageJson.logseq.icon.replace(/^\.\//, ""),
  "custom.css",
  "README.md",
  "LICENSE",
];

for (const path of requiredFiles) {
  if (!existsSync(path)) fail(`Missing required file: ${path}`);
}

let blockDepth = 0;
let quote = null;
let inComment = false;
for (let index = 0; index < css.length; index += 1) {
  const character = css[index];
  const next = css[index + 1];

  if (inComment) {
    if (character === "*" && next === "/") {
      inComment = false;
      index += 1;
    }
    continue;
  }

  if (!quote && character === "/" && next === "*") {
    inComment = true;
    index += 1;
    continue;
  }

  if (quote) {
    if (character === "\\") {
      index += 1;
    } else if (character === quote) {
      quote = null;
    }
    continue;
  }

  if (character === '"' || character === "'") {
    quote = character;
  } else if (character === "{") {
    blockDepth += 1;
  } else if (character === "}") {
    blockDepth -= 1;
    if (blockDepth < 0) fail("CSS contains an extra closing brace.");
  }
}

if (inComment) fail("CSS contains an unclosed comment.");
if (quote) fail("CSS contains an unclosed string.");
if (blockDepth !== 0) fail("CSS blocks are unbalanced.");

const cssVersion = css.match(/Logseq Transparent v(\d+\.\d+\.\d+)/)?.[1];
if (cssVersion !== packageJson.version) {
  fail(`CSS version ${cssVersion ?? "missing"} does not match package version ${packageJson.version}.`);
}

const themes = packageJson.logseq?.themes;
if (!Array.isArray(themes) || themes.length !== 2) {
  fail("The manifest must register exactly one light and one dark theme.");
}

const modes = new Set();
for (const theme of themes) {
  if (!theme.name || !theme.description) {
    fail("Every theme registration must include a name and description.");
  }
  if (!["light", "dark"].includes(theme.mode)) {
    fail(`Unsupported theme mode: ${theme.mode ?? "missing"}.`);
  }
  if (modes.has(theme.mode)) {
    fail(`Theme mode is registered more than once: ${theme.mode}.`);
  }
  modes.add(theme.mode);

  const themePath = theme.url?.replace(/^\.\//, "");
  if (themePath !== "custom.css" || !existsSync(themePath)) {
    fail(`Theme mode ${theme.mode} must reference ./custom.css.`);
  }
}

if (!modes.has("light") || !modes.has("dark")) {
  fail("Both light and dark theme modes must be registered.");
}

if (/<script\b/i.test(html)) {
  fail("The theme entry must not execute a plugin runtime.");
}
if (
  existsSync("index.js") ||
  existsSync("vendor/logseq-libs-0.0.17.js") ||
  existsSync("vendor/logseq-libs-0.0.17.LICENSE.txt")
) {
  fail("Obsolete CSS-injection runtime files must not be present.");
}

if (/https?:\/\//i.test(example)) {
  fail("The wallpaper example must remain local-only.");
}

const removedTokens = [
  "--lt-radius-lg",
  "--lt-shadow:",
  "--lt-hsl-primary:",
  "--lt-hsl-primary-foreground:",
  "--lt-hsl-accent:",
  "--lt-hsl-ring:",
];
for (const token of removedTokens) {
  if (css.includes(token)) fail(`Removed token was reintroduced: ${token}`);
}

const forbiddenBroadSelectors = [
  /(^|})\s*\[role=["']dialog["']\]\s*[, {]/m,
  /(^|})\s*\[role=["']menu["']\]\s*[, {]/m,
  /(^|})\s*\.notice\s*[, {]/m,
  /(^|})\s*\*\s*\{/m,
];
for (const pattern of forbiddenBroadSelectors) {
  if (pattern.test(css)) fail(`Unsafe broad selector detected: ${pattern}`);
}

if (/\.button-primary[\s\S]*?color:\s*#[0-9a-f]{3,8}/i.test(css)) {
  fail("Primary button foreground must not be hard-coded.");
}
if (!css.includes("hsl(var(--primary-foreground")) {
  fail("Primary buttons must follow Logseq's foreground token.");
}

if (
  !/\.ui__notifications,\s*\.ui__notifications-content\s*\{[\s\S]*?background:\s*transparent\s*!important/.test(
    css,
  )
) {
  fail("Notification wrappers must remain transparent.");
}
if (
  !/\.ui__notifications \.notification-area\s*\{[\s\S]*?background:\s*var\(--lt-panel-strong\)\s*!important/.test(
    css,
  )
) {
  fail("Notification card styling is missing.");
}

if (
  !/\.sidebar-contents-container\.is-scrolled[\s\S]*?:is\(\.favorites, \.recent\)[\s\S]*?> \.hd\s*\{[\s\S]*?var\(--lt-canvas\)/.test(
    css,
  )
) {
  fail("Scrolled sidebar section headers must use an opaque canvas surface.");
}

console.log("Validation passed.");
