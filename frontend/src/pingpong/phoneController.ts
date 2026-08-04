import { useEffect, useRef, useState } from 'react'
import { WebSocketRealtimeClient } from '@/realtime/realtimeClient'
import { buildClientMessage, type ServerMessage } from '@/realtime/wsEvents'

const RECONNECT_DELAY_MS = 1_000

export type PaddleTone = 'blue' | 'red'

interface DisplayPairOptions {
  enabled: boolean
  onReady: () => void
  onSwing: () => void
  playerTone: PaddleTone
}

export function usePhoneControllerDisplay({
  enabled,
  onReady,
  onSwing,
  playerTone,
}: DisplayPairOptions) {
  const onReadyRef = useRef(onReady)
  const onSwingRef = useRef(onSwing)
  const [code, setCode] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  onReadyRef.current = onReady
  onSwingRef.current = onSwing

  useEffect(() => {
    if (!enabled) {
      setCode(null)
      setConnected(false)
      return
    }

    const client = new WebSocketRealtimeClient()
    let active = true
    let heartbeat: number | undefined
    let reconnect: number | undefined

    const sendCreate = () => {
      client.send(
        buildClientMessage('controller.pair.create', {
          gameCode: 'PING_PONG',
          playerTone,
        }),
      )
    }
    const onMessage = (message: ServerMessage) => {
      if (message.type === 'sys.connected') {
        window.clearInterval(heartbeat)
        heartbeat = window.setInterval(() => {
          try {
            client.send(buildClientMessage('sys.ping', { clientTs: Date.now() }))
          } catch {
            // The connection callback schedules recovery.
          }
        }, message.payload.heartbeatIntervalMs)
        sendCreate()
        return
      }
      if (message.type === 'controller.pair.created') {
        setCode(message.payload.code)
        setConnected(false)
        return
      }
      if (message.type === 'controller.pair.status') {
        setConnected(message.payload.connected)
        return
      }
      if (message.type === 'controller.swing') onSwingRef.current()
      if (message.type === 'controller.ready') onReadyRef.current()
    }
    const onConnection = (event: 'open' | 'close' | 'error') => {
      if (!active || event === 'open' || reconnect !== undefined) return
      setConnected(false)
      reconnect = window.setTimeout(() => {
        reconnect = undefined
        client.connect()
      }, RECONNECT_DELAY_MS)
    }

    const unsubscribeMessage = client.onMessage(onMessage)
    const unsubscribeConnection = client.onConnectionChange(onConnection)
    client.connect()

    return () => {
      active = false
      window.clearInterval(heartbeat)
      window.clearTimeout(reconnect)
      try {
        client.send(buildClientMessage('controller.pair.leave', {}))
      } catch {
        // An already closed relay has nothing left to clean up locally.
      }
      unsubscribeMessage()
      unsubscribeConnection()
      client.disconnect()
    }
  }, [enabled, playerTone])

  return { code, connected }
}

interface ControllerPairState {
  connected: boolean
  error: string | null
  playerTone: PaddleTone
  sendReady: () => void
  sendSwing: () => void
}

export function usePhoneController(code: string): ControllerPairState {
  const clientRef = useRef<WebSocketRealtimeClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playerTone, setPlayerTone] = useState<PaddleTone>('blue')

  useEffect(() => {
    const client = new WebSocketRealtimeClient()
    clientRef.current = client
    let active = true
    let heartbeat: number | undefined
    let reconnect: number | undefined
    const unsubscribeMessage = client.onMessage((message) => {
      if (message.type === 'sys.connected') {
        window.clearInterval(heartbeat)
        heartbeat = window.setInterval(() => {
          try {
            client.send(buildClientMessage('sys.ping', { clientTs: Date.now() }))
          } catch {
            // The disconnected state below gives the retry affordance.
          }
        }, message.payload.heartbeatIntervalMs)
        client.send(buildClientMessage('controller.pair.join', { code }))
        return
      }
      if (message.type === 'controller.pair.joined') {
        setConnected(true)
        setError(null)
        setPlayerTone(message.payload.playerTone)
        return
      }
      if (message.type === 'controller.pair.status' && !message.payload.connected) {
        setConnected(false)
        setError('게임 화면과 연결이 끊어졌어요.')
        return
      }
      if (message.type === 'error') setError(message.payload.message)
    })
    const unsubscribeConnection = client.onConnectionChange((event) => {
      if (event === 'open' || !active) return
      setConnected(false)
      if (reconnect !== undefined) return
      reconnect = window.setTimeout(() => {
        reconnect = undefined
        client.connect()
      }, RECONNECT_DELAY_MS)
    })
    client.connect()
    return () => {
      active = false
      window.clearInterval(heartbeat)
      window.clearTimeout(reconnect)
      try {
        client.send(buildClientMessage('controller.pair.leave', {}))
      } catch {
        // No-op after transport close.
      }
      unsubscribeMessage()
      unsubscribeConnection()
      client.disconnect()
      clientRef.current = null
    }
  }, [code])

  const send = (type: 'controller.ready' | 'controller.swing') => {
    if (!connected) return
    try {
      clientRef.current?.send(buildClientMessage(type, {}))
    } catch {
      setConnected(false)
      setError('연결을 다시 확인하고 있어요.')
    }
  }

  return {
    connected,
    error,
    playerTone,
    sendReady: () => send('controller.ready'),
    sendSwing: () => send('controller.swing'),
  }
}

export function phoneControllerUrl(code: string) {
  const url = new URL('/pingpong/controller', window.location.origin)
  url.searchParams.set('code', code)
  return url.toString()
}
