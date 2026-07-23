import { useAppStore } from '@/store'

export function LobbyPage() {
  const roomSession = useAppStore((state) => state.roomSession)

  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center text-content">
      <section>
        <p className="font-bold text-brand-strong">방 {roomSession?.roomCode}</p>
        <h1 className="text-display font-bold">대기실</h1>
      </section>
    </main>
  )
}
