import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { rundotGameLibrariesPlugin, rundotGamePlaygroundPlugin } from "@series-inc/rundot-game-sdk/vite";

const playgroundEnabled = process.env.RUNDOT_PLAYGROUND === "1";

const plugins = [rundotGameLibrariesPlugin(), react(), tailwindcss()];

// Playground talks to real RUN services and requires sign-in, so it must never
// ambush ordinary local development. Purchases made there are real/persistent.
if (playgroundEnabled) plugins.push(rundotGamePlaygroundPlugin());

export default defineConfig({
    // REQUIRED for RUN: deployed builds are served from a subdirectory, so all
    // asset URLs must be relative. Do not change this.
    base: "./",
    plugins,
    server: {
        allowedHosts: true,
        port: 5183,
    },
    build: {
        // Top-level await in the RUN SDK needs a modern target.
        target: "es2022",
        // Pixi, React and Firebase stay isolated and cacheable. The verifier
        // keeps ordinary chunks below 600 kB.
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                // The firebase umbrella has no root entry, so group by path.
                manualChunks(id) {
                    if (id.includes("node_modules/pixi.js")) return "pixi";
                    if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
                        return "firebase";
                    }
                    if (
                        id.includes("node_modules/react") ||
                        id.includes("node_modules/scheduler") ||
                        id.includes("node_modules/react-dom")
                    ) {
                        return "react";
                    }
                },
            },
        },
    },
    esbuild: { target: "es2022" },
    optimizeDeps: {
        esbuildOptions: {
            target: "es2022",
        },
    },
});
