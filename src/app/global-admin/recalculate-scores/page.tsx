/**
 * src/app/global-admin/recalculate-scores/page.tsx
 *
 * Panel de admin global para recalcular puntuaciones del grupo global.
 * Solo accesible para usuarios en la tabla global_admins.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GLOBAL_GROUP_ID } from '@/lib/groups/globalGroup';
import AppShell from '@/components/layout/AppShell';
import RecalculateScoresClient from '@/components/admin/RecalculateScoresClient';

export default async function RecalculateScoresPage() {
  const supabase = await createClient();

  // Verificar si el usuario está autenticado
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // Verificar si el usuario es global admin
  const { data: globalAdminCheck, error: adminError } = await supabase
    .from('global_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !globalAdminCheck) {
    redirect('/dashboard');
  }

  return (
    <AppShell
      title="Recalcular Puntuaciones"
      subtitle="Panel de administración - Recálculo de scores"
    >
      <div className="bg-white rounded-lg shadow-sm p-6 dark:bg-zinc-900 dark:border dark:border-zinc-800">
        <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          Recálculo del grupo global
        </h2>
        <p className="text-gray-600 dark:text-zinc-400 mb-6">
          Esta herramienta permite recalcular las puntuaciones de todos los participantes del grupo global.
          Usa esta función solo después de corregir reglas de puntuación o registrar resultados oficiales.
        </p>
        <RecalculateScoresClient globalGroupId={GLOBAL_GROUP_ID} />
      </div>
    </AppShell>
  );
}
