"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCopilotMessagesContext } from "@copilotkit/react-core";
import { MessageStatusCode, Role, TextMessage } from "@copilotkit/runtime-client-gql";

/**
 * usePersistedMessages
 *
 * 职责：
 * 1. 页面挂载时从 Supabase 拉取历史消息并回填到 CopilotKit 上下文
 * 2. 监听 CopilotKit 消息列表变化，将新增消息持久化到 Supabase
 *
 * @param threadId 会话 ID，相同 ID 的消息属于同一会话，刷新后复原
 */
export function usePersistedMessages(threadId: string) {
  const { messages, setMessages } = useCopilotMessagesContext();
  const [loaded, setLoaded] = useState(false);
  // 记录已持久化的消息 id 集合，避免重复写入
  const persistedIds = useRef<Set<string>>(new Set());

  // ── 1. 初始化：从 Supabase 加载历史消息 ──────────────────────────────────
  useEffect(() => {
    if (!threadId) return;

    async function loadHistory() {
      try {
        const res = await fetch(`/api/chat-messages?threadId=${encodeURIComponent(threadId)}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          messages: { id: string; role: string; content: string }[];
        };

        const history = json.messages ?? [];
        if (history.length === 0) {
          setLoaded(true);
          return;
        }

        // 将历史消息转换为 CopilotKit TextMessage 格式并注入
        const copilotMessages = history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => {
            persistedIds.current.add(m.id);
            return new TextMessage({
              id: m.id,
              role: m.role === "user" ? Role.User : Role.Assistant,
              content: m.content,
              status: { code: MessageStatusCode.Success },
            });
          });

        // 只在有历史记录时回填，避免覆盖 CopilotKit 已有的初始消息
        setMessages(copilotMessages);
      } catch (e) {
        console.error("[usePersistedMessages] 加载历史消息失败:", e);
      } finally {
        setLoaded(true);
      }
    }

    loadHistory();
    // 仅在 threadId 变更时重新加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // ── 2. 监听新消息并持久化 ─────────────────────────────────────────────────
  const persistNewMessages = useCallback(async () => {
    if (!loaded || !threadId) return;

    const newMessages = messages.filter(
      (m): m is TextMessage =>
        m instanceof TextMessage &&
        (m.role === Role.User || m.role === Role.Assistant) &&
        !persistedIds.current.has(m.id)
    );

    if (newMessages.length === 0) return;

    const payload = newMessages.map((m) => ({
      id: m.id,
      threadId,
      role: m.role === Role.User ? ("user" as const) : ("assistant" as const),
      content: typeof m.content === "string" ? m.content : "",
    }));

    try {
      const res = await fetch("/api/chat-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      if (res.ok) {
        newMessages.forEach((m) => persistedIds.current.add(m.id));
      }
    } catch (e) {
      console.error("[usePersistedMessages] 持久化消息失败:", e);
    }
  }, [messages, loaded, threadId]);

  useEffect(() => {
    persistNewMessages();
  }, [persistNewMessages]);

  return { loaded };
}