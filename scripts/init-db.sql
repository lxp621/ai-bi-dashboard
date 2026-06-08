-- ============================================================
-- Supabase / PostgreSQL 初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

-- 1. 创建交易流水表
CREATE TABLE IF NOT EXISTS public.transactions (
  id          TEXT          PRIMARY KEY,
  date        DATE          NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  category    TEXT          NOT NULL,
  city        TEXT          NOT NULL,
  merchant    TEXT          NOT NULL,
  is_anomaly  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. 常用查询索引
CREATE INDEX IF NOT EXISTS idx_transactions_date     ON public.transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_city     ON public.transactions (city);

-- 3. 插入初始 Mock 数据(幂等)
INSERT INTO public.transactions (id, date, amount, category, city, merchant, is_anomaly) VALUES
  ('1', '2026-05-10', 1200.00, '电子产品', '北京',  'Apple Store',  FALSE),
ON CONFLICT (id) DO UPDATE SET
  date       = EXCLUDED.date,
  amount     = EXCLUDED.amount,
  category   = EXCLUDED.category,
  city       = EXCLUDED.city,
  merchant   = EXCLUDED.merchant,
  is_anomaly = EXCLUDED.is_anomaly;

-- 4. 启用行级安全(RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 读策略:所有人可读
CREATE POLICY "transactions_read_all"
  ON public.transactions
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- 写策略:允许通过 publishable/anon key 更新 is_anomaly 字段
-- 注意:生产环境建议改用 SERVICE_ROLE_KEY 并删除此策略
CREATE POLICY "transactions_update_anomaly"
  ON public.transactions
  FOR UPDATE
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);
