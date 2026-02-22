// src/AuthGate.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type Props = { children: React.ReactNode };
type Stage = "LOADING" | "SIGN_IN" | "DONE";

// ---------- UI (DEFINED OUTSIDE to prevent remount / focus loss) ----------
const bgUrl = "/bg-garage.jpg";
const logoUrl = "/logo.png";

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: `linear-gradient(to bottom, rgba(5,6,10,.88), rgba(5,6,10,.82)), url(${bgUrl}) center/cover no-repeat`,
        display: "grid",
        placeItems: "center",
        padding: "clamp(18px, 4vw, 44px)",
        color: "white",
      }}
    >
      <div
        style={{
          width: "min(1040px, 100%)",
          display: "grid",
          gap: "clamp(18px, 3vw, 30px)",
          justifyItems: "center",
          textAlign: "center",
        }}
      >
        {/* HERO */}
        <div style={{ display: "grid", justifyItems: "center" }}>
          <img
            src={logoUrl}
            alt="SkyShine Auto Detailing"
            style={{
              // bigger on desktop but still safe on mobile
              width: "clamp(170px, 22vw, 340px)",
              height: "auto",
              display: "block",
              marginBottom: "clamp(10px, 1.6vw, 16px)",
              filter:
                "drop-shadow(0 24px 60px rgba(0,0,0,.62)) drop-shadow(0 0 22px rgba(0,190,255,.22))",
            }}
          />

          <div
            style={{
              fontWeight: 900,
              textTransform: "uppercase",
              fontSize: "clamp(30px, 4.6vw, 64px)",
              lineHeight: 1.05,
              letterSpacing: "clamp(.06em, .35vw, .14em)",
              textShadow:
                "0 18px 60px rgba(0,0,0,.60), 0 0 22px rgba(0,190,255,.10)",
            }}
          >
            SKYSHINE AUTO DETAILING
          </div>

          <div
            style={{
              marginTop: "clamp(8px, 1.4vw, 14px)",
              fontWeight: 800,
              fontSize: "clamp(15px, 2.1vw, 24px)",
              letterSpacing: "0.06em",
              opacity: 0.96,
              textShadow: "0 10px 40px rgba(0,0,0,.55)",
            }}
          >
            Booking Tool • Secure Access
          </div>
        </div>

        {/* CARD */}
        <div
          style={{
            width: "min(560px, 100%)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,.16)",
            background: "rgba(12,14,18,.62)",
            backdropFilter: "blur(12px)",
            boxShadow:
              "0 26px 90px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.07)",
            padding: "clamp(16px, 2.4vw, 26px)",
            textAlign: "left",
          }}
        >
          {children}

          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,.10)",
              textAlign: "center",
              fontSize: 12,
              letterSpacing: "0.08em",
              opacity: 0.85,
              textTransform: "uppercase",
            }}
          >
            Terms of Use © 2026 SkyShine AutoDetailing
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: 0.85,
        marginBottom: 7,
      }}
    >
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.04)",
        color: "white",
        outline: "none",
        fontSize: 14,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)",
        ...(props.style || {}),
      }}
    />
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }
) {
  const busy = !!props.busy;
  return (
    <button
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 12,
        border: "1px solid rgba(0,190,255,.22)",
        background: busy ? "rgba(0,190,255,.10)" : "rgba(0,190,255,.18)",
        color: "white",
        fontWeight: 900,
        cursor: busy ? "not-allowed" : "pointer",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow:
          "0 14px 36px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.10)",
        ...(props.style || {}),
      }}
      disabled={busy || props.disabled}
    />
  );
}

// ---------- AuthGate ----------
export default function AuthGate({ children }: Props) {
  const [stage, setStage] = useState<Stage>("LOADING");
  const [session, setSession] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const normEmail = (v: string) => v.trim().toLowerCase();

  const timeoutPromise = (ms: number) =>
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Try again.")), ms)
    );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setErr(error.message);
        setStage("SIGN_IN");
        return;
      }

      setSession(data.session);
      setStage(data.session ? "DONE" : "SIGN_IN");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!mounted) return;
      setSession(s);
      setStage(s ? "DONE" : "SIGN_IN");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInWithPassword() {
    setErr(null);

    const e = normEmail(email);
    if (!e) return setErr("Enter your email.");
    if (!password) return setErr("Enter your password.");

    setBusy(true);
    try {
      const signInPromise = supabase.auth.signInWithPassword({
        email: e,
        password,
      });

      const { data, error } = await Promise.race([
        signInPromise,
        timeoutPromise(12000),
      ]);

      if (error) {
        const msg = error.message || "Sign-in failed.";
        setErr(msg);
        return;
      }

      setSession(data.session);
      setStage("DONE");
    } catch (e2: any) {
      setErr(e2?.message ?? "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setErr(null);
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setStage("SIGN_IN");
      setEmail("");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "DONE" && session) {
    return (
      <>
        <div style={{ position: "fixed", right: 12, top: 12, zIndex: 9999 }}>
          <button
            onClick={signOut}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(0,0,0,.35)",
              color: "white",
              cursor: "pointer",
              fontSize: 12,
              backdropFilter: "blur(8px)",
            }}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
        {children}
      </>
    );
  }

  if (stage === "LOADING") {
    return (
      <Page>
        <div style={{ padding: 6, opacity: 0.9 }}>Loading…</div>
      </Page>
    );
  }

  return (
    <Page>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Sign in</div>

        <div style={{ opacity: 0.9, fontSize: 13 }}>Authorized users only.</div>

        <div>
          <Label>Email</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            autoComplete="email"
          />
        </div>

        <div>
          <Label>Password</Label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
          />
        </div>

        <Button onClick={signInWithPassword} busy={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>

        {err && (
          <div style={{ marginTop: 2, color: "#ff6b6b", fontSize: 13 }}>
            {err}
          </div>
        )}
      </div>
    </Page>
  );
}
