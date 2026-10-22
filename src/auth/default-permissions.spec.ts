import * as fs from "fs";
import * as path from "path";
import { DEFAULT_PERMISSIONS } from "./default-permissions";

function controllerFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) controllerFiles(full, out);
    else if (entry.name.endsWith(".controller.ts")) out.push(full);
  }
  return out;
}

describe("DEFAULT_PERMISSIONS", () => {
  it("covers every key used by @RequirePermission in controllers", () => {
    const known = new Set(DEFAULT_PERMISSIONS.map((p) => p.key));
    const used = new Set<string>();
    for (const file of controllerFiles(path.join(__dirname, ".."))) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/@RequirePermission\(\s*["']([^"']+)["']/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(5);
    expect([...used].filter((k) => !known.has(k))).toEqual([]);
  });

  it("matches the keys seeded by prisma/seed-logic.ts", () => {
    const seed = fs.readFileSync(path.join(__dirname, "../../prisma/seed-logic.ts"), "utf8");
    const seeded = [...seed.matchAll(/\{ key: "([^"]+)", label:/g)].map((m) => m[1]).sort();
    expect(DEFAULT_PERMISSIONS.map((p) => p.key).sort()).toEqual(seeded);
  });
});
