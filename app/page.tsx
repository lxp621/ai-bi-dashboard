"use client";

import { CopilotKit } from "@copilotkit/react-core";
import DashboardClient from "./DashboardClient";

export default function Home() {
  return (
    // 用回标准的 runtimeUrl 属性
    <CopilotKit runtimeUrl="/api/copilotkit"> 
      <DashboardClient />
    </CopilotKit>
  );
}