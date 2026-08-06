import { useEffect, useState } from 'react'
import { playLandingSoundtrack } from '@/shared/audio/soundtrack'
import { REEL_SCENES } from './scenes'
import './reel.css'

/**
 * 서비스 소개 영상용 자동 재생 릴. `/intro`를 열면 아무것도 누르지 않아도 처음부터 끝까지
 * 굴러가고, 마지막 씬에서 멈춘다 — 화면 녹화를 걸어두고 다른 일을 하면 된다.
 *
 * <b>16:9 무대</b>: 안쪽 상자를 aspect-video로 고정하고 남는 자리는 검게 둔다. 창을 어떻게
 * 키워도 구도가 같으므로, 1920×1080으로 녹화하든 창 크기가 어중간하든 같은 영상이 나온다.
 * 글자·여백은 전부 `cqw`(무대 폭의 %)라 상자 크기를 따라 같이 스케일된다 — 뷰포트 단위(vw)를
 * 쓰면 레터박스가 생기는 창에서 글자만 무대 밖 기준으로 커진다.
 *
 * 게임 세 판은 <b>실제 플레이 화면 그대로</b>다: 요트는 `GamePlay`(점수시트·물리 주사위
 * 트레이), 탁구는 `LocalPingPongGame`(HUD·3D 코트), 결투는 `Arena`다. 서버·조작만 타임라인이
 * 대신한다 — 영상용 목업이 없으므로 게임을 고치면 릴도 같이 바뀐다.
 *
 * <b>씬 전환은 자르기(cut)다.</b> 크로스페이드를 넣지 않는 이유가 둘이다. 하나는 리듬 —
 * 챕터가 흐려지며 바뀌면 그 구간이 멈춘 것처럼 읽힌다. 다른 하나는 성능 — 두 씬이 겹치는
 * 순간 요트의 rapier 월드와 탁구 코트의 WebGL 컨텍스트가 <b>같이</b> 살아나, 녹화 중
 * 프레임이 떨어지는 가장 확실한 방법이 된다. 자르면 겹치는 프레임이 아예 없다.
 */
export function IntroReel({
  hold = false,
  startAt = 0,
}: {
  /**
   * 씬을 넘기지 않고 그 자리에 세워 둔다(`?hold=1`). 한 씬의 배치·문구만 고칠 때 쓴다 —
   * 넘어가 버리면 볼 시간이 씬 길이만큼밖에 없다. 씬 안의 등장 연출은 그대로 돈다.
   */
  hold?: boolean
  startAt?: number
}) {
  const [index, setIndex] = useState(() => Math.min(Math.max(startAt, 0), REEL_SCENES.length - 1))
  const [fontsReady, setFontsReady] = useState(false)

  /**
   * 펴진고딕을 받기 전에는 첫 씬을 <b>시작하지 않는다</b>.
   *
   * 릴은 열자마자 12cqw짜리 워드마크가 서므로, 폰트가 늦게 도착하면 그 교체가 영상 첫
   * 프레임에 그대로 찍힌다(`font-display: block`이라 대체 서체로 잠깐 그려지는 일은 없지만,
   * 글자가 없는 프레임이 남는다). 여기서 붙잡으면 녹화에는 완성된 첫 프레임만 들어간다.
   *
   * `document.fonts.ready`는 <b>대기 중인 폰트가 없을 때 즉시</b> resolve한다 — 두 번째
   * 재생부터는 캐시가 차 있으므로 기다리는 시간이 사실상 없다.
   */
  useEffect(() => {
    let alive = true
    void document.fonts.ready.then(() => {
      if (alive) setFontsReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!fontsReady || hold) return
    // 마지막 씬은 넘기지 않는다 — 끝 화면이 그대로 남아 있어야 녹화를 끊을 여유가 있다.
    if (index >= REEL_SCENES.length - 1) return
    const id = setTimeout(() => setIndex(index + 1), REEL_SCENES[index]?.ms ?? 0)
    return () => clearTimeout(id)
  }, [fontsReady, hold, index])

  /**
   * 랜딩 BGM. 브라우저 자동재생 정책이 막으면 소리만 빠진 채 릴은 그대로 돈다
   * (soundtrack이 첫 클릭을 기다렸다가 늦게 켠다) — 녹화 전에 창을 한 번 클릭하면 된다.
   */
  useEffect(() => {
    playLandingSoundtrack('yacht')
  }, [])

  const scene = REEL_SCENES[index]

  return (
    <main className="grid h-svh w-full place-items-center overflow-hidden bg-black">
      <div className="reel-stage @container relative aspect-video w-full max-w-[calc(100svh*16/9)] overflow-hidden [background:var(--ds-landing-bg)]">
        {/* key로 씬을 갈아끼운다 — 같은 자리의 다른 key라 React가 이전 씬을 언마운트한 뒤
            새 씬을 마운트하고, 그래서 등장 애니메이션(animation-delay)이 매 씬 처음부터
            다시 돈다. 겹치는 프레임은 없다. */}
        {fontsReady && scene && (
          <div className="absolute inset-0" key={scene.id}>
            {scene.render()}
          </div>
        )}
      </div>
    </main>
  )
}
