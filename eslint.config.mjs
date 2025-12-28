import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      import: importPlugin,
      "unused-imports": unusedImports,
      react: reactPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      "unused-imports/no-unused-imports": "warn",
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
