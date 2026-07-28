import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlayingRoomSnapshot, creatorSession } from '@/mocks/fixtures'
import { createRealtimeFixture } from '@/mocks/realtimeScenarios'
import { RealtimeClientProvider } from '@/realtime/RealtimeClientContext'
import type { PhysicsDiceRollRequest, PhysicsDiceSet } from '@/rendering/physics-dice/types'
import { useAppStore } from '@/store'
import { GamePlay } from './GamePlay'

/**
 * 물리 렌더러는 rAF와 WebGL에 의존해 jsdom에서 굴림을 끝낼 수 없다.
 * 굴림 완료를 버튼으로 노출해 CTA 상태 전이만 결정적으로 검증한다.
 */
vi.mock('@/components/PhysicsDiceScene', () => ({
  PhysicsDiceScene: ({
    onHeldToggle,
    onRollComplete,
    request,
  }: {
    onHeldToggle?: (index: 0) => void
    onRollComplete: (requestId: string, dice: PhysicsDiceSet) => void
    request: PhysicsDiceRollRequest | null
  }) => (
    <div>
      {request && (
        <button onClick={() => onRollComplete(request.requestId, [6, 5, 4, 3, 2])} type="button">
          굴림 완료
        </button>
      )}
      <button onClick={() => onHeldToggle?.(0)} type="button">
        첫 주사위 킵
      </button>
    </div>
  ),
}))

const { snapshot: _snapshot, ...session } = creatorSession

function renderGame() {
  const snapshot = createPlayingRoomSnapshot(Date.now() + 30_000)
  useAppStore.setState({ connectionStatus: 'connected', roomSnapshot: snapshot })
  return {
    ...render(
      <RealtimeClientProvider client={createRealtimeFixture()}>
        <GamePlay roomId={session.roomId} session={session} snapshot={snapshot} />
      </RealtimeClientProvider>,
    ),
    user: userEvent.setup(),
  }
}

describe('GamePlay', () => {
  beforeEach(() => useAppStore.getState().reset())

  it('keeps a single roll CTA', async () => {
    const { user } = renderGame()

    expect(screen.getByRole('button', { name: '굴리기' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '굴리기' }))

    // 굴리는 동안에도 버튼은 같은 자리에 남고 라벨만 바뀐다.
    expect(screen.getByRole('button', { name: '굴리는 중' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '굴림 완료' }))
    expect(screen.getByRole('button', { name: '굴리기' })).toBeEnabled()
    expect(screen.getByText('굴림 2회 남음')).toBeVisible()
  })

  it('previews scores on the quick strip once dice have settled', async () => {
    const { user } = renderGame()

    // 굴리기 전에는 예상 점수가 없어 칩이 잠긴다.
    expect(screen.getByRole('button', { name: 'Choice' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '굴리기' }))
    await user.click(screen.getByRole('button', { name: '굴림 완료' }))

    // [6,5,4,3,2] → L. Straight 30이 최고 점수로 맨 앞에 온다.
    expect(screen.getByRole('button', { name: 'L. Straight 30점 기록' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Choice 20점 기록' })).toBeEnabled()
  })

  it('opens the record panel automatically after the last roll', async () => {
    const { user } = renderGame()

    for (let roll = 0; roll < 3; roll += 1) {
      await user.click(screen.getByRole('button', { name: '굴리기' }))
      await user.click(screen.getByRole('button', { name: '굴림 완료' }))
    }

    expect(screen.getByText('굴림 소진')).toBeVisible()
    // 패널이 열리면 토글이 "접기"로 바뀌고 전체 점수시트가 드러난다.
    const toggle = await screen.findByRole('button', { name: /접기/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // 시트 행(정확히 "Choice 20")이 드러난다 — 퀵 칩("Choice 20점 기록")과 구분.
    expect(screen.getByRole('button', { name: 'Choice 20' })).toBeVisible()
  })

  it('records a category in one tap and then waits for the other players', async () => {
    const { user } = renderGame()

    await user.click(screen.getByRole('button', { name: '굴리기' }))
    await user.click(screen.getByRole('button', { name: '굴림 완료' }))

    // 퀵 칩은 peek 상태에서도 보인다 — 시트를 열 필요 없이 한 번에 기록한다.
    await user.click(screen.getByRole('button', { name: 'Choice 20점 기록' }))

    expect(await screen.findByText('점수가 반영됐습니다 · 다음 턴을 기다리는 중')).toBeVisible()
  })

  it('asks for confirmation before recording a zero', async () => {
    const { user } = renderGame()

    await user.click(screen.getByRole('button', { name: '굴리기' }))
    await user.click(screen.getByRole('button', { name: '굴림 완료' }))

    const zeroChip = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label')?.endsWith(' 0점 기록'))
    expect(zeroChip).toBeDefined()
    if (!zeroChip) return

    await user.click(zeroChip)

    expect(await screen.findByRole('dialog', { name: /0점으로 확정할까요\?/ })).toBeVisible()
  })
})
