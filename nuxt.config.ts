// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // Argus is a dark-first tool; the mode toggle still overrides this per device.
  colorMode: {
    preference: 'dark'
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    preset: 'bun'
  },

  vite: {
    optimizeDeps: {
      include: [
        'better-auth/client/plugins',
        'better-auth/vue'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
