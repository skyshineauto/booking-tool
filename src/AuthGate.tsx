import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type Props = { children: React.ReactNode };

export default function AuthGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function signIn() {
    setErr(null);
    if (!email.trim() || !password) return;

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (error) setErr(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <div style={{ padding: 24, color: "white" }}>Loading…</div>;
  }

  if (!session) {
    return (
      <>
        {/* Component-scoped styles for responsive layout */}
        <style>{`
          .auth-wrap{
            min-height: 100vh;
            width: 100%;
            display: grid;
            grid-template-rows: 1fr auto 1fr;
            place-items: center;
            position: relative;
            overflow: hidden;
            padding: clamp(16px, 3vw, 36px);
            font-family: "Archivo", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            color: #fff;
          }

          .auth-bg{
            position:absolute; inset:0;
            background-image: url("/bg-garage.jpg");
            background-size: cover;
            background-position: center;
            filter: saturate(1.05) contrast(1.05);
            transform: scale(1.03);
          }
          .auth-vignette{
            position:absolute; inset:0;
            background:
              radial-gradient(900px 540px at 50% 35%, rgba(0,190,255,.18), transparent 60%),
              radial-gradient(1100px 700px at 50% 60%, rgba(0,0,0,.35), transparent 55%),
              linear-gradient(to bottom, rgba(0,0,0,.55), rgba(0,0,0,.65));
          }

          .auth-brand{
            grid-row: 1;
            display:flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
            text-align:center;
            padding-top: clamp(8px, 2vh, 24px);
            z-index: 2;
          }

          .auth-logo{
            width: clamp(120px, 14vw, 190px);
            height: auto;
            filter: drop-shadow(0 18px 34px rgba(0,0,0,.8));
          }

          .auth-title{
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: clamp(1.8px, .18vw, 3px);
            font-size: clamp(26px, 3.2vw, 62px);
            line-height: 1.05;
            text-shadow: 0 18px 60px rgba(0,0,0,.55);
          }

          .auth-subtitle{
            opacity: .85;
            font-size: clamp(12px, 1.1vw, 14px);
            letter-spacing: .6px;
            margin-top: -2px;
          }

          .auth-card{
            grid-row: 2;
            width: min(520px, 92vw);
            border: 1px solid rgba(255,255,255,.14);
            background: rgba(8,10,14,.55);
            backdrop-filter: blur(10px);
            border-radius: 18px;
            padding: 18px;
            z-index: 2;
            box-shadow: 0 18px 60px rgba(0,0,0,.45);
          }

          .auth-card h2{
            margin: 0 0 6px 0;
            font-size: 18px;
            font-weight: 800;
          }

          .auth-card p{
            margin: 0 0 14px 0;
            font-size: 13px;
            opacity: .82;
          }

          .auth-input{
            width: 100%;
            padding: 11px 12px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,.14);
            background: rgba(255,255,255,.04);
            color: #fff;
            outline: none;
            margin-bottom: 10px;
            font-size: 14px;
          }
          .auth-input::placeholder{ color: rgba(255,255,255,.45); }

          .auth-btn{
            width: 100%;
            padding: 11px 12px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,.14);
            background: rgba(0,190,255,.22);
            color: #fff;
            font-weight: 800;
            cursor: pointer;
            transition: transform .08s ease, background .15s ease;
          }
          .auth-btn:hover{ background: rgba(0,190,255,.28); }
          .auth-btn:active{ transform: translateY(1px); }
          .auth-btn:disabled{ opacity: .55; cursor: not-allowed; }

          .auth-error{
            margin-top: 10px;
            color: #ff6b6b;
            font-size: 13px;
          }

          .auth-only{
            margin-top: 12px;
            opacity: .85;
            font-size: 12px;
            letter-spacing: 1.6px;
            text-transform: uppercase;
          }

          .auth-spacer{
            grid-row: 3;
            height: 1px;
            z-index: 2;
          }

          @media (max-width: 520px){
            .auth-card{ padding: 16px; border-radius: 16px; }
            .auth-brand{ padding-top: 10px; }
          }
        `}</style>

        <div className="auth-wrap">
          <div className="auth-bg" aria-hidden="true" />
          <div className="auth-vignette" aria-hidden="true" />

          {/* Row 1: Branding */}
          <div className="auth-brand">
            <img className="auth-logo" src="/logo.png" alt="SkyShine Auto Detailing" />
            <div className="auth-title">SkyShine Auto Detailing</div>
            <div className="auth-subtitle">Booking Tool • Secure Access</div>
          </div>

          {/* Row 2: Card */}
          <div className="auth-card">
            <h2>Sign in</h2>
            <p>Authorized users only. Sign in with email + password.</p>

            <input
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              inputMode="email"
            />

            <input
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
            />

            <button className="auth-btn" onClick={signIn} disabled={busy || !email.trim() || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>

            {err && <div className="auth-error">{err}</div>}

            <div className="auth-only">Authorized Users Only</div>
          </div>

          {/* Row 3: spacer (keeps the card visually centered with breathing room) */}
          <div className="auth-spacer" />
        </div>
      </>
    );
  }

  // Authenticated view
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
