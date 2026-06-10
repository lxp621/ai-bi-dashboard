/**
 * Agent 名字常量(client + server 共用)
 *
 * 单独抽出来避免把服务端 agent 实现(LangGraph / Node crypto)
 * 通过 `page.tsx` 的 `"use client"` 入口被错误地打进客户端 bundle。
 */
export const FINANCE_AGENT_NAME = "finance_agent";