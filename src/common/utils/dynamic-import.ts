/**
 * TypeScript compiles `import(...)` down to `Promise.resolve().then(() => require(...))`
 * when targeting CommonJS (see tsconfig.json `module: "commonjs"`). That down-leveled
 * form calls Node's `require`, which throws `ERR_REQUIRE_ESM` for ESM-only packages
 * (e.g. `file-type` v14+, which dropped CommonJS support).
 *
 * Wrapping the specifier in `new Function(...)` prevents the TypeScript compiler from
 * seeing a literal `import()` expression to down-level, so the *real* native ESM dynamic
 * `import()` runs at runtime instead of `require()`. This is the standard workaround for
 * consuming ESM-only packages from a CommonJS TypeScript codebase until the project fully
 * migrates to ESM (or enables `verbatimModuleSyntax`, which preserves `import()` as-is).
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<unknown>;

export async function importEsm<T>(specifier: string): Promise<T> {
  return dynamicImport(specifier) as Promise<T>;
}
