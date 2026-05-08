import { describe, expect, it, vi } from 'vitest'
import {
  createLoadingScreenController,
  domReady,
  setupLoadingScreen,
  type LoadingScreenDocument,
  type LoadingScreenTimeoutHandle,
  type LoadingScreenWindow,
} from '../../../electron/preload/loadingScreen'

class MockElement {
  id = ''
  className = ''
  innerHTML = ''
  parent: MockParent | null = null
}

class MockParent {
  children: MockElement[] = []

  appendChild(child: HTMLElement) {
    const nextChild = child as unknown as MockElement
    nextChild.parent = this
    this.children.push(nextChild)
    return child
  }

  removeChild(child: HTMLElement) {
    const nextChild = child as unknown as MockElement
    this.children = this.children.filter((item) => item !== nextChild)
    nextChild.parent = null
    return child
  }
}

function getDocumentElementIds(document: ReturnType<typeof createMockDocument>) {
  return {
    headIds: document.head.children.map((element) => element.id),
    bodyIds: document.body.children.map((element) => element.id),
  }
}

function createMockDocument(
  readyState: DocumentReadyState = 'loading',
) {
  const listeners = new Map<string, Set<() => void>>()
  const head = new MockParent()
  const body = new MockParent()

  const document: LoadingScreenDocument & { setReadyState: (nextState: DocumentReadyState) => void; head: MockParent; body: MockParent } = {
    readyState,
    head,
    body,
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? new Set()
      current.add(listener)
      listeners.set(type, current)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    createElement() {
      return new MockElement() as unknown as HTMLElement
    },
    getElementById(id) {
      return [...head.children, ...body.children].find((element) => element.id === id) as unknown as HTMLElement | null ?? null
    },
    setReadyState(nextState) {
      document.readyState = nextState
      listeners.get('readystatechange')?.forEach((listener) => listener())
    },
  }

  return document
}

function createMockWindow() {
  const listeners = new Set<(event: { data?: { payload?: unknown } }) => void>()

  const mockWindow: LoadingScreenWindow & {
    emitMessage: (payload?: unknown) => void
    listenerCount: () => number
  } = {
    addEventListener(_type, listener) {
      listeners.add(listener)
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener)
    },
    emitMessage(payload) {
      listeners.forEach((listener) => listener({ data: { payload } }))
    },
    listenerCount() {
      return listeners.size
    },
  }

  return mockWindow
}

describe('loadingScreen helper', () => {
  it('waits for interactive or complete readyState and removes the listener after resolving', async () => {
    const document = createMockDocument('loading')
    const readyPromise = domReady(document)

    document.setReadyState('interactive')

    await expect(readyPromise).resolves.toBeUndefined()
  })

  it('does not duplicate loading DOM when append is called multiple times', () => {
    const document = createMockDocument('complete')
    const controller = createLoadingScreenController(document)

    controller.appendLoading()
    controller.appendLoading()

    const { headIds, bodyIds } = getDocumentElementIds(document)

    expect(headIds).toEqual(['app-loading-style'])
    expect(bodyIds).toEqual(['app-loading-wrap'])
  })

  it('removes the loading DOM on removeLoading and on removeLoading message without overwriting global handlers', async () => {
    const document = createMockDocument('complete')
    const window = createMockWindow()
    const clearTimeout = vi.fn()
    let timeoutCallback: (() => void) | undefined

    const dispose = setupLoadingScreen({
      document,
      window,
      setTimeout(callback) {
        timeoutCallback = callback
        return 1 as unknown as LoadingScreenTimeoutHandle
      },
      clearTimeout,
    })

    await Promise.resolve()

    expect(document.body.children).toHaveLength(1)
    expect(window.listenerCount()).toBe(1)

    window.emitMessage('removeLoading')

    expect(document.head.children).toHaveLength(0)
    expect(document.body.children).toHaveLength(0)
    expect(window.listenerCount()).toBe(0)
    expect(clearTimeout).toHaveBeenCalledWith(1)

    dispose()
    timeoutCallback?.()
  })

  it('keeps the fallback timeout behavior', async () => {
    const document = createMockDocument('complete')
    const window = createMockWindow()
    let timeoutCallback: (() => void) | undefined

    setupLoadingScreen({
      document,
      window,
      setTimeout(callback) {
        timeoutCallback = callback
        return 1 as unknown as LoadingScreenTimeoutHandle
      },
    })

    await Promise.resolve()
    expect(document.body.children).toHaveLength(1)

    timeoutCallback?.()

    expect(document.head.children).toHaveLength(0)
    expect(document.body.children).toHaveLength(0)
    expect(window.listenerCount()).toBe(0)
  })
})
