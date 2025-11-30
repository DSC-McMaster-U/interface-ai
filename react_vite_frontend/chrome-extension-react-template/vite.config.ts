import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tailwindcss from "@tailwindcss/vite";
import hotReloadExtension from "hot-reload-extension-vite";

export default defineConfig({
  plugins: [
    react(),
    hotReloadExtension({
      log: true,
      backgroundPath: "path/to/background", // relative path to background script file
    }),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: "public/manifest.json",
          dest: ".",
        },
      ],
    }),
  ],
  build: {
    outDir: "build",
    rollupOptions: {
      input: {
        main: "./index.html",
        background: "./src/background.ts",
        content: "./src/contentScript.tsx",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // background script must not be hashed
          if (chunkInfo.name === "background") return "background.js";

          // content script must not be hashed (MV3 requirement)
          if (chunkInfo.name === "content") return "contentScript.js";

          // everything else (React app) can be hashed as usual
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
