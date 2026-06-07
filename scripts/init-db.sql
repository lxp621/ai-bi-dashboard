-- 创建数据库
CREATE DATABASE IF NOT EXISTS ai_bi_dashboard
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE ai_bi_dashboard;

-- 创建交易流水表
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  city VARCHAR(50) NOT NULL,
  merchant VARCHAR(100) NOT NULL,
  is_anomaly TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入初始 Mock 数据
INSERT INTO transactions (id, date, amount, category, city, merchant, is_anomaly) VALUES
  ('1', '2026-05-10', 1200.00, '电子产品', '北京', 'Apple Store', 0),
  ('2', '2026-05-12', 85.00, '餐饮', '上海', '星巴克', 0),
  ('3', '2026-05-15', 650.00, '服装', '上海', 'ZARA', 0),
  ('4', '2026-05-20', 199.00, 'SaaS订阅', '北京', 'Adobe Cloud', 0),
  ('5', '2026-05-20', 199.00, 'SaaS订阅', '北京', 'Adobe Cloud', 0),
  ('6', '2026-05-22', 45.00, '交通', '深圳', '滴滴出行', 0),
  ('7', '2026-05-25', 800.00, '服装', '北京', 'mayi', 0),
  ('8', '2026-05-28', 55.00, '餐饮', '广州', '麦当劳', 0)
ON DUPLICATE KEY UPDATE
  amount = VALUES(amount),
  category = VALUES(category),
  city = VALUES(city),
  merchant = VALUES(merchant);