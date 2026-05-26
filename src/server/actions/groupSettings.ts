"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const WORLD_CUP_FIRST_MATCH_START = new Date("2026-06-11T14:00:00-05:00");

/**
 * Convierte un valor datetime-local (sin zona horaria) a una Date con offset Colombia.
 * 
 * El input HTML datetime-local envía valores sin zona horaria, ej: "2026-06-11T13:30".
 * Esta función interpreta ese valor como hora Colombia (UTC-5), agregando el offset "-05:00".
 * 
 * @param value - String datetime-local sin zona horaria (ej: "2026-06-11T13:30")
 * @returns Date con el offset Colombia aplicado
 */
function parseColombiaDateTimeLocal(value: string): Date {
  // datetime-local no incluye zona horaria, así que asumimos Colombia (UTC-5)
  return new Date(`${value}:00-05:00`);
}

interface ActionState {
  error?: string;
  success?: boolean;
}

// Helper: Check if user is leader of the group
async function isGroupLeader(supabase: any, groupId: string, userId: string): Promise<boolean> {
  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .single();

  return member?.role === "leader";
}

// Helper: Generate unique invite code
async function generateUniqueInviteCode(supabase: any): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from("groups")
      .select("invite_code")
      .eq("invite_code", code)
      .single();

    if (!existing) {
      return code;
    }

    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  }

  throw new Error("No se pudo generar un código de invitación único");
}

export async function updateGroupName(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes estar autenticado" };
  }

  const groupId = formData.get("group_id") as string;
  const name = formData.get("name") as string;

  if (!groupId) {
    return { error: "ID de grupo requerido" };
  }

  // Validate name
  if (!name || name.trim().length === 0) {
    return { error: "El nombre del grupo no puede estar vacío" };
  }

  if (name.length < 2 || name.length > 80) {
    return { error: "El nombre debe tener entre 2 y 80 caracteres" };
  }

  // Check if user is leader
  const isLeader = await isGroupLeader(supabase, groupId, user.id);
  if (!isLeader) {
    return { error: "No tienes permiso para modificar este grupo" };
  }

  // Update group name
  const { error } = await supabase
    .from("groups")
    .update({ name: name.trim() })
    .eq("id", groupId);

  if (error) {
    console.error("Error updating group name:", error);
    return { error: "Error al actualizar el nombre del grupo" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function updateGroupDeadline(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes estar autenticado" };
  }

  const groupId = formData.get("group_id") as string;
  const predictionDeadline = formData.get("prediction_deadline") as string;

  if (!groupId) {
    return { error: "ID de grupo requerido" };
  }

  if (!predictionDeadline) {
    return { error: "La fecha límite es requerida" };
  }

  // Check if user is leader
  const isLeader = await isGroupLeader(supabase, groupId, user.id);
  if (!isLeader) {
    return { error: "No tienes permiso para modificar este grupo" };
  }

  // Get current group to check existing deadline
  const { data: group } = await supabase
    .from("groups")
    .select("prediction_deadline")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { error: "Grupo no encontrado" };
  }

  // Check if current deadline has already passed
  const now = new Date();
  const currentDeadline = new Date(group.prediction_deadline);
  if (currentDeadline <= now) {
    return { error: "No se puede cambiar el deadline después de que haya cerrado" };
  }

  // Validate new deadline
  // El input datetime-local no incluye zona horaria, interpretamos como hora Colombia
  const newDeadline = parseColombiaDateTimeLocal(predictionDeadline);

  if (Number.isNaN(newDeadline.getTime())) {
    return { error: "La fecha límite no es válida." };
  }

  if (newDeadline <= now) {
    return { error: "La fecha límite debe ser en el futuro" };
  }

  if (newDeadline >= WORLD_CUP_FIRST_MATCH_START) {
    return { error: "La fecha límite debe ser antes del primer partido del Mundial: 11 de junio de 2026, 2:00 p. m. hora Colombia." };
  }

  // Update deadline
  const { error } = await supabase
    .from("groups")
    .update({ prediction_deadline: newDeadline.toISOString() })
    .eq("id", groupId);

  if (error) {
    console.error("Error updating deadline:", error);
    return { error: "Error al actualizar la fecha límite" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function regenerateInviteCode(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes estar autenticado" };
  }

  const groupId = formData.get("group_id") as string;

  if (!groupId) {
    return { error: "ID de grupo requerido" };
  }

  // Check if user is leader
  const isLeader = await isGroupLeader(supabase, groupId, user.id);
  if (!isLeader) {
    return { error: "No tienes permiso para modificar este grupo" };
  }

  // Generate new unique invite code
  const newCode = await generateUniqueInviteCode(supabase);

  // Update group
  const { error } = await supabase
    .from("groups")
    .update({ invite_code: newCode })
    .eq("id", groupId);

  if (error) {
    console.error("Error regenerating invite code:", error);
    return { error: "Error al regenerar el código de invitación" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function removeGroupMember(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes estar autenticado" };
  }

  const groupId = formData.get("group_id") as string;
  const memberUserId = formData.get("member_user_id") as string;

  if (!groupId || !memberUserId) {
    return { error: "ID de grupo y ID de miembro requeridos" };
  }

  // Check if user is leader
  const isLeader = await isGroupLeader(supabase, groupId, user.id);
  if (!isLeader) {
    return { error: "No tienes permiso para modificar este grupo" };
  }

  // Get member's role
  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", memberUserId)
    .single();

  if (!member) {
    return { error: "Miembro no encontrado" };
  }

  // Cannot remove leaders
  if (member.role === "leader") {
    return { error: "No puedes remover a un líder del grupo" };
  }

  // Check if this is the only leader trying to remove themselves (shouldn't happen with above check, but safety)
  if (memberUserId === user.id) {
    return { error: "No puedes remover tu propio miembro del grupo" };
  }

  // Remove member
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberUserId);

  if (error) {
    console.error("Error removing member:", error);
    return { error: "Error al remover el miembro" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}
