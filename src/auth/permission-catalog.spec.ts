import * as fs from "fs";
import * as path from "path";
import {
  LEGACY_EXTRA_GRANTS,
  LEGACY_PERMISSION_MAP,
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
} from "./permission-catalog";

function controllerFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) controllerFiles(full, out);
    else if (entry.name.endsWith(".controller.ts")) out.push(full);
  }
  return out;
}

const srcDir = path.join(__dirname, "..");

describe("PERMISSION_CATALOG", () => {
  it("has unique keys in resource.action format with Arabic labels", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    for (const p of PERMISSION_CATALOG) {
      expect(p.key).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(p.label).toMatch(/[؀-ۿ]/);
      expect(p.group).toMatch(/[؀-ۿ]/);
    }
  });

  it("covers every key used by @RequirePermission in controllers", () => {
    const known = new Set(PERMISSION_KEYS);
    const used = new Set<string>();
    for (const file of controllerFiles(srcDir)) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/@RequirePermission\(\s*["']([^"']+)["']/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(20);
    expect([...used].filter((k) => !known.has(k))).toEqual([]);
  });

  it("every catalog key is enforced by at least one route", () => {
    const used = new Set<string>();
    for (const file of controllerFiles(srcDir)) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/@RequirePermission\(\s*["']([^"']+)["']/g)) used.add(m[1]);
    }
    // These gate UI pages / actions whose data endpoints are public or shared.
    const uiOnly = new Set(["categories.view", "pages.view"]);
    const unused = PERMISSION_KEYS.filter((k) => !used.has(k) && !uiOnly.has(k));
    expect(unused).toEqual([]);
  });

  it("never puts @RequirePermission at class level (each route declares its own key)", () => {
    const offenders: string[] = [];
    for (const file of controllerFiles(srcDir)) {
      const text = fs.readFileSync(file, "utf8");
      if (/@RequirePermission\([^)]*\)\s*\n(?:@\w+\([^)]*\)\s*\n)*export class/.test(text)) {
        offenders.push(path.relative(srcDir, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("legacy mappings only point at catalog keys", () => {
    const known = new Set(PERMISSION_KEYS);
    const targets = [
      ...Object.values(LEGACY_PERMISSION_MAP).flat(),
      ...Object.values(LEGACY_EXTRA_GRANTS).flat(),
    ];
    expect(targets.filter((k) => !known.has(k))).toEqual([]);
    expect(Object.keys(LEGACY_PERMISSION_MAP).filter((k) => known.has(k))).toEqual([]);
  });

  it("matches the permissions seeded by prisma/seed-logic.ts", () => {
    const seed = fs.readFileSync(path.join(__dirname, "../../prisma/seed-logic.ts"), "utf8");
    expect(seed).toContain("PERMISSION_CATALOG");
    const roleKeys = [...seed.matchAll(/^\s+"([a-z_]+\.[a-z_]+)",$/gm)].map((m) => m[1]);
    expect(roleKeys.filter((k) => !PERMISSION_KEYS.includes(k))).toEqual([]);
  });
});
