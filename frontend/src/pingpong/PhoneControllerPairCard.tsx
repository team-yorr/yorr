import { QRCodeSVG } from 'qrcode.react'
import { phoneControllerUrl } from './phoneController'

export function PhoneControllerPairCard({
  code,
  connected,
}: {
  code: string | null
  connected: boolean
}) {
  if (!code) {
    return (
      <aside className="grid min-w-48 gap-1 rounded-2xl border border-white/15 bg-black/55 p-3 text-sm backdrop-blur-md">
        휴대폰 연결 코드를 만들고 있어요…
      </aside>
    )
  }

  return (
    <aside className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/60 p-3 text-white shadow-xl backdrop-blur-md">
      <QRCodeSVG
        className="size-20 flex-none rounded-lg bg-white p-1.5"
        level="M"
        title="탁구 휴대폰 컨트롤러 QR 코드"
        value={phoneControllerUrl(code)}
      />
      <div className="grid min-w-0 gap-1">
        <strong className={connected ? 'text-[#8dffc0]' : 'text-white'}>
          {connected ? '휴대폰 연결 완료' : '휴대폰으로 QR을 찍어 주세요'}
        </strong>
        <span className="font-mono text-xl font-black tracking-[0.14em]">{code}</span>
        <span className="text-xs text-white/55">모션 스윙 · 화면 터치 지원</span>
      </div>
    </aside>
  )
}
