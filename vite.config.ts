import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the built site works both at the domain root and under a
  // GitHub Pages sub-path (username.github.io/costbase/) without hardcoding it.
  base: "./",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
