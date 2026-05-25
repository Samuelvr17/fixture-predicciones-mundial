/**
 * src/lib/supabase/server.ts
 *
 * Cliente Supabase para uso en Server Components, Server Actions y Route Handlers.
 * Usa createServerClient de @supabase/ssr con cookies de Next.js.
 */

import { createServerClient } from "@supabase/ssr";
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
