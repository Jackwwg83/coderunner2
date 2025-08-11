import { useEffect, useRef, useState } from 'react'

interface UseWebSocketOptions {
  url?: string
  protocols?: string | string[]
  reconnectAttempts?: number
  reconnectInterval?: number
  onOpen?: (event: Event) => void
  onMessage?: (event: MessageEvent) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
}

interface WebSocketHook {
  socket: WebSocket | null
  isConnected: boolean
  error: string | null
  send: (data: string | object) => void
  subscribe: (topic: string, callback: (data: any) => void) => void
  unsubscribe: (topic: string) => void
  close: () => void
  reconnect: () => void
}

const DEFAULT_OPTIONS: Required<Omit<UseWebSocketOptions, 'url' | 'protocols' | 'onOpen' | 'onMessage' | 'onClose' | 'onError'>> = {
  reconnectAttempts: 3,
  reconnectInterval: 3000,
}

export const useWebSocket = (
  url?: string, 
  options: UseWebSocketOptions = {}
): WebSocketHook => {
  const {
    protocols,
    reconnectAttempts = DEFAULT_OPTIONS.reconnectAttempts,
    reconnectInterval = DEFAULT_OPTIONS.reconnectInterval,
    onOpen,
    onMessage,
    onClose,
    onError
  } = options

  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttemptsRef = useRef(0)
  const subscriptionsRef = useRef<Map<string, (data: any) => void>>(new Map())
  const shouldConnectRef = useRef(false)

  // Default WebSocket URL
  const wsUrl = url || `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:8080'}/api/websocket`

  const connect = () => {
    if (socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const ws = new WebSocket(wsUrl, protocols)

      ws.onopen = (event) => {
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
        
        // Re-subscribe to all topics
        subscriptionsRef.current.forEach((callback, topic) => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            topic
          }))
        })

        onOpen?.(event)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle subscription messages
          if (data.topic) {
            const callback = subscriptionsRef.current.get(data.topic)
            if (callback) {
              callback(data)
            }
          }

          onMessage?.(event)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        setIsConnected(false)
        setSocket(null)
        
        onClose?.(event)

        // Auto-reconnect if connection was not closed intentionally
        if (shouldConnectRef.current && reconnectAttemptsRef.current < reconnectAttempts && !event.wasClean) {
          reconnectAttemptsRef.current += 1
          setError(`Connection lost. Reconnecting... (${reconnectAttemptsRef.current}/${reconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        } else if (reconnectAttemptsRef.current >= reconnectAttempts) {
          setError('Failed to reconnect after maximum attempts')
        }
      }

      ws.onerror = (event) => {
        setError('WebSocket connection error')
        onError?.(event)
      }

      setSocket(ws)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to connect')
    }
  }

  const disconnect = () => {
    shouldConnectRef.current = false
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (socket) {
      socket.close(1000, 'Component unmounting')
    }
  }

  const reconnect = () => {
    disconnect()
    shouldConnectRef.current = true
    reconnectAttemptsRef.current = 0
    connect()
  }

  const send = (data: string | object) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      socket.send(message)
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  const subscribe = (topic: string, callback: (data: any) => void) => {
    subscriptionsRef.current.set(topic, callback)
    
    if (socket?.readyState === WebSocket.OPEN) {
      send({
        type: 'subscribe',
        topic
      })
    }
  }

  const unsubscribe = (topic: string) => {
    subscriptionsRef.current.delete(topic)
    
    if (socket?.readyState === WebSocket.OPEN) {
      send({
        type: 'unsubscribe',
        topic
      })
    }
  }

  // Connect on mount if URL is provided
  useEffect(() => {
    if (url) {
      shouldConnectRef.current = true
      connect()
    }

    return () => {
      disconnect()
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  return {
    socket,
    isConnected,
    error,
    send,
    subscribe,
    unsubscribe,
    close: disconnect,
    reconnect
  }
}

export default useWebSocket