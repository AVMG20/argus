export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      secondary: 'blue',
      neutral: 'zinc'
    }
  },
  // Point these at your own fork; they are the only outbound links in the UI.
  links: {
    github: 'https://github.com/AVMG20/argus',
    license: 'https://github.com/AVMG20/argus/blob/main/LICENSE',
    sentrySdks: 'https://docs.sentry.io/platforms/'
  }
})
