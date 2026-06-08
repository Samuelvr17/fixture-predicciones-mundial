'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;
const SENSITIVE_NOTES_PATTERN = /(\b\d{6,}\b|cuenta|banco|bancolombia|nequi|daviplata|transferencia|comprobante|transacci[oó]n|referencia|monto|valor|cop|\$)/i;

type ParticipationStatus = 'confirmed' | 'pending' | 'cancelled';

type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
};

type UpdateParticipationConfirmationParams = {
  id: string;
  displayName: string;
  notes?: string | null;
  isVisible?: boolean;
  status?: ParticipationStatus;
};

async function requireGlobalAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null, error: 'No tienes permisos para realizar esta acción.' };
  }

  const { data: globalAdminCheck, error: adminError } = await supabase
    .from('global_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !globalAdminCheck) {
    return { supabase, user: null, error: 'No tienes permisos para realizar esta acción.' };
  }

  return { supabase, user, error: null };
}

function normalizeDisplayName(displayName: string) {
  return displayName.trim().replace(/\s+/g, ' ');
}

function normalizeNotes(notes?: string | null) {
  const cleanNotes = notes?.trim() ?? '';
  return cleanNotes.length > 0 ? cleanNotes : null;
}

function validateDisplayName(displayName: string): string | null {
  if (!displayName) {
    return 'El nombre visible es obligatorio.';
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return `El nombre visible no puede superar ${MAX_DISPLAY_NAME_LENGTH} caracteres.`;
  }

  return null;
}

function validateNotes(notes: string | null): string | null {
  if (!notes) {
    return null;
  }

  if (notes.length > MAX_NOTES_LENGTH) {
    return `La nota interna no puede superar ${MAX_NOTES_LENGTH} caracteres.`;
  }

  if (SENSITIVE_NOTES_PATTERN.test(notes)) {
    return 'La nota interna no debe incluir datos de pago, bancos, montos, comprobantes, transacciones ni números sensibles.';
  }

  return null;
}

function revalidateParticipationPaths() {
  revalidatePath('/participation');
  revalidatePath('/global-admin/participation');
  revalidatePath('/dashboard');
}

export async function createParticipationConfirmation(
  displayName: string,
  notes?: string | null,
): Promise<ActionResult> {
  const { supabase, user, error: permissionError } = await requireGlobalAdmin();
  if (permissionError || !user) {
    return { success: false, error: permissionError ?? 'No tienes permisos para realizar esta acción.' };
  }

  const cleanDisplayName = normalizeDisplayName(displayName);
  const cleanNotes = normalizeNotes(notes);
  const nameError = validateDisplayName(cleanDisplayName);
  const notesError = validateNotes(cleanNotes);

  if (nameError || notesError) {
    return { success: false, error: nameError ?? notesError ?? 'Datos inválidos.' };
  }

  const { error } = await supabase
    .from('participation_confirmations')
    .insert({
      display_name: cleanDisplayName,
      notes: cleanNotes,
      status: 'confirmed',
      is_visible: true,
      created_by: user.id,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateParticipationPaths();
  return { success: true, message: 'Participación agregada.' };
}

export async function updateParticipationConfirmation({
  id,
  displayName,
  notes,
  isVisible = true,
  status = 'confirmed',
}: UpdateParticipationConfirmationParams): Promise<ActionResult> {
  const { supabase, error: permissionError } = await requireGlobalAdmin();
  if (permissionError) {
    return { success: false, error: permissionError };
  }

  const cleanDisplayName = normalizeDisplayName(displayName);
  const cleanNotes = normalizeNotes(notes);
  const nameError = validateDisplayName(cleanDisplayName);
  const notesError = validateNotes(cleanNotes);

  if (nameError || notesError) {
    return { success: false, error: nameError ?? notesError ?? 'Datos inválidos.' };
  }

  if (!['confirmed', 'pending', 'cancelled'].includes(status)) {
    return { success: false, error: 'Estado inválido.' };
  }

  const { error } = await supabase
    .from('participation_confirmations')
    .update({
      display_name: cleanDisplayName,
      notes: cleanNotes,
      is_visible: Boolean(isVisible),
      status,
    })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateParticipationPaths();
  return { success: true, message: 'Participación actualizada.' };
}

export async function deleteParticipationConfirmation(id: string): Promise<ActionResult> {
  const { supabase, error: permissionError } = await requireGlobalAdmin();
  if (permissionError) {
    return { success: false, error: permissionError };
  }

  const { error } = await supabase
    .from('participation_confirmations')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateParticipationPaths();
  return { success: true, message: 'Registro eliminado.' };
}
