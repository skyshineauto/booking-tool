import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type Props = { children: React.ReactNode };

type TotpEnroll = {
  factorId: string;
  qrCode: string; // svg or data url depending on Supabase response
  secret: string;
  uri: string;
};

export default function AuthGate({ children }: Props) {
  const [loading, setLoading] = useState(true);

  // auth state
  const [session, setSession] = useState<any>(null);

  // login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // mfa state
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);

  // enrollment (if user not enrolled yet)
  const [enroll, setEnroll] = useState<TotpEnroll | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const origin = useMemo(() => window.location.origin, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(data.session);
      setLoading(false);

      // If already signed in, check whether MFA is required to reach AAL2
      if (data.session) {
        await refreshMfaRequirement();
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      setSession(s);
      setLoading(false);
      if (s) await refreshMfaRequirement();
      else {
        setNeedsMfa(false);
        setChallengeId(null);
        setEnroll(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshMfaRequirement() {
    // Determines whether Supabase wants an MFA step (AAL2) for this session
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;

      // If current is aal1 and next is aal2, user must do MFA to elevate
      const mustDoMfa = data?.currentLevel === "aal1" && data?.nextLevel === "aal2";
      setNeedsMfa(!!mustDoMfa);

      if (mustDoMfa) {
        setInfo("Enter your 6-digit Authy code to finish signing in.");
        // Prepare a challenge for the first available TOTP factor, or enroll if none
        await prepareTotpChallengeOrEnroll();
      } else {
        setInfo(null);
        setChallengeId(null);
        setEnroll(null);
      }
    } catch (e: any) {
      // If MFA not enabled in project, this might throw—don’t hard fail the app.
      console.warn("MFA AAL check failed:", e?.message || e);
      setNeedsMfa(false);
    }
  }

  async function prepareTotpChallengeOrEnroll() {
    setErr(null);

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setErr(error.message);
      return;
    }

    const totp = data?.totp ?? [];
    if (totp.length === 0) {
      // Not enrolled => show enrollment UI
      setEnroll(null);
      setChallengeId(null);
      setInfo("Set up Authy (TOTP) for this account, then verify the 6-digit code.");
      return;
    }

    const factorId = totp[0].id;
    const chall = await supabase.auth.mfa.challenge({ factorId });
    if (chall.error) {
      setErr(chall.error.message);
      return;
    }

    setEnroll(null);
    setChallengeId(chall.data.id);
  }

  async function signInWithPassword() {
    setErr(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setErr("Email and password are required.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { redirectTo: origin }, // keeps things consistent for future flows
    });

    if (error) {
      setErr(error.message);
      return;
    }

    // session will update via onAuthStateChange; MFA check runs there
  }

  async function startTotpEnrollment() {
    setErr(null);
    setInfo("Generating your Authy setup…");

    const res = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (res.error) {
      setErr(res.error.message);
      setInfo(null);
      return;
    }

    const factorId = res.data.id;
    const qrCode = res.data.totp.qr_code;
    const secret = res.data.totp.secret;
    const uri = res.data.totp.uri;

    setEnroll({ factorId, qrCode, secret, uri });
    setInfo("Scan the QR in Authy (or paste the secret), then enter the 6-digit code to verify.");
    setChallengeId(null);
  }

  async function verifyMfaCode() {
    setErr(null);

    const code = mfaCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) {
      setErr("Enter a valid 6-digit code.");
      return;
    }

    // If user is enrolled but we don’t have a challengeId yet, create one now
    let factorId: string | null = null;

    if (enroll?.factorId) {
      factorId = enroll.factorId;
    } else {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setErr(error.message);
        return;
      }
      const totp = data?.totp ?? [];
      factorId = totp[0]?.id ?? null;
    }

    if (!factorId) {
      setErr("No TOTP factor found. Click ‘Set up Authy’ first.");
      return;
    }

    let useChallengeId = challengeId;
    if (!useChallengeId) {
      const chall = await supabase.auth.mfa.challenge({ factorId });
      if (chall.error) {
        setErr(chall.error.message);
        return;
      }
      useChallengeId = chall.data.id;
      setChallengeId(useChallengeId);
    }

    const v = await supabase.auth.mfa.verify({
      factorId,
      challengeId: useChallengeId,
      code,
    });

    if (v.error) {
      setErr(v.error.message);
      return;
    }

    setInfo(null);
    setNeedsMfa(false);
    setEnroll(null);
    setChallengeId(null);
    setMfaCode("");

    // Confirm AAL2 achieved
    await refreshMfaRequirement();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // --- UI styles ---
  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    color: "white",
    background: `linear-gradient(rgba(0,0,0,.75), rgba(0,0,0,.85)), url(/bg-garage.jpg) center/cover no-repeat fixed`,
    display: "grid",
    placeItems: "center",
    padding: 24,
  };

  const cardStyle: React.CSSProperties = {
    width: 460,
    maxWidth: "92vw",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(8,10,14,.72)",
    boxShadow: "0 20px 60px rgba(0,0,0,.45)",
    padding: 18,
    backdropFilter: "blur(10px)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(255,255,255,.04)",
    color: "white",
    outline: "none",
  };

  const btnStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,190,255,.18)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  };

  if (loading) {
    return <div style={{ padding: 24, color: "white", background: "#05060a" }}>Loading…</div>;
  }

  // Signed in + MFA satisfied
  if (session && !needsMfa) {
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

  // Not signed in OR needs MFA
  return (
    <div style={pageStyle}>
      <div style={{ textAlign: "center", marginBottom: 10, maxWidth: 900 }}>
        <img
          src="/logo.png"
          alt="SkyShine"
          style={{ width: 78, height: 78, objectFit: "contain", filter: "drop-shadow(0 10px 20px rgba(0,0,0,.6))" }}
        />
        <div style={{ fontWeight: 900, fontSize: 34, letterSpacing: 1.2, marginTop: 10, textTransform: "uppercase" }}>
          SkyShine Auto Detailing
        </div>
        <div style={{ opacity: 0.8, marginTop: 4, fontSize: 14 }}>
          Booking Tool • Secure Access
        </div>
      </div>

      <div style={cardStyle}>
        {/* Header */}
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
          {session ? "Two-Step Verification" : "Sign in"}
        </div>

        <div style={{ opacity: 0.82, fontSize: 13, marginBottom: 12 }}>
          {info ||
            (session
              ? "Enter your 6-digit Authy code to continue."
              : "Authorized users only. Sign in with email + password.")}
        </div>

        {/* Login form */}
        {!session && (
          <>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                style={inputStyle}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
                style={inputStyle}
              />
              <button onClick={signInWithPassword} style={btnStyle}>
                Sign in
              </button>
            </div>
          </>
        )}

        {/* MFA flow */}
        {session && (
          <>
            {/* If not enrolled, offer setup */}
            {!enroll && (
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={startTotpEnrollment}
                  style={{
                    ...btnStyle,
                    background: "rgba(255,255,255,.08)",
                  }}
                >
                  Set up Authy (Authenticator)
                </button>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 8 }}>
                  If this account is already enrolled, you can ignore this and just enter the 6-digit code below.
                </div>
              </div>
            )}

            {/* Enrollment details */}
            {enroll && (
              <div style={{ marginBottom: 12, border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Scan this in Authy</div>

                {/* Supabase returns qr_code often as an SVG string; render safely */}
                {enroll.qrCode.startsWith("<svg") ? (
                  <div
                    style={{ background: "white", borderRadius: 12, padding: 10, display: "inline-block" }}
                    dangerouslySetInnerHTML={{ __html: enroll.qrCode }}
                  />
                ) : (
                  <img
                    src={enroll.qrCode}
                    alt="TOTP QR Code"
                    style={{ width: 180, height: 180, background: "white", borderRadius: 12, padding: 10 }}
                  />
                )}

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                  Or in Authy, choose “Enter key manually” and paste this secret:
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.04)",
                    wordBreak: "break-all",
                  }}
                >
                  {enroll.secret}
                </div>
              </div>
            )}

            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="6-digit code"
              inputMode="numeric"
              style={{ ...inputStyle, marginBottom: 10 }}
            />

            <button onClick={verifyMfaCode} style={btnStyle}>
              Verify code
            </button>
          </>
        )}

        {/* Errors */}
        {err && <div style={{ marginTop: 10, color: "#ff6b6b", fontSize: 13 }}>{err}</div>}

        {/* Footer note */}
        <div style={{ marginTop: 12, opacity: 0.65, fontSize: 12, lineHeight: 1.35 }}>
          Tip: If someone tries to sign up, it will be blocked because signups are disabled in Supabase.
        </div>
      </div>
    </div>
  );
}
