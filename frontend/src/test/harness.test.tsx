import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { gameApiClient } from '@/api/gameApi'
import { creatorSession } from '@/mocks/fixtures'
import { FakeRealtimeClient } from '@/realtime/fakeRealtimeClient'
import {
  installBlockedSessionStorage,
  installBrowserApiMocks,
  installUserAgentMock,
  mockApiError,
  renderAppHarness,
  resetAppTestState,
} from './harness'

describe('QR entrance test harness', () => {
  afterEach(() => resetAppTestState())

  it('enters the real join route with normalized search parameters', async () => {
    renderAppHarness({ initialPath: '/join?code=yorr64' })

    expect(await screen.findByText('초대 코드 YORR64')).toBeVisible()
  })

  it('seeds a room session and exposes the realtime client', async () => {
    const realtimeClient = new FakeRealtimeClient()
    renderAppHarness({
      initialPath: `/rooms/${creatorSession.roomId}/lobby`,
      realtimeClient,
      session: creatorSession,
    })

    expect(await screen.findByRole('region', { name: '참가자 2명' })).toBeVisible()
    await waitFor(() =>
      expect(realtimeClient.sentMessages[0]).toMatchObject({
        type: 'room.join',
        payload: { sessionToken: creatorSession.sessionToken },
      }),
    )
  })

  it('injects API errors with the production error envelope', async () => {
    mockApiError({
      code: 'ROOM_FULL',
      path: '/api/v1/rooms/YORR64/participants',
      status: 409,
    })

    await expect(gameApiClient.joinRoom('YORR64', { nickname: '참가자' })).rejects.toEqual(
      expect.objectContaining({
        code: 'ROOM_FULL',
        status: 409,
      }),
    )
  })

  it('controls Clipboard and Web Share success and failure', async () => {
    const browserApis = installBrowserApiMocks({
      clipboard: 'success',
      share: 'failure',
    })

    try {
      await expect(navigator.clipboard.writeText('https://yorr.test/join')).resolves.toBeUndefined()
      await expect(navigator.share?.({ url: 'https://yorr.test/join' })).rejects.toThrow(
        'Share unavailable',
      )
      expect(browserApis.writeText).toHaveBeenCalledWith('https://yorr.test/join')
    } finally {
      browserApis.restore()
    }
  })

  it('simulates blocked storage and an in-app browser user agent', () => {
    const storage = installBlockedSessionStorage()
    const userAgent = installUserAgentMock('KAKAOTALK inapp')

    try {
      expect(() => resetAppTestState()).not.toThrow()
      expect(navigator.userAgent).toBe('KAKAOTALK inapp')
    } finally {
      userAgent.restore()
      storage.restore()
    }
  })
})
