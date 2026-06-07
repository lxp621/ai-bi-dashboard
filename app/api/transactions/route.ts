import { NextResponse } from "next/server";
import { query, RowDataPacket } from "@/app/lib/db";

export interface TransactionRow extends RowDataPacket {
  id: string;
  date: string;
  amount: number;
  category: string;
  city: string;
  merchant: string;
  is_anomaly: number;
}

export async function GET() {
  try {
    const rows = await query<TransactionRow[]>(
      "SELECT id, date, amount, category, city, merchant, is_anomaly FROM transactions ORDER BY date ASC"
    );

    // 将数据库字段映射为前端 Transaction 接口格式
    const data = rows.map((row) => ({
      id: row.id,
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
      amount: Number(row.amount),
      category: row.category,
      city: row.city,
      merchant: row.merchant,
      isAnomaly: row.is_anomaly === 1,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("查询数据库失败:", error);
    return NextResponse.json(
      { error: "获取交易数据失败" },
      { status: 500 }
    );
  }
}

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

    const placeholders = transactionIds.map(() => "?").join(",");
    await query(
      `UPDATE transactions SET is_anomaly = ? WHERE id IN (${placeholders})`,
      [isAnomaly ? 1 : 0, ...transactionIds]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新异常标记失败:", error);
    return NextResponse.json(
      { error: "更新异常标记失败" },
      { status: 500 }
    );
  }
}