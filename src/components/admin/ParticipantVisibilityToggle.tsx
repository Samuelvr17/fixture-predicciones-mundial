'use client';

import { useState, useTransition } from 'react';
import { toggleLeaderboardVisibility } from '@/server/actions/leaderboardVisibility';

interface ParticipantVisibilityToggleProps {
    groupId: string;
    userId: string;
    isHidden: boolean;
}

export default function ParticipantVisibilityToggle({ groupId, userId, isHidden }: ParticipantVisibilityToggleProps) {
    const [isPending, startTransition] = useTransition();
    const [optimisticHidden, setOptimisticHidden] = useState(isHidden);

    const handleToggle = () => {
        const newValue = !optimisticHidden;
        setOptimisticHidden(newValue);
        startTransition(async () => {
            try {
                await toggleLeaderboardVisibility(groupId, userId, newValue);
            } catch (error) {
                console.error("Error toggling visibility:", error);
                setOptimisticHidden(isHidden); // Revert on error
            }
        });
    };

    return (
        <div className="flex flex-col gap-1 items-end sm:items-start shrink-0">
            <button
                onClick={handleToggle}
                disabled={isPending}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${optimisticHidden
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-800/50'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-800/50'
                    }`}
            >
                {isPending
                    ? 'Guardando...'
                    : optimisticHidden ? 'Mostrar participante' : 'Ocultar participante'
                }
            </button>
            {optimisticHidden && (
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/20">
                    Oculto para usuarios
                </span>
            )}
        </div>
    );
}
