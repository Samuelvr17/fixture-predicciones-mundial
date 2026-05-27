/**
 * src/lib/supabase/server.ts
 *
 * Cliente Supabase para uso en Server Components, Server Actions y Route Handlers.
 * Usa createServerClient de @supabase/ssr con cookies de Next.js.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // setAll puede fallar en Server Components de solo lectura.
                        // El middleware se encarga de refrescar la sesión en esos casos.
                    }
                },
            },
        }
    );
}

/**
 * Cliente Supabase con service role key para bypass RLS.
 * Solo debe usarse en server-side para operaciones administrativas
 * como el motor de scoring que necesita escribir en score_breakdowns.
 *
 * @throws Error si SUPABASE_SERVICE_ROLE_KEY no está configurado
 */
export function createServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL no está configurado en el entorno");
    }

    if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurado en el entorno. Esta variable es requerida para operaciones de servidor que bypass RLS.");
    }

    return createSupabaseClient<Database>(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
