"use client";

import { CopilotKit } from "@copilotkit/react-core";
import DashboardClient from "./DashboardClient";

export default function Home() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      enableInspector={process.env.NODE_ENV === "development"}
    >
      <DashboardClient />
    </CopilotKit>
  );
}