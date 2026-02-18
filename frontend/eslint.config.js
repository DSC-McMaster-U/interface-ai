import js from "@eslint/js";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
  globalIgnores(["**/build/"])
];
