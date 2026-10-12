import { test as base, expect } from '@playwright/test'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
const INLINE_PROTOCOLS = new Set(['data:', 'blob:'])
const FILE_PROTOCOL = 'file:'

// The page may only talk to the local server. A file:// page may only load its own
// document (plus inline data:/blob: URIs); the build must be self-contained.
export const isAllowedRequest = ({ url, isMainDocument }) => {
  const { protocol, hostname } = new URL(url)
  if (INLINE_PROTOCOLS.has(protocol)) return true
  if (protocol === FILE_PROTOCOL) return isMainDocument
  return LOCAL_HOSTS.has(hostname)
}

export const test = base.extend({
  requestGuard: [
    async ({ page }, use) => {
      const disallowedUrls = []
      page.on('request', (request) => {
        const isMainDocument = request.isNavigationRequest() && !request.frame().parentFrame()
        if (!isAllowedRequest({ url: request.url(), isMainDocument })) {
          disallowedUrls.push(request.url())
        }
      })
      await use()
      expect(disallowedUrls, 'requests to disallowed destinations').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
