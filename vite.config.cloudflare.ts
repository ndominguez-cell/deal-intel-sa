import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { rmSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

function removeGeneratedPreviewSecrets(): Plugin {
  const generatedDevVars = path.resolve(
    import.meta.dirname,
    "dist",
    "public",
    "deal_intel_sa",
    ".dev.vars",
  );

  return {
    name: "remove-generated-preview-secrets",
    apply: "build",
    enforce: "post",
    closeBundle() {
      rmSync(generatedDevVars, { force: true });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    cloudflare({
      configPath: path.resolve(import.meta.dirname, "wrangler.jsonc"),
    }),
    removeGeneratedPreviewSecrets(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "public"),
    emptyOutDir: true,
  },
});
