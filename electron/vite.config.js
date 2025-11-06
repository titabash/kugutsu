import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
    root: path.resolve(__dirname, "renderer"),
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./renderer"),
        },
    },
    build: {
        outDir: path.resolve(__dirname, "dist/renderer"),
        emptyOutDir: true,
    },
    base: "./",
});
//# sourceMappingURL=vite.config.js.map