export const p0 = import(/* webpackChunkName: "page0" */ "./page0.js");
export const p1 = import(/* webpackChunkName: "page1" */ "./page1.js");

export async function run() {
  const [page0, page1] = await Promise.all([p0, p1]);
  return page0.page0() + page1.page1();
}
