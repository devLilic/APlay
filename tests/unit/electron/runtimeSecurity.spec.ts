import { afterEach, describe, expect, it, vi } from 'vitest'

const openExternalMock = vi.fn()

vi.mock('electron', () => ({
  shell: {
    openExternal: openExternalMock,
  },
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  delete process.env.VITE_DEV_SERVER_URL
})

async function loadRuntimeSecurity(options?: {
  devServerUrl?: string
}) {
  if (options?.devServerUrl) {
    process.env.VITE_DEV_SERVER_URL = options.devServerUrl
  } else {
    delete process.env.VITE_DEV_SERVER_URL
  }

  return await import('../../../electron/main/security/runtimeSecurity')
}

describe('runtime security external URL policy', () => {
  it('denies external URLs when no allowed host is configured', async () => {
    const runtimeSecurity = await loadRuntimeSecurity()

    runtimeSecurity.setAllowedExternalHosts([])

    expect(runtimeSecurity.isAllowedExternalUrl('https://example.com/path')).toBe(false)
    await expect(runtimeSecurity.openExternalUrl('https://example.com/path')).resolves.toBe(false)
    expect(openExternalMock).not.toHaveBeenCalled()
  })

  it('allows only explicitly configured https hosts to be opened externally', async () => {
    const runtimeSecurity = await loadRuntimeSecurity()

    runtimeSecurity.setAllowedExternalHosts(['example.com'])

    expect(runtimeSecurity.isAllowedExternalUrl('https://example.com/news')).toBe(true)
    expect(runtimeSecurity.isAllowedExternalUrl('https://sub.example.com/news')).toBe(false)
    expect(runtimeSecurity.isAllowedExternalUrl('http://example.com/news')).toBe(false)

    openExternalMock.mockResolvedValueOnce(undefined)

    await runtimeSecurity.openExternalUrl('https://example.com/news')

    expect(openExternalMock).toHaveBeenCalledWith('https://example.com/news')
    expect(openExternalMock).toHaveBeenCalledTimes(1)
  })
})

describe('runtime security in-app navigation policy', () => {
  it('allows only the dev server URL and about:blank for in-app navigation', async () => {
    const runtimeSecurity = await loadRuntimeSecurity({
      devServerUrl: 'http://127.0.0.1:7777/',
    })

    expect(runtimeSecurity.isAllowedInAppNavigation('http://127.0.0.1:7777/')).toBe(true)
    expect(runtimeSecurity.isAllowedInAppNavigation('http://127.0.0.1:7777/settings')).toBe(true)
    expect(runtimeSecurity.isAllowedInAppNavigation('about:blank')).toBe(true)
    expect(runtimeSecurity.isAllowedInAppNavigation('https://example.com')).toBe(false)
    expect(runtimeSecurity.isAllowedInAppNavigation('file:///tmp/index.html')).toBe(false)
  })
})
