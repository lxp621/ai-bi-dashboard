import {CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint} from "@copilotkit/runtime"
import OpenAI from "openai"

// 延迟初始化：避免构建时因缺少 OPENAI_API_KEY 报错
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: "https://api.deepseek.com"
  })
}

function getServiceAdapter() {
  return new OpenAIAdapter({
    openai: getOpenAIClient(),
    model: "deepseek-v4-pro",
  })
}

const runtime = new CopilotRuntime()

const {handleRequest} = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  serviceAdapter: getServiceAdapter(),
  endpoint: "/api/copilotkit",
})

export async function POST(request: Request) {
  return handleRequest(request)
}