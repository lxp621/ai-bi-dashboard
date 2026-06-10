/**
 * 财务数据分析 Agent (TypeScript)
 *
 * 实现思路:
 * - 使用 LangGraph 的 `createAgent` 在内存里跑一个 ReAct 智能体(模型用 Gemini)
 * - 自定义类 `FinanceAgent` 继承 ag-ui 的 `AbstractAgent`,负责把 LangGraph 的
 *   一次推理结果转换成 ag-ui 协议事件流(`RUN_STARTED` → 若干 TEXT_MESSAGE / TOOL_CALL → `RUN_FINISHED`)
 * - CopilotKit 的 `CopilotRuntime` 通过 `agents` 字段把这个 agent 暴露给前端
 * - 前端 `<CopilotKit agent="finance_agent">` 即可锁定到该 agent
 *
 * 由于完整的流式增量协议较为复杂,这里采用"一次性快照"模式:
 * 等 graph 跑完后,把最终 AI 消息(可能含 tool_calls)整段发布出去。
 * 前端体验上是"想完再说",但工具调用、对话记忆都正常工作。
 */

import { Observable } from "rxjs";
import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { randomUUID } from "crypto";
import { FINANCE_AGENT_NAME } from "./agent-name";

export { FINANCE_AGENT_NAME };

/* -------------------------------------------------------------------------- */
/*                            Server-side tools                               */
/* -------------------------------------------------------------------------- */

/**
 * 与前端 CopilotAction 同名的"镜像工具":
 * - LangGraph 这一侧只是描述参数 schema 和给一个占位 handler
 * - 真正执行在前端 useCopilotAction(handler) 中
 */
const filterTransactionsTool = tool(
  async ({ category, city, minAmount }) =>
    `(client-side) 已请求按 category=${category ?? "*"}, city=${city ?? "*"}, minAmount=${minAmount ?? 0} 筛选`,
  {
    name: "filterTransactions",
    description: "根据类别、城市或最小金额筛选账单表格数据",
    schema: z.object({
      category: z.string().optional().describe("账单类别"),
      city: z.string().optional().describe("城市名称"),
      minAmount: z.number().optional().describe("最低金额门槛"),
    }),
  },
);

const resetFiltersTool = tool(
  async () => "(client-side) 已请求恢复全部数据",
  {
    name: "resetFilters",
    description: "清除所有筛选条件，恢复展示全部账单数据",
    schema: z.object({}),
  },
);

const switchChartTypeTool = tool(
  async ({ type }) => `(client-side) 已请求切换图表为 ${type}`,
  {
    name: "switchChartType",
    description: "切换看板图表的展现形式(bar 柱状图 / pie 饼图)",
    schema: z.object({ type: z.enum(["bar", "pie"]) }),
  },
);

const flagAnomalyTransactionTool = tool(
  async ({ transactionIds }) => `(client-side) 已请求标记 ${transactionIds.length} 条异常账单`,
  {
    name: "flagAnomalyTransaction",
    description: "对可疑的重复扣款或异常账单标记红圈警告",
    schema: z.object({
      transactionIds: z.array(z.string()).min(1).describe("异常账单 ID 数组"),
    }),
  },
);

const sendAnomalyEmailTool = tool(
  async ({ to, transactionIds }) =>
    `(client-side) 已请求发送 ${transactionIds.length} 条异常账单通知到 ${to}`,
  {
    name: "sendAnomalyEmail",
    description: "将检测到的异常账单列表以邮件形式发送给用户，需先通过 flagAnomalyTransaction 标记后再调用",
    schema: z.object({
      to: z.string().email().describe("收件人邮箱地址"),
      transactionIds: z.array(z.string()).min(1).describe("要通知的异常账单 ID 数组"),
    }),
  },
);

/* -------------------------------------------------------------------------- */
/*                                 LangGraph                                  */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `你是一名资深的财务数据分析专家,负责协助用户分析当前看板上的账单流水。

能力:
1. 阅读用户当前看板里的交易数据(由前端通过 CopilotReadable 提供);
2. 通过工具调用控制看板:
   - filterTransactions: 按类别/城市/最小金额筛选;
   - resetFilters: 清除所有筛选条件，恢复显示全部数据;
   - switchChartType: 切换柱状图 / 饼图;
   - flagAnomalyTransaction: 把可疑账单(如同一商户/同一天同金额的重复扣款)标记为异常;
   - sendAnomalyEmail: 将异常账单列表发邮件通知用户。

工作原则:
- 回答尽量简洁、专业、用中文;
- 用户需要看板操作时必须用工具,不要只用文字描述;
- 标记异常前,先在数据中识别出真正可疑的记录,然后一次性传入全部 ID;
- 用户要求发邮件时,先调用 flagAnomalyTransaction 标记异常,再调用 sendAnomalyEmail 发送通知,两步顺序执行。`;

function buildGraph() {
  console.log("[FinanceAgent] Initializing LangGraph agent with Gemini...");
  const llm = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY ?? "",
    model: "gemini-2.0-flash",
    temperature: 0,
  });
  // 使用 `langchain` 包导出的 `createAgent`(替代旧的 `createReactAgent`)
  // 返回的 ReactAgent 实例本身就提供 .invoke()/.stream(),无需再拿 .graph
  return createAgent({
    model: llm,
    tools: [resetFiltersTool, filterTransactionsTool, switchChartTypeTool, flagAnomalyTransactionTool, sendAnomalyEmailTool],
    checkpointer: new MemorySaver(),
    systemPrompt: SYSTEM_PROMPT,
  });
}

const agent = buildGraph();

/* -------------------------------------------------------------------------- */
/*                       AG-UI 协议下的 TS 自定义 Agent                       */
/* -------------------------------------------------------------------------- */

/**
 * 把 ag-ui 协议里的输入消息列表转成 LangChain BaseMessage[]
 */
function toLangChainMessages(input: RunAgentInput): BaseMessage[] {
  const result: BaseMessage[] = [];
  for (const m of input.messages ?? []) {
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
    switch (m.role) {
      case "user":
        result.push(new HumanMessage(text));
        break;
      case "assistant":
        result.push(new AIMessage(text));
        break;
      case "system":
      case "developer":
        result.push(new SystemMessage(text));
        break;
      // 其余 role(tool 等)按一般文本处理
      default:
        result.push(new HumanMessage(text));
    }
  }
  return result;
}

/**
 * 从 LangChain AIMessage.content 中提取纯文本字符串
 */
function extractText(content: AIMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c: { type?: string; text?: string }) => c.text ?? "")
      .join("");
  }
  return "";
}

/**
 * 财务分析 Agent
 *
 * 通过继承 ag-ui 的 `AbstractAgent`,使其可被 CopilotKit Runtime 注册和调度。
 *
 * 工作流程(使用 streamEvents 逐步 emit):
 *   RUN_STARTED
 *     → (LLM 决定调工具) TOOL_CALL_START / ARGS /END  × N
 *     → (LLM 给出最终文字) TEXT_MESSAGE_START / CONTENT / END
 *   RUN_FINISHED
 *
 * 这样前端 CopilotKit 会在 TOOL_CALL_END 后立刻执行对应的 useCopilotAction handler,
 * 实现 UI 的实时响应(筛选/切图表/标记异常)。
 */
export class FinanceAgent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const threadId = input.threadId ?? randomUUID();
      const runId    = input.runId    ?? randomUUID();

      console.log(`[FinanceAgent] run start threadId=${threadId} runId=${runId}`);

      // 通知前端 agent 开始执行
      subscriber.next({ type: EventType.RUN_STARTED, threadId, runId } as BaseEvent);

      (async () => {
        try {
          const messages = toLangChainMessages(input);

          // 用 streamEvents 逐步消费 LangGraph 内部的每一个事件,
          // 这样工具调用和文字输出都可以在发生时立刻转成 ag-ui 事件推给前端,
          // 而不是等 invoke() 全部跑完才一次性推
          const eventStream = agent.streamEvents(
            { messages },
            {
              version: "v2",
              configurable: { thread_id: threadId },
            },
          );

          // 用于追踪当前正在进行的文本消息 id,避免重复开启
          let currentTextMessageId: string | null = null;

          for await (const event of eventStream) {
            const { event: eventName, data } = event;

            // ── LLM 开始生成 ──────────────────────────────────────────────────
            if (eventName === "on_chat_model_start") {
              // 新的一段 AI 回复开始,先关闭上一段(如有)
              if (currentTextMessageId) {
                subscriber.next({
                  type: EventType.TEXT_MESSAGE_END,
                  messageId: currentTextMessageId,
                } as BaseEvent);
                currentTextMessageId = null;
              }
            }

            // ── LLM 流式输出 token ────────────────────────────────────────────
            if (eventName === "on_chat_model_stream") {
              const chunk = data?.chunk;
              // 忽略只含 tool_calls 的中间 chunk,只处理有文本内容的
              const token = extractText(chunk?.content ?? "");
              if (token) {
                if (!currentTextMessageId) {
                  // 第一个 token:开启文本消息
                  currentTextMessageId = randomUUID();
                  subscriber.next({
                    type: EventType.TEXT_MESSAGE_START,
                    messageId: currentTextMessageId,
                    role: "assistant",
                  } as BaseEvent);
                }
                subscriber.next({
                  type: EventType.TEXT_MESSAGE_CONTENT,
                  messageId: currentTextMessageId,
                  delta: token,
                } as BaseEvent);
              }
            }

            // ── 工具开始调用 ──────────────────────────────────────────────────
            if (eventName === "on_tool_start") {
              // 工具调用前,先关闭进行中的文本消息
              if (currentTextMessageId) {
                subscriber.next({
                  type: EventType.TEXT_MESSAGE_END,
                  messageId: currentTextMessageId,
                } as BaseEvent);
                currentTextMessageId = null;
              }
              // run_id 作为 toolCallId,LangGraph 每次工具调用都有唯一的 run_id
              const toolCallId   = event.run_id ?? randomUUID();
              const toolCallName = event.name ?? "";

              // data.input 在 LangChain on_tool_start 里可能已经是 JSON 字符串,
              // 也可能是对象——统一处理成对象再重新序列化,避免双重编码
              const rawInput = data?.input;
              let parsedArgs: Record<string, unknown> = {};
              if (typeof rawInput === "string") {
                try { parsedArgs = JSON.parse(rawInput); } catch { parsedArgs = { input: rawInput }; }
              } else if (rawInput && typeof rawInput === "object") {
                const obj = rawInput as Record<string, unknown>;
                const keys = Object.keys(obj);
                // LangChain on_tool_start 可能把参数包在 { input: '{"k":"v"}' } 里
                if (keys.length === 1 && keys[0] === "input" && typeof obj["input"] === "string") {
                  try { parsedArgs = JSON.parse(obj["input"] as string); } catch { parsedArgs = obj; }
                } else {
                  parsedArgs = obj;
                }
              }
              const argsStr = JSON.stringify(parsedArgs);

              subscriber.next({
                type: EventType.TOOL_CALL_START,
                toolCallId,
                toolCallName,
              } as BaseEvent);
              subscriber.next({
                type: EventType.TOOL_CALL_ARGS,
                toolCallId,
                delta: argsStr,
              } as BaseEvent);
              subscriber.next({
                type: EventType.TOOL_CALL_END,
                toolCallId,
              } as BaseEvent);
              // TOOL_CALL_END 之后,前端 CopilotKit 会立刻执行
              // 对应的 useCopilotAction handler,更新 UI(筛选/切图表/标记)
            }
          }

          // 流结束:关闭最后一段文本消息(如有)
          if (currentTextMessageId) {
            subscriber.next({
              type: EventType.TEXT_MESSAGE_END,
              messageId: currentTextMessageId,
            } as BaseEvent);
          }

          // 通知前端 agent 执行完毕
          subscriber.next({ type: EventType.RUN_FINISHED, threadId, runId } as BaseEvent);
          subscriber.complete();

        } catch (err) {
          console.error("[FinanceAgent] error:", err);
          subscriber.next({
            type: EventType.RUN_ERROR,
            message: err instanceof Error ? err.message : String(err),
          } as BaseEvent);
          subscriber.error(err);
        }
      })();
    });
  }
}

/** 单例 agent 实例 */
// 模块加载时实例化一次,后续所有请求共用同一个 FinanceAgent 实例
// (内部 LangGraph 的 MemorySaver 已经按 thread_id 隔离了不同会话的状态)
export const financeAgent = new FinanceAgent({
  // agentId 用于在 CopilotKit Runtime 的 agents 字典里被检索,
  // 必须与前端 <CopilotKit agent={FINANCE_AGENT_NAME}> 的取值保持一致
  agentId: FINANCE_AGENT_NAME,
  // description 提供给 ag-ui 协议消费方做展示/选择(目前主要用于多 agent 场景)
  description: "财务数据分析 Agent — 帮助用户在 BI 看板里筛选、可视化与异常标记",
});