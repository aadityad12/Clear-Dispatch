import { useEffect, useRef } from 'react'
import { WsMessage } from '../types'

export function useWebSocket(
  onMessage: (msg: WsMessage) => void,
  onConnect: () => void,
  onDisconnect: () => void,
): void {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    // Each effect invocation gets its own isCancelled — when cleanup sets it
    // true, the old socket's async onclose skips scheduling a new connection.
    // Without this, React StrictMode's mount→cleanup→remount cycle leaves a
    // ghost reconnect timer that opens a second connection, causing every WS
    // broadcast to be dispatched twice.
    let isCancelled = false

    function connect() {
      if (isCancelled) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const url = `${protocol}//${window.location.host}/ws`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => onConnect()
      ws.onclose = () => {
        onDisconnect()
        if (!isCancelled) {
          reconnectTimeout.current = setTimeout(connect, 3000)
        }
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage
          onMessage(msg)
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()

    return () => {
      isCancelled = true
      clearTimeout(reconnectTimeout.current)
      wsRef.current?.close()
    }
  }, [onMessage, onConnect, onDisconnect])
}
