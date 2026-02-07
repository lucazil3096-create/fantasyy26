'use client';

import { useEffect, useState, useRef } from 'react';
import { ref, onValue, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, ChatMessage } from '@/store/useStore';

export default function ChatScreen() {
  const { user, messages, setMessages, setUnreadCount } = useStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Listen to messages
  useEffect(() => {
    const chatRef = ref(db, 'chat');
    const unsub = onValue(chatRef, (snap) => {
      const data = snap.val();
      if (!data) { setMessages([]); return; }
      const msgs: ChatMessage[] = Object.entries(data).map(([id, val]) => ({
        ...(val as ChatMessage),
        id,
      }));
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(msgs);
      setUnreadCount(0);
    });
    return () => unsub();
  }, [setMessages, setUnreadCount]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user || sending) return;
    setSending(true);
    try {
      await push(ref(db, 'chat'), {
        from: user.nickname,
        text: text.trim(),
        timestamp: serverTimestamp(),
      });
      setText('');
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts: number) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(ts: number) {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // Group messages by date
  let lastDate = '';

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)]">
      <h2 className="text-xl font-bold text-white mb-3">Chat</h2>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-1 pb-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 text-sm">Nenhuma mensagem ainda. Diga oi!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.from === user?.nickname;
            const dateStr = formatDate(msg.timestamp);
            let showDate = false;
            if (dateStr !== lastDate) {
              showDate = true;
              lastDate = dateStr;
            }

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="text-center py-2">
                    <span className="text-zinc-600 text-[10px] bg-zinc-800 px-3 py-1 rounded-full">{dateStr}</span>
                  </div>
                )}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${isMe ? 'order-2' : 'order-1'}`}>
                    {!isMe && (
                      <p className="text-zinc-500 text-[10px] mb-0.5 ml-2">{msg.from}</p>
                    )}
                    <div className={`px-3 py-2 rounded-2xl ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-zinc-800 text-white rounded-bl-md'
                    }`}>
                      <p className="text-sm break-words">{msg.text}</p>
                      <p className={`text-[9px] mt-0.5 ${isMe ? 'text-emerald-200' : 'text-zinc-500'}`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 pt-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite uma mensagem..."
          className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 text-white font-bold rounded-xl transition-colors"
        >
          {sending ? '...' : '>'}
        </button>
      </form>
    </div>
  );
}
