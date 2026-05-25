/**
 * src/lib/supabase/client.ts
 *
 * Cliente Supabase para uso en componentes Client ("use client").
 * Usa createBrowserClient de @supabase/ssr para manejar cookies en el browser.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
