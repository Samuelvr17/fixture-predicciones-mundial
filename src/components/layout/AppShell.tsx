import Link from 'next/link';
import type { ReactNode } from 'react';

type AppShellProps = {
    title: string;
    subtitle?: ReactNode;
    children: ReactNode;
    groupId?: string;
    groupName?: string;
    headerActions?: ReactNode;
    headerMeta?: ReactNode;
    headerNotice?: ReactNode;
    maxWidthClassName?: string;
};

type NavItem = {
    href: string;
    label: string;
    shortLabel?: string;
};

function getNavItems(groupId?: string, groupName?: string): NavItem[] {
    const items: NavItem[] = [
        { href: '/dashboard', label: 'Dashboard' },
    ];

    if (groupId) {
        items.push(
            {
                href: `/groups/${groupId}`,
                label: groupName ? `Grupo: ${groupName}` : 'Grupo actual',
                shortLabel: 'Grupo',
            },
            {
                href: `/groups/${groupId}/my-predictions`,
                label: 'Predicciones',
            },
            {
                href: `/groups/${groupId}/matches`,
                label: 'Calendario',
            },
            {
                href: `/groups/${groupId}/bracket`,
                label: 'Bracket',
            },
            {
                href: `/groups/${groupId}/leaderboard`,
                label: 'Leaderboard',
            },
        );
    }

    items.push({ href: '/standings', label: 'Standings' });

    return items;
}

export default function AppShell({
    title,
    subtitle,
    children,
    groupId,
    groupName,
    headerActions,
    headerMeta,
    headerNotice,
    maxWidthClassName = 'max-w-6xl',
}: AppShellProps) {
    const navItems = getNavItems(groupId, groupName);

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 p-4 pb-24 font-sans text-zinc-900 sm:p-6 lg:p-8 dark:bg-zinc-950 dark:text-zinc-100">
            <div className={`${maxWidthClassName} mx-auto flex w-full flex-col gap-8`}>
                <header className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                            {subtitle && (
                                <div className="mt-2 text-sm text-zinc-500 sm:text-base dark:text-zinc-400">
                                    {subtitle}
                                </div>
                            )}
                            {headerMeta && (
                                <div className="mt-4">
                                    {headerMeta}
                                </div>
                            )}
                        </div>
                        {headerActions && (
                            <div className="shrink-0">
                                {headerActions}
                            </div>
                        )}
                    </div>

                    {headerNotice && (
                        <div className="mt-4">
                            {headerNotice}
                        </div>
                    )}

                    <nav aria-label="Navegación principal" className="-mx-2 mt-6 overflow-x-auto px-2 pb-1">
                        <div className="flex min-w-max gap-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="inline-flex min-h-11 items-center rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                                >
                                    <span className="sm:hidden">{item.shortLabel || item.label}</span>
                                    <span className="hidden sm:inline">{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    </nav>
                </header>

                <main className="flex flex-col gap-8">{children}</main>
            </div>
        </div>
    );
}
