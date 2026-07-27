import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import type { RoomSession } from '@/api/gameApi'
import { RealtimeSync } from '@/app/RealtimeSync'
import { createAppRouter } from '@/app/router'
import { mockApiServer } from '@/mocks/server'
import { FakeRealtimeClient } from '@/realtime/fakeRealtimeClient'
import { useAppStore } from '@/store'

type ApiMethod = 'get' | 'post'
type BrowserApiMode = 'success' | 'failure' | 'unsupported'

export interface AppHarnessOptions {
  initialPath?: string
  realtimeClient?: FakeRealtimeClient
  session?: RoomSession | null
}

export interface MockApiErrorOptions {
  code: string
  message?: string
  method?: ApiMethod
  path: string
  status?: number
}

export interface BrowserApiOptions {
  clipboard?: BrowserApiMode
  share?: BrowserApiMode
}

/**
 * Renders the real route tree with isolated memory history, app state, and a
 * controllable realtime transport. This is the default harness for route and
 * QR-entrance integration tests.
 */
export function renderAppHarness(options: AppHarnessOptions = {}) {
  resetAppTestState()
  if (options.session) useAppStore.getState().setRoomSession(options.session)

  const history = createMemoryHistory({
    initialEntries: [options.initialPath ?? '/'],
  })
  const router = createAppRouter(history)
  const realtimeClient = options.realtimeClient ?? new FakeRealtimeClient()
  const user = userEvent.setup()
  const view = render(
    <RealtimeSync client={realtimeClient}>
      <RouterProvider router={router} />
    </RealtimeSync>,
  )

  return {
    ...view,
    history,
    realtimeClient,
    router,
    user,
  }
}

/**
 * Resets all state that can leak between entrance-flow tests. Storage failures
 * are intentionally ignored because blocked sessionStorage is a supported case.
 */
export function resetAppTestState() {
  safely(() => useAppStore.getState().reset())
  safely(() => window.sessionStorage.clear())
}

/**
 * Overrides one REST endpoint with a typed API error envelope.
 */
export function mockApiError({
  code,
  message = code,
  method = 'post',
  path,
  status = 400,
}: MockApiErrorOptions) {
  const register = method === 'get' ? http.get : http.post
  mockApiServer.use(
    register(path, () =>
      HttpResponse.json(
        {
          code,
          message,
        },
        { status },
      ),
    ),
  )
}

/**
 * Installs deterministic Clipboard and Web Share capabilities. Call restore()
 * in the test that installs them.
 */
export function installBrowserApiMocks(options: BrowserApiOptions = {}) {
  const clipboardMode = options.clipboard ?? 'success'
  const shareMode = options.share ?? 'success'
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share')
  const writeText = vi.fn(async (_text: string) => {
    if (clipboardMode === 'failure') throw new DOMException('Clipboard unavailable')
  })
  const share = vi.fn(async (_data?: ShareData) => {
    if (shareMode === 'failure') throw new DOMException('Share unavailable')
  })

  defineNavigatorApi('clipboard', clipboardMode === 'unsupported' ? undefined : { writeText })
  defineNavigatorApi('share', shareMode === 'unsupported' ? undefined : share)

  return {
    share,
    writeText,
    restore() {
      restoreNavigatorApi('clipboard', clipboardDescriptor)
      restoreNavigatorApi('share', shareDescriptor)
    },
  }
}

export function installBlockedSessionStorage() {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
  const blocked = () => {
    throw new DOMException('Session storage unavailable')
  }
  const storage: Storage = {
    length: 0,
    clear: blocked,
    getItem: blocked,
    key: blocked,
    removeItem: blocked,
    setItem: blocked,
  }

  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: storage,
  })

  return {
    restore() {
      restoreWindowProperty('sessionStorage', descriptor)
    },
  }
}

export function installUserAgentMock(userAgent: string) {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  })

  return {
    restore() {
      if (descriptor) {
        Object.defineProperty(navigator, 'userAgent', descriptor)
        return
      }
      Reflect.deleteProperty(navigator, 'userAgent')
    },
  }
}

export function renderRealtimeHarness(
  children: ReactNode,
  options: Omit<AppHarnessOptions, 'initialPath'> = {},
) {
  resetAppTestState()
  if (options.session) useAppStore.getState().setRoomSession(options.session)
  const realtimeClient = options.realtimeClient ?? new FakeRealtimeClient()

  return {
    ...render(<RealtimeSync client={realtimeClient}>{children}</RealtimeSync>),
    realtimeClient,
  }
}

function safely(action: () => void) {
  try {
    action()
  } catch {
    // Storage access is allowed to fail without breaking the current tab.
  }
}

function defineNavigatorApi(name: 'clipboard' | 'share', value: unknown) {
  if (value === undefined) {
    Reflect.deleteProperty(navigator, name)
    return
  }

  Object.defineProperty(navigator, name, {
    configurable: true,
    value,
  })
}

function restoreNavigatorApi(name: 'clipboard' | 'share', descriptor?: PropertyDescriptor) {
  if (descriptor) {
    Object.defineProperty(navigator, name, descriptor)
    return
  }
  Reflect.deleteProperty(navigator, name)
}

function restoreWindowProperty(name: 'sessionStorage', descriptor?: PropertyDescriptor) {
  if (descriptor) {
    Object.defineProperty(window, name, descriptor)
    return
  }
  Reflect.deleteProperty(window, name)
}
