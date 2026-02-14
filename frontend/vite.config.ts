import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tailwindcss from "@tailwindcss/vite";
import hotReloadExtension from "hot-reload-extension-vite";

export default defineConfig({
  plugins: [
    hotReloadExtension({
      log: true,
      backgroundPath: "src/background.ts", // relative path to background script file
    }),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: "public/manifest.json",
          dest: ".",
        },
        {
          src: "public/logo_128px.svg",
          dest: ".",
        },
      ],
    }),
  ],
  build: {
    outDir: "build",
    rollupOptions: {
      input: {
        background: "./src/background.ts",
        content: "./src/content.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Output background.js and content.js at the root level
          if (chunkInfo.name === "background" || chunkInfo.name === "content") {
            return "[name].js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
