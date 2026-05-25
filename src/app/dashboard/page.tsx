import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Esto es un fallback, ya que el middleware debe proteger la ruta,
        // pero satisface a TypeScript.
        return null;
    }

    // Obtener perfil (username)
    const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

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

                <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-xl font-semibold mb-4">Mis Grupos</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                            Aún no perteneces a ningún grupo.
                        </p>
                        <button className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-all active:scale-95">
                            Crear Nuevo Grupo
                        </button>
                    </section>

                    <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <h2 className="text-xl font-semibold mb-4">Unirme a un Grupo</h2>
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="Código de invitación"
                                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                            <button className="px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                Unirme
                            </button>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
