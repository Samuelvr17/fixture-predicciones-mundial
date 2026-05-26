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

  // Find group by invite code
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, prediction_deadline")
    .eq("invite_code", normalizedCode)
    .single();

  if (groupError || !group) {
    return { error: "Código de invitación inválido" };
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    // Already a member, redirect to group
    revalidatePath("/dashboard");
    redirect(`/groups/${group.id}`);
  }

  // Add user as member
  const { error: memberError } = await supabase
    .from("group_members")
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: "member",
    });

  if (memberError) {
    console.error("Error joining group:", memberError);
    return { error: "Error al unirte al grupo. Intenta nuevamente." };
  }

  revalidatePath("/dashboard");
  redirect(`/groups/${group.id}`);
}
