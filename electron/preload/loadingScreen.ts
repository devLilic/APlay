export type LoadingScreenTimeoutHandle = ReturnType<typeof globalThis.setTimeout>

interface LoadingScreenParent {
  appendChild: (child: HTMLElement) => HTMLElement
  removeChild: (child: HTMLElement) => HTMLElement
  children: ArrayLike<{ id?: string }>
}

export interface LoadingScreenDocument {
  readyState: DocumentReadyState
  head: LoadingScreenParent
  body: LoadingScreenParent
  addEventListener: (type: 'readystatechange', listener: () => void) => void
  removeEventListener: (type: 'readystatechange', listener: () => void) => void
  createElement: (tagName: string) => HTMLElement
  getElementById: (id: string) => HTMLElement | null
}

export interface LoadingScreenWindow {
  addEventListener: (type: 'message', listener: (event: { data?: { payload?: unknown } }) => void) => void
  removeEventListener: (type: 'message', listener: (event: { data?: { payload?: unknown } }) => void) => void
}

interface LoadingScreenSetupDependencies {
  document: LoadingScreenDocument
  window: LoadingScreenWindow
  setTimeout: (callback: () => void, delay: number) => LoadingScreenTimeoutHandle
  clearTimeout?: (handle: LoadingScreenTimeoutHandle) => void
  timeoutMs?: number
}

const loadingStyleId = 'app-loading-style'
const loadingContainerId = 'app-loading-wrap'
const loadingClassName = 'loaders-css__square-spin'
const loadingStyleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${loadingClassName} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
`

export function domReady(
  document: Pick<LoadingScreenDocument, 'readyState' | 'addEventListener' | 'removeEventListener'>,
  condition: DocumentReadyState[] = ['complete', 'interactive'],
): Promise<void> {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve()
      return
    }

    const handleReadyStateChange = () => {
      if (!condition.includes(document.readyState)) {
        return
      }

      document.removeEventListener('readystatechange', handleReadyStateChange)
      resolve()
    }

    document.addEventListener('readystatechange', handleReadyStateChange)
  })
}

export function createLoadingScreenController(document: LoadingScreenDocument) {
  const ensureStyleElement = () => {
    const existing = document.getElementById(loadingStyleId)
    if (existing) {
      return existing
    }

    const styleElement = document.createElement('style')
    styleElement.id = loadingStyleId
    styleElement.innerHTML = loadingStyleContent
    return styleElement
  }

  const ensureContainerElement = () => {
    const existing = document.getElementById(loadingContainerId)
    if (existing) {
      return existing
    }

    const container = document.createElement('div')
    container.id = loadingContainerId
    container.className = 'app-loading-wrap'
    container.innerHTML = `<div class="${loadingClassName}"><div></div></div>`
    return container
  }

  return {
    appendLoading() {
      const styleElement = ensureStyleElement()
      const container = ensureContainerElement()

      if (!Array.from(document.head.children).includes(styleElement)) {
        document.head.appendChild(styleElement)
      }

      if (!Array.from(document.body.children).includes(container)) {
        document.body.appendChild(container)
      }
    },
    removeLoading() {
      const styleElement = document.getElementById(loadingStyleId)
      const container = document.getElementById(loadingContainerId)

      if (styleElement && Array.from(document.head.children).includes(styleElement)) {
        document.head.removeChild(styleElement)
      }

      if (container && Array.from(document.body.children).includes(container)) {
        document.body.removeChild(container)
      }
    },
  }
}

export function setupLoadingScreen({
  document,
  window,
  setTimeout,
  clearTimeout,
  timeoutMs = 4999,
}: LoadingScreenSetupDependencies) {
  const controller = createLoadingScreenController(document)
  let disposed = false
  let timeoutHandle: LoadingScreenTimeoutHandle

  const handleMessage = (event: { data?: { payload?: unknown } }) => {
    if (event.data?.payload !== 'removeLoading') {
      return
    }

    controller.removeLoading()
    cleanupListener()
    if (clearTimeout) {
      clearTimeout(timeoutHandle)
    }
  }

  const cleanupListener = () => {
    window.removeEventListener('message', handleMessage)
  }

  window.addEventListener('message', handleMessage)

  void domReady(document).then(() => {
    if (!disposed) {
      controller.appendLoading()
    }
  })

  timeoutHandle = setTimeout(() => {
    controller.removeLoading()
    cleanupListener()
  }, timeoutMs)

  return () => {
    disposed = true
    controller.removeLoading()
    cleanupListener()
    if (clearTimeout) {
      clearTimeout(timeoutHandle)
    }
  }
}
