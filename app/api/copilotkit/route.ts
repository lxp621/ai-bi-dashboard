import {CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint} from "@copilotkit/runtime"
import OpenAI from "openai"

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.deepseek.com"
})

const serviceAdapter = new OpenAIAdapter({openai,
  model: "deepseek-v4-pro",
})

const runtime = new CopilotRuntime()

const {handleRequest} = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  serviceAdapter,
  endpoint: "/api/copilotkit",
})

export async function POST(request: Request) {
  console.log("👉 CopilotKit 收到前端请求了！");
  return handleRequest(request)
}