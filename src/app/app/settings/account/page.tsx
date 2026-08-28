import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { AccountSettingsPanel } from "@/modules/account/AccountSettingsPanel";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "ניהול חשבון — SamePath" };

export default async function AccountSettingsPage() {
  const user = await requireUser();
  const profile = await prisma.professionalProfile.findUnique({ where: { userId: user.id } });

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">ניהול חשבון</h1>
      <p className="mt-2 text-muted">{user.email}</p>

      <div className="mt-8">
        <AccountSettingsPanel isPaused={profile?.status === "PAUSED"} />
      </div>
    </Container>
  );
}
