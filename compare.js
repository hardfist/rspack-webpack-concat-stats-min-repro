"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { createRequire } = require("module");

function resolveDepsRoot() {
  const candidates = [
    process.env.DEPS_ROOT,
    path.join(__dirname, "..", "rspack-runtime-memory-repro", "node_modules"),
    path.join(__dirname, "..", "..", "work", "rspack-runtime-memory-repro", "node_modules"),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("Cannot find dependency root. Set DEPS_ROOT to a node_modules directory containing webpack and @rspack/core.");
  }
  return found;
}

const depsRoot = resolveDepsRoot();
const packageRequire = createRequire(path.join(depsRoot, ".resolve-anchor.js"));

async function loadRspack() {
  const resolved = packageRequire.resolve("@rspack/core");
  try {
    return packageRequire("@rspack/core").rspack;
  } catch (error) {
    if (error.code !== "ERR_REQUIRE_ESM") throw error;
    return (await import(pathToFileURL(resolved).href)).rspack;
  }
}

const root = __dirname;

function makeConfig(name) {
  return {
    mode: "production",
    target: "web",
    devtool: false,
    context: root,
    entry: path.join(root, "src/index.js"),
    output: {
      path: path.join(root, "dist", name),
      filename: "main.js",
      chunkFilename: "[name].[id].js",
      clean: true,
    },
    optimization: {
      concatenateModules: true,
      moduleIds: "deterministic",
      chunkIds: "deterministic",
      minimize: false,
      runtimeChunk: false,
      splitChunks: {
        chunks: "all",
        minSize: 0,
        cacheGroups: {
          default: false,
          defaultVendors: false,
          shared: {
            test: /[\\/]shared[\\/]/,
            name: "shared",
            chunks: "async",
            minChunks: 2,
            enforce: true,
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      },
    },
  };
}

function compile(name, compiler, config) {
  return new Promise((resolve, reject) => {
    compiler(config, (err, stats) => {
      if (err) return reject(err);
      if (stats.hasErrors()) {
        return reject(new Error(stats.toString({ all: false, errors: true })));
      }
      resolve(stats);
    });
  });
}

function flatten(modules, out = []) {
  for (const module of modules || []) {
    out.push(module);
    flatten(module.modules, out);
    flatten(module.children, out);
  }
  return out;
}

function statsSummary(stats, expandNested) {
  const json = stats.toJson({
    all: false,
    chunks: true,
    modules: true,
    nestedModules: true,
    optimizationBailout: true,
    reasons: false,
    ...(expandNested
      ? {
          orphanModules: true,
          runtimeModules: true,
          chunkModules: true,
          dependentModules: true,
          groupModulesByAttributes: false,
          groupModulesByCacheStatus: false,
          groupModulesByExtension: false,
          groupModulesByLayer: false,
          groupModulesByPath: false,
          groupModulesByType: false,
        }
      : {}),
  });
  const topModules = json.modules || [];
  const concatGroups = topModules
    .filter((module) => / \+ \d+ modules$/.test(module.name || ""))
    .map((module) => ({
      name: module.name,
      chunks: module.chunks,
      nested: (module.modules || module.children || []).map((child) => child.name),
    }));
  const bailouts = flatten(topModules)
    .flatMap((module) =>
      (module.optimizationBailout || []).map((reason) => ({
        module: module.name,
        reason: String(reason),
      })),
    )
    .filter(({ reason }) => reason.includes("ModuleConcatenation bailout"));
  return { chunks: json.chunks, concatGroups, bailouts };
}

function printSummary(name, label, summary) {
  console.log(`\n## ${name} (${label})`);
  console.log("chunks:", summary.chunks.map((chunk) => `${chunk.id}:${chunk.names.join(",") || "(unnamed)"}`).join(" "));
  console.log("concat groups:");
  for (const group of summary.concatGroups) {
    console.log(`- ${group.name} [chunks=${(group.chunks || []).join(",")}]`);
    for (const nested of group.nested) console.log(`  - ${nested}`);
  }
  console.log("selected bailouts:");
  for (const bailout of summary.bailouts.slice(0, 24)) {
    if (
      bailout.reason.includes("same chunk") ||
      bailout.reason.includes("different chunks") ||
      bailout.reason.includes("entry point")
    ) {
      console.log(`- ${bailout.module}: ${bailout.reason}`);
    }
  }
}

(async () => {
  const webpack = packageRequire("webpack");
  const rspack = await loadRspack();
  const webpackStats = await compile("webpack", webpack, makeConfig("webpack"));
  const rspackStats = await compile("rspack", rspack, makeConfig("rspack"));

  printSummary("webpack", "default stats", statsSummary(webpackStats, false));
  printSummary("rspack", "default stats", statsSummary(rspackStats, false));
  printSummary("webpack", "expanded stats", statsSummary(webpackStats, true));
  printSummary("rspack", "expanded stats", statsSummary(rspackStats, true));
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
