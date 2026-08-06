import { QRCodeSVG } from 'qrcode.react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Arena } from '@/duel/Arena'
import { flightMs, MAX_FOULS, MAX_HP } from '@/duel/duel'
import { OUTFIT_LEFT, OUTFIT_RIGHT } from '@/duel/Gunslinger'
import type { Stage } from '@/duel/stage'
import { type Game, gameByKey } from '@/games'
import { LocalPingPongGame } from '@/pingpong/PingPongModePage'
import { RealtimeClientProvider } from '@/realtime/RealtimeClientContext'
import { cn } from '@/shared/cn'
import { useAppStore } from '@/store'
import { GamePlay } from '@/yacht/screens/GamePlay'
import { createTutorialClient, createTutorialSnapshot, tutorialSession } from '@/yacht/tutorialGame'

/** 배포 주소. QR과 마지막 화면이 같은 값을 가리킨다 — 카메라로 찍어도 실제로 열린다. */
const SERVICE_URL = 'https://yorr.site'
/** 화면에 그리는 예시 초대 코드. 형식(4~12자 대문자)만 보여주는 자리다. */
const SAMPLE_CODE = 'YORR64'

export interface ReelScene {
  /** 이 씬이 화면에 머무는 시간. 전부 더한 값이 영상 길이다. */
  ms: number
  id: string
  render: () => ReactNode
}

/**
 * 릴의 대본. 순서와 길이가 여기 한 곳에 있다 — 영상이 길거나 짧으면 이 표의 ms만 고친다.
 * 합계 62.5초.
 *
 * 게임은 <b>지금 플레이할 수 있는 3종만</b> 싣는다(`games.ts`의 `live: true`). 준비 중인
 * 게임을 소개 영상에 넣으면 보고 들어온 사람이 없는 걸 찾는다.
 */
export const REEL_SCENES: ReelScene[] = [
  { id: 'open', ms: 6500, render: () => <OpenScene /> },
  { id: 'problem', ms: 8000, render: () => <ProblemScene /> },
  { id: 'join', ms: 8500, render: () => <JoinScene /> },
  { id: 'yacht', ms: 13000, render: () => <YachtScene /> },
  { id: 'pingpong', ms: 11000, render: () => <PingPongScene /> },
  { id: 'duel', ms: 11000, render: () => <DuelScene /> },
  { id: 'close', ms: 4500, render: () => <CloseScene /> },
]

/** 씬 좌상단의 작은 대문자 라벨. 챕터 번호처럼 읽힌다. */
const kicker = 'font-mono text-[0.95cqw] tracking-[0.4em] text-landing-text-faint uppercase'

function Kicker({ children }: { children: ReactNode }) {
  return <span className={cn(kicker, 'reel-fade')}>{children}</span>
}

function noop() {}

// ── 01 오프닝 · 로고 스팅 ────────────────────────────────────────────────────

/**
 * 주사위 두 개가 맞물리는 시각(ms). 굴러 들어오는 시간(reel.css의 `.reel-die-*` 900ms)과
 * 같은 값이고, 충격 연출과 워드마크가 전부 이 시각을 기준으로 선다 — 한 곳만 고치면 스팅
 * 전체의 박자가 같이 움직인다.
 */
const SNAP_AT = 900

function OpenScene() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-[1.1cqw]">
      {/*
        로고 스팅. 닌텐도 스위치 인트로의 문법을 주사위로 옮긴 것이다 — 조이콘 두 짝이
        양쪽에서 들어와 본체에 맞물리고, 그 충격에서 로고가 선다.
        주사위 몸통·눈 색은 게임의 물리 주사위와 같은 토큰을 쓴다(아이보리 + 딥 블랙).
      */}
      <div
        className="reel-snap flex items-center gap-[1.1cqw]"
        style={{ animationDelay: `${SNAP_AT}ms` }}
      >
        <Die className="reel-die-left" face={6} />
        <Die className="reel-die-right" face={6} />
      </div>

      {/* 맞물리는 순간의 섬광. 기본 상태가 투명이라 모션 감소에서 animation을 지워도 안 보인다. */}
      <div
        aria-hidden="true"
        className="reel-flash pointer-events-none absolute inset-0 opacity-0 [background:radial-gradient(58%_48%_at_50%_44%,rgb(255_255_255/82%)_0%,rgb(229_57_53/32%)_46%,rgb(8_9_10/0)_74%)]"
        style={{ animationDelay: `${SNAP_AT}ms` }}
      />

      <h2
        className="reel-rise m-0 font-mono text-[10.5cqw]/none font-bold tracking-[-0.045em] text-landing-text"
        style={{ animationDelay: `${SNAP_AT + 200}ms` }}
      >
        YO<span className="text-landing-accent">R</span>R
      </h2>
      <span
        aria-hidden="true"
        className="reel-draw h-px w-[26cqw] bg-landing-hairline-strong"
        style={{ animationDelay: '1800ms' }}
      />
      <p
        className="reel-rise m-0 text-[2.7cqw]/[1.3] font-bold text-landing-text-strong"
        style={{ animationDelay: '2150ms' }}
      >
        링크 하나로 모이면 바로 시작하는 파티 게임
      </p>
      <p
        className="reel-rise m-0 font-mono text-[1.15cqw] tracking-[0.22em] text-landing-text-muted uppercase"
        style={{ animationDelay: '2850ms' }}
      >
        설치도 가입도 없이 · 폰이 컨트롤러
      </p>
    </div>
  )
}

/**
 * 눈 배치는 3×3 칸 중 어디에 점이 서는지로 정해진다(0부터 8까지, 왼쪽 위가 0).
 * 실제 주사위처럼 마주보는 면의 합이 7이 되도록 대칭으로 놓는다.
 */
const DIE_PIPS: Record<1 | 2 | 3 | 4 | 5 | 6, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** 로고 스팅의 주사위 한 개. 3D가 아니라 정면 한 판이다 — 로고는 흔들리지 않아야 한다. */
function Die({ className, face }: { className?: string; face: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const pips = DIE_PIPS[face]

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-[9cqw] flex-none grid-cols-3 grid-rows-3 gap-[0.5cqw] rounded-[1.7cqw] bg-physics-die p-[1cqw]',
        // 위에서 빛이 드는 한 겹과 바닥 그림자. 로고라 굴리는 주사위보다 대비를 세게 준다.
        'shadow-[inset_0_0.22cqw_0_rgb(255_255_255/75%),inset_0_-0.5cqw_1.2cqw_rgb(0_0_0/18%),0_1.4cqw_2.8cqw_rgb(0_0_0/58%)]',
        className,
      )}
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <span
          className={cn('rounded-full', pips.includes(cell) ? 'bg-physics-pip' : 'bg-transparent')}
          key={cell}
        />
      ))}
    </span>
  )
}

// ── 02 문제 ─────────────────────────────────────────────────────────────────

const OBSTACLES = ['앱을 설치하고', '계정을 만들고', '규칙을 읽고']

function ProblemScene() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-[0.9cqw] px-[9cqw]">
      <Kicker>The Problem</Kicker>
      <p
        className="reel-rise m-0 text-[2cqw] text-landing-text-muted"
        style={{ animationDelay: '250ms' }}
      >
        게임 하나 같이 하려면
      </p>
      <ul className="m-0 flex list-none flex-col items-start gap-[0.4cqw] p-0">
        {OBSTACLES.map((line, index) => (
          <li
            key={line}
            className="reel-rise relative m-0 text-[4.2cqw]/[1.18] font-bold text-landing-text-strong"
            style={{ animationDelay: `${800 + index * 800}ms` }}
          >
            {line}
            {/* 취소선은 세 줄이 다 올라온 뒤에 순서대로 그어진다. */}
            <span
              aria-hidden="true"
              className="reel-draw absolute top-1/2 left-0 h-[0.26cqw] w-full origin-left bg-landing-accent"
              style={{ animationDelay: `${3300 + index * 320}ms` }}
            />
          </li>
        ))}
      </ul>
      <p
        className="reel-rise m-0 mt-[0.8cqw] text-[5cqw]/[1.1] font-bold text-landing-text"
        style={{ animationDelay: '4400ms' }}
      >
        YORR는 <span className="text-landing-accent">링크 하나</span>.
      </p>
      {/* 링크로 모인 다음의 이야기 — 조작할 물건을 따로 사지도, 나눠 쓰지도 않는다. */}
      <p
        className="reel-rise m-0 text-[2.2cqw]/[1.35] font-bold text-landing-accent-text"
        style={{ animationDelay: '5300ms' }}
      >
        그리고 손에 든 폰이 그대로 컨트롤러 — 흔들고, 탭하고, 휘두르세요.
      </p>
    </div>
  )
}

// ── 03 입장 ─────────────────────────────────────────────────────────────────

const STEPS = [
  { n: '01', title: '큰 화면에서 방을 연다', body: '노트북·TV·모니터 아무거나' },
  { n: '02', title: 'QR과 초대 코드가 뜬다', body: '링크를 보내도, 화면을 찍어도 된다' },
  { n: '03', title: '폰으로 바로 대기실', body: '닉네임만 적으면 끝' },
]

function JoinScene() {
  return (
    <div className="grid h-full w-full grid-cols-[1fr_auto] items-center gap-[5cqw] px-[8cqw]">
      <div className="flex flex-col gap-[1.1cqw]">
        <Kicker>Join in 10 seconds</Kicker>
        <h3
          className="reel-rise m-0 text-[3.6cqw]/[1.12] font-bold text-landing-text"
          style={{ animationDelay: '250ms' }}
        >
          모이는 데 <span className="text-landing-accent">10초</span>
        </h3>
        <ol className="m-0 flex list-none flex-col gap-[0.8cqw] p-0">
          {STEPS.map((step, index) => (
            <li
              key={step.n}
              className="reel-rise flex items-baseline gap-[1.2cqw]"
              style={{ animationDelay: `${800 + index * 900}ms` }}
            >
              <span className="font-mono text-[1.3cqw] font-bold tracking-[0.1em] text-landing-accent-text">
                {step.n}
              </span>
              <span className="flex flex-col gap-[0.2cqw]">
                <strong className="text-[1.9cqw]/[1.2] font-bold text-landing-text-strong">
                  {step.title}
                </strong>
                <span className="text-[1.25cqw]/[1.4] text-landing-text-muted">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* 오른쪽: 큰 화면에 뜬 초대 패널과, 그것을 찍고 들어온 폰. */}
      <div className="flex items-end gap-[2.2cqw]">
        <div
          className="reel-pop flex flex-col items-center gap-[1.1cqw] rounded-[2cqw] border border-landing-hairline bg-landing-panel px-[2.4cqw] py-[2.2cqw] shadow-landing-popover"
          style={{ animationDelay: '1000ms' }}
        >
          <span className={kicker}>Scan to join</span>
          {/* 실제 배포 주소를 담은 진짜 QR이다 — 영상을 보다가 찍어도 열린다. */}
          <div className="size-[13cqw] rounded-[1cqw] bg-landing-text p-[0.7cqw] [&>svg]:size-full">
            <QRCodeSVG
              bgColor="transparent"
              fgColor="#08090a"
              level="M"
              size={512}
              value={`${SERVICE_URL}/join?code=${SAMPLE_CODE}`}
            />
          </div>
          <span className="font-mono text-[2.4cqw] font-bold tracking-[0.2em] text-landing-text">
            {SAMPLE_CODE}
          </span>
        </div>
        <LobbyPhone delay={2000} />
      </div>
    </div>
  )
}

/** 대기실이 뜬 폰. 참가자가 한 명씩 들어오는 것만 말한다. */
function LobbyPhone({ delay }: { delay: number }) {
  const players = ['재현', '민서', '도윤', '수아']

  return (
    <div
      className="reel-rise flex w-[12cqw] flex-col gap-[0.7cqw] rounded-[1.6cqw] border border-landing-hairline-strong bg-landing-field p-[1cqw] shadow-landing-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={kicker}>Lobby · {SAMPLE_CODE}</span>
      {players.map((name, index) => (
        <span
          key={name}
          className="reel-pop flex items-center gap-[0.6cqw] rounded-[0.8cqw] bg-landing-soft px-[0.8cqw] py-[0.55cqw] text-[1cqw] font-semibold text-landing-text-strong"
          style={{ animationDelay: `${delay + 500 + index * 460}ms` }}
        >
          <span aria-hidden="true" className="size-[0.7cqw] rounded-full bg-landing-accent-text" />
          {name}
        </span>
      ))}
    </div>
  )
}

// ── 게임 세그먼트 공통 껍데기 ────────────────────────────────────────────────

/**
 * 게임 한 종을 소개하는 한 판. <b>실제 플레이 화면이 무대를 가득 채우고</b> 이름·룰은 그
 * 위에 얹는 띠다.
 *
 * 반으로 갈라 한쪽 칸에 넣지 않는다. 제품 플레이 화면은 `h-svh` 전면 화면이라(요트
 * `GamePlay`, 탁구 `LocalPingPongGame`) 절반 칸에서는 레이아웃이 성립하지 않고, 애초에
 * 화면을 작은 상자에 담으면 "플레이 화면"이 아니라 스크린샷 카드로 읽힌다. `h-svh`를
 * 무대 높이로 되돌리는 것은 reel.css의 `.reel-screen`이다.
 *
 * 메타는 `games.ts`에서 그대로 읽는다 — 카탈로그가 SSOT이므로 영상용으로 따로 적어둔
 * 인원·시간 표기가 없다. 룰만 이 파일이 소유한다(영상 길이에 맞춘 요약이라 제품 화면의
 * 규칙 설명과 문장이 다르다).
 */
function GameSegment({
  chapter,
  game,
  rules,
  screen,
}: {
  /** 챕터 표시. 게임 이름·조작은 아래에서 이미 말하므로 여기서는 몇 번째인지만 말한다. */
  chapter: string
  game: Game
  rules: string[]
  screen: ReactNode
}) {
  return (
    <div className="relative size-full">
      {/* 실제 게임 코드가 그리는 화면. 조작만 릴이 대신 한다. */}
      <div className="reel-screen reel-fade absolute inset-0 overflow-hidden">{screen}</div>

      {/*
        릴 글자는 <b>전부 하단 한 층</b>에 모은다. 화면 위쪽은 게임 자기 HUD 자리다 —
        요트는 라운드·타이머·연결 상태, 탁구는 YOU:CPU 점수판, 결투는 양쪽 이름표가 거기
        선다. 위에도 카피를 얹으면 그것들과 겹쳐 둘 다 못 읽는다.
        스크림은 그 한 층만 걷어 낸다(랜딩 히어로 카드가 3D 위에 카피를 얹는 것과 같은 수법).
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] [background:linear-gradient(0deg,rgb(8_9_10/95%)_0%,rgb(8_9_10/86%)_38%,rgb(8_9_10/42%)_74%,rgb(8_9_10/0)_100%)]"
      />

      <div className="absolute inset-x-[4.5cqw] bottom-[3.2cqw] flex items-end justify-between gap-[3cqw]">
        <div className="flex flex-col gap-[0.45cqw]">
          <Kicker>{chapter}</Kicker>
          <h3
            className="reel-rise m-0 text-[3.6cqw]/[1.06] font-bold text-landing-text"
            style={{ animationDelay: '250ms' }}
          >
            {game.name}
          </h3>
          <p
            className="reel-rise m-0 mb-[0.4cqw] text-[1.7cqw]/[1.25] font-bold text-landing-accent-text"
            style={{ animationDelay: '1000ms' }}
          >
            {game.tagline}
          </p>
          <ul className="m-0 flex list-none flex-col gap-[0.55cqw] p-0">
            {rules.map((rule, index) => (
              <li
                key={rule}
                className="reel-rise flex items-baseline gap-[0.9cqw] text-[1.45cqw]/[1.3] font-bold text-landing-text-strong"
                style={{ animationDelay: `${1700 + index * 1050}ms` }}
              >
                <span
                  aria-hidden="true"
                  className="size-[0.5cqw] flex-none translate-y-[-0.3cqw] rounded-full bg-landing-accent"
                />
                {rule}
              </li>
            ))}
          </ul>
        </div>
        <ul
          className="reel-fade m-0 flex list-none flex-col items-end gap-[0.4cqw] p-0"
          style={{ animationDelay: '1350ms' }}
        >
          {[game.players, game.duration, game.control].map((item) => (
            <li
              key={item}
              className="rounded-full border border-landing-hairline-strong bg-landing-well px-[0.9cqw] py-[0.35cqw] font-mono text-[0.9cqw] tracking-[0.1em] whitespace-nowrap text-landing-text-muted uppercase"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * 화면이 그린 <b>실제 버튼</b>을 누른다. 준비될 때까지(지연 로드 · 굴리는 중 disabled) 잠깐
 * 기다렸다가 누르고, 끝까지 못 찾으면 조용히 포기한다.
 *
 * 왜 상태를 직접 밀어넣지 않는가: 굴림 횟수 · 킵 · 기록은 화면과 로컬 서버가 나눠 들고 있다.
 * 밖에서 상태만 갈아끼우면 둘이 어긋나 실제로는 나올 수 없는 화면이 그려진다 — 버튼을
 * 누르면 사람이 플레이할 때와 <b>완전히 같은 경로</b>를 탄다.
 */
function clickWhenReady(root: HTMLElement | null, selector: string) {
  let timer = 0
  let left = 16

  const attempt = () => {
    const target = root?.querySelector<HTMLElement>(selector)
    if (target && !target.hasAttribute('disabled')) {
      target.click()
      return
    }
    if (left-- > 0) timer = window.setTimeout(attempt, 120)
  }
  attempt()

  return () => window.clearTimeout(timer)
}

// ── 04 요트 다이스 (실제 플레이 화면) ────────────────────────────────────────

/**
 * 릴이 요트 화면을 진행시키는 순서. `at`은 씬이 뜬 뒤 경과 시간(ms)이고, selector는 실제
 * 화면이 붙여 둔 표지다 — 연습 모드 안내(`TutorialGuide`)가 가리킬 때 쓰는 것과 같은
 * 표지라 클래스명이 바뀌어도 따라 깨지지 않는다.
 *
 * `choice`(총합)를 기록한다. 굴림을 강제하지 않으니 주사위는 매번 다른데, 다른 족보는 안
 * 맞으면 0점이 찍힌다 — 총합은 어떤 주사위에서도 실제 점수가 나온다.
 */
const YACHT_STEPS = [
  { at: 1600, selector: '[data-tutorial="roll"]' },
  { at: 6200, selector: '[data-tutorial="roll"]' },
  { at: 10600, selector: '[data-tutorial-category="choice"]' },
]

function YachtScene() {
  return (
    <GameSegment
      chapter="Game 01 / 03"
      game={gameByKey('yacht')}
      rules={[
        '주사위 5개를 굴려 12개 족보를 채운다',
        '3번까지 다시 굴리고, 남길 주사위는 킵',
        '12라운드 뒤 총점이 높은 쪽이 승리',
      ]}
      screen={<YachtPlayScreen />}
    />
  )
}

/**
 * 실제 요트 플레이 화면(`GamePlay`) 그대로 — 점수시트 · 라운드 표시 · 물리 주사위 트레이가
 * 전부 살아 있다. 서버 자리에는 연습 모드와 같은 1인 로컬 서버(`createTutorialClient`)가
 * 들어가고, 누르는 사람 자리에 위 {@link YACHT_STEPS}가 들어간다.
 *
 * 연습 안내 띠(`guide`)는 넘기지 않는다 — 소개 영상에서는 "배우는 화면"으로 읽힌다.
 */
function YachtPlayScreen() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [client] = useState(createTutorialClient)
  const [snapshot] = useState(createTutorialSnapshot)
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus)

  /*
   * GamePlay는 연결 상태를 스토어에서 읽어 조작을 잠근다. 연습 모드와 같은 이유로 들어올 때
   * 연결됨으로 두고 나갈 때 되돌린다 — 남겨 두면 실전 화면이 끊긴 소켓을 연결됨으로 본다.
   */
  useEffect(() => {
    client.connect()
    setConnectionStatus('connected')
    return () => setConnectionStatus('idle')
  }, [client, setConnectionStatus])

  useEffect(() => {
    const cancels = YACHT_STEPS.map(({ at, selector }) => {
      let cancelClick = () => {}
      const timer = window.setTimeout(() => {
        cancelClick = clickWhenReady(rootRef.current, selector)
      }, at)
      return () => {
        window.clearTimeout(timer)
        cancelClick()
      }
    })
    return () => {
      for (const cancel of cancels) cancel()
    }
  }, [])

  return (
    <div className="size-full" ref={rootRef}>
      <RealtimeClientProvider client={client}>
        <GamePlay
          /*
           * 아무것도 그리지 않는 안내다. 첫 진입 코치마크("빛나는 동그라미 두 개를 눌러
           * 보세요")는 `guide`가 없을 때만 뜨므로(GameDiceTray의 `coachOpen`), 빈 안내를
           * 넘기면 조작 안내 없이 플레이 화면만 남는다 — 소개 영상에 "이걸 눌러 보세요"가
           * 뜨면 시연이 아니라 사용설명서로 읽힌다.
           *
           * 쿠키(`hideTutorial()`)로 끄지 않는 이유: 그건 녹화용 브라우저에 1년짜리 흔적을
           * 남긴다. 이 화면에서만 끄면 되는 일이다.
           */
          guide={() => null}
          onLeaveRequest={noop}
          roomId={tutorialSession.roomId}
          session={tutorialSession}
          snapshot={snapshot}
        />
      </RealtimeClientProvider>
    </div>
  )
}

// ── 05 탁구 (실제 플레이 화면) ───────────────────────────────────────────────

function PingPongScene() {
  return (
    <GameSegment
      chapter="Game 02 / 03"
      game={gameByKey('pingpong')}
      rules={[
        '11점을 먼저 내면 이긴다 (듀스는 2점 차)',
        '공이 넘어오는 순간 탭하거나 폰을 휘두른다',
        '타이밍이 정확할수록 스매시로 꽂힌다',
      ]}
      // auto: 릴에는 라켓을 휘두를 사람이 없다. 상대는 그대로 진짜 AI다.
      screen={<LocalPingPongGame auto difficulty="normal" mode="solo" onExit={noop} />}
    />
  )
}

// ── 06 석양이 진다 (실제 플레이 화면) ────────────────────────────────────────

/**
 * 결투 한 판의 대본. `at`은 씬이 뜬 뒤 경과 시간(ms)이고, 각 항목이 그 시각부터 다음
 * 항목까지 화면에 서 있는 무대다.
 *
 * 서버 상태(`DuelState`)를 위조해 `buildStage`에 넣지 않고 무대를 직접 세운다 — 무대는
 * 순수한 화면 서술이라 이 대본이 곧 그림이고, 가짜 서버 상태를 만들면 진짜 서버가 절대
 * 만들지 않는 조합(체력 · 기록 · 라운드가 어긋난 상태)이 조용히 그려질 수 있다.
 */
const DUEL_BEATS: { at: number; round: number; stage: Stage }[] = [
  { at: 0, round: 1, stage: duelStage({ phase: 'waiting' }) },
  { at: 2600, round: 1, stage: duelStage({ phase: 'signal' }) },
  {
    at: 3400,
    round: 1,
    stage: duelStage({
      phase: 'result',
      leftMs: 214,
      rightMs: 388,
      rightHp: MAX_HP - 1,
      hit: 'right',
    }),
  },
  { at: 6600, round: 2, stage: duelStage({ phase: 'waiting', rightHp: MAX_HP - 1 }) },
  { at: 8400, round: 2, stage: duelStage({ phase: 'signal', rightHp: MAX_HP - 1 }) },
  {
    at: 9200,
    round: 2,
    stage: duelStage({
      phase: 'result',
      leftMs: 187,
      rightMs: 402,
      rightHp: MAX_HP - 2,
      hit: 'right',
      ko: true,
    }),
  },
]

/** 한 무대를 세운다. 기본값은 "둘 다 멀쩡히 서서 신호를 기다리는" 그림이다. */
function duelStage({
  phase,
  hit,
  ko = false,
  leftMs = null,
  rightHp = MAX_HP,
  rightMs = null,
}: {
  phase: Stage['phase']
  /** 총알이 닿은 쪽. 결과 국면에서만 준다. */
  hit?: 'right'
  ko?: boolean
  leftMs?: number | null
  rightHp?: number
  rightMs?: number | null
}): Stage {
  const settled = phase === 'result'

  return {
    clash: false,
    foulSide: 0,
    ko,
    left: {
      fouls: 0,
      hp: MAX_HP,
      ms: leftMs,
      name: '나',
      outfit: OUTFIT_LEFT,
      pose: settled ? 'draw' : 'ready',
    },
    leftMiss: false,
    leftShot: settled ? 'opponent' : null,
    miss: null,
    pending: false,
    phase,
    right: {
      fouls: 0,
      hp: rightHp,
      ms: rightMs,
      name: '민서',
      outfit: OUTFIT_RIGHT,
      pose: settled && hit === 'right' ? (ko ? 'dead' : 'hit') : 'ready',
    },
    rightMiss: false,
    rightShot: null,
    selfShot: false,
    tie: false,
    winner: settled ? 1 : 0,
  }
}

function DuelScene() {
  return (
    <GameSegment
      chapter="Game 03 / 03"
      game={gameByKey('duel')}
      rules={[
        '신호가 초록으로 바뀌는 순간 뽑는다',
        '먼저 뽑은 쪽이 맞힌다. 3발 먼저면 끝',
        `신호 전에 뽑으면 부정출발 — ${MAX_FOULS}번이면 제 발을 쏜다`,
      ]}
      screen={<DuelPlayScreen />}
    />
  )
}

/**
 * 실제 결투 플레이 화면. `DuelGame`이 세우는 껍데기와 `Arena`가 그대로다 — 그 화면에서
 * 여기 없는 것은 나가기 버튼과 탭 히트 영역뿐이고, 둘 다 소개 영상에 있을 이유가 없다.
 * 서버 대신 위 {@link DUEL_BEATS} 대본이 무대를 넘긴다.
 */
function DuelPlayScreen() {
  const shellRef = useRef<HTMLElement>(null)
  const [beat, setBeat] = useState(0)
  // 총알 비행 시간은 사거리(무대 폭)에서 나온다 — 실제 게임과 같은 계산을 쓴다.
  const [stageWidth, setStageWidth] = useState(720)

  useEffect(() => {
    const width = shellRef.current?.getBoundingClientRect().width
    if (width) setStageWidth(width)
  }, [])

  useEffect(() => {
    const timers = DUEL_BEATS.slice(1).map((next, index) =>
      setTimeout(() => setBeat(index + 1), next.at),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const current = DUEL_BEATS[beat] ?? DUEL_BEATS[0]
  if (!current) return null
  const flight = flightMs(stageWidth)

  return (
    <main
      className="relative flex size-full flex-col overflow-hidden bg-[#0b0409] text-white select-none"
      ref={shellRef}
    >
      <Arena
        {...current.stage}
        actLabel="휘둘러!"
        flightMs={flight}
        fxKey={beat}
        hint="초록이 되면 폰을 휘둘러 뽑아!"
        // 총알이 방금 떠났으므로 사거리 전체가 남아 있다.
        impactDelayMs={flight}
        maxFouls={MAX_FOULS}
        maxHp={MAX_HP}
        round={current.round}
      />
    </main>
  )
}

// ── 07 클로징 ───────────────────────────────────────────────────────────────

function CloseScene() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[1.2cqw]">
      <Kicker>Now playing</Kicker>
      <h2
        className="reel-rise m-0 font-mono text-[8cqw]/none font-bold tracking-[-0.045em] text-landing-text"
        style={{ animationDelay: '250ms' }}
      >
        YO<span className="text-landing-accent">R</span>R
      </h2>
      <p
        className="reel-rise m-0 text-[2.4cqw]/[1.3] font-bold text-landing-text-strong"
        style={{ animationDelay: '1000ms' }}
      >
        링크 하나 보내고, 지금 시작하세요.
      </p>
      <span
        aria-hidden="true"
        className="reel-draw h-px w-[20cqw] bg-landing-hairline-strong"
        style={{ animationDelay: '1650ms' }}
      />
      <p
        className="reel-rise m-0 font-mono text-[1.9cqw] tracking-[0.14em] text-landing-accent-text"
        style={{ animationDelay: '2050ms' }}
      >
        {SERVICE_URL.replace('https://', '')}
      </p>
    </div>
  )
}
