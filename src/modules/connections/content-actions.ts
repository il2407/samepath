"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { changePractice, ContentSelectionError } from "./content-service";

const schema = z.object({
  connectionId: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
  key: z
    .string()
    .regex(/^(template|guide|interview):[^:]+$/)
    .max(250)
    .optional(),
});
export async function changePracticeAction(input: unknown) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "לא ניתן לשמור את הבחירה" };
  try {
    await changePractice(
      user.id,
      parsed.data.connectionId,
      parsed.data.revision,
      parsed.data.key,
    );
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ContentSelectionError
          ? error.message
          : "השמירה לא הצליחה. נסו שוב",
    };
  }
}
