import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses geographic focus strokes while preserving other controls' focus outlines", () => {
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  expect(styles).toMatch(/\.geo-region\[role="button"\]:focus\s*\{\s*outline:none;/);
  expect(styles).toMatch(/\.geo-highlight\.focused\s*\{[^}]*stroke:#[0-9a-f]+;[^}]*stroke-width:4;/);
  expect(styles).toContain(":focus-visible { outline: 3px solid #3182f6;");
});

it("paints non-interactive highlights after region fills using the same geometry", () => {
  const source = readFileSync(new URL("./ImpactMap.tsx", import.meta.url), "utf8");
  expect(source.indexOf('className="geo-highlights"')).toBeGreaterThan(source.indexOf('className="demand-flow"'));
  expect(source).toContain('className="geo-highlights" pointerEvents="none" aria-hidden="true"');
  expect(source.match(/d=\{boundaryPath\(boundary\)\}/g)).toHaveLength(2);
});
