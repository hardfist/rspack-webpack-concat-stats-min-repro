export function formatValue(value) {
  return String(value).toUpperCase();
}

export function formatLabel(label, value) {
  return label + ": " + formatValue(value);
}
