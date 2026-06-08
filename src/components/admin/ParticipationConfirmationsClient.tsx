'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  createParticipationConfirmation,
  deleteParticipationConfirmation,
  updateParticipationConfirmation,
} from '@/server/actions/participationConfirmations';
import type { Database } from '@/types/database.types';

type ParticipationConfirmation = Database['public']['Tables']['participation_confirmations']['Row'];
type ParticipationConfirmationForClient = ParticipationConfirmation & {
  confirmed_at_display: string;
};
type ParticipationStatus = 'confirmed' | 'pending' | 'cancelled';

type ParticipationConfirmationsClientProps = {
  confirmations: ParticipationConfirmationForClient[];
};


export default function ParticipationConfirmationsClient({ confirmations }: ParticipationConfirmationsClientProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { displayName: string; notes: string; isVisible: boolean; status: ParticipationStatus }>>(() =>
    Object.fromEntries(confirmations.map((confirmation) => [
      confirmation.id,
      {
        displayName: confirmation.display_name,
        notes: confirmation.notes ?? '',
        isVisible: confirmation.is_visible,
        status: confirmation.status as ParticipationStatus,
      },
    ])),
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEditing(Object.fromEntries(confirmations.map((confirmation) => [
      confirmation.id,
      {
        displayName: confirmation.display_name,
        notes: confirmation.notes ?? '',
        isVisible: confirmation.is_visible,
        status: confirmation.status as ParticipationStatus,
      },
    ])));
  }, [confirmations]);

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const refreshAfterSuccess = (successMessage: string) => {
    setMessage(successMessage);
    router.refresh();
  };

  const handleCreate = () => {
    resetFeedback();

    startTransition(async () => {
      const result = await createParticipationConfirmation(displayName, notes);
      if (!result.success) {
        setError(result.error ?? 'No se pudo agregar la participación.');
        return;
      }

      setDisplayName('');
      setNotes('');
      refreshAfterSuccess(result.message ?? 'Participación agregada.');
    });
  };

  const handleFieldChange = <K extends keyof (typeof editing)[string]>(
    id: string,
    key: K,
    value: (typeof editing)[string][K],
  ) => {
    setEditing((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [key]: value,
      },
    }));
  };

  const handleUpdate = (id: string) => {
    resetFeedback();
    const values = editing[id];

    startTransition(async () => {
      const result = await updateParticipationConfirmation({
        id,
        displayName: values.displayName,
        notes: values.notes,
        isVisible: values.isVisible,
        status: values.status,
      });

      if (!result.success) {
        setError(result.error ?? 'No se pudo actualizar la participación.');
        return;
      }

      refreshAfterSuccess(result.message ?? 'Participación actualizada.');
    });
  };

  const handleToggleVisibility = (confirmation: ParticipationConfirmation) => {
    resetFeedback();
    const values = editing[confirmation.id];

    startTransition(async () => {
      const result = await updateParticipationConfirmation({
        id: confirmation.id,
        displayName: values.displayName,
        notes: values.notes,
        isVisible: !values.isVisible,
        status: values.status,
      });

      if (!result.success) {
        setError(result.error ?? 'No se pudo cambiar la visibilidad.');
        return;
      }

      handleFieldChange(confirmation.id, 'isVisible', !values.isVisible);
      refreshAfterSuccess(result.message ?? 'Participación actualizada.');
    });
  };

  const handleDelete = (id: string) => {
    resetFeedback();

    if (!window.confirm('¿Eliminar este registro de participación confirmada?')) {
      return;
    }

    startTransition(async () => {
      const result = await deleteParticipationConfirmation(id);
      if (!result.success) {
        setError(result.error ?? 'No se pudo eliminar el registro.');
        return;
      }

      refreshAfterSuccess(result.message ?? 'Registro eliminado.');
    });
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Agregar persona confirmada</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Registra únicamente nombres cuya participación ya fue confirmada por fuera de la app. No guardes datos bancarios, comprobantes, referencias ni montos.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
          <label className="space-y-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <span>Nombre visible</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Ej. María Pérez"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <span>Nota interna opcional</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Solo contexto administrativo no sensible"
            />
          </label>
        </div>

        <Button onClick={handleCreate} disabled={isPending || !displayName.trim()}>
          {isPending ? 'Guardando...' : 'Agregar confirmado'}
        </Button>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Registros existentes</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Las notas internas no aparecen en la vista de usuarios. La vista pública solo muestra registros visibles y confirmados.
          </p>
        </div>

        {confirmations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Aún no hay participaciones confirmadas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Nota interna</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Visible</th>
                  <th className="px-3 py-3">Fecha de confirmación</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {confirmations.map((confirmation) => {
                  const values = editing[confirmation.id] ?? {
                    displayName: confirmation.display_name,
                    notes: confirmation.notes ?? '',
                    isVisible: confirmation.is_visible,
                    status: confirmation.status as ParticipationStatus,
                  };

                  return (
                    <tr key={confirmation.id} className="align-top">
                      <td className="min-w-52 px-3 py-3">
                        <input
                          value={values.displayName}
                          onChange={(event) => handleFieldChange(confirmation.id, 'displayName', event.target.value)}
                          maxLength={80}
                          className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </td>
                      <td className="min-w-60 px-3 py-3">
                        <input
                          value={values.notes}
                          onChange={(event) => handleFieldChange(confirmation.id, 'notes', event.target.value)}
                          maxLength={500}
                          className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </td>
                      <td className="min-w-36 px-3 py-3">
                        <select
                          value={values.status}
                          onChange={(event) => handleFieldChange(confirmation.id, 'status', event.target.value as ParticipationStatus)}
                          className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          <option value="confirmed">Confirmado</option>
                          <option value="pending">Pendiente</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${values.isVisible ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                          {values.isVisible ? 'Visible' : 'Oculto'}
                        </span>
                      </td>
                      <td className="min-w-44 px-3 py-3 text-zinc-600 dark:text-zinc-300">
                        {confirmation.confirmed_at_display}
                      </td>
                      <td className="min-w-72 px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="primary" onClick={() => handleUpdate(confirmation.id)} disabled={isPending}>
                            Guardar
                          </Button>
                          <Button variant="secondary" onClick={() => handleToggleVisibility(confirmation)} disabled={isPending}>
                            {values.isVisible ? 'Ocultar' : 'Mostrar'}
                          </Button>
                          <Button variant="danger" onClick={() => handleDelete(confirmation.id)} disabled={isPending}>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
