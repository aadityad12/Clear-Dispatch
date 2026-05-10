import { useEffect, useRef, useCallback } from 'react'
import { WsMessage } from '../types'

export function useWebSocket(
  onMessage: (msg: WsMessage) => void,
  onConnect: () => void,
  onDisconnect: () => void,
): void {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    const url = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => onConnect()
    ws.onclose = () => {
      onDisconnect()
      reconnectTimeout.current = setTimeout(connect, 3000)
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage
        onMessage(msg)
      } catch {
        // silently ignore malformed messages
      }
    }
  }, [onMessage, onConnect, onDisconnect])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeout.current)
      wsRef.current?.close()
    }
  }, [connect])
}
