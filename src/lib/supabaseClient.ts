import { createClient } from "@supabase/supabase-js";

// Hardcoded to avoid Cloudflare env injection issues.
// Publishable key is safe for frontend use with RLS enabled.
const supabaseUrl = sb_publishable_yg0iXd_S0Fv10AuaLmxaFA_OY3hsmb6
const supabaseAnonKey = "PASTE_YOUR_sb_publishable_KEY_HERE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
