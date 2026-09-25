import type { ReactNode } from "react";
import { Container } from "@/shared/ui/Container";
import { SettingsTabs } from "./SettingsTabs";
import { FlowNav } from "../FlowNav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Container className="max-w-2xl pt-8">
        <FlowNav />
        <SettingsTabs />
      </Container>
      {children}
    </div>
  );
}
