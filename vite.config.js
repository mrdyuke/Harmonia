import { defineConfig } from "vite";
import path from "path";
import eslintPlugin from "vite-plugin-eslint"; // импорт плагина ESLint

export default defineConfig({
  root: ".",
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: { port: 5173 },
  plugins: [
    eslintPlugin({
      cache: false,
      include: ["src/**/*.js", "electron/**/*.js"],
    }),
  ],
});
