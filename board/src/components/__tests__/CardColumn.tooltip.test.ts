import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { en } from "../../i18n/en";

const srcPath = join(import.meta.dir, "../CardColumn.tsx");
const src = readFileSync(srcPath, "utf8");

describe("ShippedColumn collapse button — tooltip + aria", () => {
  it("has title={t('collapseShipped')} in source", () => {
    expect(src).toContain("title={t('collapseShipped')}");
  });

  it("has aria-label={t('collapseShipped')} in source", () => {
    expect(src).toContain("aria-label={t('collapseShipped')}");
  });

  it("has aria-expanded={true} on the collapse button", () => {
    expect(src).toContain("aria-expanded={true}");
  });

  it("en.collapseShipped is a non-empty string", () => {
    expect(typeof en.collapseShipped).toBe("string");
    expect(en.collapseShipped.length).toBeGreaterThan(0);
  });
});
