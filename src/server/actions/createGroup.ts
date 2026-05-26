"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

interface CreateGroupState {
  error?: string;
  success?: boolean;
}

export async function createGroup(
  prevState: CreateGroupState,
  formData: FormData
): Promise<CreateGroupState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes estar autenticado para crear un grupo" };
  }

  const name = formData.get("name") as string;
  const predictionDeadline = formData.get("prediction_deadline") as string;

  // Validate name
  if (!name || name.trim().length === 0) {
    return { error: "El nombre del grupo no puede estar vacío" };
  }

  if (name.length < 2 || name.length > 80) {
    return { error: "El nombre debe tener entre 2 y 80 caracteres" };
  }

  // Validate deadline
  if (!predictionDeadline) {
    return { error: "La fecha límite es requerida" };
  }

  const deadlineDate = new Date(predictionDeadline);
  const now = new Date();

  if (deadlineDate <= now) {
    return { error: "La fecha límite debe ser en el futuro" };
  }

  // Generate unique invite code
  const generateInviteCode = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  let inviteCode = generateInviteCode();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure invite code is unique
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from("groups")
      .select("invite_code")
      .eq("invite_code", inviteCode)
      .single();

    if (!existing) {
      break;
    }

    inviteCode = generateInviteCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    return { error: "No se pudo generar un código de invitación único. Intenta nuevamente." };
  }

  // Create group
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      name: name.trim(),
      invite_code: inviteCode,
      creator_id: user.id,
      prediction_deadline: deadlineDate.toISOString(),
    })
    .select()
    .single();

  if (groupError) {
    console.error("Error creating group:", groupError);
    return { error: "Error al crear el grupo. Intenta nuevamente." };
  }

  // Add creator as leader
  const { error: memberError } = await supabase
    .from("group_members")
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: "leader",
    });

  if (memberError) {
    console.error("Error adding creator as leader:", memberError);
    return { error: "Error al configurar el grupo. Intenta nuevamente." };
  }

  revalidatePath("/dashboard");
  redirect(`/groups/${group.id}`);
}
