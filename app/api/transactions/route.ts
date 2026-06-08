import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  TRANSACTIONS_TABLE,
  TransactionRow,
} from "@/app/lib/db";

/**
 * GET /api/transactions
 * 返回全部交易流水(按 date 升序)
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(TRANSACTIONS_TABLE)
      .select("id, date, amount, category, city, merchant, is_anomaly")
      .order("date", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as TransactionRow[];
    const transactions = rows.map((row) => ({
      id: row.id,
      date: String(row.date).slice(0, 10),
      amount: Number(row.amount),
      category: row.category,
      city: row.city,
      merchant: row.merchant,
      isAnomaly: Boolean(row.is_anomaly),
    }));

    return NextResponse.json({ data: transactions });
  } catch (error) {
    console.error("查询 Supabase 失败:", error);
    return NextResponse.json(
      { error: "获取交易数据失败" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/transactions
 * Body: { transactionIds: string[]; isAnomaly: boolean }
 * 批量更新异常标记
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { transactionIds, isAnomaly } = body as {
      transactionIds: string[];
      isAnomaly: boolean;
    };

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: "transactionIds 必须是非空数组" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from(TRANSACTIONS_TABLE)
      .update({ is_anomaly: Boolean(isAnomaly) })
      .in("id", transactionIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新异常标记失败:", error);
    return NextResponse.json(
      { error: "更新异常标记失败" },
      { status: 500 }
    );
  }
}