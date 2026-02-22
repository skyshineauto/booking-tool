import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type Props = { children: React.ReactNode };

export default function AuthGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function sendLink() {
    setErr(null);
    if (!email.trim()) return;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) setErr(error.message);
    else setSent(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div style={{ padding: 24, color: "white" }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05060a", color: "white" }}>
        <div style={{ width: 380, maxWidth: "92vw", border: "1px solid rgba(255,255,255,.12)", borderRadius: 16, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Sign in</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>
            {sent ? "Check your email for the magic link." : "Enter your email to receive a magic link."}
          </div>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.04)",
              color: "white",
              outline: "none",
              marginBottom: 10,
            }}
          />

          <button
            onClick={sendLink}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(0,190,255,.18)",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Send magic link
          </button>

          {err && <div style={{ marginTop: 10, color: "#ff6b6b", fontSize: 13 }}>{err}</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ position: "fixed", right: 12, top: 12, zIndex: 9999 }}>
        <button
          onClick={signOut}
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(255,255,255,.06)",
            color: "white",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
