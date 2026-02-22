import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bwbhfdmkgirbujrpssse.supabase.co";
const supabaseAnonKey = "sb_publishable_yg0iXd_S0Fv10AuaLmxaFA_OY3hsmb6";

// Hard fail early if this file isn't the one actually deployed
if (!supabaseUrl.startsWith("https://") || !supabaseAnonKey.startsWith("sb_publishable_")) {
  throw new Error("Supabase config not loaded (wrong bundle / wrong file).");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
