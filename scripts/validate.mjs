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

const requiredFiles = [
  packageJson.main,
  packageJson.logseq.icon.replace(/^\.\//, ""),
  "custom.css",
  "README.md",
  "LICENSE",
  "vendor/logseq-libs-0.0.17.js",
  "vendor/logseq-libs-0.0.17.LICENSE.txt",
];

for (const path of requiredFiles) {
  if (!existsSync(path)) fail(`Missing required file: ${path}`);
}

const entryScript = new vm.Script(javascript, { filename: "index.js" });

const runEntry = async ({ responseOk }) => {
  let readyCallback;
  let providedStyle = null;
  const messages = [];
  const errors = [];
  const context = vm.createContext({
    console: {
      error: (...args) => errors.push(args),
    },
    fetch: async () => ({
      ok: responseOk,
      status: responseOk ? 200 : 503,
      text: async () => "body { color: red; }",
    }),
    logseq: {
      ready: (callback) => {
        readyCallback = callback;
      },
      resolveResourceFullUrl: (path) => `lsp://plugin/${path}`,
      provideStyle: (style) => {
        providedStyle = style;
      },
      UI: {
        showMsg: (...args) => messages.push(args),
      },
    },
  });

  entryScript.runInContext(context);
  if (typeof readyCallback !== "function") fail("Plugin entry did not register logseq.ready().");
  await readyCallback();
  return { errors, messages, providedStyle };
};

const successfulEntry = await runEntry({ responseOk: true });
if (successfulEntry.providedStyle !== "body { color: red; }") {
  fail("Plugin entry did not provide the fetched stylesheet.");
}
if (successfulEntry.messages.length || successfulEntry.errors.length) {
  fail("Plugin entry reported an error on the successful load path.");
}

const failedEntry = await runEntry({ responseOk: false });
if (failedEntry.providedStyle !== null) {
  fail("Plugin entry provided a stylesheet after a failed fetch.");
}
if (failedEntry.messages.length !== 1 || failedEntry.errors.length !== 1) {
  fail("Plugin entry did not report a failed stylesheet load.");
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

if (packageJson.logseq.themes) {
  fail("The manifest must not register a second stylesheet-loading path.");
}

if (/<script[^>]+src=["']https?:\/\//i.test(html)) {
  fail("Runtime scripts must be local and pinned.");
}
for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
  const scriptPath = match[1].replace(/^\.\//, "");
  if (!existsSync(scriptPath)) fail(`Missing local runtime script: ${scriptPath}`);
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
