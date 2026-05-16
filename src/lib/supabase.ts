import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Service-role client. Bypasses RLS — use ONLY in server-side pipeline scripts.
 * Never bundle this into a client app.
 */
export function createServiceClient(): SupabaseClient {
    return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
