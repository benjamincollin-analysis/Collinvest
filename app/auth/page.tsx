"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const particles = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      dx: (Math.random() - 0.5) * 0.2, dy: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.25 + 0.05,
    }));
    let animId: number;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,158,11,${p.opacity})`; ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError(""); setMessage("");
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Account created! Check your email to confirm, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = "/Dashboard";
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setOauthLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/Dashboard` },
    });
    if (error) { setError(error.message); setOauthLoading(false); }
  }

  const IS: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px",
    padding: "13px 16px", fontSize: "14px", color: "#fff",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .auth-card { animation: fadeUp 0.6s ease forwards; }
        .auth-input:focus { border-color: rgba(245,158,11,0.5) !important; background: rgba(245,158,11,0.04) !important; }
        .submit-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .submit-btn { transition: all 0.2s ease !important; }
        .tab-btn:hover { color: rgba(255,255,255,0.7) !important; }
        .google-btn:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.2) !important; transform: translateY(-1px); }
        .google-btn { transition: all 0.2s ease !important; }
        @media (max-width: 480px) {
          .auth-inner { padding: 28px 20px !important; }
          .auth-wrap { padding: 16px !important; }
        }
      `}</style>

      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(245,158,11,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.02) 1px,transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "600px", height: "300px", background: "radial-gradient(ellipse at top,rgba(245,158,11,0.07) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div className="auth-wrap auth-card" style={{ width: "100%", maxWidth: "420px", padding: "20px", position: "relative", zIndex: 10 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "36px", justifyContent: "center" }}>
          <div style={{ width: "38px", height: "38px", background: "#f59e0b", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "#000", boxShadow: "0 0 20px rgba(245,158,11,0.3)" }}>GS</div>
          <span style={{ fontSize: "20px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>GOLDSTREAM</span>
          <span style={{ fontSize: "9px", fontWeight: "600", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "4px", padding: "2px 7px", letterSpacing: "0.5px" }}>BETA</span>
        </div>

        {/* Card */}
        <div className="auth-inner" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "36px", backdropFilter: "blur(20px)" }}>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "2px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "3px", marginBottom: "32px" }}>
            {(["login", "signup"] as const).map((m) => (
              <button key={m} className="tab-btn" onClick={() => { setMode(m); setError(""); setMessage(""); }}
                style={{ flex: 1, padding: "9px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer", transition: "all 0.2s", background: mode === m ? "rgba(255,255,255,0.08)" : "transparent", color: mode === m ? "#fff" : "rgba(255,255,255,0.35)" }}>
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Google button */}
          <button className="google-btn" onClick={handleGoogle} disabled={oauthLoading || loading}
            style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: oauthLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "20px" }}>
            {oauthLoading ? (
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Connecting...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.5px", fontWeight: "600" }}>OR</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "7px", fontWeight: "700" }}>Email</label>
              <input className="auth-input" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={IS} />
            </div>
            <div>
              <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "7px", fontWeight: "700" }}>Password</label>
              <input className="auth-input" type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={IS} />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: "14px", padding: "11px 14px", background: "rgba(248,113,113,0.08)", borderRadius: "10px", border: "1px solid rgba(248,113,113,0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>⚠</span>
              <p style={{ fontSize: "12px", color: "#f87171" }}>{error}</p>
            </div>
          )}
          {message && (
            <div style={{ marginTop: "14px", padding: "11px 14px", background: "rgba(52,211,153,0.08)", borderRadius: "10px", border: "1px solid rgba(52,211,153,0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>✓</span>
              <p style={{ fontSize: "12px", color: "#34d399" }}>{message}</p>
            </div>
          )}

          <button className="submit-btn" onClick={handleSubmit} disabled={loading || oauthLoading}
            style={{ width: "100%", marginTop: "20px", padding: "14px", background: loading ? "rgba(245,158,11,0.5)" : "#f59e0b", color: "#000", borderRadius: "12px", fontSize: "14px", fontWeight: "800", border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "..." : mode === "login" ? "Log In →" : "Create Account →"}
          </button>

          <p style={{ textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.18)", marginTop: "20px", lineHeight: "1.5" }}>
            Your portfolio data is private and encrypted.
          </p>
        </div>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <a href="/" style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>
            ← Back to Goldstream
          </a>
        </div>
      </div>
    </div>
  );
}

