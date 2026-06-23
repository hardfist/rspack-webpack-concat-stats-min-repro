export async function run() {
  const [{ render: renderA }, { render: renderB }] = await Promise.all([
    import(/* webpackChunkName: "page-a" */ "./pages/page-a/index.js"),
    import(/* webpackChunkName: "page-b" */ "./pages/page-b/index.js"),
  ]);
  return renderA() + renderB();
}

run().then((value) => {
  globalThis.__RESULT__ = value;
});
