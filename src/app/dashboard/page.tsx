import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

    const { data: groups } = await supabase
        .from("group_members")
        .select(`
            group_id,
            role,
            groups (
                id,
                name,
                invite_code,
                prediction_deadline,
                created_at
            )
        `)
        .eq("user_id", user.id);

    const { data: memberCounts } = await supabase
        .from("group_members")
        .select("group_id")
        .in("group_id", groups?.map(g => g.group_id) || []);


    // Check if user is global admin
    const { data: globalAdmin } = await supabase
        .from("global_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

    const countMap = new Map<string, number>();
    memberCounts?.forEach(m => {
        countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1);
    });

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 p-8">
            <div className="max-w-4xl w-full mx-auto flex flex-col gap-8">

                <header className="flex items-center justify-between bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                            Bienvenido, {profile?.username || user?.email}
                        </p>
                    </div>

                    <form action={logout}>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                        >
                            Cerrar sesión
                        </button>
                    </form>
                </header>

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

                <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DashboardClient groups={groups || []} memberCounts={countMap} />
                </main>
            </div>
        </div>
    );
}
