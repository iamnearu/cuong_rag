// vite.config.js
import { defineConfig } from "file:///app/node_modules/vite/dist/node/index.js";
import { fileURLToPath, URL } from "url";

// postcss.config.js
import tailwind from "file:///app/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///app/node_modules/autoprefixer/lib/autoprefixer.js";

// tailwind.config.js
var tailwind_config_default = {
  darkMode: "class",
  content: {
    relative: true,
    files: [
      "./src/components/**/*.{js,jsx}",
      "./src/hooks/**/*.js",
      "./src/models/**/*.js",
      "./src/pages/**/*.{js,jsx}",
      "./src/utils/**/*.js",
      "./src/*.jsx",
      "./index.html",
      "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}"
    ]
  },
  theme: {
    extend: {
      rotate: {
        "270": "270deg",
        "360": "360deg"
      },
      colors: {
        "black-900": "#141414",
        accent: "#3D4147",
        "sidebar-button": "#31353A",
        sidebar: "#25272C",
        "historical-msg-system": "rgba(255, 255, 255, 0.05);",
        "historical-msg-user": "#2C2F35",
        outline: "#4E5153",
        "primary-button": "var(--theme-button-primary)",
        "cta-button": "var(--theme-button-cta)",
        secondary: "#2C2F36",
        "dark-input": "#18181B",
        "mobile-onboarding": "#2C2F35",
        "dark-highlight": "#1C1E21",
        "dark-text": "#222628",
        description: "#D2D5DB",
        "x-button": "#9CA3AF",
        royalblue: "#065986",
        purple: "#4A1FB8",
        magenta: "#9E165F",
        danger: "#F04438",
        error: "#B42318",
        warn: "#854708",
        success: "#05603A",
        darker: "#F4F4F4",
        teal: "#0BA5EC",
        // Generic theme colors
        theme: {
          bg: {
            primary: "var(--theme-bg-primary)",
            secondary: "var(--theme-bg-secondary)",
            sidebar: "var(--theme-bg-sidebar)",
            container: "var(--theme-bg-container)",
            chat: "var(--theme-bg-chat)",
            "chat-input": "var(--theme-bg-chat-input)",
            "popup-menu": "var(--theme-popup-menu-bg)"
          },
          text: {
            primary: "var(--theme-text-primary)",
            secondary: "var(--theme-text-secondary)",
            placeholder: "var(--theme-placeholder)"
          },
          sidebar: {
            item: {
              default: "var(--theme-sidebar-item-default)",
              selected: "var(--theme-sidebar-item-selected)",
              hover: "var(--theme-sidebar-item-hover)"
            },
            subitem: {
              default: "var(--theme-sidebar-subitem-default)",
              selected: "var(--theme-sidebar-subitem-selected)",
              hover: "var(--theme-sidebar-subitem-hover)"
            },
            footer: {
              icon: "var(--theme-sidebar-footer-icon)",
              "icon-hover": "var(--theme-sidebar-footer-icon-hover)"
            },
            border: "var(--theme-sidebar-border)"
          },
          "chat-input": {
            border: "var(--theme-chat-input-border)"
          },
          "action-menu": {
            bg: "var(--theme-action-menu-bg)",
            "item-hover": "var(--theme-action-menu-item-hover)"
          },
          settings: {
            input: {
              bg: "var(--theme-settings-input-bg)",
              active: "var(--theme-settings-input-active)",
              placeholder: "var(--theme-settings-input-placeholder)",
              text: "var(--theme-settings-input-text)"
            }
          },
          modal: {
            border: "var(--theme-modal-border)"
          },
          "file-picker": {
            hover: "var(--theme-file-picker-hover)"
          },
          attachment: {
            bg: "var(--theme-attachment-bg)",
            "error-bg": "var(--theme-attachment-error-bg)",
            "success-bg": "var(--theme-attachment-success-bg)",
            text: "var(--theme-attachment-text)",
            "text-secondary": "var(--theme-attachment-text-secondary)",
            "icon": "var(--theme-attachment-icon)",
            "icon-spinner": "var(--theme-attachment-icon-spinner)",
            "icon-spinner-bg": "var(--theme-attachment-icon-spinner-bg)"
          },
          home: {
            text: "var(--theme-home-text)",
            "text-secondary": "var(--theme-home-text-secondary)",
            "bg-card": "var(--theme-home-bg-card)",
            "bg-button": "var(--theme-home-bg-button)",
            border: "var(--theme-home-border)",
            "button-primary": "var(--theme-home-button-primary)",
            "button-primary-hover": "var(--theme-home-button-primary-hover)",
            "button-secondary": "var(--theme-home-button-secondary)",
            "button-secondary-hover": "var(--theme-home-button-secondary-hover)",
            "button-secondary-text": "var(--theme-home-button-secondary-text)",
            "button-secondary-hover-text": "var(--theme-home-button-secondary-hover-text)",
            "button-secondary-border": "var(--theme-home-button-secondary-border)",
            "button-secondary-border-hover": "var(--theme-home-button-secondary-border-hover)",
            "update-card-bg": "var(--theme-home-update-card-bg)",
            "update-card-hover": "var(--theme-home-update-card-hover)",
            "update-source": "var(--theme-home-update-source)"
          },
          checklist: {
            "item-bg": "var(--theme-checklist-item-bg)",
            "item-bg-hover": "var(--theme-checklist-item-bg-hover)",
            "item-text": "var(--theme-checklist-item-text)",
            "item-completed-bg": "var(--theme-checklist-item-completed-bg)",
            "item-completed-text": "var(--theme-checklist-item-completed-text)",
            "item-hover": "var(--theme-checklist-item-hover)",
            "checkbox-border": "var(--theme-checklist-checkbox-border)",
            "checkbox-fill": "var(--theme-checklist-checkbox-fill)",
            "checkbox-text": "var(--theme-checklist-checkbox-text)",
            "button-border": "var(--theme-checklist-button-border)",
            "button-text": "var(--theme-checklist-button-text)",
            "button-hover-bg": "var(--theme-checklist-button-hover-bg)",
            "button-hover-border": "var(--theme-checklist-button-hover-border)"
          },
          button: {
            text: "var(--theme-button-text)",
            "code-hover-text": "var(--theme-button-code-hover-text)",
            "code-hover-bg": "var(--theme-button-code-hover-bg)",
            "disable-hover-text": "var(--theme-button-disable-hover-text)",
            "disable-hover-bg": "var(--theme-button-disable-hover-bg)",
            "delete-hover-text": "var(--theme-button-delete-hover-text)",
            "delete-hover-bg": "var(--theme-button-delete-hover-bg)"
          }
        }
      },
      backgroundImage: {
        "preference-gradient": "linear-gradient(180deg, #5A5C63 0%, rgba(90, 92, 99, 0.28) 100%);",
        "chat-msg-user-gradient": "linear-gradient(180deg, #3D4147 0%, #2C2F35 100%);",
        "selected-preference-gradient": "linear-gradient(180deg, #313236 0%, rgba(63.40, 64.90, 70.13, 0) 100%);",
        "main-gradient": "linear-gradient(180deg, #3D4147 0%, #2C2F35 100%)",
        "modal-gradient": "linear-gradient(180deg, #3D4147 0%, #2C2F35 100%)",
        "sidebar-gradient": "linear-gradient(90deg, #5B616A 0%, #3F434B 100%)",
        "login-gradient": "linear-gradient(180deg, #3D4147 0%, #2C2F35 100%)",
        "menu-item-gradient": "linear-gradient(90deg, #3D4147 0%, #2C2F35 100%)",
        "menu-item-selected-gradient": "linear-gradient(90deg, #5B616A 0%, #3F434B 100%)",
        "workspace-item-gradient": "linear-gradient(90deg, #3D4147 0%, #2C2F35 100%)",
        "workspace-item-selected-gradient": "linear-gradient(90deg, #5B616A 0%, #3F434B 100%)",
        "switch-selected": "linear-gradient(146deg, #5B616A 0%, #3F434B 100%)"
      },
      fontFamily: {
        sans: [
          "plus-jakarta-sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          '"Noto Sans"',
          "sans-serif",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"'
        ]
      },
      animation: {
        sweep: "sweep 0.5s ease-in-out",
        "pulse-glow": "pulse-glow 1.5s infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out forwards",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite"
      },
      keyframes: {
        sweep: {
          "0%": { transform: "scaleX(0)", transformOrigin: "bottom left" },
          "100%": { transform: "scaleX(1)", transformOrigin: "bottom left" }
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 }
        },
        fadeOut: {
          "0%": { opacity: 1 },
          "100%": { opacity: 0 }
        },
        "pulse-glow": {
          "0%": {
            opacity: 1,
            transform: "scale(1)",
            boxShadow: "0 0 0 rgba(255, 255, 255, 0.0)",
            backgroundColor: "rgba(255, 255, 255, 0.0)"
          },
          "50%": {
            opacity: 1,
            transform: "scale(1.1)",
            boxShadow: "0 0 15px rgba(255, 255, 255, 0.2)",
            backgroundColor: "rgba(255, 255, 255, 0.1)"
          },
          "100%": {
            opacity: 1,
            transform: "scale(1)",
            boxShadow: "0 0 0 rgba(255, 255, 255, 0.0)",
            backgroundColor: "rgba(255, 255, 255, 0.0)"
          }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" }
        }
      }
    }
  },
  variants: {
    extend: {
      backgroundColor: ["light"],
      textColor: ["light"]
    }
  },
  // Required for rechart styles to show since they can be rendered dynamically and will be tree-shaken if not safe-listed.
  safelist: [
    {
      pattern: /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"]
    },
    {
      pattern: /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"]
    },
    {
      pattern: /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"]
    },
    {
      pattern: /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/
    },
    {
      pattern: /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/
    },
    {
      pattern: /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/
    }
  ],
  plugins: [
    function({ addVariant }) {
      addVariant("light", ".light &");
      addVariant("pwa", ".pwa &");
    }
  ]
};

// postcss.config.js
var postcss_config_default = {
  plugins: [tailwind(tailwind_config_default), autoprefixer]
};

// vite.config.js
import react from "file:///app/node_modules/@vitejs/plugin-react/dist/index.mjs";
import dns from "dns";
import { visualizer } from "file:///app/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_import_meta_url = "file:///app/vite.config.js";
dns.setDefaultResultOrder("verbatim");
var vite_config_default = defineConfig({
  cacheDir: "./.vite-cache",
  assetsInclude: [
    "./public/piper/ort-wasm-simd-threaded.wasm",
    "./public/piper/piper_phonemize.wasm",
    "./public/piper/piper_phonemize.data"
  ],
  worker: {
    format: "es"
  },
  server: {
    port: 3e3,
    host: "0.0.0.0",
    hmr: false,
    proxy: {
      "/api/v1/ingest": {
        target: process.env.VITE_INGESTION_API_URL || "http://ingestion-service:8082",
        changeOrigin: true,
        secure: false
      },
      "/api/v1/documents": {
        target: process.env.VITE_INGESTION_API_URL || "http://ingestion-service:8082",
        changeOrigin: true,
        secure: false
      },
      "/api/v1/kg": {
        target: process.env.VITE_KG_API_URL || "http://kg-service:8083",
        changeOrigin: true,
        secure: false
      },
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8081",
        changeOrigin: true,
        secure: false
      }
    }
  },
  define: {
    "process.env": process.env
  },
  css: {
    postcss: postcss_config_default
  },
  plugins: [
    react(),
    visualizer({
      template: "treemap",
      // or sunburst
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: "bundleinspector.html"
      // will be saved in project's root
    })
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
      },
      {
        process: "process/browser",
        stream: "stream-browserify",
        zlib: "browserify-zlib",
        util: "util",
        find: /^~.+/,
        replacement: (val) => {
          return val.replace(/^~/, "");
        }
      }
    ]
  },
  build: {
    rollupOptions: {
      output: {
        // These settings ensure the primary JS and CSS file references are always index.{js,css}
        // so we can SSR the index.html as text response from server/index.js without breaking references each build.
        entryFileNames: "index.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "index.css")
            return `index.css`;
          return assetInfo.name;
        }
      },
      external: [
        // Reduces transformation time by 50% and we don't even use this variant, so we can ignore.
        /@phosphor-icons\/react\/dist\/ssr/
      ]
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    include: ["@mintplex-labs/piper-tts-web"],
    esbuildOptions: {
      define: {
        global: "globalThis"
      },
      plugins: []
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAicG9zdGNzcy5jb25maWcuanMiLCAidGFpbHdpbmQuY29uZmlnLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIlxyXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tIFwidXJsXCJcclxuaW1wb3J0IHBvc3Rjc3MgZnJvbSBcIi4vcG9zdGNzcy5jb25maWcuanNcIlxyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCJcclxuaW1wb3J0IGRucyBmcm9tIFwiZG5zXCJcclxuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gXCJyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXJcIlxyXG5cclxuZG5zLnNldERlZmF1bHRSZXN1bHRPcmRlcihcInZlcmJhdGltXCIpXHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIGNhY2hlRGlyOiBcIi4vLnZpdGUtY2FjaGVcIixcclxuXHJcbiAgYXNzZXRzSW5jbHVkZTogW1xyXG4gICAgJy4vcHVibGljL3BpcGVyL29ydC13YXNtLXNpbWQtdGhyZWFkZWQud2FzbScsXHJcbiAgICAnLi9wdWJsaWMvcGlwZXIvcGlwZXJfcGhvbmVtaXplLndhc20nLFxyXG4gICAgJy4vcHVibGljL3BpcGVyL3BpcGVyX3Bob25lbWl6ZS5kYXRhJyxcclxuICBdLFxyXG4gIHdvcmtlcjoge1xyXG4gICAgZm9ybWF0OiAnZXMnXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDAsXHJcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcclxuICAgIGhtcjogZmFsc2UsXHJcbiAgICBwcm94eToge1xyXG4gICAgICBcIi9hcGkvdjEvaW5nZXN0XCI6IHtcclxuICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfSU5HRVNUSU9OX0FQSV9VUkwgfHwgXCJodHRwOi8vaW5nZXN0aW9uLXNlcnZpY2U6ODA4MlwiLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBcIi9hcGkvdjEvZG9jdW1lbnRzXCI6IHtcclxuICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfSU5HRVNUSU9OX0FQSV9VUkwgfHwgXCJodHRwOi8vaW5nZXN0aW9uLXNlcnZpY2U6ODA4MlwiLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBcIi9hcGkvdjEva2dcIjoge1xyXG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVklURV9LR19BUElfVVJMIHx8IFwiaHR0cDovL2tnLXNlcnZpY2U6ODA4M1wiLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBcIi9hcGlcIjoge1xyXG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVklURV9BUElfQkFTRV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwODFcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBkZWZpbmU6IHtcclxuICAgIFwicHJvY2Vzcy5lbnZcIjogcHJvY2Vzcy5lbnZcclxuICB9LFxyXG4gIGNzczoge1xyXG4gICAgcG9zdGNzc1xyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIHZpc3VhbGl6ZXIoe1xyXG4gICAgICB0ZW1wbGF0ZTogXCJ0cmVlbWFwXCIsIC8vIG9yIHN1bmJ1cnN0XHJcbiAgICAgIG9wZW46IGZhbHNlLFxyXG4gICAgICBnemlwU2l6ZTogdHJ1ZSxcclxuICAgICAgYnJvdGxpU2l6ZTogdHJ1ZSxcclxuICAgICAgZmlsZW5hbWU6IFwiYnVuZGxlaW5zcGVjdG9yLmh0bWxcIiAvLyB3aWxsIGJlIHNhdmVkIGluIHByb2plY3QncyByb290XHJcbiAgICB9KVxyXG4gIF0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IFtcclxuICAgICAge1xyXG4gICAgICAgIGZpbmQ6IFwiQFwiLFxyXG4gICAgICAgIHJlcGxhY2VtZW50OiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCIuL3NyY1wiLCBpbXBvcnQubWV0YS51cmwpKVxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgcHJvY2VzczogXCJwcm9jZXNzL2Jyb3dzZXJcIixcclxuICAgICAgICBzdHJlYW06IFwic3RyZWFtLWJyb3dzZXJpZnlcIixcclxuICAgICAgICB6bGliOiBcImJyb3dzZXJpZnktemxpYlwiLFxyXG4gICAgICAgIHV0aWw6IFwidXRpbFwiLFxyXG4gICAgICAgIGZpbmQ6IC9efi4rLyxcclxuICAgICAgICByZXBsYWNlbWVudDogKHZhbCkgPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIHZhbC5yZXBsYWNlKC9efi8sIFwiXCIpXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICBdXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAvLyBUaGVzZSBzZXR0aW5ncyBlbnN1cmUgdGhlIHByaW1hcnkgSlMgYW5kIENTUyBmaWxlIHJlZmVyZW5jZXMgYXJlIGFsd2F5cyBpbmRleC57anMsY3NzfVxyXG4gICAgICAgIC8vIHNvIHdlIGNhbiBTU1IgdGhlIGluZGV4Lmh0bWwgYXMgdGV4dCByZXNwb25zZSBmcm9tIHNlcnZlci9pbmRleC5qcyB3aXRob3V0IGJyZWFraW5nIHJlZmVyZW5jZXMgZWFjaCBidWlsZC5cclxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2luZGV4LmpzJyxcclxuICAgICAgICBhc3NldEZpbGVOYW1lczogKGFzc2V0SW5mbykgPT4ge1xyXG4gICAgICAgICAgaWYgKGFzc2V0SW5mby5uYW1lID09PSAnaW5kZXguY3NzJykgcmV0dXJuIGBpbmRleC5jc3NgO1xyXG4gICAgICAgICAgcmV0dXJuIGFzc2V0SW5mby5uYW1lO1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIGV4dGVybmFsOiBbXHJcbiAgICAgICAgLy8gUmVkdWNlcyB0cmFuc2Zvcm1hdGlvbiB0aW1lIGJ5IDUwJSBhbmQgd2UgZG9uJ3QgZXZlbiB1c2UgdGhpcyB2YXJpYW50LCBzbyB3ZSBjYW4gaWdub3JlLlxyXG4gICAgICAgIC9AcGhvc3Bob3ItaWNvbnNcXC9yZWFjdFxcL2Rpc3RcXC9zc3IvLFxyXG4gICAgICBdXHJcbiAgICB9LFxyXG4gICAgY29tbW9uanNPcHRpb25zOiB7XHJcbiAgICAgIHRyYW5zZm9ybU1peGVkRXNNb2R1bGVzOiB0cnVlXHJcbiAgICB9XHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFtcIkBtaW50cGxleC1sYWJzL3BpcGVyLXR0cy13ZWJcIl0sXHJcbiAgICBlc2J1aWxkT3B0aW9uczoge1xyXG4gICAgICBkZWZpbmU6IHtcclxuICAgICAgICBnbG9iYWw6IFwiZ2xvYmFsVGhpc1wiXHJcbiAgICAgIH0sXHJcbiAgICAgIHBsdWdpbnM6IFtdXHJcbiAgICB9XHJcbiAgfVxyXG59KVxyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvcG9zdGNzcy5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9wb3N0Y3NzLmNvbmZpZy5qc1wiO2ltcG9ydCB0YWlsd2luZCBmcm9tICd0YWlsd2luZGNzcydcclxuaW1wb3J0IGF1dG9wcmVmaXhlciBmcm9tICdhdXRvcHJlZml4ZXInXHJcbmltcG9ydCB0YWlsd2luZENvbmZpZyBmcm9tICcuL3RhaWx3aW5kLmNvbmZpZy5qcydcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICBwbHVnaW5zOiBbdGFpbHdpbmQodGFpbHdpbmRDb25maWcpLCBhdXRvcHJlZml4ZXJdLFxyXG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL3RhaWx3aW5kLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL3RhaWx3aW5kLmNvbmZpZy5qc1wiOy8qKiBAdHlwZSB7aW1wb3J0KCd0YWlsd2luZGNzcycpLkNvbmZpZ30gKi9cclxuZXhwb3J0IGRlZmF1bHQge1xyXG4gIGRhcmtNb2RlOiBcImNsYXNzXCIsXHJcbiAgY29udGVudDoge1xyXG4gICAgcmVsYXRpdmU6IHRydWUsXHJcbiAgICBmaWxlczogW1xyXG4gICAgICBcIi4vc3JjL2NvbXBvbmVudHMvKiovKi57anMsanN4fVwiLFxyXG4gICAgICBcIi4vc3JjL2hvb2tzLyoqLyouanNcIixcclxuICAgICAgXCIuL3NyYy9tb2RlbHMvKiovKi5qc1wiLFxyXG4gICAgICBcIi4vc3JjL3BhZ2VzLyoqLyoue2pzLGpzeH1cIixcclxuICAgICAgXCIuL3NyYy91dGlscy8qKi8qLmpzXCIsXHJcbiAgICAgIFwiLi9zcmMvKi5qc3hcIixcclxuICAgICAgXCIuL2luZGV4Lmh0bWxcIixcclxuICAgICAgXCIuL25vZGVfbW9kdWxlcy9AdHJlbW9yLyoqLyoue2pzLHRzLGpzeCx0c3h9XCJcclxuICAgIF1cclxuICB9LFxyXG4gIHRoZW1lOiB7XHJcbiAgICBleHRlbmQ6IHtcclxuICAgICAgcm90YXRlOiB7XHJcbiAgICAgICAgXCIyNzBcIjogXCIyNzBkZWdcIixcclxuICAgICAgICBcIjM2MFwiOiBcIjM2MGRlZ1wiXHJcbiAgICAgIH0sXHJcbiAgICAgIGNvbG9yczoge1xyXG4gICAgICAgIFwiYmxhY2stOTAwXCI6IFwiIzE0MTQxNFwiLFxyXG4gICAgICAgIGFjY2VudDogXCIjM0Q0MTQ3XCIsXHJcbiAgICAgICAgXCJzaWRlYmFyLWJ1dHRvblwiOiBcIiMzMTM1M0FcIixcclxuICAgICAgICBzaWRlYmFyOiBcIiMyNTI3MkNcIixcclxuICAgICAgICBcImhpc3RvcmljYWwtbXNnLXN5c3RlbVwiOiBcInJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNSk7XCIsXHJcbiAgICAgICAgXCJoaXN0b3JpY2FsLW1zZy11c2VyXCI6IFwiIzJDMkYzNVwiLFxyXG4gICAgICAgIG91dGxpbmU6IFwiIzRFNTE1M1wiLFxyXG4gICAgICAgIFwicHJpbWFyeS1idXR0b25cIjogXCJ2YXIoLS10aGVtZS1idXR0b24tcHJpbWFyeSlcIixcclxuICAgICAgICBcImN0YS1idXR0b25cIjogXCJ2YXIoLS10aGVtZS1idXR0b24tY3RhKVwiLFxyXG4gICAgICAgIHNlY29uZGFyeTogXCIjMkMyRjM2XCIsXHJcbiAgICAgICAgXCJkYXJrLWlucHV0XCI6IFwiIzE4MTgxQlwiLFxyXG4gICAgICAgIFwibW9iaWxlLW9uYm9hcmRpbmdcIjogXCIjMkMyRjM1XCIsXHJcbiAgICAgICAgXCJkYXJrLWhpZ2hsaWdodFwiOiBcIiMxQzFFMjFcIixcclxuICAgICAgICBcImRhcmstdGV4dFwiOiBcIiMyMjI2MjhcIixcclxuICAgICAgICBkZXNjcmlwdGlvbjogXCIjRDJENURCXCIsXHJcbiAgICAgICAgXCJ4LWJ1dHRvblwiOiBcIiM5Q0EzQUZcIixcclxuICAgICAgICByb3lhbGJsdWU6IFwiIzA2NTk4NlwiLFxyXG4gICAgICAgIHB1cnBsZTogXCIjNEExRkI4XCIsXHJcbiAgICAgICAgbWFnZW50YTogXCIjOUUxNjVGXCIsXHJcbiAgICAgICAgZGFuZ2VyOiBcIiNGMDQ0MzhcIixcclxuICAgICAgICBlcnJvcjogXCIjQjQyMzE4XCIsXHJcbiAgICAgICAgd2FybjogXCIjODU0NzA4XCIsXHJcbiAgICAgICAgc3VjY2VzczogXCIjMDU2MDNBXCIsXHJcbiAgICAgICAgZGFya2VyOiBcIiNGNEY0RjRcIixcclxuICAgICAgICB0ZWFsOiBcIiMwQkE1RUNcIixcclxuXHJcbiAgICAgICAgLy8gR2VuZXJpYyB0aGVtZSBjb2xvcnNcclxuICAgICAgICB0aGVtZToge1xyXG4gICAgICAgICAgYmc6IHtcclxuICAgICAgICAgICAgcHJpbWFyeTogJ3ZhcigtLXRoZW1lLWJnLXByaW1hcnkpJyxcclxuICAgICAgICAgICAgc2Vjb25kYXJ5OiAndmFyKC0tdGhlbWUtYmctc2Vjb25kYXJ5KScsXHJcbiAgICAgICAgICAgIHNpZGViYXI6ICd2YXIoLS10aGVtZS1iZy1zaWRlYmFyKScsXHJcbiAgICAgICAgICAgIGNvbnRhaW5lcjogJ3ZhcigtLXRoZW1lLWJnLWNvbnRhaW5lciknLFxyXG4gICAgICAgICAgICBjaGF0OiAndmFyKC0tdGhlbWUtYmctY2hhdCknLFxyXG4gICAgICAgICAgICBcImNoYXQtaW5wdXRcIjogJ3ZhcigtLXRoZW1lLWJnLWNoYXQtaW5wdXQpJyxcclxuICAgICAgICAgICAgXCJwb3B1cC1tZW51XCI6ICd2YXIoLS10aGVtZS1wb3B1cC1tZW51LWJnKScsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgdGV4dDoge1xyXG4gICAgICAgICAgICBwcmltYXJ5OiAndmFyKC0tdGhlbWUtdGV4dC1wcmltYXJ5KScsXHJcbiAgICAgICAgICAgIHNlY29uZGFyeTogJ3ZhcigtLXRoZW1lLXRleHQtc2Vjb25kYXJ5KScsXHJcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyOiAndmFyKC0tdGhlbWUtcGxhY2Vob2xkZXIpJyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBzaWRlYmFyOiB7XHJcbiAgICAgICAgICAgIGl0ZW06IHtcclxuICAgICAgICAgICAgICBkZWZhdWx0OiAndmFyKC0tdGhlbWUtc2lkZWJhci1pdGVtLWRlZmF1bHQpJyxcclxuICAgICAgICAgICAgICBzZWxlY3RlZDogJ3ZhcigtLXRoZW1lLXNpZGViYXItaXRlbS1zZWxlY3RlZCknLFxyXG4gICAgICAgICAgICAgIGhvdmVyOiAndmFyKC0tdGhlbWUtc2lkZWJhci1pdGVtLWhvdmVyKScsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN1Yml0ZW06IHtcclxuICAgICAgICAgICAgICBkZWZhdWx0OiAndmFyKC0tdGhlbWUtc2lkZWJhci1zdWJpdGVtLWRlZmF1bHQpJyxcclxuICAgICAgICAgICAgICBzZWxlY3RlZDogJ3ZhcigtLXRoZW1lLXNpZGViYXItc3ViaXRlbS1zZWxlY3RlZCknLFxyXG4gICAgICAgICAgICAgIGhvdmVyOiAndmFyKC0tdGhlbWUtc2lkZWJhci1zdWJpdGVtLWhvdmVyKScsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGZvb3Rlcjoge1xyXG4gICAgICAgICAgICAgIGljb246ICd2YXIoLS10aGVtZS1zaWRlYmFyLWZvb3Rlci1pY29uKScsXHJcbiAgICAgICAgICAgICAgJ2ljb24taG92ZXInOiAndmFyKC0tdGhlbWUtc2lkZWJhci1mb290ZXItaWNvbi1ob3ZlciknLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBib3JkZXI6ICd2YXIoLS10aGVtZS1zaWRlYmFyLWJvcmRlciknLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIFwiY2hhdC1pbnB1dFwiOiB7XHJcbiAgICAgICAgICAgIGJvcmRlcjogJ3ZhcigtLXRoZW1lLWNoYXQtaW5wdXQtYm9yZGVyKScsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgXCJhY3Rpb24tbWVudVwiOiB7XHJcbiAgICAgICAgICAgIGJnOiAndmFyKC0tdGhlbWUtYWN0aW9uLW1lbnUtYmcpJyxcclxuICAgICAgICAgICAgXCJpdGVtLWhvdmVyXCI6ICd2YXIoLS10aGVtZS1hY3Rpb24tbWVudS1pdGVtLWhvdmVyKScsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgc2V0dGluZ3M6IHtcclxuICAgICAgICAgICAgaW5wdXQ6IHtcclxuICAgICAgICAgICAgICBiZzogJ3ZhcigtLXRoZW1lLXNldHRpbmdzLWlucHV0LWJnKScsXHJcbiAgICAgICAgICAgICAgYWN0aXZlOiAndmFyKC0tdGhlbWUtc2V0dGluZ3MtaW5wdXQtYWN0aXZlKScsXHJcbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI6ICd2YXIoLS10aGVtZS1zZXR0aW5ncy1pbnB1dC1wbGFjZWhvbGRlciknLFxyXG4gICAgICAgICAgICAgIHRleHQ6ICd2YXIoLS10aGVtZS1zZXR0aW5ncy1pbnB1dC10ZXh0KScsXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBtb2RhbDoge1xyXG4gICAgICAgICAgICBib3JkZXI6ICd2YXIoLS10aGVtZS1tb2RhbC1ib3JkZXIpJyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBcImZpbGUtcGlja2VyXCI6IHtcclxuICAgICAgICAgICAgaG92ZXI6ICd2YXIoLS10aGVtZS1maWxlLXBpY2tlci1ob3ZlciknLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGF0dGFjaG1lbnQ6IHtcclxuICAgICAgICAgICAgYmc6ICd2YXIoLS10aGVtZS1hdHRhY2htZW50LWJnKScsXHJcbiAgICAgICAgICAgICdlcnJvci1iZyc6ICd2YXIoLS10aGVtZS1hdHRhY2htZW50LWVycm9yLWJnKScsXHJcbiAgICAgICAgICAgICdzdWNjZXNzLWJnJzogJ3ZhcigtLXRoZW1lLWF0dGFjaG1lbnQtc3VjY2Vzcy1iZyknLFxyXG4gICAgICAgICAgICB0ZXh0OiAndmFyKC0tdGhlbWUtYXR0YWNobWVudC10ZXh0KScsXHJcbiAgICAgICAgICAgICd0ZXh0LXNlY29uZGFyeSc6ICd2YXIoLS10aGVtZS1hdHRhY2htZW50LXRleHQtc2Vjb25kYXJ5KScsXHJcbiAgICAgICAgICAgICdpY29uJzogJ3ZhcigtLXRoZW1lLWF0dGFjaG1lbnQtaWNvbiknLFxyXG4gICAgICAgICAgICAnaWNvbi1zcGlubmVyJzogJ3ZhcigtLXRoZW1lLWF0dGFjaG1lbnQtaWNvbi1zcGlubmVyKScsXHJcbiAgICAgICAgICAgICdpY29uLXNwaW5uZXItYmcnOiAndmFyKC0tdGhlbWUtYXR0YWNobWVudC1pY29uLXNwaW5uZXItYmcpJyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBob21lOiB7XHJcbiAgICAgICAgICAgIHRleHQ6ICd2YXIoLS10aGVtZS1ob21lLXRleHQpJyxcclxuICAgICAgICAgICAgXCJ0ZXh0LXNlY29uZGFyeVwiOiAndmFyKC0tdGhlbWUtaG9tZS10ZXh0LXNlY29uZGFyeSknLFxyXG4gICAgICAgICAgICBcImJnLWNhcmRcIjogJ3ZhcigtLXRoZW1lLWhvbWUtYmctY2FyZCknLFxyXG4gICAgICAgICAgICBcImJnLWJ1dHRvblwiOiAndmFyKC0tdGhlbWUtaG9tZS1iZy1idXR0b24pJyxcclxuICAgICAgICAgICAgYm9yZGVyOiAndmFyKC0tdGhlbWUtaG9tZS1ib3JkZXIpJyxcclxuICAgICAgICAgICAgXCJidXR0b24tcHJpbWFyeVwiOiAndmFyKC0tdGhlbWUtaG9tZS1idXR0b24tcHJpbWFyeSknLFxyXG4gICAgICAgICAgICBcImJ1dHRvbi1wcmltYXJ5LWhvdmVyXCI6ICd2YXIoLS10aGVtZS1ob21lLWJ1dHRvbi1wcmltYXJ5LWhvdmVyKScsXHJcbiAgICAgICAgICAgIFwiYnV0dG9uLXNlY29uZGFyeVwiOiAndmFyKC0tdGhlbWUtaG9tZS1idXR0b24tc2Vjb25kYXJ5KScsXHJcbiAgICAgICAgICAgIFwiYnV0dG9uLXNlY29uZGFyeS1ob3ZlclwiOiAndmFyKC0tdGhlbWUtaG9tZS1idXR0b24tc2Vjb25kYXJ5LWhvdmVyKScsXHJcbiAgICAgICAgICAgIFwiYnV0dG9uLXNlY29uZGFyeS10ZXh0XCI6ICd2YXIoLS10aGVtZS1ob21lLWJ1dHRvbi1zZWNvbmRhcnktdGV4dCknLFxyXG4gICAgICAgICAgICBcImJ1dHRvbi1zZWNvbmRhcnktaG92ZXItdGV4dFwiOiAndmFyKC0tdGhlbWUtaG9tZS1idXR0b24tc2Vjb25kYXJ5LWhvdmVyLXRleHQpJyxcclxuICAgICAgICAgICAgXCJidXR0b24tc2Vjb25kYXJ5LWJvcmRlclwiOiAndmFyKC0tdGhlbWUtaG9tZS1idXR0b24tc2Vjb25kYXJ5LWJvcmRlciknLFxyXG4gICAgICAgICAgICBcImJ1dHRvbi1zZWNvbmRhcnktYm9yZGVyLWhvdmVyXCI6ICd2YXIoLS10aGVtZS1ob21lLWJ1dHRvbi1zZWNvbmRhcnktYm9yZGVyLWhvdmVyKScsXHJcbiAgICAgICAgICAgIFwidXBkYXRlLWNhcmQtYmdcIjogJ3ZhcigtLXRoZW1lLWhvbWUtdXBkYXRlLWNhcmQtYmcpJyxcclxuICAgICAgICAgICAgXCJ1cGRhdGUtY2FyZC1ob3ZlclwiOiAndmFyKC0tdGhlbWUtaG9tZS11cGRhdGUtY2FyZC1ob3ZlciknLFxyXG4gICAgICAgICAgICBcInVwZGF0ZS1zb3VyY2VcIjogJ3ZhcigtLXRoZW1lLWhvbWUtdXBkYXRlLXNvdXJjZSknLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGNoZWNrbGlzdDoge1xyXG4gICAgICAgICAgICBcIml0ZW0tYmdcIjogJ3ZhcigtLXRoZW1lLWNoZWNrbGlzdC1pdGVtLWJnKScsXHJcbiAgICAgICAgICAgIFwiaXRlbS1iZy1ob3ZlclwiOiAndmFyKC0tdGhlbWUtY2hlY2tsaXN0LWl0ZW0tYmctaG92ZXIpJyxcclxuICAgICAgICAgICAgXCJpdGVtLXRleHRcIjogJ3ZhcigtLXRoZW1lLWNoZWNrbGlzdC1pdGVtLXRleHQpJyxcclxuICAgICAgICAgICAgXCJpdGVtLWNvbXBsZXRlZC1iZ1wiOiAndmFyKC0tdGhlbWUtY2hlY2tsaXN0LWl0ZW0tY29tcGxldGVkLWJnKScsXHJcbiAgICAgICAgICAgIFwiaXRlbS1jb21wbGV0ZWQtdGV4dFwiOiAndmFyKC0tdGhlbWUtY2hlY2tsaXN0LWl0ZW0tY29tcGxldGVkLXRleHQpJyxcclxuICAgICAgICAgICAgXCJpdGVtLWhvdmVyXCI6ICd2YXIoLS10aGVtZS1jaGVja2xpc3QtaXRlbS1ob3ZlciknLFxyXG4gICAgICAgICAgICBcImNoZWNrYm94LWJvcmRlclwiOiAndmFyKC0tdGhlbWUtY2hlY2tsaXN0LWNoZWNrYm94LWJvcmRlciknLFxyXG4gICAgICAgICAgICBcImNoZWNrYm94LWZpbGxcIjogJ3ZhcigtLXRoZW1lLWNoZWNrbGlzdC1jaGVja2JveC1maWxsKScsXHJcbiAgICAgICAgICAgIFwiY2hlY2tib3gtdGV4dFwiOiAndmFyKC0tdGhlbWUtY2hlY2tsaXN0LWNoZWNrYm94LXRleHQpJyxcclxuICAgICAgICAgICAgXCJidXR0b24tYm9yZGVyXCI6ICd2YXIoLS10aGVtZS1jaGVja2xpc3QtYnV0dG9uLWJvcmRlciknLFxyXG4gICAgICAgICAgICBcImJ1dHRvbi10ZXh0XCI6ICd2YXIoLS10aGVtZS1jaGVja2xpc3QtYnV0dG9uLXRleHQpJyxcclxuICAgICAgICAgICAgXCJidXR0b24taG92ZXItYmdcIjogJ3ZhcigtLXRoZW1lLWNoZWNrbGlzdC1idXR0b24taG92ZXItYmcpJyxcclxuICAgICAgICAgICAgXCJidXR0b24taG92ZXItYm9yZGVyXCI6ICd2YXIoLS10aGVtZS1jaGVja2xpc3QtYnV0dG9uLWhvdmVyLWJvcmRlciknLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGJ1dHRvbjoge1xyXG4gICAgICAgICAgICB0ZXh0OiAndmFyKC0tdGhlbWUtYnV0dG9uLXRleHQpJyxcclxuICAgICAgICAgICAgJ2NvZGUtaG92ZXItdGV4dCc6ICd2YXIoLS10aGVtZS1idXR0b24tY29kZS1ob3Zlci10ZXh0KScsXHJcbiAgICAgICAgICAgICdjb2RlLWhvdmVyLWJnJzogJ3ZhcigtLXRoZW1lLWJ1dHRvbi1jb2RlLWhvdmVyLWJnKScsXHJcbiAgICAgICAgICAgICdkaXNhYmxlLWhvdmVyLXRleHQnOiAndmFyKC0tdGhlbWUtYnV0dG9uLWRpc2FibGUtaG92ZXItdGV4dCknLFxyXG4gICAgICAgICAgICAnZGlzYWJsZS1ob3Zlci1iZyc6ICd2YXIoLS10aGVtZS1idXR0b24tZGlzYWJsZS1ob3Zlci1iZyknLFxyXG4gICAgICAgICAgICAnZGVsZXRlLWhvdmVyLXRleHQnOiAndmFyKC0tdGhlbWUtYnV0dG9uLWRlbGV0ZS1ob3Zlci10ZXh0KScsXHJcbiAgICAgICAgICAgICdkZWxldGUtaG92ZXItYmcnOiAndmFyKC0tdGhlbWUtYnV0dG9uLWRlbGV0ZS1ob3Zlci1iZyknLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICBiYWNrZ3JvdW5kSW1hZ2U6IHtcclxuICAgICAgICBcInByZWZlcmVuY2UtZ3JhZGllbnRcIjpcclxuICAgICAgICAgIFwibGluZWFyLWdyYWRpZW50KDE4MGRlZywgIzVBNUM2MyAwJSwgcmdiYSg5MCwgOTIsIDk5LCAwLjI4KSAxMDAlKTtcIixcclxuICAgICAgICBcImNoYXQtbXNnLXVzZXItZ3JhZGllbnRcIjpcclxuICAgICAgICAgIFwibGluZWFyLWdyYWRpZW50KDE4MGRlZywgIzNENDE0NyAwJSwgIzJDMkYzNSAxMDAlKTtcIixcclxuICAgICAgICBcInNlbGVjdGVkLXByZWZlcmVuY2UtZ3JhZGllbnRcIjpcclxuICAgICAgICAgIFwibGluZWFyLWdyYWRpZW50KDE4MGRlZywgIzMxMzIzNiAwJSwgcmdiYSg2My40MCwgNjQuOTAsIDcwLjEzLCAwKSAxMDAlKTtcIixcclxuICAgICAgICBcIm1haW4tZ3JhZGllbnRcIjogXCJsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCAjM0Q0MTQ3IDAlLCAjMkMyRjM1IDEwMCUpXCIsXHJcbiAgICAgICAgXCJtb2RhbC1ncmFkaWVudFwiOiBcImxpbmVhci1ncmFkaWVudCgxODBkZWcsICMzRDQxNDcgMCUsICMyQzJGMzUgMTAwJSlcIixcclxuICAgICAgICBcInNpZGViYXItZ3JhZGllbnRcIjogXCJsaW5lYXItZ3JhZGllbnQoOTBkZWcsICM1QjYxNkEgMCUsICMzRjQzNEIgMTAwJSlcIixcclxuICAgICAgICBcImxvZ2luLWdyYWRpZW50XCI6IFwibGluZWFyLWdyYWRpZW50KDE4MGRlZywgIzNENDE0NyAwJSwgIzJDMkYzNSAxMDAlKVwiLFxyXG4gICAgICAgIFwibWVudS1pdGVtLWdyYWRpZW50XCI6XHJcbiAgICAgICAgICBcImxpbmVhci1ncmFkaWVudCg5MGRlZywgIzNENDE0NyAwJSwgIzJDMkYzNSAxMDAlKVwiLFxyXG4gICAgICAgIFwibWVudS1pdGVtLXNlbGVjdGVkLWdyYWRpZW50XCI6XHJcbiAgICAgICAgICBcImxpbmVhci1ncmFkaWVudCg5MGRlZywgIzVCNjE2QSAwJSwgIzNGNDM0QiAxMDAlKVwiLFxyXG4gICAgICAgIFwid29ya3NwYWNlLWl0ZW0tZ3JhZGllbnRcIjpcclxuICAgICAgICAgIFwibGluZWFyLWdyYWRpZW50KDkwZGVnLCAjM0Q0MTQ3IDAlLCAjMkMyRjM1IDEwMCUpXCIsXHJcbiAgICAgICAgXCJ3b3Jrc3BhY2UtaXRlbS1zZWxlY3RlZC1ncmFkaWVudFwiOlxyXG4gICAgICAgICAgXCJsaW5lYXItZ3JhZGllbnQoOTBkZWcsICM1QjYxNkEgMCUsICMzRjQzNEIgMTAwJSlcIixcclxuICAgICAgICBcInN3aXRjaC1zZWxlY3RlZFwiOiBcImxpbmVhci1ncmFkaWVudCgxNDZkZWcsICM1QjYxNkEgMCUsICMzRjQzNEIgMTAwJSlcIlxyXG4gICAgICB9LFxyXG4gICAgICBmb250RmFtaWx5OiB7XHJcbiAgICAgICAgc2FuczogW1xyXG4gICAgICAgICAgXCJwbHVzLWpha2FydGEtc2Fuc1wiLFxyXG4gICAgICAgICAgXCJ1aS1zYW5zLXNlcmlmXCIsXHJcbiAgICAgICAgICBcInN5c3RlbS11aVwiLFxyXG4gICAgICAgICAgXCItYXBwbGUtc3lzdGVtXCIsXHJcbiAgICAgICAgICBcIkJsaW5rTWFjU3lzdGVtRm9udFwiLFxyXG4gICAgICAgICAgJ1wiU2Vnb2UgVUlcIicsXHJcbiAgICAgICAgICBcIlJvYm90b1wiLFxyXG4gICAgICAgICAgJ1wiSGVsdmV0aWNhIE5ldWVcIicsXHJcbiAgICAgICAgICBcIkFyaWFsXCIsXHJcbiAgICAgICAgICAnXCJOb3RvIFNhbnNcIicsXHJcbiAgICAgICAgICBcInNhbnMtc2VyaWZcIixcclxuICAgICAgICAgICdcIkFwcGxlIENvbG9yIEVtb2ppXCInLFxyXG4gICAgICAgICAgJ1wiU2Vnb2UgVUkgRW1vamlcIicsXHJcbiAgICAgICAgICAnXCJTZWdvZSBVSSBTeW1ib2xcIicsXHJcbiAgICAgICAgICAnXCJOb3RvIENvbG9yIEVtb2ppXCInXHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICBhbmltYXRpb246IHtcclxuICAgICAgICBzd2VlcDogXCJzd2VlcCAwLjVzIGVhc2UtaW4tb3V0XCIsXHJcbiAgICAgICAgXCJwdWxzZS1nbG93XCI6IFwicHVsc2UtZ2xvdyAxLjVzIGluZmluaXRlXCIsXHJcbiAgICAgICAgJ2ZhZGUtaW4nOiAnZmFkZS1pbiAwLjNzIGVhc2Utb3V0JyxcclxuICAgICAgICAnc2xpZGUtdXAnOiAnc2xpZGUtdXAgMC40cyBlYXNlLW91dCBmb3J3YXJkcycsXHJcbiAgICAgICAgJ2JvdW5jZS1zdWJ0bGUnOiAnYm91bmNlLXN1YnRsZSAycyBlYXNlLWluLW91dCBpbmZpbml0ZSdcclxuICAgICAgfSxcclxuICAgICAga2V5ZnJhbWVzOiB7XHJcbiAgICAgICAgc3dlZXA6IHtcclxuICAgICAgICAgIFwiMCVcIjogeyB0cmFuc2Zvcm06IFwic2NhbGVYKDApXCIsIHRyYW5zZm9ybU9yaWdpbjogXCJib3R0b20gbGVmdFwiIH0sXHJcbiAgICAgICAgICBcIjEwMCVcIjogeyB0cmFuc2Zvcm06IFwic2NhbGVYKDEpXCIsIHRyYW5zZm9ybU9yaWdpbjogXCJib3R0b20gbGVmdFwiIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGZhZGVJbjoge1xyXG4gICAgICAgICAgXCIwJVwiOiB7IG9wYWNpdHk6IDAgfSxcclxuICAgICAgICAgIFwiMTAwJVwiOiB7IG9wYWNpdHk6IDEgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZmFkZU91dDoge1xyXG4gICAgICAgICAgXCIwJVwiOiB7IG9wYWNpdHk6IDEgfSxcclxuICAgICAgICAgIFwiMTAwJVwiOiB7IG9wYWNpdHk6IDAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCJwdWxzZS1nbG93XCI6IHtcclxuICAgICAgICAgIFwiMCVcIjoge1xyXG4gICAgICAgICAgICBvcGFjaXR5OiAxLFxyXG4gICAgICAgICAgICB0cmFuc2Zvcm06IFwic2NhbGUoMSlcIixcclxuICAgICAgICAgICAgYm94U2hhZG93OiBcIjAgMCAwIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wKVwiLFxyXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwicmdiYSgyNTUsIDI1NSwgMjU1LCAwLjApXCJcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBcIjUwJVwiOiB7XHJcbiAgICAgICAgICAgIG9wYWNpdHk6IDEsXHJcbiAgICAgICAgICAgIHRyYW5zZm9ybTogXCJzY2FsZSgxLjEpXCIsXHJcbiAgICAgICAgICAgIGJveFNoYWRvdzogXCIwIDAgMTVweCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMilcIixcclxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcInJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKVwiXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgXCIxMDAlXCI6IHtcclxuICAgICAgICAgICAgb3BhY2l0eTogMSxcclxuICAgICAgICAgICAgdHJhbnNmb3JtOiBcInNjYWxlKDEpXCIsXHJcbiAgICAgICAgICAgIGJveFNoYWRvdzogXCIwIDAgMCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMClcIixcclxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcInJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wKVwiXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAnZmFkZS1pbic6IHtcclxuICAgICAgICAgICcwJSc6IHsgb3BhY2l0eTogJzAnIH0sXHJcbiAgICAgICAgICAnMTAwJSc6IHsgb3BhY2l0eTogJzEnIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdzbGlkZS11cCc6IHtcclxuICAgICAgICAgICcwJSc6IHsgdHJhbnNmb3JtOiAndHJhbnNsYXRlWSgxMHB4KScsIG9wYWNpdHk6ICcwJyB9LFxyXG4gICAgICAgICAgJzEwMCUnOiB7IHRyYW5zZm9ybTogJ3RyYW5zbGF0ZVkoMCknLCBvcGFjaXR5OiAnMScgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJ2JvdW5jZS1zdWJ0bGUnOiB7XHJcbiAgICAgICAgICAnMCUsIDEwMCUnOiB7IHRyYW5zZm9ybTogJ3RyYW5zbGF0ZVkoMCknIH0sXHJcbiAgICAgICAgICAnNTAlJzogeyB0cmFuc2Zvcm06ICd0cmFuc2xhdGVZKC0ycHgpJyB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICB2YXJpYW50czoge1xyXG4gICAgZXh0ZW5kOiB7XHJcbiAgICAgIGJhY2tncm91bmRDb2xvcjogWydsaWdodCddLFxyXG4gICAgICB0ZXh0Q29sb3I6IFsnbGlnaHQnXSxcclxuICAgIH1cclxuICB9LFxyXG4gIC8vIFJlcXVpcmVkIGZvciByZWNoYXJ0IHN0eWxlcyB0byBzaG93IHNpbmNlIHRoZXkgY2FuIGJlIHJlbmRlcmVkIGR5bmFtaWNhbGx5IGFuZCB3aWxsIGJlIHRyZWUtc2hha2VuIGlmIG5vdCBzYWZlLWxpc3RlZC5cclxuICBzYWZlbGlzdDogW1xyXG4gICAge1xyXG4gICAgICBwYXR0ZXJuOlxyXG4gICAgICAgIC9eKGJnLSg/OnNsYXRlfGdyYXl8emluY3xuZXV0cmFsfHN0b25lfHJlZHxvcmFuZ2V8YW1iZXJ8eWVsbG93fGxpbWV8Z3JlZW58ZW1lcmFsZHx0ZWFsfGN5YW58c2t5fGJsdWV8aW5kaWdvfHZpb2xldHxwdXJwbGV8ZnVjaHNpYXxwaW5rfHJvc2UpLSg/OjUwfDEwMHwyMDB8MzAwfDQwMHw1MDB8NjAwfDcwMHw4MDB8OTAwfDk1MCkpJC8sXHJcbiAgICAgIHZhcmlhbnRzOiBbXCJob3ZlclwiLCBcInVpLXNlbGVjdGVkXCJdXHJcbiAgICB9LFxyXG4gICAge1xyXG4gICAgICBwYXR0ZXJuOlxyXG4gICAgICAgIC9eKHRleHQtKD86c2xhdGV8Z3JheXx6aW5jfG5ldXRyYWx8c3RvbmV8cmVkfG9yYW5nZXxhbWJlcnx5ZWxsb3d8bGltZXxncmVlbnxlbWVyYWxkfHRlYWx8Y3lhbnxza3l8Ymx1ZXxpbmRpZ298dmlvbGV0fHB1cnBsZXxmdWNoc2lhfHBpbmt8cm9zZSktKD86NTB8MTAwfDIwMHwzMDB8NDAwfDUwMHw2MDB8NzAwfDgwMHw5MDB8OTUwKSkkLyxcclxuICAgICAgdmFyaWFudHM6IFtcImhvdmVyXCIsIFwidWktc2VsZWN0ZWRcIl1cclxuICAgIH0sXHJcbiAgICB7XHJcbiAgICAgIHBhdHRlcm46XHJcbiAgICAgICAgL14oYm9yZGVyLSg/OnNsYXRlfGdyYXl8emluY3xuZXV0cmFsfHN0b25lfHJlZHxvcmFuZ2V8YW1iZXJ8eWVsbG93fGxpbWV8Z3JlZW58ZW1lcmFsZHx0ZWFsfGN5YW58c2t5fGJsdWV8aW5kaWdvfHZpb2xldHxwdXJwbGV8ZnVjaHNpYXxwaW5rfHJvc2UpLSg/OjUwfDEwMHwyMDB8MzAwfDQwMHw1MDB8NjAwfDcwMHw4MDB8OTAwfDk1MCkpJC8sXHJcbiAgICAgIHZhcmlhbnRzOiBbXCJob3ZlclwiLCBcInVpLXNlbGVjdGVkXCJdXHJcbiAgICB9LFxyXG4gICAge1xyXG4gICAgICBwYXR0ZXJuOlxyXG4gICAgICAgIC9eKHJpbmctKD86c2xhdGV8Z3JheXx6aW5jfG5ldXRyYWx8c3RvbmV8cmVkfG9yYW5nZXxhbWJlcnx5ZWxsb3d8bGltZXxncmVlbnxlbWVyYWxkfHRlYWx8Y3lhbnxza3l8Ymx1ZXxpbmRpZ298dmlvbGV0fHB1cnBsZXxmdWNoc2lhfHBpbmt8cm9zZSktKD86NTB8MTAwfDIwMHwzMDB8NDAwfDUwMHw2MDB8NzAwfDgwMHw5MDB8OTUwKSkkL1xyXG4gICAgfSxcclxuICAgIHtcclxuICAgICAgcGF0dGVybjpcclxuICAgICAgICAvXihzdHJva2UtKD86c2xhdGV8Z3JheXx6aW5jfG5ldXRyYWx8c3RvbmV8cmVkfG9yYW5nZXxhbWJlcnx5ZWxsb3d8bGltZXxncmVlbnxlbWVyYWxkfHRlYWx8Y3lhbnxza3l8Ymx1ZXxpbmRpZ298dmlvbGV0fHB1cnBsZXxmdWNoc2lhfHBpbmt8cm9zZSktKD86NTB8MTAwfDIwMHwzMDB8NDAwfDUwMHw2MDB8NzAwfDgwMHw5MDB8OTUwKSkkL1xyXG4gICAgfSxcclxuICAgIHtcclxuICAgICAgcGF0dGVybjpcclxuICAgICAgICAvXihmaWxsLSg/OnNsYXRlfGdyYXl8emluY3xuZXV0cmFsfHN0b25lfHJlZHxvcmFuZ2V8YW1iZXJ8eWVsbG93fGxpbWV8Z3JlZW58ZW1lcmFsZHx0ZWFsfGN5YW58c2t5fGJsdWV8aW5kaWdvfHZpb2xldHxwdXJwbGV8ZnVjaHNpYXxwaW5rfHJvc2UpLSg/OjUwfDEwMHwyMDB8MzAwfDQwMHw1MDB8NjAwfDcwMHw4MDB8OTAwfDk1MCkpJC9cclxuICAgIH1cclxuICBdLFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIGZ1bmN0aW9uICh7IGFkZFZhcmlhbnQgfSkge1xyXG4gICAgICBhZGRWYXJpYW50KCdsaWdodCcsICcubGlnaHQgJicpIC8vIEFkZCB0aGUgYGxpZ2h0OmAgdmFyaWFudFxyXG4gICAgICBhZGRWYXJpYW50KCdwd2EnLCAnLnB3YSAmJykgLy8gQWRkIHRoZSBgcHdhOmAgdmFyaWFudFxyXG4gICAgfSxcclxuICBdXHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4TCxTQUFTLG9CQUFvQjtBQUMzTixTQUFTLGVBQWUsV0FBVzs7O0FDRGlLLE9BQU8sY0FBYztBQUN6TixPQUFPLGtCQUFrQjs7O0FDQXpCLElBQU8sMEJBQVE7QUFBQSxFQUNiLFVBQVU7QUFBQSxFQUNWLFNBQVM7QUFBQSxJQUNQLFVBQVU7QUFBQSxJQUNWLE9BQU87QUFBQSxNQUNMO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixRQUFRO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxPQUFPO0FBQUEsTUFDVDtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sYUFBYTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFFBQ1Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1QseUJBQXlCO0FBQUEsUUFDekIsdUJBQXVCO0FBQUEsUUFDdkIsU0FBUztBQUFBLFFBQ1Qsa0JBQWtCO0FBQUEsUUFDbEIsY0FBYztBQUFBLFFBQ2QsV0FBVztBQUFBLFFBQ1gsY0FBYztBQUFBLFFBQ2QscUJBQXFCO0FBQUEsUUFDckIsa0JBQWtCO0FBQUEsUUFDbEIsYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2IsWUFBWTtBQUFBLFFBQ1osV0FBVztBQUFBLFFBQ1gsUUFBUTtBQUFBLFFBQ1IsU0FBUztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsT0FBTztBQUFBLFFBQ1AsTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsTUFB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
