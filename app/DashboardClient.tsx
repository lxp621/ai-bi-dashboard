"use client"; // 严格声明客户端边界

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useCopilotReadable, useCopilotAction } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie } from "recharts";
import { Transaction } from "./dashboard/mockData";

export default function DashboardClient() {
  const [data, setData] = useState<Transaction[]>([]);
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [filters, setFilters] = useState({ category: "", city: "", minAmount: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 从后端拉取交易数据
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/transactions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: Transaction[] };
      setData(json.data ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      console.error("加载交易数据失败:", e);
      setError(`加载数据失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Readable 绑定
  useCopilotReadable({ description: "当前展示的财务流水数据列表", value: data });
  useCopilotReadable({ description: "当前的表格筛选条件", value: filters });

  // Action 绑定
  useCopilotAction({
    name: "filterTransactions",
    description: "根据类别、城市或最小金额筛选账单表格数据",
    parameters: [
      { name: "category", type: "string", description: "账单类别", required: false },
      { name: "city", type: "string", description: "城市名称", required: false },
      { name: "minAmount", type: "number", description: "最低金额门槛", required: false },
    ],
    handler: async ({ category, city, minAmount }) => {
      setFilters({ category: category || "", city: city || "", minAmount: minAmount || 0 });
      return `已成功为您筛选数据。`;
    },
  });

  useCopilotAction({
    name: "switchChartType",
    description: "切换看板图表的展现形式",
    parameters: [{ name: "type", type: "string", description: "图表类型 'bar' 或 'pie'", required: true }],
    handler: async ({ type }) => {
      if (type === "bar" || type === "pie") setChartType(type);
      return `图表已切换。`;
    },
  });

  useCopilotAction({
    name: "flagAnomalyTransaction",
    description: "对可疑的重复扣款或异常账单标记红圈警告",
    parameters: [{ name: "transactionIds", type: "string[]", description: "异常账单ID数组", required: true }],
    handler: async ({ transactionIds }) => {
      try {
        const res = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionIds, isAnomaly: true }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}`);
        }
        // 后端写入成功后再更新本地状态,保持数据一致性
        setData((prev) =>
          prev.map((item) => (transactionIds.includes(item.id) ? { ...item, isAnomaly: true } : item))
        );
        return `成功标记 ${transactionIds.length} 条异常账单。`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "未知错误";
        console.error("标记异常失败:", e);
        return `标记异常失败: ${msg}`;
      }
    },
  });

  // 数据计算
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchCategory = filters.category ? item.category === filters.category : true;
      const matchCity = filters.city ? item.city === filters.city : true;
      return matchCategory && matchCity && item.amount >= filters.minAmount;
    });
  }, [data, filters]);

  const chartData = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredData.forEach((item) => { agg[item.category] = (agg[item.category] || 0) + item.amount; });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  return (
    <CopilotSidebar
      instructions="你是一个资深的财务数据分析专家。"
      defaultOpen={true}
      clickOutsideToClose={false}
    >
      <div className="flex h-screen w-screen bg-slate-50 text-slate-800 p-6 overflow-y-auto flex-col space-y-6">
        <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">AI 智能数据看板</h1>
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "刷新中..." : "刷新数据"}
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 图表区域 */}
        <div className="bg-white p-5 rounded-xl shadow-sm h-72">
          {loading && data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">加载中...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4f46e5" />
                </BarChart>
              ) : (
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} fill="#8884d8" label />
                  <Tooltip />
                </PieChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* 表格区域 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-medium border-b">
                <th className="p-3 pl-5">商户</th>
                <th className="p-3">类别</th>
                <th className="p-3">城市</th>
                <th className="p-3 text-right pr-5">金额</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">暂无数据</td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className={`border-b hover:bg-indigo-50/20 ${item.isAnomaly ? "bg-red-50" : ""}`}>
                    <td className="p-3 pl-5 font-medium flex items-center gap-2">
                      {item.merchant}
                      {item.isAnomaly && <span className="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded">重复扣款嫌疑</span>}
                    </td>
                    <td className="p-3">{item.category}</td>
                  <td className="p-3">{item.city}</td>
                    <td className="p-3 text-right pr-5 font-semibold">¥{item.amount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CopilotSidebar>
  );
}