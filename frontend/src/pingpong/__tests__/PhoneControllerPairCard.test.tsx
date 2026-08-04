import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhoneControllerPairCard } from '../PhoneControllerPairCard'
import { phoneControllerUrl } from '../phoneController'

describe('PhoneControllerPairCard', () => {
  it('shows a scannable controller code and motion plus touch guidance', () => {
    render(<PhoneControllerPairCard code="ABC234" connected={false} />)

    expect(screen.getByText('ABC234')).toBeVisible()
    expect(screen.getByText('모션 스윙 · 화면 터치 지원')).toBeVisible()
    expect(screen.getByTitle('탁구 휴대폰 컨트롤러 QR 코드')).toBeInTheDocument()
    expect(phoneControllerUrl('ABC234')).toContain('/pingpong/controller?code=ABC234')
  })

  it('announces when the phone is connected', () => {
    render(<PhoneControllerPairCard code="ABC234" connected />)

    expect(screen.getByText('휴대폰 연결 완료')).toBeVisible()
  })
})
