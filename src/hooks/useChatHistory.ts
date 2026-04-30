import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '../services/crfService';

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'crf_chat_history';
const MAX_STORED = 50;

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  const t = first.content.trim();
  return t.length > 58 ? t.slice(0, 58) + '…' : t;
}

function load(): Conversation[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function persist(list: Conversation[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_STORED))); }
  catch {}
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>(load);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const currentMessages = conversations.find(c => c.id === activeId)?.messages ?? [];

  const updateMessages = useCallback((messages: ChatMessage[]) => {
    if (!messages.length) return;
    const id = activeIdRef.current;
    setConversations(prev => {
      if (id && prev.some(c => c.id === id)) {
        const next = prev.map(c =>
          c.id === id
            ? { ...c, messages, title: titleFrom(messages), updatedAt: Date.now() }
            : c
        );
        persist(next);
        return next;
      }
      const newConv: Conversation = {
        id: uid(),
        title: titleFrom(messages),
        messages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      activeIdRef.current = newConv.id;
      setActiveId(newConv.id);
      const next = [newConv, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const startNew = useCallback(() => setActive(null), [setActive]);

  const selectConversation = useCallback((id: string) => setActive(id), [setActive]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      persist(next);
      return next;
    });
    setActiveId(prev => {
      const next = prev === id ? null : prev;
      activeIdRef.current = next;
      return next;
    });
  }, []);

  return {
    conversations,
    activeId,
    currentMessages,
    updateMessages,
    startNew,
    selectConversation,
    deleteConversation,
  };
}
