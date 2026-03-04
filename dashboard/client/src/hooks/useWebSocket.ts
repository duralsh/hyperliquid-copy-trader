import { useEffect, useRef, useCallback, useState } from "react";
import type { BotStatus, BotTradeEvent, DockerLogEntry } from "../../../shared/types.js";

const WS_RECONNECT_MS = 3_000;
const MAX_TRADE_EVENTS = 100;
const MAX_DOCKER_LOGS = 500;

interface WsMessage {
  event: string;
  data: unknown;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [connected, setConnected] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [trades, setTrades] = useState<BotTradeEvent[]>([]);
  const [dockerLogs, setDockerLogs] = useState<DockerLogEntry[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = localStorage.getItem("hl-auth-token");
    const wsUrl = `${protocol}//${window.location.host}/ws${token ? `?token=${token}` : ""}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsMessage;
        if (msg.event === "bot:status") {
          setBotStatus(msg.data as BotStatus);
          setIsSwitching(false);
        } else if (msg.event === "bot:switching") {
          setIsSwitching(true);
        } else if (msg.event === "bot:trade") {
          setTrades((prev) => [...prev, msg.data as BotTradeEvent].slice(-MAX_TRADE_EVENTS));
        } else if (msg.event === "bot:error") {
          setTrades((prev) => [...prev, msg.data as BotTradeEvent].slice(-MAX_TRADE_EVENTS));
        } else if (msg.event === "docker:log") {
          setDockerLogs((prev) => [...prev, msg.data as DockerLogEntry].slice(-MAX_DOCKER_LOGS));
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, WS_RECONNECT_MS);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, botStatus, trades, dockerLogs, isSwitching };
}
