import {
  CopilotRuntime,
  GoogleGenerativeAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { FINANCE_AGENT_NAME, financeAgent } from "@/app/lib/agent";

/**
 * CopilotKit Runtime
 * - `serviceAdapter` 仍保留为 Gemini,用于"非 agent 模式"下的回退
 * - `agents` 注册了一个 TS 自定义 Agent (FinanceAgent),
 *   前端 `<CopilotKit agent="finance_agent">` 即可锁定使用它
 */

function getServiceAdapter() {
  return new GoogleGenerativeAIAdapter({
    apiKey: process.env.GOOGLE_API_KEY || "",
    model: "gemini-2.0-flash",
  });
}

const runtime = new CopilotRuntime({
  agents: {
    [FINANCE_AGENT_NAME]: financeAgent,
  },
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  serviceAdapter: getServiceAdapter(),
  endpoint: "/api/copilotkit",
});

export async function POST(request: Request) {
  return handleRequest(request);
}