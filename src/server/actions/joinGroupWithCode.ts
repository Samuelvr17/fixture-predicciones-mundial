"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

interface JoinGroupState {
  error?: string;
  success?: boolean;
}

export async function joinGroupWithCode(
  prevState: JoinGroupState,
  formData: FormData
): Promise<JoinGroupState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes estar autenticado para unirte a un grupo" };
  }

  const inviteCode = formData.get("invite_code") as string;

  // Validate code
  if (!inviteCode || inviteCode.trim().length === 0) {
    return { error: "El código de invitación es requerido" };
  }

  // Normalize code: trim + uppercase
  const normalizedCode = inviteCode.trim().toUpperCase();

  // Call RPC function to join group by code
  const { data: result, error: rpcError } = await supabase
    .rpc("join_group_by_code", { p_invite_code: normalizedCode });

  if (rpcError || !result || result.length === 0) {
    console.error("Error joining group via RPC:", rpcError);
    // Show specific error message based on the actual error
    if (rpcError?.message?.includes('not_authenticated')) {
      return { error: "Debes estar autenticado para unirte a un grupo" };
    }
    if (rpcError?.message?.includes('invalid_invite_code')) {
      return { error: "Código de invitación inválido" };
    }
    return { error: rpcError?.message || "Error al unirse al grupo" };
  }

  const groupId = result[0].group_id;

  revalidatePath("/dashboard");
  redirect(`/groups/${groupId}`);
}
