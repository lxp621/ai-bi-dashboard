import {CopilotRuntime, GoogleGenerativeAIAdapter, copilotRuntimeNextJSAppRouterEndpoint} from "@copilotkit/runtime"

function getServiceAdapter() {
  return new GoogleGenerativeAIAdapter({
    apiKey: process.env.GOOGLE_API_KEY || "",
    model: "gemini-2.5-flash",
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