import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export interface AnomalyEmailPayload {
  to: string;
  anomalies: {
    id: string;
    date: string;
    amount: number;
    category: string;
    city: string;
    merchant: string;
  }[];
}

function buildHtml(anomalies: AnomalyEmailPayload["anomalies"]): string {
  const rows = anomalies
    .map(
      (t) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${t.date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${t.merchant}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${t.category}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${t.city}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#dc2626">¥${t.amount}</td>
      </tr>`,
    )
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1e293b">
      <h2 style="color:#dc2626">⚠️ 账单异常提醒</h2>
      <p>AI 财务助手检测到以下 <strong>${anomalies.length} 条</strong>可疑账单，请核查：</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f8fafc;color:#64748b">
            <th style="padding:8px 12px;text-align:left">日期</th>
            <th style="padding:8px 12px;text-align:left">商户</th>
            <th style="padding:8px 12px;text-align:left">类别</th>
            <th style="padding:8px 12px;text-align:left">城市</th>
            <th style="padding:8px 12px;text-align:right">金额</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">此邮件由 AI 智能数据看板自动发送，请勿直接回复。</p>
    </div>`;
}

/**
 * POST /api/send-email
 * Body: AnomalyEmailPayload
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnomalyEmailPayload;
    const { to, anomalies } = body;

    if (!to || !anomalies?.length) {
      return NextResponse.json(
        { error: "to 和 anomalies 不能为空" },
        { status: 400 },
      );
    }

    const { data, error } = await resend.emails.send({
      from: "AI看板 <onboarding@resend.dev>",
      to,
      subject: `⚠️ 检测到 ${anomalies.length} 条异常账单`,
      html: buildHtml(anomalies),
    });

    if (error) {
      console.error("[send-email] Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("[send-email] 未知错误:", err);
    return NextResponse.json({ error: "发送失败" }, { status: 500 });
  }
}