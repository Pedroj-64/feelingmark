import assert from "node:assert/strict";
import { test } from "node:test";
import { dark, light } from "../src/colors.ts";

// Contraste WCAG 2.x: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const [name, t] of [
  ["claro", light],
  ["oscuro", dark],
] as const) {
  test(`contraste AA (4.5:1) en modo ${name}`, () => {
    const pairs: [string, string, string][] = [
      ["texto sobre fondo", t.ink, t.bg],
      ["texto sobre superficie", t.ink, t.surface],
      ["texto secundario sobre fondo", t.muted, t.bg],
      ["texto secundario sobre superficie", t.muted, t.surface],
      ["acento como texto sobre fondo", t.accent, t.bg],
      ["texto sobre botón de acento", t.onAccent, t.accent],
    ];
    const bad = pairs.filter(([, fg, bg]) => ratio(fg, bg) < 4.5).map(([label, fg, bg]) => `${label}: ${ratio(fg, bg).toFixed(2)}`);
    assert.deepEqual(bad, []);
  });
}
