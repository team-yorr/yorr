import { useSwing } from '@/shared/useSwing'
import { usePhoneController } from './phoneController'

export function PingPongPhoneControllerPage({ code }: { code: string }) {
  const controller = usePhoneController(code)
  const { permission, requestPermission } = useSwing({
    enabled: controller.connected,
    onSwing: controller.sendSwing,
  })
  const blue = controller.playerTone === 'blue'
  const paddleColor = blue ? '#2b8fe0' : '#e2513c'

  return (
    <main className="relative flex h-svh w-full touch-none select-none flex-col overflow-hidden bg-[#070b12] px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 font-mono text-xs tracking-[0.16em] text-white/45">PHONE CONTROLLER</p>
          <h1 className="mt-1 mb-0 text-xl font-black">탁구 컨트롤러</h1>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${controller.connected ? 'bg-[#49e08a]/15 text-[#8dffc0]' : 'bg-white/8 text-white/55'}`}
        >
          {controller.connected ? '연결됨' : '연결 중'}
        </span>
      </header>

      <button
        aria-label="탁구채를 휘두르기"
        className="relative mt-4 min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-white/12 bg-white/5"
        disabled={!controller.connected}
        onPointerDown={controller.sendSwing}
        type="button"
      >
        <span
          aria-hidden="true"
          className="absolute top-[16%] left-1/2 block h-[45%] aspect-square -translate-x-1/2 rotate-[-8deg] rounded-full border-[10px] shadow-[0_18px_45px_rgb(0_0_0_/_35%)]"
          style={{ backgroundColor: paddleColor, borderColor: `${paddleColor}73` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-[54%] left-1/2 h-[29%] w-11 origin-top -translate-x-1/2 rotate-[-8deg] rounded-b-full bg-[#201a1a]"
        />
        <span className="absolute inset-x-4 bottom-5 text-center text-sm font-bold text-white/60">
          휴대폰을 휘두르거나 화면을 탭하세요
        </span>
      </button>

      <section className="mt-3 grid flex-none gap-2">
        {permission === 'unknown' && (
          <button
            className="min-h-12 rounded-2xl bg-[#49e08a] font-black text-[#06110b]"
            onClick={() => void requestPermission()}
            type="button"
          >
            모션 스윙 켜기
          </button>
        )}
        <button
          className="min-h-12 rounded-2xl bg-white font-black text-[#070b12] disabled:opacity-40"
          disabled={!controller.connected}
          onClick={controller.sendReady}
          type="button"
        >
          준비 완료
        </button>
        {controller.error && (
          <p className="m-0 text-center text-sm text-[#ff8b7c]" role="alert">
            {controller.error}
          </p>
        )}
      </section>
    </main>
  )
}
