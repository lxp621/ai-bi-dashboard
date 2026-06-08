import { NextRequest, NextResponse } from "next/server";

/**
 * 兼容 CopilotKit SDK 对 /api/copilotkit 下子路径(如 /threads、/agents)的探测请求
 *
 * 背景:
 * - 当前项目未启用 CoAgents(LangGraph) 模式
 * - 但 SDK 仍会主动 GET /api/copilotkit/threads?agentId=default 等接口
 * - 不兜底会触发 404,兜底返回错误结构又会触发前端 "threads is not iterable" 错误
 * - 这里根据具体子路径返回 SDK 期望的最小数据结构
 *
 * 后续若接入 LangGraph CoAgents,删除此文件并改用官方实现替换
 */

function buildEmptyBody(slug: string[]): unknown {
  const last = (slug[slug.length - 1] || "").toLowerCase();
  switch (last) {
    case "threads":
      // SDK 期望 { threads: [...] },内部会做 for...of 迭代
      return { threads: [] };
    case "agents":
      return { agents: [] };
    case "messages":
      return { messages: [] };
    default:
      return {};
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  return NextResponse.json(buildEmptyBody(slug));
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  return NextResponse.json(buildEmptyBody(slug));
}

export async function PUT() {
  return NextResponse.json({});
}

export async function DELETE() {
  return NextResponse.json({});
}