import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
export default defineConfig({
  plugins: [react()],
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
