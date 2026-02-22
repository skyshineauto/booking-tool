import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bwbhfdmkgirbujrspsse.supabase.co";
const supabaseAnonKey = "sb_publishable_yg0iXd_S0Fv10AuaLmxaFA_OY3hsmb6";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
