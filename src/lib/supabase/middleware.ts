/**
 * src/lib/supabase/middleware.ts
 *
 * Lógica Supabase para el middleware de Next.js.
 * Refresca la sesión de usuario en cada request para evitar expiración de tokens.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresca el token de sesión sin redirigir.
    // El usuario se usa más adelante para proteger rutas si se necesita.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Protección de rutas
    const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
    const isGroups = request.nextUrl.pathname.startsWith('/groups');
    const isAuthRoute = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register';

    if (!user && (isDashboard || isGroups)) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    if (user && isAuthRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    void user; // evita unused variable warning

    return supabaseResponse;
}
