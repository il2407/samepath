import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";

export default async function SettingsPage() {
  await requireUser();
  redirect("/app/settings/profile");
}
