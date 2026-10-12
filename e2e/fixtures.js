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

// A popup's first navigation has no frame yet (request.frame() throws); treat it as not the
// document under test, so only the host check can allow it.
const isMainDocumentRequest = (request) => {
  if (!request.isNavigationRequest()) return false
  try {
    return !request.frame().parentFrame()
  } catch {
    return false
  }
}

// Guards every page in the context (popups included) and every WebSocket they open.
export const test = base.extend({
  requestGuard: [
    async ({ context }, use) => {
      const disallowedUrls = []
      const record = (url, isMainDocument) => {
        if (!isAllowedRequest({ url, isMainDocument })) disallowedUrls.push(url)
      }
      const watchSockets = (watchedPage) =>
        watchedPage.on('websocket', (socket) => record(socket.url(), false))

      context.on('request', (request) => record(request.url(), isMainDocumentRequest(request)))
      context.pages().forEach(watchSockets)
      context.on('page', watchSockets)
      await use()
      expect(disallowedUrls, 'requests to disallowed destinations').toEqual([])
    },
    { auto: true },
  ],
})

export const SIMULATOR_TITLE = 'AI vs. Human Code Review Simulator'

const FIXED_START_MS = Date.parse('2026-01-05T09:00:00Z')
const CLOCK_PAUSE_OFFSET_MS = 60_000

// Opens the page under a fake clock that then stops: time only moves through page.clock.runFor.
export const openSimulator = async (page, url = '/') => {
  await page.clock.install({ time: FIXED_START_MS })
  await page.goto(url)
  await expect(page.getByRole('heading', { name: SIMULATOR_TITLE })).toBeVisible()
  await page.clock.pauseAt(FIXED_START_MS + CLOCK_PAUSE_OFFSET_MS)
}

export { expect }
