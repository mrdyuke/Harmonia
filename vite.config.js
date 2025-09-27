import { defineConfig } from "vite";
import eslintPlugin from "vite-plugin-eslint";

export default defineConfig({
  root: ".",
  base: "./", // ⚡ важно для Electron, чтобы ресурсы подключались правильно
  build: {
    outDir: "dist",
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
