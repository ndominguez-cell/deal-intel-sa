import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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

// The Cloudflare plugin writes its deploy redirect (.wrangler/deploy/config.json)
// under the Vite root, which is client/. Cloudflare Workers Builds runs
// `npx wrangler deploy` from the repo root, so without a root copy of the
// redirect it deploys the raw wrangler.jsonc and fails on assets.directory.
function writeRootDeployRedirect(): Plugin {
  return {
    name: "write-root-deploy-redirect",
    apply: "build",
    enforce: "post",
    closeBundle() {
      const dir = path.resolve(import.meta.dirname, ".wrangler", "deploy");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "config.json"),
        JSON.stringify({
          configPath: "../../dist/public/deal_intel_sa/wrangler.json",
          auxiliaryWorkers: [],
        }),
      );
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
    writeRootDeployRedirect(),
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
