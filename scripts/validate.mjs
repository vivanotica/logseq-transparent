import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const read = (path) => readFileSync(path, "utf8");
const fail = (message) => {
  throw new Error(message);
};

const packageJson = JSON.parse(read("package.json"));
const css = read("custom.css");
const html = read("index.html");
const javascript = read("index.js");
const example = read("custom-background.example.css");
const readme = read("README.md");

const requiredFiles = [
  packageJson.main,
  packageJson.logseq.icon.replace(/^\.\//, ""),
  "custom.css",
  "README.md",
  "LICENSE",
  "index.js",
  "assets/logseq-transparent-dark.png",
  "assets/logseq-transparent-light.png",
  "vendor/logseq-libs-0.0.17.js",
  "vendor/logseq-libs-0.0.17.LICENSE.txt",
];

for (const path of requiredFiles) {
  if (!existsSync(path)) fail(`Missing required file: ${path}`);
}

for (const preview of [
  "./assets/logseq-transparent-dark.png",
  "./assets/logseq-transparent-light.png",
]) {
  if (!readme.includes(preview)) {
    fail(`README must display the theme preview: ${preview}`);
  }
}
if (
  !readme.includes(
    "https://github.com/oczko24/Obsidian-transparent",
  )
) {
  fail("README must credit the Obsidian-transparent inspiration.");
}
if (/^## (Project structure|Validation|Development)\s*$/im.test(readme)) {
  fail("README must remain user-facing and exclude development sections.");
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

if (/<script[^>]+src=["']https?:\/\//i.test(html)) {
  fail("Runtime scripts must remain local and pinned.");
}
for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
  const scriptPath = match[1].replace(/^\.\//, "");
  if (!existsSync(scriptPath)) fail(`Missing local runtime script: ${scriptPath}`);
}

if (/provideStyle|resolveResourceFullUrl|fetch\s*\(/.test(javascript)) {
  fail("The package entry must not load or inject theme CSS.");
}

let readyCallback;
const runtimeErrors = [];
const entryScript = new vm.Script(javascript, { filename: "index.js" });
entryScript.runInContext(
  vm.createContext({
    console: {
      error: (...args) => runtimeErrors.push(args),
    },
    logseq: {
      ready: (callback) => {
        readyCallback = callback;
        return Promise.resolve();
      },
    },
  }),
);
await Promise.resolve();
if (typeof readyCallback !== "function") {
  fail("The package entry must register logseq.ready().");
}
await readyCallback();
if (runtimeErrors.length) {
  fail("The package entry reported an initialization error.");
}

if (/https?:\/\//i.test(example)) {
  fail("The wallpaper example must remain local-only.");
}

const sdkHash = createHash("sha256")
  .update(readFileSync("vendor/logseq-libs-0.0.17.js"))
  .digest("hex");
const expectedSdkHash =
  "fbf51e570989ac2eccbd726816ef8a619612fb6c047dfe39cc2c9103b12b4669";
if (sdkHash !== expectedSdkHash) {
  fail("The vendored Logseq SDK does not match the pinned 0.0.17 bundle.");
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

const inputFocusRule = css.match(
  /#app-container\s+:is\([\s\S]*?\):focus\s*\{([\s\S]*?)\}/,
)?.[1];
if (!inputFocusRule) {
  fail("Input focus normalization is missing.");
}
if (
  !/border-color:\s*var\(--lt-border\)\s*!important/.test(inputFocusRule) ||
  !/background:\s*var\(--lt-control\)\s*!important/.test(inputFocusRule) ||
  !/box-shadow:\s*none\s*!important/.test(inputFocusRule)
) {
  fail("Focused inputs must retain their resting box appearance.");
}
if (/var\(--lt-accent\)|var\(--lt-control-hover\)|0 0 0/.test(inputFocusRule)) {
  fail("Focused inputs must not add an accent highlight or focus ring.");
}

const pluginReadmeDialogRule = css.match(
  /\.ui__dialog-content\[label=["']plugin-readme["']\]\s*\{([\s\S]*?)\}/,
)?.[1];
if (!pluginReadmeDialogRule) {
  fail("Plugin README dialog sizing fix is missing.");
}
if (
  !/width:\s*min\(900px,\s*calc\(100vw - 32px\)\)\s*!important/.test(
    pluginReadmeDialogRule,
  ) ||
  !/min-width:\s*0/.test(pluginReadmeDialogRule)
) {
  fail("Plugin README dialogs must retain a responsive readable width.");
}
if (
  !/\.ui__dialog-content\[label=["']plugin-readme["']\]\s+\.lsp-frame-readme\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-width:\s*0/.test(
    css,
  )
) {
  fail("Marketplace README frames must fit the dialog width.");
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
