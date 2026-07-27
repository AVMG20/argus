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
    github: 'https://github.com/argus-monitoring/argus',
    license: 'https://github.com/argus-monitoring/argus/blob/main/LICENSE',
    sentrySdks: 'https://docs.sentry.io/platforms/'
  }
})
