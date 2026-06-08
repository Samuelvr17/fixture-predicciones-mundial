import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/server';
import { ensureGlobalGroupMembership } from '@/lib/groups/globalGroup';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export default async function ParticipationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  await ensureGlobalGroupMembership(supabase, user.id);

  const { data: confirmations, error } = await supabase
    .from('participation_confirmations')
    .select('id, display_name, confirmed_at, status')
    .eq('is_visible', true)
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: false });

  return (
    <AppShell
      title="Participación confirmada"
      subtitle="Consulta las personas cuya participación en la quiniela ya fue confirmada."
      maxWidthClassName="max-w-4xl"
    >
      <Alert variant="info">
        La confirmación de participación se gestiona por fuera de la app. Esta sección solo muestra las participaciones confirmadas.
      </Alert>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Personas confirmadas</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Esta lista no procesa pagos ni muestra datos de pago; solo presenta nombres y fechas de confirmación registrados manualmente por administración.
          </p>
        </div>

        {error ? (
          <Alert variant="error">No se pudo cargar la lista de participación confirmada.</Alert>
        ) : confirmations && confirmations.length > 0 ? (
          <div className="grid gap-3">
            {confirmations.map((confirmation) => (
              <article
                key={confirmation.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{confirmation.display_name}</h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Fecha de confirmación: {formatDate(confirmation.confirmed_at)}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-200">
                  Confirmado
                </span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Aún no hay participaciones confirmadas." description="Cuando administración confirme participantes por fuera de la app, aparecerán en esta sección." />
        )}
      </Card>
    </AppShell>
  );
}
