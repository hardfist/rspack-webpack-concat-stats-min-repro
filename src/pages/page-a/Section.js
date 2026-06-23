import { SharedComponent, SharedWrapper } from "../../shared/SharedComponent.js";
import { formatValue } from "../../shared/SharedUtil.js";
import { computeScore, getTitle } from "./helpers.js";

export function renderSection(a, b) {
  const score = computeScore(a, b);
  const label = formatValue(getTitle());
  return SharedWrapper(SharedComponent("span", { class: "score" }, label + ": " + score));
}
