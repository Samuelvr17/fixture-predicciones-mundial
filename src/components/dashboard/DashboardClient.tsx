"use client";

import { useState } from "react";
import CreateGroupModal from "@/components/groups/CreateGroupModal";
import JoinGroupModal from "@/components/groups/JoinGroupModal";

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

export default function DashboardClient({ groups, memberCounts }: DashboardClientProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  return (
    <>
      <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Mis Grupos</h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-all active:scale-95"
          >
            Crear Nuevo Grupo
          </button>
        </div>

        {groups && groups.length > 0 ? (
          <div className="space-y-3">
            {groups.map((member) => (
              <a
                key={member.group_id}
                href={`/groups/${member.group_id}`}
                className="block p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{member.groups?.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>
                        {member.role === 'leader' ? 'Líder' : 'Miembro'}
                      </span>
                      <span>•</span>
                      <span>
                        {memberCounts.get(member.group_id) || 0} {memberCounts.get(member.group_id) === 1 ? 'miembro' : 'miembros'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                      Deadline: {new Date(member.groups?.prediction_deadline || '').toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
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
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Aún no perteneces a ningún grupo.
          </p>
        )}
      </section>

      <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Unirme a un Grupo</h2>
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Unirse con Código
          </button>
        </div>
      </section>

      <CreateGroupModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <JoinGroupModal isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
    </>
  );
}
