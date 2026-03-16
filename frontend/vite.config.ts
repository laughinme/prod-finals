import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import path from "path";
import type { PluginOption } from "vite";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), "")
  };

  const enableHttps = env.VITE_ENABLE_HTTPS !== "false";
  const enablePwa = env.VITE_ENABLE_PWA !== "false";
  const proxyTarget = env.VITE_PROXY_TARGET ?? "http://localhost:8080";

  const plugins: PluginOption[] = [tailwindcss(), react()];

  if (enableHttps) {
    plugins.push(basicSsl());
  }

  if (enablePwa) {
    plugins.push(
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: [
          "vite.svg",
          "icons/pwa-192x192.png",
          "icons/pwa-512x512.png",
          "icons/apple-touch-icon.png"
        ],
        manifest: {
          id: "/",
          name: "T-Match",
          short_name: "T-Match",
          description: "Сервис знакомств с ML-рекомендациями",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#111111",
          theme_color: "#facc15",
          icons: [
            {
              src: "/icons/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "/icons/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png"
            },
            {
              src: "/icons/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ]
        },
        workbox: {
          navigateFallback: "/index.html",
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            },
            {
              urlPattern: /\/api\//,
              handler: "NetworkOnly"
            }
          ]
        },
        devOptions: {
          enabled: env.VITE_PWA_DEV === "true",
          type: "module"
        }
      })
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    server: {
      host: true,
      https: enableHttps ? {} : false,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          followRedirects: true
        }
      }
    },
    preview: {
      https: enableHttps ? {} : false
    }
  };
});
