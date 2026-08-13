import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./", // ルート以外のサブフォルダにそのまま置いても動くよう相対パスでビルドする
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "スマートロック",
        short_name: "スマートロック",
        description: "Sesameスマートロックの状態確認・施錠/解錠",
        theme_color: "#111827",
        background_color: "#f9fafb",
        display: "standalone",
        start_url: ".",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
