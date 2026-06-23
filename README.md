# Minimal webpack/rspack ConcatenatedModule Difference

This repo is a minimal repro where webpack and Rspack produce different real
`ConcatenatedModule` groups for the same source and matched optimization config.

Run:

```bash
npm install
npm run compare
```

Verified locally with:

- `webpack@5.66.0`
- `@rspack/core@1.7.11`
- `@rspack/core@2.0.8`

## Module Graph

```text
index.js
  dynamic import page0.js
  dynamic import page1.js

page0.js
  imports m3.js

page1.js
  imports m1.js
  imports m3.js

m3.js
  imports m1.js

m1.js
  pure ESM leaf
```

`splitChunks` is configured with `chunks: "all"`, `minSize: 0`, and `minChunks: 2`,
so `m1.js` and `m3.js` are extracted into the `common` chunk.

## Observed Difference

Webpack bails out completely:

```text
## webpack
concat groups:
- none

ModuleConcatenation bailout: Cannot concat with ./src/m1.js:
Module ./src/m1.js is not in the same chunk(s)
(expected in chunk(s) page1, module is in chunk(s) common)
```

Rspack concatenates `page1.js` with `m1.js` even though `m1.js` is in the common
chunk:

```text
## rspack
concat groups:
- ./src/page1.js + 1 modules
  - ./src/page1.js
  - ./src/m1.js
```

## Why This Shape Matters

The direct shared-helper shape is not enough:

```text
page0.js -> m1.js
page1.js -> m1.js
```

Both bundlers avoid concatenating there.

The difference appears when the common chunk has a module (`m3.js`) that imports
the same leaf (`m1.js`) that the async page also imports directly:

```text
page0.js -> m3.js -> m1.js
page1.js -> m3.js
page1.js -> m1.js
```

Webpack treats `m1.js` as unavailable to the `page1` concatenation because it lives
in `common`. Rspack duplicates/inlines the side-effect-free leaf into the `page1`
concatenation group.
