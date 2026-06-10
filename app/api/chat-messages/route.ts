import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/db";

const TABLE = "chat_messages";

/**
 * GET /api/chat-messages?threadId=xxx
 * 按 thread_id 查询历史消息，按 created_at 升序排列
 */
export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json({ error: "threadId is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, role, content, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ messages: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export interface ChatMessagePayload {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "tool";
  content: string;
}

/**
 * POST /api/chat-messages
 * 批量写入消息（body: { messages: ChatMessagePayload[] }）
 * 支持单条或多条，使用 upsert 保证幂等
 */
export async function POST(req: NextRequest) {
  let body: { messages: ChatMessagePayload[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const rows = messages.map((m) => ({
    id: m.id,
    thread_id: m.threadId,
    role: m.role,
    content: m.content ?? "",
  }));

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from(TABLE)
      .upsert(rows, { onConflict: "id" });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}