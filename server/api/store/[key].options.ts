export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-sentry-auth',
    'access-control-max-age': 86400
  })
  setResponseStatus(event, 204)
  return null
})
