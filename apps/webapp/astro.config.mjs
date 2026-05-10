import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

import vercel from "@astrojs/vercel";

export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ["yearlong-jon-patrilineal.ngrok-free.dev"],
    },
  },

  server: {
    host: true,
    port: 3000,
  },

  adapter: vercel(),
});