import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import AppShell from "@/components/layout/AppShell";
import HelpButton from "@/components/help/HelpButton";
import { ensureGlobalGroupMembership } from "@/lib/groups/globalGroup";

const dashboardLinks = [
    {
        href: "/predictions",
        title: "Mis predicciones",
        description: "Registra y revisa tus marcadores, clasificados, goleador y mejor arquero.",
    },
    {
        href: "/participants",
        title: "Participantes",
        description: "Consulta quiénes participan y revisa sus predicciones.",
    },
    {
        href: "/leaderboard",
        title: "Tabla de puntuaciones",
        description: "Revisa el ranking de participantes y el acumulado de puntos.",
    },
    {
        href: "/bracket",
        title: "Llaves",
        description: "Consulta el cuadro de eliminatorias y el avance de los equipos.",
    },
    {
        href: "/standings",
        title: "Tabla de grupos",
        description: "Revisa las posiciones por grupo, puntos, goles y diferencia de gol.",
    },
    {
        href: "/matches",
        title: "Partidos",
        description: "Consulta calendario, sedes y resultados oficiales.",
    },
];

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    await ensureGlobalGroupMembership(supabase, user.id);

    const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

    // Check if user is global admin
    const { data: globalAdmin } = await supabase
        .from("global_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

    return (
        <AppShell
            title="Inicio"
            subtitle={<>Bienvenido, {profile?.username || user?.email}</>}
            maxWidthClassName="max-w-4xl"
            headerActions={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <HelpButton title="¿Cómo funciona Inicio?" buttonLabel="¿Cómo funciona?">
                        <p>
                            Inicio es el punto de entrada de la quiniela. Desde aquí puedes ir a tus predicciones, revisar la tabla de puntuaciones, consultar participantes, ver partidos, llaves y tabla de grupos. Cada tarjeta te lleva a una sección específica.
                        </p>
                    </HelpButton>
                    <form action={logout}>
                        <button
                            type="submit"
                            className="min-h-11 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/50"
                        >
                            Cerrar sesión
                        </button>
                    </form>
                </div>
            }
            headerNotice={
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Pagar 120.000 COP de la inscripción a Bancolombia 91249281994 o llave 3214076747. Puedes participar gratis, pero el premio es solo para quienes pagan.
                    </p>
                </div>
            }
        >
            {globalAdmin && (
                <section className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900">
                    <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-4">Panel Global Admin</h2>
                    <div className="flex flex-wrap gap-3">
                        <a
                            href="/global-admin/results"
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                            Registrar resultados oficiales
                        </a>
                        <a
                            href="/global-admin/tiebreaks"
                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                            Resolver desempates
                        </a>
                    </div>
                </section>
            )}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {dashboardLinks.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h2>
                                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.description}</p>
                            </div>
                            <span className="text-2xl text-zinc-400 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-300">→</span>
                        </div>
                    </Link>
                ))}
            </section>
        </AppShell>
    );
}
