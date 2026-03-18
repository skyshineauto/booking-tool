// src/AuthGate.tsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type Props = { children: React.ReactElement };
type Stage = "LOADING" | "SIGN_IN" | "DONE";

export default function AuthGate({ children }: Props) {
  const [stage, setStage] = useState<Stage>("LOADING");
  const [session, setSession] = useState<any>(null);

  const emailRef = useRef<HTMLInputElement | null>(null);
  const passRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bgUrl = "/bg-garage.jpg";
  const logoUrl = "/logo.png";

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

    const e = (emailRef.current?.value ?? "").trim().toLowerCase();
    const p = passRef.current?.value ?? "";

    if (!e) return setErr("Enter your email.");
    if (!p) return setErr("Enter your password.");

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: e,
        password: p,
      });
      if (error) {
        setErr(error.message);
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
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setStage("SIGN_IN");
      setErr(null);
      if (emailRef.current) emailRef.current.value = "";
      if (passRef.current) passRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 12px 13px 40px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(255,255,255,.05)",
    color: "#fff",
    outline: "none",
    fontSize: 14,
    transition: "box-shadow 180ms ease, border-color 180ms ease, background 180ms ease",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
  };

  const Page = ({ children: pageChildren }: { children: React.ReactNode }) => (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: `url(${bgUrl}) center/cover no-repeat`,
        display: "grid",
        placeItems: "center",
        padding: "clamp(18px, 4vw, 40px)",
        color: "white",
      }}
    >
      {/* overlays */}
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(5,6,10,.78), rgba(5,6,10,.84))",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(1200px 700px at 50% 45%, rgba(0,0,0,.28), rgba(0,0,0,.72) 70%, rgba(0,0,0,.86) 100%)",
        }}
      />

      {/* content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "min(980px, 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(18px, 3.2vw, 28px)",
          textAlign: "center",
        }}
      >
        {/* hero */}
        <div style={{ width: "100%" }}>
          <img
            src={logoUrl}
            alt="SkyShine Auto Detailing"
            style={{
              // slightly smaller on mobile (min reduced from 300 -> 240)
              width: "clamp(240px, 34vw, 620px)",
              height: "auto",
              display: "block",
              margin: "0 auto 14px auto",
              filter:
                "drop-shadow(0 28px 70px rgba(0,0,0,.62)) drop-shadow(0 0 20px rgba(0,190,255,.24))",
            }}
          />

          {/* layered headline */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                transform: "translateY(3px)",
                filter: "blur(10px)",
                opacity: 0.55,
                color: "rgba(0,190,255,.35)",
                fontWeight: 900,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontSize: "clamp(28px, 3.9vw, 56px)",
                lineHeight: 1.06,
                textShadow: "0 28px 80px rgba(0,0,0,.70), 0 0 26px rgba(0,190,255,.24)",
              }}
            >
              SKYSHINE AUTO DETAILING
            </div>

            <div
              style={{
                fontWeight: 900,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontSize: "clamp(28px, 3.9vw, 56px)",
                lineHeight: 1.06,
                color: "rgba(255,255,255,.98)",
                textShadow:
                  "0 18px 60px rgba(0,0,0,.70), 0 0 18px rgba(0,190,255,.14), 0 0 2px rgba(0,0,0,.35)",
              }}
            >
              SKYSHINE AUTO DETAILING
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: "clamp(14px, 1.7vw, 22px)",
              opacity: 0.96,
              letterSpacing: "0.10em",
              fontWeight: 800,
              textShadow: "0 14px 44px rgba(0,0,0,.65)",
            }}
          >
            Booking Tool • Secure Access
          </div>

          <div
            aria-hidden="true"
            style={{
              width: "min(620px, 92%)",
              height: 2,
              margin: "14px auto 0 auto",
              borderRadius: 999,
              background:
                "linear-gradient(90deg, rgba(0,190,255,.0), rgba(0,190,255,.92), rgba(255,140,0,.74), rgba(255,140,0,0))",
              boxShadow: "0 12px 34px rgba(0,190,255,.12)",
            }}
          />
        </div>

        {/* card */}
        <div
          style={{
            width: "min(560px, 100%)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(12,14,18,.58)",
            backdropFilter: "blur(14px)",
            boxShadow: "0 28px 90px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.06)",
            padding: "clamp(18px, 2.4vw, 26px)",
            textAlign: "left",
            position: "relative",
          }}
        >
          {pageChildren}

          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,.10)",
              textAlign: "center",
              fontSize: 12,
              letterSpacing: "0.10em",
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

  const Label = ({ children: t }: { children: React.ReactNode }) => (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        opacity: 0.85,
        marginBottom: 6,
      }}
    >
      {t}
    </div>
  );

  const IconWrap = ({ children }: { children: React.ReactNode }) => (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 12,
        top: "50%",
        transform: "translateY(-50%)",
        opacity: 0.75,
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );

  const MailIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
        stroke="rgba(255,255,255,.82)"
        strokeWidth="1.6"
      />
      <path
        d="M6.2 7.6 12 12l5.8-4.4"
        stroke="rgba(0,190,255,.85)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const LockIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M7.5 11V8.8A4.5 4.5 0 0 1 12 4.3a4.5 4.5 0 0 1 4.5 4.5V11"
        stroke="rgba(255,255,255,.82)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7.2 11h9.6A2.2 2.2 0 0 1 19 13.2v5.6A2.2 2.2 0 0 1 16.8 21H7.2A2.2 2.2 0 0 1 5 18.8v-5.6A2.2 2.2 0 0 1 7.2 11Z"
        stroke="rgba(0,190,255,.85)"
        strokeWidth="1.6"
      />
    </svg>
  );

  if (stage === "DONE" && session) {
  return React.cloneElement(children, { onSignOut: signOut } as any);
}

  if (stage === "LOADING") {
    return (
      <Page>
        <div style={{ opacity: 0.92, fontWeight: 800 }}>Loading…</div>
      </Page>
    );
  }

  return (
    <Page>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 10px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.22)",
          marginBottom: 12,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          fontSize: 11,
          opacity: 0.95,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: "rgba(0,190,255,.9)",
            boxShadow: "0 0 0 4px rgba(0,190,255,.12)",
          }}
        />
        Secure Portal
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "0.02em" }}>
          Sign in
        </div>
        <div style={{ opacity: 0.85, fontSize: 13 }}>Authorized users only.</div>

        <div>
          <Label>Email</Label>
          <div style={{ position: "relative" }}>
            <IconWrap>{MailIcon}</IconWrap>
            <input
              ref={emailRef}
              style={inputStyle}
              placeholder="you@domain.com"
              autoComplete="email"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="none"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,190,255,.55)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 4px rgba(0,190,255,.14), inset 0 1px 0 rgba(255,255,255,.05)";
                e.currentTarget.style.background = "rgba(255,255,255,.06)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,.14)";
                e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
                e.currentTarget.style.background = "rgba(255,255,255,.05)";
              }}
            />
          </div>
        </div>

        <div>
          <Label>Password</Label>
          <div style={{ position: "relative" }}>
            <IconWrap>{LockIcon}</IconWrap>
            <input
              ref={passRef}
              style={inputStyle}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              spellCheck={false}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,190,255,.55)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 4px rgba(0,190,255,.14), inset 0 1px 0 rgba(255,255,255,.05)";
                e.currentTarget.style.background = "rgba(255,255,255,.06)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,.14)";
                e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
                e.currentTarget.style.background = "rgba(255,255,255,.05)";
              }}
            />
          </div>
        </div>

        <button
          onClick={signInWithPassword}
          disabled={busy}
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.14)",
            background: busy ? "rgba(0,190,255,.10)" : "rgba(0,190,255,.18)",
            color: "white",
            fontWeight: 900,
            cursor: busy ? "not-allowed" : "pointer",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            transition: "transform 120ms ease, filter 120ms ease, background 160ms ease",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {err && <div style={{ marginTop: 4, color: "#ff6b6b", fontSize: 13 }}>{err}</div>}
      </div>
    </Page>
  );
}
