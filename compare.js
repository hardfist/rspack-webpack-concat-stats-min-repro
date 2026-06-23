"use strict";

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const { pathToFileURL } = require("url");

const root = __dirname;

function createPackageRequire(depsRoot) {
  return createRequire(path.join(depsRoot, ".resolve-anchor.js"));
}

async function loadRspack(packageRequire) {
  const resolved = packageRequire.resolve("@rspack/core");
  try {
    return packageRequire("@rspack/core").rspack;
  } catch (error) {
    if (error.code !== "ERR_REQUIRE_ESM") throw error;
    return (await import(pathToFileURL(resolved).href)).rspack;
  }
}

function makeConfig(name) {
  return {
    mode: "production",
    target: "web",
    devtool: false,
    context: root,
    entry: "./src/index.js",
    output: {
      path: path.join(root, "dist", name),
      filename: "[name].js",
      chunkFilename: "[name].js",
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
        minChunks: 2,
        cacheGroups: {
          default: false,
          defaultVendors: false,
          common: {
            chunks: "all",
            minChunks: 2,
            name: "common",
            enforce: true,
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      },
    },
  };
}

function compile(compiler, config) {
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

function summarize(stats) {
  const json = stats.toJson({
    all: false,
    chunks: true,
    modules: true,
    nestedModules: true,
    orphanModules: true,
    runtimeModules: true,
    chunkModules: true,
    dependentModules: true,
    optimizationBailout: true,
    reasons: true,
    groupModulesByAttributes: false,
    groupModulesByCacheStatus: false,
    groupModulesByExtension: false,
    groupModulesByLayer: false,
    groupModulesByPath: false,
    groupModulesByType: false,
  });
  const concatGroups = (json.modules || [])
    .filter((module) => / \+ \d+ modules$/.test(module.name || ""))
    .map((module) => ({
      name: module.name,
      nested: (module.modules || module.children || []).map((child) => child.name).filter(Boolean),
    }));
  const relevantBailouts = flatten(json.modules || [])
    .filter((module) => /page1|m1|m3/.test(module.name || ""))
    .flatMap((module) =>
      (module.optimizationBailout || []).map((reason) => ({
        module: module.name,
        reason: String(reason),
      })),
    )
    .filter(({ reason }) => reason.includes("ModuleConcatenation bailout"));
  return { concatGroups, relevantBailouts };
}

function printSummary(name, summary) {
  console.log(`\n## ${name}`);
  console.log("concat groups:");
  if (summary.concatGroups.length === 0) {
    console.log("- none");
  }
  for (const group of summary.concatGroups) {
    console.log(`- ${group.name}`);
    for (const nested of group.nested) console.log(`  - ${nested}`);
  }
  console.log("selected bailouts:");
  for (const bailout of summary.relevantBailouts) {
    console.log(`- ${bailout.module}: ${bailout.reason}`);
  }
}

async function runPair(label, depsRoot) {
  const packageRequire = createPackageRequire(depsRoot);
  const webpack = packageRequire("webpack");
  const rspack = await loadRspack(packageRequire);
  const webpackStats = await compile(webpack, makeConfig(`webpack-${label}`));
  const rspackStats = await compile(rspack, makeConfig(`rspack-${label}`));
  printSummary(`webpack ${label}`, summarize(webpackStats));
  printSummary(`rspack ${label}`, summarize(rspackStats));
}

(async () => {
  const candidates = [
    ["webpack 5.66 / rspack 1.7.11", path.join(root, "..", "rspack-runtime-memory-repro", "node_modules")],
    ["webpack 5.66 / rspack 2.0.8", path.join(root, "..", "rspack-208", "node_modules")],
    ["local package.json", path.join(root, "node_modules")],
  ].filter(([, depsRoot]) => fs.existsSync(depsRoot));

  for (const [label, depsRoot] of candidates) {
    await runPair(label, depsRoot);
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
