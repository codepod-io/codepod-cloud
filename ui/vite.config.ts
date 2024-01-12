import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
// import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: { port: 3000 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // find: "shared",
      // replacement: path.resolve("./shared/src"),
      shared: path.resolve(__dirname, "./shared/src"),
    },
  },
  plugins: [
    react({ tsDecorators: true }),
    checker({
      // e.g. use TypeScript check
      typescript: true,
    }),
  ],
  // Support for excalidraw. Ref:
  // https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration#preact
  define: {
    "process.env.IS_PREACT": JSON.stringify("true"),
  },
});
