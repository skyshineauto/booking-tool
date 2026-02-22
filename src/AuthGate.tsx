// src/AuthGate.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type Props = { children: React.ReactNode };

type Stage = "LOADING" | "SIGN_IN" | "ENROLL_TOTP" | "VERIFY_TOTP" | "DONE";

export default function AuthGate({ children }: Props) {
  // ✅ Add any other allowed emails here (lowercase)
  const ALLOWED_EMAILS = useMemo(
    () =>
      new Set<string>([
        "autodetail@skyshineautodetailing.com",
        "brsgala61@outlook.com",
      ]),
    []
  );

  const [stage, setStage] = useState<Stage>("LOADING");
  const [session, setSession] = useState<any>(null);

  // Sign-in form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // MFA
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  // UI state
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ---------- helpers ----------
  const normEmail = (v: string) => v.trim().toLowerCase();

  const timeoutPromise = (ms: number) =>
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Try again.")), ms)
    );

  async function decideMfaStage() {
    // AAL: "aal1" (no MFA) or "aal2" (MFA satisfied)
    const { data: aalData, error: aalErr } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalErr) {
      // If this fails for any reason, fall back to factors check
      // (still keep user in flow)
      // eslint-disable-next-line no-console
      console.warn("AAL check failed:", aalErr.message);
    }

    // If already AAL2, we’re good
    if (aalData?.currentLevel === "aal2") return "DONE" as const;

    // If not AAL2, check if they have TOTP enrolled
    const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
    if (fErr) throw new Error(fErr.message);

    const totp = factors?.totp ?? [];
    if (totp.length === 0) return "ENROLL_TOTP" as const;

    // Use first verified factor if possible, else first
    const f = totp.find((x) => x.status === "verified") ?? totp[0];
    setFactorId(f.id);
    return "VERIFY_TOTP" as const;
  }

  // ---------- session bootstrap ----------
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

      if (!data.session) {
        setStage("SIGN_IN");
        return;
      }

      decideMfaStage()
        .then((next) => setStage(next))
        .catch((e: any) => {
          setErr(e?.message ?? "Auth error.");
          setStage("SIGN_IN");
        });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      if (!mounted) return;
      setSession(s);

      if (!s) {
        setStage("SIGN_IN");
        return;
      }

      try {
        const next = await decideMfaStage();
        setStage(next);
      } catch (e: any) {
        setErr(e?.message ?? "Auth error.");
        setStage("SIGN_IN");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ---------- actions ----------
  async function signInWithPassword() {
    setErr(null);

    const e = normEmail(email);
    if (!e) return setErr("Enter your email.");
    if (!password) return setErr("Enter your password.");

    // ✅ local allowlist guard (front-end)
    if (!ALLOWED_EMAILS.has(e)) {
      setErr("Unauthorized user.");
      return;
    }

    setBusy(true);
    try {
      const signInPromise = supabase.auth.signInWithPassword({
        email: e,
        password,
      });

      const { data, error } = await Promise.race([
        signInPromise,
        timeoutPromise(10000),
      ]);

      if (error) {
        setErr(error.message);
        return;
      }

      setSession(data.session);

      const next = await decideMfaStage();
      setStage(next);
    } catch (e2: any) {
      setErr(e2?.message ?? "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function beginEnrollTotp() {
    setErr(null);
    setBusy(true);
    try {
      const enrollPromise = supabase.auth.mfa.enroll({ factorType: "totp" });
      const { data, error } = await Promise.race([
        enrollPromise,
        timeoutPromise(10000),
      ]);

      if (error) {
        setErr(error.message);
        return;
      }

      const f = data?.id;
      const q = data?.totp?.qr_code ?? null;
      const s = data?.totp?.secret ?? null;

      if (!f || !q || !s) {
        setErr("MFA enrollment did not return QR/secret. Try again.");
        return;
      }

      setFactorId(f);
      setQrSvg(q);
      setSecret(s);

      // Now user must verify with a code to complete MFA
      setStage("ENROLL_TOTP");
    } catch (e2: any) {
      setErr(e2?.message ?? "MFA enrollment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyTotp() {
    setErr(null);

    const code = mfaCode.trim();
    if (!factorId) {
      setErr("Missing MFA factor. Refresh and try again.");
      return;
    }
    if (code.length !== 6) {
      setErr("Enter the 6-digit code.");
      return;
    }

    setBusy(true);

    try {
      // Always start a fresh challenge (prevents “stuck verifying”)
      const chPromise = supabase.auth.mfa.challenge({ factorId });
      const { data: ch, error: chErr } = await Promise.race([
        chPromise,
        timeoutPromise(10000),
      ]);

      if (chErr) {
        setErr(chErr.message);
        return;
      }
      if (!ch?.id) {
        setErr("Could not start MFA challenge. Try again.");
        return;
      }

      const vPromise = supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code,
      });

      const { error: vErr } = await Promise.race([
        vPromise,
        timeoutPromise(10000),
      ]);

      if (vErr) {
        setErr(vErr.message);
        return;
      }

      // IMPORTANT: refresh session so it upgrades to AAL2
      await supabase.auth.refreshSession();

      // re-check stage
      const next = await decideMfaStage();
      setStage(next);
    } catch (e2: any) {
      setErr(e2?.message ?? "MFA verification failed. Try again.");
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
      setFactorId(null);
      setQrSvg(null);
      setSecret(null);
      setMfaCode("");
    } finally {
      setBusy(false);
    }
  }

  // ---------- UI ----------
  const bgUrl = "/bg-garage.jpg";
  const logoUrl = "/logo.png";

  const Page = ({ children: pageChildren }: { children: React.ReactNode }) => (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: `linear-gradient(to bottom, rgba(5,6,10,.82), rgba(5,6,10,.78)), url(${bgUrl}) center/cover no-repeat`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(18px, 4vw, 36px)",
        color: "white",
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(16px, 2.8vw, 24px)",
        }}
      >
        {/* Hero */}
        <div style={{ textAlign: "center" }}>
          <img
            src={logoUrl}
            alt="SkyShine Auto Detailing"
            style={{
              width: "clamp(86px, 10vw, 140px)",
              height: "auto",
              display: "block",
              margin: "0 auto 12px auto",
              filter:
                "drop-shadow(0 18px 40px rgba(0,0,0,.55)) drop-shadow(0 0 14px rgba(0,190,255,.18))",
            }}
          />
          <div
            style={{
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontSize: "clamp(22px, 3.3vw, 44px)",
              lineHeight: 1.1,
              textShadow: "0 10px 40px rgba(0,0,0,.55)",
            }}
          >
            SKYSHINE AUTO DETAILING
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: "clamp(12px, 1.25vw, 16px)",
              opacity: 0.92,
              letterSpacing: "0.06em",
            }}
          >
            Booking Tool • Secure Access
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            width: "min(520px, 100%)",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(12,14,18,.62)",
            backdropFilter: "blur(10px)",
            boxShadow:
              "0 24px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06)",
            padding: "clamp(16px, 2vw, 22px)",
          }}
        >
          {pageChildren}
          <div
            style={{
              marginTop: 14,
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

  const Label = ({ children: t }: { children: React.ReactNode }) => (
    <div
      style={{
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: 0.85,
        marginBottom: 6,
      }}
    >
      {t}
    </div>
  );

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
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
        ...(props.style || {}),
      }}
    />
  );

  const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.14)",
        background: busy ? "rgba(0,190,255,.10)" : "rgba(0,190,255,.18)",
        color: "white",
        fontWeight: 800,
        cursor: busy ? "not-allowed" : "pointer",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        ...(props.style || {}),
      }}
      disabled={busy || props.disabled}
    />
  );

  // ---------- render ----------
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
            }}
          >
            Sign out
          </button>
        </div>
        {children}
      </>
    );
  }

  // If we have a session but AAL isn't done, we remain in MFA flow.
  if (stage === "LOADING") {
    return (
      <Page>
        <div style={{ padding: 6, opacity: 0.9 }}>Loading…</div>
      </Page>
    );
  }

  if (!session || stage === "SIGN_IN") {
    return (
      <Page>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Sign in</div>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            Authorized users only.
          </div>

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

          <Button onClick={signInWithPassword}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          {err && (
            <div style={{ marginTop: 4, color: "#ff6b6b", fontSize: 13 }}>
              {err}
            </div>
          )}
        </div>
      </Page>
    );
  }

  if (stage === "ENROLL_TOTP") {
    // If not enrolled yet, show enroll button
    const hasQr = !!qrSvg && !!secret && !!factorId;

    return (
      <Page>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            Two-step verification
          </div>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            Use Authy (or any authenticator) to add the QR code, then enter the
            6-digit code.
          </div>

          {!hasQr ? (
            <>
              <Button onClick={beginEnrollTotp}>
                {busy ? "Preparing…" : "Set up Authy"}
              </Button>
            </>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(0,0,0,.22)",
                }}
              >
                {/* Supabase returns SVG string */}
                <div
                  style={{ width: "min(280px, 100%)" }}
                  dangerouslySetInnerHTML={{ __html: qrSvg! }}
                />
              </div>

              <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
                <div style={{ marginBottom: 6 }}>
                  Secret: <span style={{ opacity: 0.95 }}>{secret}</span>
                </div>
                <div>Scan once, then enter the current 6-digit code below.</div>
              </div>

              <div>
                <Label>6-digit code</Label>
                <Input
                  value={mfaCode}
                  onChange={(e) =>
                    setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="123456"
                />
              </div>

              <Button onClick={verifyTotp}>
                {busy ? "Verifying…" : "Verify & continue"}
              </Button>
            </>
          )}

          {err && (
            <div style={{ marginTop: 4, color: "#ff6b6b", fontSize: 13 }}>
              {err}
            </div>
          )}
        </div>
      </Page>
    );
  }

  // VERIFY_TOTP
  return (
    <Page>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Two-step verification</div>
        <div style={{ opacity: 0.85, fontSize: 13 }}>
          Enter the 6-digit code from Authy to continue.
        </div>

        <div>
          <Label>6-digit code</Label>
          <Input
            value={mfaCode}
            onChange={(e) =>
              setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            placeholder="123456"
          />
        </div>

        <Button onClick={verifyTotp}>
          {busy ? "Verifying…" : "Verify"}
        </Button>

        {err && (
          <div style={{ marginTop: 4, color: "#ff6b6b", fontSize: 13 }}>
            {err}
          </div>
        )}
      </div>
    </Page>
  );
}
