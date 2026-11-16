import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "wa-gateway/**",
      "prisma/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Erros pré-existentes quando o lint entrou no CI (07/11/2026). Rebaixados para
    // "warn" para o CI ficar verde sem correção em massa; voltar para "error" quando
    // os follow-ups do PR chore/ci-lint-build forem resolvidos.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn", // platform/report.ts, queue/data.ts, plan/effective.ts
      "@typescript-eslint/no-require-imports": "warn", // tailwind.config.ts (plugin via require)
      "react/no-children-prop": "warn", // client/(app)/agendar/page.tsx
    },
  },
];

export default eslintConfig;
