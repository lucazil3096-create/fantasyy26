'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ref, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, ChatMessage } from '@/store/useStore';

// ── Helpers ──

function formatTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateLabel(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Group messages by date label, preserving order. */
function groupByDate(msgs: ChatMessage[]): { label: string; messages: ChatMessage[] }[] {
  const groups: { label: string; messages: ChatMessage[] }[] = [];
  let currentLabel = '';

  for (const msg of msgs) {
    const label = formatDateLabel(msg.timestamp);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

// ── Component ──

export default function ChatScreen() {
  const { messages, setUnreadCount, currentLeague, nickname, isAdmin } = useStore();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const adminNickname = currentLeague?.adminNickname ?? null;

  // ── Mark as read when screen is visible ──
  useEffect(() => {
    setUnreadCount(0);
  }, [messages, setUnreadCount]);

  // ── Track scroll position ──
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const threshold = 120;
    setIsNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  // ── Auto-scroll to bottom when new messages arrive (only if near bottom) ──
  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isNearBottom]);

  // ── Scroll to bottom on mount ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  // ── Send message ──
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !currentLeague || !nickname || sending) return;

    setSending(true);
    try {
      const chatRef = ref(db, `leagues/${currentLeague.id}/chat`);
      await push(chatRef, {
        from: nickname,
        text: trimmed,
        timestamp: serverTimestamp(),
      });
      setText('');
      // Scroll to bottom after sending
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  // ── Character count ──
  const charCount = text.length;
  const MAX_CHARS = 500;
  const isOverLimit = charCount > MAX_CHARS;

  // ── Pre-compute grouped messages ──
  const groups = groupByDate(messages);

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-white">Chat</h2>
        {currentLeague && (
          <span className="text-xs text-zinc-500 truncate max-w-[180px]">
            {currentLeague.name}
          </span>
        )}
      </div>

      {/* Messages Area */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto hide-scrollbar space-y-1 pb-2"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-zinc-600 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-zinc-500 text-sm">Nenhuma mensagem ainda.</p>
              <p className="text-zinc-600 text-xs mt-1">Seja o primeiro a mandar um oi!</p>
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              {/* Date Divider */}
              <div className="flex items-center justify-center py-3">
                <span className="text-zinc-500 text-[10px] bg-zinc-800/80 px-3 py-1 rounded-full font-medium">
                  {group.label}
                </span>
              </div>

              {/* Messages in group */}
              {group.messages.map((msg) => {
                const isMe = msg.from === nickname;
                const isSenderAdmin = msg.from === adminNickname;

                return (
                  <div key={msg.id} className="px-1 mb-1">
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Sender name (for other people's messages) */}
                        {!isMe && (
                          <div className="flex items-center gap-1.5 mb-0.5 ml-2">
                            <p className={`text-[10px] font-medium ${
                              isSenderAdmin ? 'text-amber-400' : 'text-zinc-400'
                            }`}>
                              {msg.from}
                            </p>
                            {isSenderAdmin && (
                              <span className="text-[8px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full leading-none">
                                ADMIN
                              </span>
                            )}
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          className={`px-3 py-2 rounded-2xl ${
                            isMe
                              ? isSenderAdmin || isAdmin
                                ? 'bg-amber-600 text-white rounded-br-md'
                                : 'bg-emerald-600 text-white rounded-br-md'
                              : isSenderAdmin
                                ? 'bg-zinc-800 border border-amber-500/30 text-white rounded-bl-md'
                                : 'bg-zinc-800 text-white rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                          <div className={`flex items-center gap-1 mt-0.5 ${
                            isMe ? 'justify-end' : 'justify-start'
                          }`}>
                            <p
                              className={`text-[9px] ${
                                isMe
                                  ? isSenderAdmin || isAdmin
                                    ? 'text-amber-200/70'
                                    : 'text-emerald-200/70'
                                  : 'text-zinc-500'
                              }`}
                            >
                              {formatTime(msg.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button (shown when not at bottom) */}
      {!isNearBottom && messages.length > 0 && (
        <div className="flex justify-center -mt-10 mb-2 relative z-10">
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full px-3 py-1.5 text-xs shadow-lg hover:bg-zinc-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Novas mensagens
          </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={sendMessage} className="flex gap-2 pt-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                setText(e.target.value);
              }
            }}
            placeholder="Digite uma mensagem..."
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors pr-14"
            maxLength={MAX_CHARS}
            disabled={!currentLeague}
          />
          {charCount > 0 && (
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ${
                isOverLimit ? 'text-red-400' : charCount > 400 ? 'text-amber-400' : 'text-zinc-600'
              }`}
            >
              {charCount}/{MAX_CHARS}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim() || sending || isOverLimit || !currentLeague}
          className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold rounded-xl transition-colors"
        >
          {sending ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
