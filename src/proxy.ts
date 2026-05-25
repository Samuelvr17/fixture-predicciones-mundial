/**
 * middleware.ts (raíz del proyecto)
 *
 * Intercepta cada request para refrescar la sesión de Supabase Auth.
 * Esto es necesario para que los Server Components tengan siempre
 * la sesión más reciente y los tokens no expiren entre navegaciones.
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Aplica el middleware a todas las rutas excepto:
         * - _next/static (archivos estáticos)
         * - _next/image (optimización de imágenes)
         * - favicon.ico, archivos de imagen
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
