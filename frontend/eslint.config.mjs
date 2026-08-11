import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ── Vendored third-party source ───────────────────────────────────────
    //
    // `components/vendor-datatable/` and `components/ui/` are the reference
    // implementation's files, copied verbatim on 2026-08-10 with the owner's
    // approval (see DAILY_CHANGES). They are **deliberately kept close to
    // upstream** so re-copying a newer version stays a file copy rather than a
    // merge — which means they are not edited to satisfy our lint rules, and
    // holding them to those rules would only produce noise nobody may act on.
    //
    // ⚠️ This is an exemption from lint, **not** from the rules that matter.
    // Both directories are still covered by `tsc --noEmit` and by the
    // brand-colour guard in UI_PATTERNS.md — the copy shipped one `bg-blue-50`
    // and it was retinted, not ignored. Anything genuinely wrong in here gets
    // patched with a `// PATCHED:` comment saying why.
    "components/vendor-datatable/**",
    "components/ui/**",
  ]),
]);

export default eslintConfig;
