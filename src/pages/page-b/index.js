import { SharedComponent, SharedWrapper } from "../../shared/SharedComponent.js";
import { formatLabel } from "../../shared/SharedUtil.js";

export function render() {
  const rank = Math.floor(42 / 10) + 1;
  const label = formatLabel("rank", String(rank));
  return SharedWrapper(SharedComponent("span", { class: "rank" }, label));
}
