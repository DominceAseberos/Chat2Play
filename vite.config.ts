import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {VitePWA} from "vite-plugin-pwa";
import {fileURLToPath} from "node:url";
export default defineConfig({
  plugins: [react(),VitePWA({
    manifest:false,
    registerType:"autoUpdate",
    injectRegister:"script-defer",
    workbox:{
      globPatterns:["**/*.{js,css,html,ico}","icon-*.png","apple-touch-icon.png","chat2play-logo.webp"],
      cleanupOutdatedCaches:true,
      clientsClaim:true,
      skipWaiting:true,
      navigateFallback:"/index.html",
      navigateFallbackDenylist:[/^\/api\//,/^\/socket\.io\//],
      maximumFileSizeToCacheInBytes:3*1024*1024,
      runtimeCaching:[
        {
          urlPattern:/\/(?:api|socket\.io)(?:\/|$)/,
          handler:"NetworkOnly"
        },
        {
          urlPattern:/\/models\//,
          handler:"CacheFirst",
          options:{cacheName:"chat2play-models",expiration:{maxEntries:12,maxAgeSeconds:60*60*24*30},cacheableResponse:{statuses:[0,200]}}
        },
        {
          urlPattern:/\/(?:emoji|gifs)\//,
          handler:"CacheFirst",
          options:{cacheName:"chat2play-media",expiration:{maxEntries:256,maxAgeSeconds:60*60*24*30},cacheableResponse:{statuses:[0,200]}}
        },
        {
          urlPattern:/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
          handler:"StaleWhileRevalidate",
          options:{cacheName:"chat2play-fonts",expiration:{maxEntries:12,maxAgeSeconds:60*60*24*365},cacheableResponse:{statuses:[0,200]}}
        }
      ]
    }
  })],
  build:{rollupOptions:{input:{
    main:fileURLToPath(new URL("./index.html",import.meta.url)),
    characters:fileURLToPath(new URL("./assets/characters/review.html",import.meta.url)),
    firstPerson:fileURLToPath(new URL("./assets/characters/first-person.html",import.meta.url)),
    firstPersonRps:fileURLToPath(new URL("./assets/characters/first-person-rps.html",import.meta.url))
  }}},
  server: {
    port: 5173,
    proxy: { "/socket.io": { target: "http://127.0.0.1:3001", ws: true }, "/api": "http://127.0.0.1:3001" }
  }
});
