import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { normalizeRoomCode } from '@/roomCode'
import { EntryPage } from '@/screens/EntryPage'
import { LobbyPage } from '@/screens/LobbyPage'
import { NicknamePage } from '@/screens/NicknamePage'
import { DevCatalog } from './DevCatalog'
>>>>>>> 96e7252d9d23d7d509ed4819e8180e49c884c7c8

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <main>페이지를 찾을 수 없습니다.</main>,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: EntryPage,
})

<<<<<<< HEAD
const routeTree = rootRoute.addChildren([indexRoute])
=======
const devCatalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/__dev/components',
  component: DevCatalog,
})

const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/join',
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? normalizeRoomCode(search.code) : undefined,
  }),
  component: () => {
    const { code } = joinRoute.useSearch()
    return <NicknamePage roomCode={code} />
  },
})

const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rooms/$roomId/lobby',
  component: LobbyPage,
})

const routeTree = rootRoute.addChildren([indexRoute, joinRoute, lobbyRoute, devCatalogRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
