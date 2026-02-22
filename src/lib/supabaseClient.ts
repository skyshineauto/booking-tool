import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bwbhfdmkgirbujrpssse.supabase.co";
const supabaseAnonKey = "sb_publishable_yg0iXd_S0Fv10AuaLmxaFA_OY3hsmb6";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
