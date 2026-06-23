export function SharedComponent(tag, props, children) {
  return tag + JSON.stringify(props || {}) + children;
}

export function SharedWrapper(child) {
  return "<div>" + child + "</div>";
}
