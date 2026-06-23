# Minimal webpack/rspack ConcatenatedModule Stats Case

Run from this directory:

```bash
npm install
npm run compare
```

The case has two async page chunks and a forced shared async chunk:

```text
src/index.js
  dynamic import page-a
  dynamic import page-b

src/pages/page-a/index.js
  imports ./Section.js

src/pages/page-a/Section.js
  imports ./helpers.js
  imports ../../shared/SharedComponent.js
  imports ../../shared/SharedUtil.js

src/pages/page-b/index.js
  imports ../../shared/SharedComponent.js
  imports ../../shared/SharedUtil.js

src/shared/*
  extracted into shared chunk by splitChunks
```

What this reveals:

- Default webpack stats expands the concatenated module:

```text
./src/pages/page-a/index.js + 2 modules
  ./src/pages/page-a/index.js
  ./src/pages/page-a/Section.js
  ./src/pages/page-a/helpers.js
```

- Default rspack stats reports the same group name, but its nested module entry may be collapsed/missing:

```text
./src/pages/page-a/index.js + 2 modules
  undefined
```

- With expanded stats options (`orphanModules`, `chunkModules`, `dependentModules`, and all `groupModulesBy*` disabled), rspack shows the same nested modules as webpack.

Verified versions:

- `webpack@5.66.0`
- `@rspack/core@1.7.11`
- `@rspack/core@2.0.8`

Conclusion: on both checked rspack versions, this minimal case does **not** prove different actual concatenation. It proves a stats/reporting difference that can make rspack look like it has fewer `concatenatedModules` unless stats grouping is disabled.
