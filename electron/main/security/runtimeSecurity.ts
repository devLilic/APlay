import { shell, type BrowserWindow } from 'electron'
import { URL } from 'node:url'
import { VITE_DEV_SERVER_URL } from '../bootstrap/paths'

const allowedExternalProtocols = new Set(['https:'])
const allowedExternalHosts = new Set<string>()

export function setAllowedExternalHosts(hosts: Iterable<string>) {
  allowedExternalHosts.clear()

  for (const host of hosts) {
    const normalizedHost = host.trim().toLowerCase()
    if (normalizedHost.length > 0) {
      allowedExternalHosts.add(normalizedHost)
    }
  }
}

export function applyRuntimeSecurityPolicies(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void openExternalUrl(url)
    }

    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isAllowedInAppNavigation(url)) {
      return
    }

    event.preventDefault()

    if (isAllowedExternalUrl(url)) {
      void openExternalUrl(url)
    }
  })
}

export function isAllowedExternalUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    return allowedExternalProtocols.has(parsedUrl.protocol) && isAllowedHost(parsedUrl.hostname)
  } catch {
    return false
  }
}

export function isAllowedInAppNavigation(url: string) {
  if (VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL)) {
    return true
  }

  return url === 'about:blank'
}

export function isAllowedHost(hostname: string) {
  return allowedExternalHosts.size > 0 && allowedExternalHosts.has(hostname.toLowerCase())
}

export async function openExternalUrl(url: string) {
  if (!isAllowedExternalUrl(url)) {
    return false
  }

  return shell.openExternal(url)
}
