import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      <main className="flex w-full flex-col items-center justify-center py-20 px-4 text-center">
        <h1 className="text-5xl font-bold tracking-tighter mb-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-300">
          Quiniela Mundial 2026
        </h1>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            href="/register"
            className="flex h-12 items-center justify-center rounded-lg bg-blue-600 px-8 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 hover:shadow-md transition-all active:scale-95"
          >
            Registrarse
          </Link>
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 px-8 text-sm font-semibold hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
          >
            Iniciar Sesión
          </Link>
        </div>
      </main>
    </div>
  );
}
