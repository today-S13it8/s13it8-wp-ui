/**
 * Build settings shared by every theme and plugin.
 *
 *   // ui/vite.config.ts
 *   import { wpUi } from "@s13it8/wp-ui/vite"
 *   export default wpUi({ scope: "frb-app", root: import.meta.dirname, outDir: "../assets/build" })
 *
 * What it sets up, and why:
 *   - React, and Tailwind v4 with the Typography plugin.
 *   - The CSS fence: every rule only applies inside the scope class.
 *   - app.js, a small loader. WordPress adds "?ver=" to it, so nothing a
 *     chunk needs may live in it, or the browser would run it twice under
 *     two addresses and load React twice. React and the boot code go into
 *     a "vendor" chunk, and Vite's preload helper into a "runtime" chunk.
 *     `npx wp-ui check-build` fails if a chunk still imports app.js.
 *   - One app.css. Chunks get stable names with a content hash.
 */
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { scopeCssPlugin } from "./scope-css.js";
export function wpUi(options) {
    const root = path.resolve(options.root);
    const config = {
        root,
        base: "./",
        plugins: [react(), tailwindcss(), scopeCssPlugin({ scope: options.scope, island: options.island })],
        resolve: { alias: { "@": path.join(root, "src") } },
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
        build: {
            outDir: path.resolve(root, options.outDir),
            emptyOutDir: true,
            target: "es2020",
            cssCodeSplit: false,
            modulePreload: false,
            sourcemap: false,
            rollupOptions: {
                input: { app: path.resolve(root, options.entry ?? "src/main.tsx") },
                output: {
                    manualChunks: (id) => {
                        if (id.includes("preload-helper"))
                            return "runtime";
                        // Everything the loader shares with the views lives outside it.
                        if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
                            return "vendor";
                        if (/[\\/](@s13it8[\\/]wp-ui|s13it8-wp-ui)[\\/]src[\\/](boot|lib)[\\/.]/.test(id))
                            return "vendor";
                        return undefined;
                    },
                    entryFileNames: "[name].js",
                    chunkFileNames: "chunks/[name]-[hash].js",
                    assetFileNames: (asset) => (asset.names?.some((n) => n.endsWith(".css")) ? "app.css" : "assets/[name]-[hash][extname]"),
                },
            },
        },
    };
    const extra = options.extend ?? {};
    return defineConfig({
        ...config,
        ...extra,
        plugins: [...(config.plugins ?? []), ...(extra.plugins ?? [])],
        build: { ...config.build, ...extra.build },
    });
}
