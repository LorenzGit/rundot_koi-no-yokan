import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const mode = process.argv[2];
const supportedModes = new Set(["embedded", "bundled"]);

if (!supportedModes.has(mode)) {
    throw new Error(`Expected build mode: ${[...supportedModes].join(", ")}`);
}

const root = process.cwd();
const dist = path.join(root, "dist");
const manifestPath = path.join(dist, "rundot-game-libraries.manifest.json");
const indexPath = path.join(dist, "index.html");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const indexHtml = fs.readFileSync(indexPath, "utf8");

function assert(condition, message) {
    if (!condition) throw new Error(`Build verification failed: ${message}`);
}

function verifyEmbeddedLibraries() {
    assert(fs.existsSync(manifestPath), "embedded build did not emit the RUN library manifest");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const react = `react@${packageJson.dependencies.react}`;
    const reactDom = `react-dom@${packageJson.dependencies["react-dom"]}`;
    assert(manifest.enabled === true, "RUN library manifest is not enabled");
    assert(manifest.required?.includes(react), `${react} is not embedded`);
    assert(manifest.required?.includes(reactDom), `${reactDom} is not embedded`);
    assert(indexHtml.includes("_rundot_bootstrap"), "embedded-library bootstrap is absent from index.html");
}

if (mode === "bundled") {
    assert(!fs.existsSync(manifestPath), "standalone build unexpectedly emitted an embedded-library manifest");
    assert(!indexHtml.includes("_rundot_bootstrap"), "standalone build unexpectedly references the RUN bootstrap");
} else {
    verifyEmbeddedLibraries();
}

const oversizedChunks = fs
    .readdirSync(path.join(dist, "assets"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => ({
        name: entry.name,
        bytes: fs.statSync(path.join(dist, "assets", entry.name)).size,
        budget: 600_000,
    }))
    .filter(({ bytes, budget }) => bytes > budget);
assert(
    oversizedChunks.length === 0,
    `JavaScript chunk budget exceeded: ${oversizedChunks
        .map(({ name, bytes, budget }) => `${name} (${bytes} bytes; budget ${budget})`)
        .join(", ")}`,
);

const compiledJavaScript = fs
    .readdirSync(path.join(dist, "assets"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => fs.readFileSync(path.join(dist, "assets", entry.name), "utf8"))
    .join("\n");
assert(compiledJavaScript.includes("koi-build-version"), "visible build-version label is absent");
assert(compiledJavaScript.includes(packageJson.version), `visible build version does not match ${packageJson.version}`);
for (const developmentMarker of [
    "Development diagnostics",
    "RESET SESSION TUNING",
    'Unknown screen preview "',
    "safeAreaRefreshCount",
]) {
    assert(
        !compiledJavaScript.includes(developmentMarker),
        `development-only tooling leaked into production: ${developmentMarker}`,
    );
}

console.log(`Build verification passed (${mode}).`);
