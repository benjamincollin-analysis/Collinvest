"use client";

import { useEffect, useRef } from "react";

const DEMO_MARKERS = [
  { lat: 29.76, lng: -95.37, value: "$420K", cf: "+$1,800" },
  { lat: 48.85, lng: 2.35, value: "$680K", cf: "+$2,100" },
  { lat: 51.50, lng: -0.12, value: "$890K", cf: "+$3,400" },
  { lat: 40.71, lng: -74.00, value: "$1.2M", cf: "+$4,200" },
  { lat: 34.05, lng: -118.24, value: "$760K", cf: "+$2,900" },
  { lat: 43.65, lng: -79.38, value: "$540K", cf: "+$1,600" },
  { lat: -33.87, lng: 151.21, value: "$820K", cf: "+$2,700" },
  { lat: 35.68, lng: 139.69, value: "$950K", cf: "+$3,100" },
  { lat: 19.43, lng: -99.13, value: "$210K", cf: "+$900" },
  { lat: 52.52, lng: 13.40, value: "$480K", cf: "+$1,500" },
  { lat: 25.20, lng: 55.27, value: "$1.1M", cf: "+$3,800" },
  { lat: 1.35, lng: 103.82, value: "$720K", cf: "+$2,300" },
];

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.25, dy: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.35 + 0.08,
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

  useEffect(() => {
    if (typeof window === "undefined" || leafletRef.current) return;
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const style = document.createElement("style");
    style.textContent = `.leaflet-layer{filter:invert(1) hue-rotate(195deg) brightness(0.35) contrast(1.1) saturate(0.25)}.leaflet-container{background:#030608!important}.leaflet-control-zoom,.leaflet-control-attribution{display:none!important}`;
    document.head.appendChild(style);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = (window as any).L;
      if (!mapRef.current) return;
      const map = L.map(mapRef.current, {
        center: [20, 10], zoom: 2, zoomControl: false,
        attributionControl: false, dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, keyboard: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 5 }).addTo(map);
      leafletRef.current = map;
      DEMO_MARKERS.forEach((m) => {
        const html = `<div style="background:rgba(5,10,15,0.92);border:2px solid #f59e0b;border-radius:8px;padding:5px 10px;font-family:'DM Sans',sans-serif;text-align:center;position:relative;box-shadow:0 0 14px rgba(245,158,11,0.35);">
          <div style="font-size:11px;font-weight:800;color:#f59e0b;">${m.value}</div>
          <div style="font-size:9px;color:#34d399;font-weight:700;">${m.cf}/mo</div>
          <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #f59e0b;"></div>
        </div>`;
        const icon = L.divIcon({ html, className: "", iconSize: [90, 46], iconAnchor: [45, 52] });
        L.marker([m.lat, m.lng], { icon }).addTo(map);
      });
      let angle = 0;
      const pan = setInterval(() => {
        angle += 0.02;
        map.panTo([20 + Math.sin(angle * 0.3) * 5, 10 + angle * 0.8], { animate: true, duration: 2 });
      }, 3000);
      return () => clearInterval(pan);
    };
    document.head.appendChild(script);
  }, []);

  const features = [
    { icon: "◈", title: "Portfolio Tracking", desc: "Real-time value, equity, and cash flow across all your properties." },
    { icon: "◎", title: "Tactical Map", desc: "Military-grade dark map showing every asset with live financial data." },
    { icon: "⟁", title: "10-Year Projections", desc: "See your path to $1M and $2M with scenario simulation." },
    { icon: "✦", title: "AI Analysis", desc: "Instant portfolio insights on velocity, risk, and next move." },
    { icon: "⬡", title: "Goal Tracking", desc: "Visual progress toward your $2M portfolio and $2K/mo cash flow targets." },
    { icon: "◑", title: "Investor Clubs", desc: "Coming soon — share dashboards, combine portfolios, build together." },
  ];

  const stats = [
    { value: "$2M", label: "Portfolio Goal" },
    { value: "10yr", label: "Projection Horizon" },
    { value: "∞", label: "Properties Tracked" },
    { value: "AI", label: "Powered Insights" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fade1 { animation: fadeUp 0.7s ease forwards; }
        .fade2 { animation: fadeUp 0.7s ease 0.15s forwards; opacity:0; }
        .fade3 { animation: fadeUp 0.7s ease 0.3s forwards; opacity:0; }
        .fade4 { animation: fadeUp 0.7s ease 0.45s forwards; opacity:0; }
        .cta-btn:hover { transform: scale(1.03); box-shadow: 0 0 30px rgba(245,158,11,0.4) !important; }
        .sec-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .feature-card:hover { border-color: rgba(245,158,11,0.3) !important; background: rgba(245,158,11,0.04) !important; transform: translateY(-2px); }
        .feature-card { transition: all 0.2s ease; }

        /* ── NAV ── */
        .lp-nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 40px; border-bottom: 1px solid rgba(255,255,255,0.06); position: relative; z-index: 10; }
        @media (max-width: 600px) {
          .lp-nav { padding: 14px 16px; }
          .lp-nav-cta-text { display: none; }
        }

        /* ── HERO ── */
        .lp-hero { max-width: 900px; margin: 0 auto; padding: 80px 24px 60px; text-align: center; position: relative; z-index: 10; }
        @media (max-width: 600px) {
          .lp-hero { padding: 48px 20px 40px; }
        }

        /* ── HERO BUTTONS ── */
        .lp-hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        @media (max-width: 400px) {
          .lp-hero-btns { flex-direction: column; align-items: center; }
          .lp-hero-btns a { width: 100%; text-align: center; }
        }

        /* ── MOCKUP ── */
        .lp-mockup { max-width: 1100px; margin: 0 auto 80px; padding: 0 24px; position: relative; z-index: 10; }
        .lp-mockup-inner { border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.1); }
        .lp-mockup-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
        @media (max-width: 600px) {
          .lp-mockup { padding: 0 12px; margin-bottom: 48px; }
          .lp-mockup-kpis { grid-template-columns: 1fr 1fr !important; }
          .lp-mockup-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
          .lp-mockup-kpi-val { font-size: 18px !important; }
        }

        /* ── STATS BAND ── */
        .lp-stats { max-width: 900px; margin: 0 auto 80px; padding: 0 24px; position: relative; z-index: 10; }
        .lp-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: rgba(255,255,255,0.06); border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); }
        @media (max-width: 640px) {
          .lp-stats { padding: 0 12px; margin-bottom: 48px; }
          .lp-stats-grid { grid-template-columns: repeat(2,1fr); }
          .lp-stats-grid > div:nth-child(2) { border-right: none; }
          .lp-stats-grid > div:nth-child(3) { border-top: 1px solid rgba(255,255,255,0.06); }
        }

        /* ── FEATURES ── */
        .lp-features { max-width: 1100px; margin: 0 auto 80px; padding: 0 24px; position: relative; z-index: 10; }
        .lp-features-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
        @media (max-width: 768px) {
          .lp-features { padding: 0 12px; margin-bottom: 48px; }
          .lp-features-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .lp-features-grid { grid-template-columns: 1fr; }
        }

        /* ── CTA BOTTOM ── */
        .lp-cta { max-width: 700px; margin: 0 auto 80px; padding: 0 24px; text-align: center; position: relative; z-index: 10; }
        @media (max-width: 600px) {
          .lp-cta { padding: 0 12px; margin-bottom: 48px; }
          .lp-cta-box { padding: 40px 24px !important; }
          .lp-cta-title { font-size: 26px !important; }
        }

        /* ── FOOTER ── */
        .lp-footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 28px 40px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 10; gap: 16px; flex-wrap: wrap; }
        @media (max-width: 600px) {
          .lp-footer { padding: 20px 16px; flex-direction: column; text-align: center; gap: 12px; }
        }

        /* ── HERO TITLE ── */
        .lp-h1 { font-size: clamp(36px, 8vw, 80px); font-weight: 800; letter-spacing: -2px; line-height: 1.05; margin-bottom: 20px; background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .lp-h1-accent { background: linear-gradient(135deg, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .lp-subtitle { font-size: clamp(14px, 3vw, 18px); color: rgba(255,255,255,0.45); line-height: 1.6; max-width: 520px; margin: 0 auto 40px; }
      `}</style>

      {/* Map BG */}
      <div ref={mapRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(to bottom, rgba(8,8,8,0.88) 0%, rgba(8,8,8,0.78) 40%, rgba(8,8,8,0.96) 100%)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(245,158,11,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.025) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 3 }} />
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "900px", height: "400px", background: "radial-gradient(ellipse at top, rgba(245,158,11,0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 3 }} />

      {/* Nav */}
      <nav className="lp-nav">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", color: "#000", flexShrink: 0 }}>GS</div>
          <span style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "-0.3px" }}>GOLDSTREAM</span>
          <span style={{ fontSize: "9px", fontWeight: "600", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "4px", padding: "2px 6px", flexShrink: 0 }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <a href="/auth" style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textDecoration: "none", padding: "8px 14px", borderRadius: "8px" }}>Log In</a>
          <a href="/auth" className="cta-btn" style={{ fontSize: "13px", fontWeight: "700", color: "#000", background: "#f59e0b", padding: "9px 18px", borderRadius: "8px", textDecoration: "none", transition: "all 0.2s", display: "inline-block", whiteSpace: "nowrap" }}>
            <span className="lp-nav-cta-text">Get Started </span>→
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="lp-hero">
        <div className="fade1" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "999px", padding: "6px 16px", fontSize: "11px", color: "#f59e0b", fontWeight: "600", letterSpacing: "0.5px", marginBottom: "28px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
          REAL ESTATE PORTFOLIO INTELLIGENCE
        </div>
        <h1 className="fade2 lp-h1">
          Track your path<br />to <span className="lp-h1-accent">$2M</span>
        </h1>
        <p className="fade3 lp-subtitle">
          The portfolio dashboard built for landlords with ambition. Track properties, simulate growth, and see exactly when you hit your goals.
        </p>
        <div className="fade4 lp-hero-btns">
          <a href="/auth" className="cta-btn" style={{ fontSize: "15px", fontWeight: "800", color: "#000", background: "linear-gradient(135deg,#f59e0b,#d97706)", padding: "15px 32px", borderRadius: "12px", textDecoration: "none", transition: "all 0.2s", display: "inline-block", boxShadow: "0 0 20px rgba(245,158,11,0.25)" }}>
            Start for free →
          </a>
          <a href="/auth" className="sec-btn" style={{ fontSize: "15px", fontWeight: "600", color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", padding: "15px 32px", borderRadius: "12px", textDecoration: "none", transition: "all 0.2s", display: "inline-block" }}>
            Log in
          </a>
        </div>
      </section>

      {/* Dashboard preview mockup */}
      <section className="lp-mockup">
        <div className="lp-mockup-inner">
          {/* Fake browser bar */}
          <div style={{ background: "#111", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            {["#ef4444","#f59e0b","#22c55e"].map((c) => <div key={c} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c, opacity: 0.6, flexShrink: 0 }} />)}
            <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "4px 10px", fontSize: "10px", color: "rgba(255,255,255,0.2)", marginLeft: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>propvest-two.vercel.app/Dashboard</div>
          </div>
          {/* Dashboard preview content */}
          <div style={{ background: "#080808", padding: "20px" }}>
            {/* Mini nav */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "22px", height: "22px", background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "800", color: "#000", flexShrink: 0 }}>GS</div>
                <span style={{ fontSize: "13px", fontWeight: "700" }}>GOLDSTREAM</span>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {["portfolio","map","projections"].map((t) => <div key={t} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "10px", background: t === "portfolio" ? "rgba(255,255,255,0.08)" : "transparent", color: t === "portfolio" ? "#fff" : "rgba(255,255,255,0.3)", fontWeight: "600" }}>{t}</div>)}
              </div>
            </div>
            {/* KPI cards */}
            <div className="lp-mockup-kpis" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              {[
                { label: "Portfolio Value", value: "$840K", pct: 42, color: "linear-gradient(90deg,#d97706,#f59e0b)", glow: "rgba(245,158,11,0.4)", vc: "#fff" },
                { label: "Monthly Cash Flow", value: "+$3,200", pct: 100, color: "linear-gradient(90deg,#059669,#34d399)", glow: "rgba(52,211,153,0.3)", vc: "#34d399" },
              ].map((c) => (
                <div key={c.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                  <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>{c.label}</p>
                  <p className="lp-mockup-kpi-val" style={{ fontSize: "22px", fontWeight: "800", marginBottom: "10px", color: c.vc }}>{c.value}</p>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }}>
                    <div style={{ height: "100%", width: `${c.pct}%`, background: c.color, borderRadius: "999px", boxShadow: `0 0 8px ${c.glow}` }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Stats row */}
            <div className="lp-mockup-stats">
              {[
                { l: "Total Equity", v: "$290K", c: "#f59e0b" },
                { l: "Gross Rent", v: "$4,200/mo", c: "#fff" },
                { l: "Properties", v: "3", c: "#fff" },
                { l: "Avg ROI", v: "8.4%", c: "#34d399" },
              ].map((m) => (
                <div key={m.l} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "12px" }}>
                  <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "5px" }}>{m.l}</p>
                  <p style={{ fontSize: "14px", fontWeight: "800", color: m.c }}>{m.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="lp-stats">
        <div className="lp-stats-grid">
          {stats.map((s, i) => (
            <div key={s.label} style={{ background: "#080808", padding: "28px 20px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <p style={{ fontSize: "32px", fontWeight: "800", color: "#f59e0b", letterSpacing: "-1px", marginBottom: "6px" }}>{s.value}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="lp-features">
        <h2 style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: "800", letterSpacing: "-1px", textAlign: "center", marginBottom: "12px" }}>
          Everything a landlord needs
        </h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "14px", marginBottom: "40px" }}>
          Built by a landlord, for landlords with a $2M vision.
        </p>
        <div className="lp-features-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "24px" }}>
              <div style={{ fontSize: "22px", color: "#f59e0b", marginBottom: "12px" }}>{f.icon}</div>
              <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>{f.title}</h3>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: "1.6" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="lp-cta">
        <div className="lp-cta-box" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "24px", padding: "56px 40px" }}>
          <h2 className="lp-cta-title" style={{ fontSize: "32px", fontWeight: "800", letterSpacing: "-1px", marginBottom: "14px" }}>
            Ready to track your portfolio?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "32px", lineHeight: "1.6" }}>
            Free to start. Add your properties in 2 minutes.
          </p>
          <a href="/auth" className="cta-btn" style={{ fontSize: "15px", fontWeight: "800", color: "#000", background: "linear-gradient(135deg,#f59e0b,#d97706)", padding: "15px 36px", borderRadius: "12px", textDecoration: "none", transition: "all 0.2s", display: "inline-block", boxShadow: "0 0 24px rgba(245,158,11,0.3)" }}>
            Start for free →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "22px", height: "22px", background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "800", color: "#000", flexShrink: 0 }}>GS</div>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "rgba(255,255,255,0.4)" }}>GOLDSTREAM</span>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>© 2026 · Built for landlords with ambition</p>
        <a href="/auth" style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Log in →</a>
      </footer>
    </div>
  );
}
