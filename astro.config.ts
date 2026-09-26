import node from "@astrojs/node";
import { defineConfig, passthroughImageService } from "astro/config";

// Server-rendered output: pages render per request so they can read the
// database, and `astro build` emits the Node server the Dockerfile runs.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  // README.md's screenshot goes through Astro's image pipeline when /readme/
  // renders it. The default service needs `sharp`, which isn't installed, so
  // the live /_image URL 500'd; passthrough serves the original file as is.
  image: { service: passthroughImageService() },
  security: {
    // Fly's proxy terminates TLS, so naming the deploy domain is what lets
    // Astro trust x-forwarded-proto and accept same-origin form POSTs.
    allowedDomains: [{ hostname: "**.fly.dev", protocol: "https" }],
  },
});
