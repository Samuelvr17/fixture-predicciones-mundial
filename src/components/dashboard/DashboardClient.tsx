"use client";

import { useState } from "react";
import CreateGroupModal from "@/components/groups/CreateGroupModal";
import JoinGroupModal from "@/components/groups/JoinGroupModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface Group {
  group_id: string;
  role: string;
  groups: {
    id: string;
    name: string;
    invite_code: string;
    prediction_deadline: string;
    created_at: string;
  };
}

interface DashboardClientProps {
  groups: Group[];
  memberCounts: Map<string, number>;
}

const deadlineDateFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatDeadline(deadline: string) {
  const date = new Date(deadline);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  const parts = deadlineDateFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${getPart('day')} de ${getPart('month')} de ${getPart('year')}, ${getPart('hour')}:${getPart('minute')}`;
}

export default function DashboardClient({ groups, memberCounts }: DashboardClientProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  return (
    <>
      <Card as="section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold sm:text-2xl">Mis Grupos</h2>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            Crear Nuevo Grupo
          </Button>
        </div>

        {groups && groups.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {groups.map((member) => (
              <a
                key={member.group_id}
                href={`/groups/${member.group_id}`}
                className="block p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{member.groups?.name}</h3>
                    <div className="mt-1 flex items-center gap-3 sm:gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>
                        {member.role === 'leader' ? 'Líder' : 'Miembro'}
                      </span>
                      <span>•</span>
                      <span>
                        {memberCounts.get(member.group_id) || 0} {memberCounts.get(member.group_id) === 1 ? 'miembro' : 'miembros'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                      Cierre de predicciones: {formatDeadline(member.groups?.prediction_deadline || '')}
                    </p>
                  </div>
                  <div className="text-zinc-400">
                    →
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState title="Aún no perteneces a ningún grupo." />
        )}
      </Card>

      <Card as="section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold sm:text-2xl">Unirme a un Grupo</h2>
          <Button variant="secondary" onClick={() => setIsJoinModalOpen(true)}>
            Unirse con Código
          </Button>
        </div>
      </Card>

      <CreateGroupModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <JoinGroupModal isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
    </>
  );
}
