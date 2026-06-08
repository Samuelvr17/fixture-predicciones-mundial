import Link from 'next/link';
import { redirect } from 'next/navigation';
import ParticipationConfirmationsClient from '@/components/admin/ParticipationConfirmationsClient';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/server';

export default async function GlobalAdminParticipationPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  const { data: globalAdminCheck, error: adminError } = await supabase
    .from('global_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !globalAdminCheck) {
    redirect('/dashboard');
  }

  const { data: confirmations, error } = await supabase
    .from('participation_confirmations')
    .select('id, display_name, status, is_visible, notes, confirmed_at, created_by, created_at, updated_at')
    .order('confirmed_at', { ascending: false });

  return (
    <div className="min-h-screen bg-zinc-50 p-4 text-zinc-900 sm:p-6 lg:p-8 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">Panel Global Admin</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Administrar pagos confirmados</h1>
              <p className="mt-2 max-w-3xl text-sm text-zinc-500 sm:text-base dark:text-zinc-400">
                Controla la lista pública de personas con participación confirmada. La app no procesa pagos ni debe guardar datos sensibles de pago.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/participation" className="inline-flex min-h-10 items-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
                Ver sección pública
              </Link>
              <Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Volver al inicio
              </Link>
            </div>
          </div>
        </header>

        <Alert variant="warning">
          La confirmación se gestiona por fuera de la app. No ingreses cuentas bancarias, comprobantes, números de transacción, referencias ni montos en esta sección.
        </Alert>

        {error ? (
          <Alert variant="error">No se pudieron cargar los registros de participación.</Alert>
        ) : (
          <ParticipationConfirmationsClient confirmations={confirmations ?? []} />
        )}
      </div>
    </div>
  );
}
