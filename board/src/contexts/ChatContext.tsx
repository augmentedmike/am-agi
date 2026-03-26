'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

type ChatContextValue = {
  showChat: boolean;
  chatUnread: boolean;
  openChat: () => void;
  closeChat: () => void;
  markRead: () => void;
  notifyUnread: () => void;
};

const ChatContext = createContext<ChatContextValue>({
  showChat: false,
  chatUnread: false,
  openChat: () => {},
  closeChat: () => {},
  markRead: () => {},
  notifyUnread: () => {},
});

export function useChat() {
  return useContext(ChatContext);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [showChat, setShowChat] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const showChatRef = useRef(showChat);

  // Restore open state from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try { if (localStorage.getItem('am:chat:open') === 'true') setShowChat(true); } catch {}
  }, []);

  useEffect(() => {
    showChatRef.current = showChat;
    try { localStorage.setItem('am:chat:open', String(showChat)); } catch {}
  }, [showChat]);

  // WS listener for chat unread indicator — runs regardless of panel open state
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4201';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (event: MessageEvent) => {
        try {
          const ev = JSON.parse(event.data);
          if ((ev.type === 'chat_message' || ev.type === 'chat_message_updated')
            && ev.message?.role === 'assistant'
            && ev.message?.status === 'done'
            && !showChatRef.current) {
            setChatUnread(true);
          }
        } catch {}
      };
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => { ws.close(); };
    }

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const openChat = useCallback(() => {
    setShowChat(true);
    setChatUnread(false);
  }, []);

  const closeChat = useCallback(() => setShowChat(false), []);
  const markRead = useCallback(() => setChatUnread(false), []);
  const notifyUnread = useCallback(() => { if (!showChatRef.current) setChatUnread(true); }, []);

  return (
    <ChatContext.Provider value={{ showChat, chatUnread, openChat, closeChat, markRead, notifyUnread }}>
      {children}
    </ChatContext.Provider>
  );
}
