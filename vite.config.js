import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tauri expects a fixed dev port and a build output it can bundle.
// We keep the source under src/ and emit the production build to ./build/
// (separate from ./dist/ which holds final installers).
export default defineConfig({
  root: path.resolve(__dirname, "src"),
  publicDir: false,
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "build"),
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          mermaid: ["mermaid"],
          katex: ["katex"]
        }
      }
    }
  },
  server: {
    port: 1430,
    strictPort: true,
    host: "127.0.0.1",
    hmr: {
      port: 1430
    }
  },
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"]
});
