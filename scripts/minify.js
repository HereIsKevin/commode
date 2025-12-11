// @ts-check

import process from "node:process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

import { transform } from "esbuild";

const nodeDir = process.argv[2];

/** @type {string[]} */
const libFiles = [];
for await (const file of fs.glob("./lib/**/*.js", { cwd: nodeDir })) {
  libFiles.push(file);
}

const nodeGypFile = path.join(nodeDir, "node.gyp");
const nodeGyp = await fs.readFile(nodeGypFile, { encoding: "utf8" });
const depsFilesMatches = /'deps_files': \[(.*?)\]/s.exec(nodeGyp);
if (depsFilesMatches === null) {
  throw new Error("Could not find deps_files in node.gyp");
}
const depsFiles = depsFilesMatches[1]
  .split(",")
  .map((item) => item.trim().slice(1, -1))
  .filter((file) => !file.startsWith("<@") && file.endsWith("js"));

const configurePyFile = path.join(nodeDir, "configure.py");
const configurePy = await fs.readFile(configurePyFile, { encoding: "utf8" });
const builtinsMatches = /shareable_builtins = {(.*?)}/s.exec(configurePy);
if (builtinsMatches === null) {
  throw new Error("Could not find shareable_builtins in configure.py");
}
const builtinsFiles = builtinsMatches[1]
  .split(",")
  .map((entry) =>
    entry
      .slice(entry.indexOf(":") + 1)
      .trim()
      .slice(1, -1),
  )
  .filter((file) => file.endsWith("js"));

let originalSize = 0;
let minifiedSize = 0;

await Promise.all(
  [...libFiles, ...depsFiles, ...builtinsFiles].map(async (file) => {
    const resolvedFile = path.join(nodeDir, file);
    const contents = await fs.readFile(resolvedFile, { encoding: "utf8" });
    originalSize += contents.length;

    // This file is already minified, no need to process further.
    if (file.endsWith("deps/cjs-module-lexer/dist/lexer.js")) {
      minifiedSize += contents.length;
      return;
    }

    const result = await transform(contents, { minify: true });
    await fs.writeFile(resolvedFile, result.code);
    minifiedSize += result.code.length;
  }),
);

console.log(
  `Reduced bundled JavaScript from ${originalSize} bytes to ${minifiedSize} bytes`,
);
