import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { corejsPlugin } from "rollup-plugin-corejs"
import unpluginIcons from "unplugin-icons/vite"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  build: {
    manifest: true,
    cssMinify: "lightningcss",
    rollupOptions: {
      plugins: [corejsPlugin({ targets: ["baseline widely available", "Firefox ESR"], exclude: [/^esnext\./] })],
    },
  },
  esbuild: {
    supported: {
      "top-level-await": true,
    },
  },
  plugins: [tailwindcss(), reactRouter(), unpluginIcons({ compiler: "jsx", jsx: "react" }), tsconfigPaths()],
})
