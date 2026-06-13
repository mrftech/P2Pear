import React, { useState, useEffect, useRef } from 'react';
import { WebRTCManager } from '../lib/webrtc';
import { getMessages, type ChatMessage } from '../lib/db';
import { Send, MessageSquare, ShieldCheck } from 'lucide-react';

interface ChatProps {
  rtcManager: WebRTCManager;
  refreshTrigger: number;
}

export const Chat: React.FC<ChatProps> = ({ rtcManager, refreshTrigger }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputStr, setInputStr] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    const msgs = await getMessages();
    setMessages(msgs);
  };

  useEffect(() => {
    loadMessages();
  }, [refreshTrigger]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputStr.trim()) return;
    try {
      await rtcManager.sendChat(inputStr.trim());
      setInputStr('');
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  return (
    <div className="chat-container glass-panel">
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <MessageSquare size={20} className="text-primary-400" />
          <h2>Chat</h2>
        </div>
        {rtcManager.roomId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <ShieldCheck size={14} />
            <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>{rtcManager.roomId}</span>
          </div>
        )}
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 mt-8">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.sender === 'me' ? 'me' : 'peer'}`}>
            <div className="chat-text">{msg.text}</div>
            <div className="chat-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          className="input flex-1"
          placeholder="Type a message..."
          value={inputStr}
          onChange={(e) => setInputStr(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!inputStr.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
