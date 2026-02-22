import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "./lib/supabaseClient";

type Props = { children: ReactNode };

type Stage = "loading" | "signin" | "enroll" | "verify";

export default function AuthGate({ children }: Props) {
  const [stage, setStage] = useState<Stage>("loading");

  const [session, setSession] = useState<any>(null);

  // Sign-in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // MFA
  const [mfaCode, setMfaCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  // Enroll UI
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const footerText = "Terms of Use © 2026 SkyShine AutoDetailing";

  const styles = useMemo(() => {
    return {
      page: {
        minHeight: "100vh",
        width: "100%",
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(180deg, rgba(0,0,0,.65), rgba(0,0,0,.55)), url("/bg-garage.jpg") center/cover no-repeat`,
      } as const,

      wrap: {
        width: "min(980px, 94vw)",
        minHeight: "min(860px, 92vh)",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        alignItems: "center",
        justifyItems: "center",
        padding: "clamp(18px, 3vw, 36px)",
        gap: "clamp(18px, 3vw, 34px)",
      } as const,

      brand: {
        display: "grid",
        justifyItems: "center",
        gap: "10px",
        textAlign: "center",
      } as const,

      logo: {
        width: "clamp(70px, 10vw, 120px)",
        height: "auto",
        filter: "drop-shadow(0 10px 28px rgba(0,0,0,.55))",
      } as const,

      title: {
        margin: 0,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "white",
        fontSize: "clamp(26px, 4.2vw, 48px)",
        textShadow: "0 10px 30px rgba(0,0,0,.65)",
      } as const,

      subtitle: {
        margin: 0,
        color: "rgba(255,255,255,.88)",
        fontWeight: 600,
        fontSize: "clamp(14px, 1.6vw, 18px)",
        letterSpacing: "0.06em",
        textShadow: "0 10px 22px rgba(0,0,0,.55)",
      } as const,

      card: {
        width: "min(520px, 92vw)",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(8,10,14,.68)",
        boxShadow: "0 18px 60px rgba(0,0,0,.55)",
        padding: "18px",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      } as const,

      cardHeader: {
        display: "grid",
        gap: "6px",
        marginBottom: 12,
        textAlign: "center",
      } as const,

      cardTitle: {
        margin: 0,
        fontWeight: 800,
        color: "white",
        fontSize: 18,
        letterSpacing: "0.02em",
      } as const,

      cardDesc: {
        margin: 0,
        color: "rgba(255,255,255,.78)",
        fontSize: 13,
        lineHeight: 1.35,
      } as const,

      field: {
        width: "100%",
        padding: "11px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.05)",
        color: "white",
        outline: "none",
      } as const,

      btn: {
        width: "100%",
        padding: "11px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(0,190,255,.22)",
        color: "white",
        fontWeight: 800,
        cursor: "pointer",
      } as const,

      btnSecondary: {
        width: "100%",
        padding: "11px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.08)",
        color: "white",
        fontWeight: 800,
        cursor: "pointer",
      } as const,

      err: {
        marginTop: 10,
        color: "#ff6b6b",
        fontSize: 13,
        textAlign: "center",
      } as const,

      footer: {
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid rgba(255,255,255,.10)",
        textAlign: "center",
        fontSize: 12,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,.70)",
      } as const,

      qrWrap: {
        display: "grid",
        justifyItems: "center",
        gap: 10,
        marginTop: 10,
      } as const,

      qrBox: {
        width: "min(260px, 70vw)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.06)",
        padding: 12,
      } as const,

      secret: {
        fontSize: 12,
        color: "rgba(255,255,255,.85)",
        wordBreak: "break-all",
        textAlign: "center",
      } as const,

      topRight: {
        position: "fixed",
        right: 12,
        top: 12,
        zIndex: 9999,
      } as const,

      signOut: {
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.08)",
        color: "white",
        cursor: "pointer",
        fontSize: 12,
      } as const,
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setErr(null);

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(data.session);

      // If no session yet -> show signin
      if (!data.session) {
        setStage("signin");
        return;
      }

      // If session exists, enforce MFA
      const next = await decideMfaStage();
      if (!mounted) return;
      setStage(next);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt: any, s: any) => {
      setSession(s);

      if (!s) {
        setStage("signin");
        return;
      }

      const next = await decideMfaStage();
      setStage(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decideMfaStage(): Promise<Stage> {
    // If user has enrolled + verified (AAL2) -> allow into app
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) return "signin";

      // data.currentLevel: "aal1" or "aal2"
      if (data?.currentLevel === "aal2") return "loading"; // will render app below

      // current is aal1, decide enroll vs verify based on factors
      const list = await supabase.auth.mfa.listFactors();
      const totp = list.data?.totp ?? [];

      if (totp.length > 0) {
        // has factor, must verify
        setFactorId(totp[0].id);
        return "verify";
      }

      // no factor yet, must enroll
      return "enroll";
    } catch {
      return "signin";
    }
  }

  async function signInEmailPassword() {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErr(error.message);
        setBusy(false);
        return;
      }

      // After password sign-in, enforce MFA stage
      const next = await decideMfaStage();
      setStage(next);
    } catch (e: any) {
      setErr(e?.message ?? "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function startEnrollTotp() {
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) {
        setErr(error.message);
        return;
      }

      setFactorId(data.id);
      setQrSvg(data.totp.qr_code);
      setSecret(data.totp.secret);

      // After showing QR, user will enter 6-digit in verify stage
      setStage("verify");
    } catch (e: any) {
      setErr(e?.message ?? "MFA enroll failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyTotp() {
    setErr(null);
    if (!factorId) {
      setErr("Missing factor. Try enrolling again.");
      return;
    }

    const code = mfaCode.trim();
    if (code.length < 6) return;

    setBusy(true);
    try {
      // Some flows require challenge first
      if (!challengeId) {
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
        if (chErr) {
          setErr(chErr.message);
          return;
        }
        setChallengeId(ch.id);
      }

      const cid = challengeId ?? (await supabase.auth.mfa.challenge({ factorId })).data?.id;
      if (!cid) {
        setErr("Could not start MFA challenge.");
        return;
      }

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: cid,
        code,
      });

      if (error) {
        setErr(error.message);
        return;
      }

      // Re-check assurance level; if now AAL2, allow app
      const next = await decideMfaStage();
      setStage(next);
    } catch (e: any) {
      setErr(e?.message ?? "MFA verify failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setStage("signin");
    setEmail("");
    setPassword("");
    setMfaCode("");
    setQrSvg(null);
    setSecret(null);
    setFactorId(null);
    setChallengeId(null);
    setErr(null);
  }

  // If we are signed-in and already AAL2, show app (children)
  const showApp = !!session;

  // When showApp is true, we might still be waiting for MFA; decide by stage:
  // - "loading" is used as the “pass-through” when AAL2
  if (showApp) {
    // If the user is authenticated but not AAL2, stage will be "enroll" or "verify"
    if (stage === "loading") {
      return (
        <>
          <div style={styles.topRight}>
            <button onClick={signOut} style={styles.signOut}>
              Sign out
            </button>
          </div>
          {children}
        </>
      );
    }
  }

  // Otherwise show auth UI
  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.brand}>
          <img src="/logo.png" alt="SkyShine Auto Detailing" style={styles.logo} />
          <h1 style={styles.title}>SKYSHINE AUTO DETAILING</h1>
          <p style={styles.subtitle}>Booking Tool • Secure Access</p>
        </div>

        <div style={styles.card}>
          {stage === "signin" && (
            <>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>Sign in</div>
                <div style={styles.cardDesc}>Authorized users only. Sign in with email + password.</div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <input
                  style={styles.field}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                />
                <input
                  style={styles.field}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type="password"
                  autoComplete="current-password"
                />

                <button style={styles.btn} onClick={signInEmailPassword} disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </button>

                {err && <div style={styles.err}>{err}</div>}
              </div>

              <div style={styles.footer}>{footerText}</div>
            </>
          )}

          {stage === "enroll" && (
            <>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>Set up Authy code</div>
                <div style={styles.cardDesc}>
                  To access this tool, you must enable a 6-digit authenticator code (Authy).
                </div>
              </div>

              <button style={styles.btnSecondary} onClick={startEnrollTotp} disabled={busy}>
                {busy ? "Starting…" : "Start setup"}
              </button>

              {err && <div style={styles.err}>{err}</div>}
              <div style={styles.footer}>{footerText}</div>
            </>
          )}

          {stage === "verify" && (
            <>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>Two-step verification</div>
                <div style={styles.cardDesc}>Enter the 6-digit code from Authy to continue.</div>
              </div>

              {!!qrSvg && (
                <div style={styles.qrWrap}>
                  <div style={styles.qrBox} dangerouslySetInnerHTML={{ __html: qrSvg }} />
                  {secret && <div style={styles.secret}>Secret: {secret}</div>}
                  <div style={{ color: "rgba(255,255,255,.70)", fontSize: 12, textAlign: "center" }}>
                    Scan the QR in Authy once, then enter the 6-digit code below.
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <input
                  style={styles.field}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                />

                <button style={styles.btn} onClick={verifyTotp} disabled={busy}>
                  {busy ? "Verifying…" : "Verify"}
                </button>

                {err && <div style={styles.err}>{err}</div>}
              </div>

              <div style={styles.footer}>{footerText}</div>
            </>
          )}

          {stage === "loading" && (
            <>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>Loading…</div>
                <div style={styles.cardDesc}>Checking secure session.</div>
              </div>
              <div style={styles.footer}>{footerText}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
