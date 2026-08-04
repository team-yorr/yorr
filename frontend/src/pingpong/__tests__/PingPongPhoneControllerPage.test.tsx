import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PingPongPhoneControllerPage } from '../PingPongPhoneControllerPage'
import type { PaddleTone } from '../phoneController'

let tone: PaddleTone = 'blue'

vi.mock('../phoneController', () => ({
  usePhoneController: () => ({
    connected: true,
    error: null,
    playerTone: tone,
    sendReady: vi.fn(),
    sendSwing: vi.fn(),
  }),
}))

vi.mock('@/shared/useSwing', () => ({
  useSwing: () => ({ permission: 'granted', requestPermission: vi.fn() }),
}))

describe('PingPongPhoneControllerPage', () => {
  beforeEach(() => {
    tone = 'blue'
  })

  it('renders a blue paddle for player 1', () => {
    render(<PingPongPhoneControllerPage code="ABC234" />)

    expect(screen.getByLabelText('탁구채를 휘두르기').firstElementChild).toHaveStyle({
      backgroundColor: '#2b8fe0',
    })
  })

  it('renders a red paddle for player 2', () => {
    tone = 'red'
    render(<PingPongPhoneControllerPage code="ABC234" />)

    expect(screen.getByLabelText('탁구채를 휘두르기').firstElementChild).toHaveStyle({
      backgroundColor: '#e2513c',
    })
  })
})
