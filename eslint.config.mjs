import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";


export default defineConfig([
  { ignores: ["build/**"] },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: "readonly"
      }
    }
  },
  {
    ...pluginReact.configs.flat.recommended,
    ignores: ["build/**"],
    settings: {
      react: {
        version: "detect"
      }
    }
  }
]);
