export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  city: string;
  merchant: string;
  isAnomaly?: boolean;
}

export const MOCK_DATA: Transaction[] = [
  { id: "1", date: "2026-05-10", amount: 1200, category: "电子产品", city: "北京", merchant: "Apple Store" },
  { id: "2", date: "2026-05-12", amount: 85, category: "餐饮", city: "上海", merchant: "星巴克" },
  { id: "3", date: "2026-05-15", amount: 650, category: "服装", city: "上海", merchant: "ZARA" },
  { id: "4", date: "2026-05-20", amount: 199, category: "SaaS订阅", city: "北京", merchant: "Adobe Cloud" },
  { id: "5", date: "2026-05-20", amount: 199, category: "SaaS订阅", city: "北京", merchant: "Adobe Cloud" }, // 故意制造的重复扣款异常
  { id: "6", date: "2026-05-22", amount: 45, category: "交通", city: "深圳", merchant: "滴滴出行" },
  { id: "7", date: "2026-05-25", amount: 800, category: "服装", city: "北京", merchant: " mayi " },
  { id: "8", date: "2026-05-28", amount: 55, category: "餐饮", city: "广州", merchant: "麦当劳" },
];