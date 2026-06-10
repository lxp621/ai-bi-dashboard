"use client";

import { CopilotKit } from "@copilotkit/react-core";
import DashboardClient from "./DashboardClient";
import { FINANCE_AGENT_NAME } from "./lib/agent-name";

export default function Home() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent={FINANCE_AGENT_NAME}
      enableInspector={process.env.NODE_ENV === "development"}
    >
      <DashboardClient />
    </CopilotKit>
  );
}