"use client";

import { useState } from 'react';
import { updateGroupName, updateGroupDeadline, regenerateInviteCode, removeGroupMember } from '@/server/actions/groupSettings';

interface Group {
    id: string;
    name: string;
    invite_code: string;
    prediction_deadline: string;
}

interface Member {
    user_id: string;
    role: string;
    joined_at: string;
    profile: {
        id: string;
        username: string;
        avatar_url: string | null;
    } | null | undefined;
}

interface GroupSettingsFormProps {
    group: Group;
    members: Member[];
    deadlineFormatted: string;
    isDeadlinePassed: boolean;
    leaderCount: number;
}

export default function GroupSettingsForm({
    group,
    members,
    deadlineFormatted,
    isDeadlinePassed,
    leaderCount
}: GroupSettingsFormProps) {
    const [nameError, setNameError] = useState<string>('');
    const [nameSuccess, setNameSuccess] = useState<boolean>(false);
    const [deadlineError, setDeadlineError] = useState<string>('');
    const [deadlineSuccess, setDeadlineSuccess] = useState<boolean>(false);
    const [inviteError, setInviteError] = useState<string>('');
    const [inviteSuccess, setInviteSuccess] = useState<boolean>(false);
    const [removeError, setRemoveError] = useState<string>('');
    const [removeSuccess, setRemoveSuccess] = useState<boolean>(false);

    const handleUpdateName = async (formData: FormData) => {
        setNameError('');
        setNameSuccess(false);
        
        const result = await updateGroupName({}, formData);
        if (result.error) {
            setNameError(result.error);
        } else {
            setNameSuccess(true);
            setTimeout(() => setNameSuccess(false), 3000);
        }
    };

    const handleUpdateDeadline = async (formData: FormData) => {
        setDeadlineError('');
        setDeadlineSuccess(false);
        
        const result = await updateGroupDeadline({}, formData);
        if (result.error) {
            setDeadlineError(result.error);
        } else {
            setDeadlineSuccess(true);
            setTimeout(() => setDeadlineSuccess(false), 3000);
        }
    };

    const handleRegenerateInvite = async (formData: FormData) => {
        setInviteError('');
        setInviteSuccess(false);
        
        const result = await regenerateInviteCode({}, formData);
        if (result.error) {
            setInviteError(result.error);
        } else {
            setInviteSuccess(true);
            setTimeout(() => setInviteSuccess(false), 3000);
        }
    };

    const handleRemoveMember = async (formData: FormData) => {
        setRemoveError('');
        setRemoveSuccess(false);
        
        const result = await removeGroupMember({}, formData);
        if (result.error) {
            setRemoveError(result.error);
        } else {
            setRemoveSuccess(true);
            setTimeout(() => setRemoveSuccess(false), 3000);
            // Refresh page to show updated member list
            window.location.reload();
        }
    };

    const copyInviteCode = () => {
        navigator.clipboard.writeText(group.invite_code);
    };

    return (
        <div className="space-y-6">
            {/* Group Name */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-lg font-semibold mb-4">Nombre del Grupo</h2>
                <form action={handleUpdateName} className="space-y-4">
                    <input type="hidden" name="group_id" value={group.id} />
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-2">
                            Nombre actual
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            defaultValue={group.name}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={80}
                        />
                    </div>
                    {nameError && (
                        <p className="text-sm text-red-600 dark:text-red-400">{nameError}</p>
                    )}
                    {nameSuccess && (
                        <p className="text-sm text-green-600 dark:text-green-400">Nombre actualizado correctamente</p>
                    )}
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        Actualizar Nombre
                    </button>
                </form>
            </div>

            {/* Invite Code */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-lg font-semibold mb-4">Código de Invitación</h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-2">
                                Código actual
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg font-mono text-lg">
                                    {group.invite_code}
                                </code>
                                <button
                                    type="button"
                                    onClick={copyInviteCode}
                                    className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                                    title="Copiar código"
                                >
                                    📋
                                </button>
                            </div>
                        </div>
                    </div>
                    <form action={handleRegenerateInvite}>
                        <input type="hidden" name="group_id" value={group.id} />
                        {inviteError && (
                            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{inviteError}</p>
                        )}
                        {inviteSuccess && (
                            <p className="text-sm text-green-600 dark:text-green-400 mb-2">Código regenerado correctamente</p>
                        )}
                        <button
                            type="submit"
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        >
                            Regenerar Código
                        </button>
                    </form>
                </div>
            </div>

            {/* Prediction Deadline */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-lg font-semibold mb-4">Deadline de Predicciones</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Deadline actual
                        </label>
                        <p className="text-zinc-700 dark:text-zinc-300">{deadlineFormatted}</p>
                        {isDeadlinePassed && (
                            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                ⚠️ El deadline ya cerró, no se puede modificar
                            </p>
                        )}
                    </div>
                    {!isDeadlinePassed && (
                        <form action={handleUpdateDeadline} className="space-y-4">
                            <input type="hidden" name="group_id" value={group.id} />
                            <div>
                                <label htmlFor="prediction_deadline" className="block text-sm font-medium mb-2">
                                    Nuevo deadline
                                </label>
                                <input
                                    type="datetime-local"
                                    id="prediction_deadline"
                                    name="prediction_deadline"
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    El deadline debe ser antes del 11 de junio de 2026, 2:00 p. m. hora Colombia
                                </p>
                            </div>
                            {deadlineError && (
                                <p className="text-sm text-red-600 dark:text-red-400">{deadlineError}</p>
                            )}
                            {deadlineSuccess && (
                                <p className="text-sm text-green-600 dark:text-green-400">Deadline actualizado correctamente</p>
                            )}
                            <button
                                type="submit"
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            >
                                Actualizar Deadline
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Members */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-lg font-semibold mb-4">Miembros del Grupo</h2>
                <div className="space-y-3">
                    {members.map((member) => (
                        <div
                            key={member.user_id}
                            className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                        {member.profile?.username?.[0]?.toUpperCase() || '?'}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {member.profile?.username || 'Usuario desconocido'}
                                    </p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        {member.role === 'leader' ? '👑 Líder' : 'Miembro'}
                                    </p>
                                </div>
                            </div>
                            {member.role === 'member' && (
                                <form action={handleRemoveMember}>
                                    <input type="hidden" name="group_id" value={group.id} />
                                    <input type="hidden" name="member_user_id" value={member.user_id} />
                                    <button
                                        type="submit"
                                        className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                                        onClick={(e) => {
                                            if (!confirm(`¿Estás seguro de remover a ${member.profile?.username} del grupo?`)) {
                                                e.preventDefault();
                                            }
                                        }}
                                    >
                                        Remover
                                    </button>
                                </form>
                            )}
                            {member.role === 'leader' && (
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                    {leaderCount === 1 ? 'Único líder' : 'Líder'}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
                {removeError && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-4">{removeError}</p>
                )}
                {removeSuccess && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-4">Miembro removido correctamente</p>
                )}
            </div>
        </div>
    );
}
