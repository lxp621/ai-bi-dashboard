import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 服务端客户端
 * - 仅在 Next.js Server Components / Route Handlers 中使用
 * - 当前使用 Publishable Key(等同于 anon key),受 RLS 策略约束
 * - 如需绕过 RLS 做后台运维,请改用 SERVICE_ROLE_KEY 并放入服务端专用环境变量
 */

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !apiKey) {
    throw new Error(
      "缺少 Supabase 配置: 请在 .env.local 中设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  supabaseAdmin = createClient(url, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdmin;
}

/**
 * 数据库表行的强类型定义
 */
export interface TransactionRow {
  id: string;
  date: string;
  amount: number | string; // PG NUMERIC 在 supabase-js 中可能返回 string
  category: string;
  city: string;
  merchant: string;
  is_anomaly: boolean;
  created_at?: string;
}

/**
 * 表名常量,避免硬编码
 */
export const TRANSACTIONS_TABLE = "transactions";