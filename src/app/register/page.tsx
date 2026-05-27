"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup } from "@/app/auth/actions";
import { useEffect, useState } from "react";

type AuthState = { error: string | null; success?: boolean };

async function signupAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
    const result = await signup(formData);
    return result as AuthState;
}

export default function RegisterPage() {
    const router = useRouter();
    const [state, formAction, isPending] = useActionState(signupAction, { error: null });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Redirect on successful signup
        if (state?.success) {
            router.push("/dashboard");
        }
    }, [state, router]);

    if (!mounted) return null;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 font-sans p-4">
            <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 p-8 transform transition-all">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Crear cuenta</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Únete para participar en una quiniela</p>
                </div>

                <form action={formAction} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="username" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Nombre de usuario
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            required
                            minLength={2}
                            maxLength={32}
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                            placeholder="tu_usuario"
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-500">Visible para los demás en los grupos.</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Correo electrónico
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                            placeholder="tu@email.com"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            minLength={6}
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    {state?.error && (
                        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 p-3 mt-2 border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-400 text-center">
                            {state.error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {isPending ? "Registrando..." : "Registrarse"}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    ¿Ya tienes una cuenta?{" "}
                    <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        Inicia sesión aquí
                    </Link>
                </div>
            </div>
        </div>
    );
}
