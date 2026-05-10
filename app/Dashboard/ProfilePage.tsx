"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrivacySettings {
  showExactPortfolio: boolean;   // else shows range
  showExactCashFlow: boolean;    // else shows range
  showExactEquity: boolean;
  showPropertyCount: boolean;
  showStrategy: boolean;
  showMarkets: boolean;
}

interface InvestorProfile {
  id: string;
  name: string;
  initials: string;
  tier: string;
  verified: boolean;
  influenceScore: number;
  memberSince: string;
  streakDays: number;
  markets: string[];
  strategy: string;
  propertyCount: number;
  portfolioValue: number;
  cashFlow: number;
  equity: number;
  totalDeals: number;
  winRate: number;
  posts: number;
  following: number;
  followers: number;
  badges: string[];
  recentPosts: { id: string; type: string; content: string; timeAgo: string; reactions: number }[];
  privacy: PrivacySettings;
  isOwnProfile: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_PROFILE: InvestorProfile = {
  id: "jordan-id",
  name: "Jordan V.",
  initials: "JV",
  tier: "Architect",
  verified: true,
  influenceScore: 847,
  memberSince: "Jan 2022",
  streakDays: 14,
  markets: ["Houston", "Dallas", "Austin"],
  strategy: "Multifamily",
  propertyCount: 7,
  portfolioValue: 1200000,
  cashFlow: 8400,
  equity: 680000,
  totalDeals: 12,
  winRate: 83,
  posts: 47,
  following: 23,
  followers: 189,
  badges: ["🏆 Top Caller", "🔥 12-deal streak", "✓ Verified", "📍 Houston #1"],
  recentPosts: [
    { id: "p1", type: "deal", content: "Just closed on a $640K triplex in Midtown Houston. 7.2% cap rate, fully occupied.", timeAgo: "2h ago", reactions: 78 },
    { id: "p2", type: "win", content: "Portfolio crossed $1.2M. 3 years of work. Keep going.", timeAgo: "1w ago", reactions: 203 },
    { id: "p3", type: "hottake", content: "Houston multifamily is the most underrated market in America right now.", timeAgo: "2w ago", reactions: 188 },
  ],
  privacy: {
    showExactPortfolio: true,
    showExactCashFlow: false,
    showExactEquity: false,
    showPropertyCount: true,
    showStrategy: true,
    showMarkets: true,
  },
  isOwnProfile: false,
};

const OWN_PROFILE: InvestorProfile = {
  ...MOCK_PROFILE,
  id: "me",
  name: "Bob",
  initials: "B",
  tier: "Builder I",
  influenceScore: 203,
  streakDays: 8,
  portfolioValue: 280000,
  cashFlow: 1200,
  equity: 95000,
  propertyCount: 2,
  totalDeals: 3,
  winRate: 67,
  posts: 12,
  following: 18,
  followers: 34,
  badges: ["✓ Verified", "🔥 8-day streak"],
  isOwnProfile: true,
  privacy: {
    showExactPortfolio: false,
    showExactCashFlow: false,
    showExactEquity: false,
    showPropertyCount: true,
    showStrategy: true,
    showMarkets: true,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#C9972A", "#378ADD", "#1D9E75", "#7F77DD", "#D85A30", "#D4537E"];
const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function fmtRange(n: number) {
  if (n >= 2_000_000) return "$2M+";
  if (n >= 1_000_000) return "$1M–$2M";
  if (n >= 500_000) return "$500K–$1M";
  if (n >= 250_000) return "$250K–$500K";
  if (n >= 100_000) return "$100K–$250K";
  return "Under $100K";
}

function fmtRangeCF(n: number) {
  if (n >= 10_000) return "$10K+/mo";
  if (n >= 5_000) return "$5K–$10K/mo";
  if (n >= 2_000) return "$2K–$5K/mo";
  if (n >= 1_000) return "$1K–$2K/mo";
  return "Under $1K/mo";
}

const POST_TYPE_COLOR: Record<string, string> = {
  deal: "#C9972A", win: "#1D9E75", hottake: "#D85A30", question: "#378ADD", poll: "#7F77DD"
};

// ─── Privacy Toggle Row ───────────────────────────────────────────────────────

function PrivacyRow({
  label, sublabel, value, sensitive, onChange
}: {
  label: string; sublabel: string; value: boolean; sensitive?: boolean; onChange: (v: boolean) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = () => {
    if (sensitive && !value) {
      setShowConfirm(true);
    } else {
      onChange(!value);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 600 }}>{label}</span>
          {sensitive && <span style={{ fontSize: 10, color: "#D85A30", background: "rgba(216,90,48,0.1)", border: "0.5px solid rgba(216,90,48,0.3)", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>Sensitive</span>}
        </div>
        <div style={{ fontSize: 12, color: "#4A4845" }}>{sublabel}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: value ? "#1D9E75" : "#4A4845", fontWeight: 600 }}>{value ? "Public" : "Hidden"}</span>
        <div onClick={handleToggle} style={{ width: 44, height: 24, borderRadius: 999, background: value ? "#1D9E75" : "#2A2A30", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: value ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
        </div>
      </div>

      {/* Sensitive confirmation modal */}
      {showConfirm && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ background: "#141417", border: "1px solid rgba(216,90,48,0.4)", borderRadius: 18, padding: "28px 24px", maxWidth: 380, width: "90%", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 24, textAlign: "center" }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F0EDE8", textAlign: "center" }}>You're sharing sensitive information</div>
            <div style={{ fontSize: 13, color: "#8A8780", lineHeight: 1.7, textAlign: "center" }}>
              <strong style={{ color: "#F0EDE8" }}>{label}</strong> will be visible to all verified members on the platform. This includes your exact financial figures.
              <br /><br />
              You can hide this again at any time from your privacy settings.
            </div>
            <div style={{ background: "rgba(216,90,48,0.08)", border: "1px solid rgba(216,90,48,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#D85A30" }}>
              🔒 Goldstream never sells your data. This is only visible to verified investors on the platform.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "11px", border: "1px solid #2A2A30", borderRadius: 10, background: "transparent", color: "#4A4845", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Cancel</button>
              <button onClick={() => { onChange(true); setShowConfirm(false); }} style={{ flex: 1, padding: "11px", border: "none", borderRadius: 10, background: "#C9972A", color: "#000", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Yes, make public</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Privacy Settings Panel ───────────────────────────────────────────────────

function PrivacyPanel({ privacy, onChange }: { privacy: PrivacySettings; onChange: (p: PrivacySettings) => void }) {
  const set = (key: keyof PrivacySettings, val: boolean) => onChange({ ...privacy, [key]: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Always public notice */}
      <div style={{ background: "rgba(29,158,117,0.06)", border: "1px solid rgba(29,158,117,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1D9E75", marginBottom: 4 }}>✓ Always public — builds trust</div>
        <div style={{ fontSize: 12, color: "#4A4845", lineHeight: 1.6 }}>
          Name · Tier · Verified badge · Influence score · Member since · Streak · Posts & wins · Number of properties · Strategy type · Markets (city only)
        </div>
      </div>

      {/* Always private notice */}
      <div style={{ background: "rgba(216,90,48,0.06)", border: "1px solid rgba(216,90,48,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#D85A30", marginBottom: 4 }}>🔒 Always private — never shown</div>
        <div style={{ fontSize: 12, color: "#4A4845", lineHeight: 1.6 }}>
          Exact property addresses · Mortgage amounts · Personal income · Tax information · Bank & lender details
        </div>
      </div>

      {/* Toggleable */}
      <div style={{ fontSize: 11, color: "#4A4845", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>YOU CONTROL THESE</div>

      <PrivacyRow
        label="Exact portfolio value"
        sublabel={`Shows "$${(1200000 / 1000000).toFixed(1)}M" vs range "$1M–$2M"`}
        value={privacy.showExactPortfolio}
        sensitive
        onChange={v => set("showExactPortfolio", v)}
      />
      <PrivacyRow
        label="Exact monthly cash flow"
        sublabel="Shows exact $/mo vs range"
        value={privacy.showExactCashFlow}
        sensitive
        onChange={v => set("showExactCashFlow", v)}
      />
      <PrivacyRow
        label="Exact equity"
        sublabel="Net owned value, exact vs range"
        value={privacy.showExactEquity}
        sensitive
        onChange={v => set("showExactEquity", v)}
      />
      <PrivacyRow
        label="Property count"
        sublabel="How many properties you own"
        value={privacy.showPropertyCount}
        onChange={v => set("showPropertyCount", v)}
      />
      <PrivacyRow
        label="Investment strategy"
        sublabel="e.g. BRRRR, Multifamily, STR"
        value={privacy.showStrategy}
        onChange={v => set("showStrategy", v)}
      />
      <PrivacyRow
        label="Markets"
        sublabel="Cities you invest in"
        value={privacy.showMarkets}
        onChange={v => set("showMarkets", v)}
      />
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────

export default function ProfilePage({
  profileId,
  onClose,
  viewingOwnProfile = false,
}: {
  profileId?: string;
  onClose?: () => void;
  viewingOwnProfile?: boolean;
}) {
  const [profile, setProfile] = useState<InvestorProfile>(viewingOwnProfile ? OWN_PROFILE : MOCK_PROFILE);
  const [activeTab, setActiveTab] = useState<"overview" | "posts" | "privacy">("overview");
  const [following, setFollowing] = useState(false);
  const [connectionSent, setConnectionSent] = useState(false);

  const ac = getAvatarColor(profile.initials);
  const isOwn = profile.isOwnProfile || viewingOwnProfile;

  const updatePrivacy = (p: PrivacySettings) => setProfile(prev => ({ ...prev, privacy: p }));

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "posts", label: `Posts (${profile.posts})` },
    ...(isOwn ? [{ key: "privacy", label: "🔒 Privacy" }] : []),
  ] as const;

  return (
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 500, padding: "40px 20px", overflowY: "auto" }}>
      <div style={{ background: "linear-gradient(135deg, rgba(8,8,18,0.99), rgba(4,4,12,0.97))", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 22, width: "100%", maxWidth: 680, overflow: "hidden", fontFamily: "'Inter', -apple-system, sans-serif" }}>

        {/* ── Header Banner ── */}
        <div style={{ background: `linear-gradient(135deg, ${ac}18, ${ac}06)`, borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "28px 28px 0", position: "relative" }}>
          {/* Top accent */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${ac}66, ${ac})` }} />
          {/* Glow */}
          <div style={{ position: "absolute", top: 0, right: 0, width: 160, height: 160, background: `radial-gradient(circle at top right, ${ac}18, transparent 70%)`, pointerEvents: "none" }} />

          {/* Close */}
          {onClose && (
            <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 32, height: 32, color: "#4A4845", fontSize: 18, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          )}

          {/* Avatar + name row */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginBottom: 20 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${ac}22`, border: `3px solid ${ac}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: ac }}>
                {profile.initials}
              </div>
              {profile.verified && (
                <div style={{ position: "absolute", bottom: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "#1D9E75", border: "2px solid #0D0D0F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 800 }}>✓</div>
              )}
            </div>

            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#F0EDE8" }}>{profile.name}</span>
                <span style={{ fontSize: 11, color: ac, background: `${ac}18`, border: `0.5px solid ${ac}44`, padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>◆ {profile.tier}</span>
                <span style={{ fontSize: 11, color: "#C9972A", fontWeight: 700 }}>✦ {profile.influenceScore}</span>
                {profile.streakDays > 0 && <span style={{ fontSize: 11, color: "#1D9E75", background: "rgba(29,158,117,0.1)", border: "0.5px solid rgba(29,158,117,0.3)", padding: "3px 10px", borderRadius: 20 }}>🔥 {profile.streakDays}-day streak</span>}
              </div>
              <div style={{ fontSize: 12, color: "#4A4845" }}>Member since {profile.memberSince} · {profile.followers} followers · {profile.following} following</div>
            </div>

            {/* Action buttons — only for other profiles */}
            {!isOwn && (
              <div style={{ display: "flex", gap: 8, paddingBottom: 4, flexShrink: 0 }}>
                <button onClick={() => setFollowing(!following)} style={{ fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 10, border: following ? "1px solid rgba(255,255,255,0.15)" : "none", background: following ? "transparent" : "#C9972A", color: following ? "#4A4845" : "#000", cursor: "pointer", fontFamily: "inherit" }}>
                  {following ? "Following" : "Follow"}
                </button>
                {!connectionSent ? (
                  <button onClick={() => setConnectionSent(true)} style={{ fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 10, border: "1px solid rgba(201,151,42,0.4)", background: "rgba(201,151,42,0.08)", color: "#C9972A", cursor: "pointer", fontFamily: "inherit" }}>
                    Connect
                  </button>
                ) : (
                  <span style={{ fontSize: 13, color: "#4A4845", padding: "8px 18px", border: "1px solid #2A2A30", borderRadius: 10 }}>Sent</span>
                )}
              </div>
            )}
          </div>

          {/* Badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 20 }}>
            {profile.badges.map(b => (
              <span key={b} style={{ fontSize: 11, color: "#C9972A", background: "rgba(201,151,42,0.08)", border: "0.5px solid rgba(201,151,42,0.25)", padding: "3px 10px", borderRadius: 20 }}>{b}</span>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{ fontSize: 13, fontWeight: 700, padding: "12px 20px", cursor: "pointer", fontFamily: "inherit", border: "none", borderBottom: `2px solid ${activeTab === t.key ? "#C9972A" : "transparent"}`, background: "transparent", color: activeTab === t.key ? "#EFC96E" : "#4A4845", transition: "all .15s" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {/* Portfolio value */}
              <div style={{ background: "linear-gradient(135deg, rgba(201,151,42,0.08), rgba(201,151,42,0.02))", border: "1px solid rgba(201,151,42,0.2)", borderRadius: 14, padding: "16px 18px", position: "relative" as const, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #C9972A44, #C9972A)" }} />
                <div style={{ fontSize: 10, color: "#4A4845", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>PORTFOLIO</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#C9972A" }}>
                  {profile.privacy.showExactPortfolio ? fmt(profile.portfolioValue) : fmtRange(profile.portfolioValue)}
                </div>
                {!profile.privacy.showExactPortfolio && <div style={{ fontSize: 10, color: "#2A2A30", marginTop: 3 }}>Range only · hidden by owner</div>}
              </div>

              {/* Cash flow */}
              <div style={{ background: "linear-gradient(135deg, rgba(29,158,117,0.08), rgba(29,158,117,0.02))", border: "1px solid rgba(29,158,117,0.2)", borderRadius: 14, padding: "16px 18px", position: "relative" as const, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #1D9E7544, #1D9E75)" }} />
                <div style={{ fontSize: 10, color: "#4A4845", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>CASH FLOW</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1D9E75" }}>
                  {profile.privacy.showExactCashFlow ? `+${fmt(profile.cashFlow)}/mo` : fmtRangeCF(profile.cashFlow)}
                </div>
                {!profile.privacy.showExactCashFlow && <div style={{ fontSize: 10, color: "#2A2A30", marginTop: 3 }}>Range only · hidden by owner</div>}
              </div>

              {/* Equity */}
              <div style={{ background: "linear-gradient(135deg, rgba(55,138,221,0.08), rgba(55,138,221,0.02))", border: "1px solid rgba(55,138,221,0.2)", borderRadius: 14, padding: "16px 18px", position: "relative" as const, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #378ADD44, #378ADD)" }} />
                <div style={{ fontSize: 10, color: "#4A4845", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>EQUITY</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#378ADD" }}>
                  {profile.privacy.showExactEquity ? fmt(profile.equity) : fmtRange(profile.equity)}
                </div>
                {!profile.privacy.showExactEquity && <div style={{ fontSize: 10, color: "#2A2A30", marginTop: 3 }}>Range only · hidden by owner</div>}
              </div>
            </div>

            {/* Secondary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { label: "Properties", value: profile.privacy.showPropertyCount ? `${profile.propertyCount}` : "—", color: "#F0EDE8" },
                { label: "Deals closed", value: String(profile.totalDeals), color: "#C9972A" },
                { label: "Win rate", value: `${profile.winRate}%`, color: "#1D9E75" },
                { label: "Influence", value: `✦ ${profile.influenceScore}`, color: "#C9972A" },
              ].map(s => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#4A4845", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Strategy + Markets */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 10, color: "#4A4845", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>STRATEGY</div>
                {profile.privacy.showStrategy ? (
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#C9972A", background: "rgba(201,151,42,0.1)", border: "1px solid rgba(201,151,42,0.3)", padding: "5px 14px", borderRadius: 20 }}>{profile.strategy}</span>
                ) : (
                  <span style={{ fontSize: 13, color: "#2A2A30" }}>Hidden by owner</span>
                )}
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 10, color: "#4A4845", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>MARKETS</div>
                {profile.privacy.showMarkets ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                    {profile.markets.map(m => (
                      <span key={m} style={{ fontSize: 12, color: "#378ADD", background: "rgba(55,138,221,0.1)", border: "1px solid rgba(55,138,221,0.3)", padding: "3px 10px", borderRadius: 20 }}>📍 {m}</span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: "#2A2A30" }}>Hidden by owner</span>
                )}
              </div>
            </div>

            {/* Privacy info for non-owner */}
            {!isOwn && (
              <div style={{ background: "rgba(74,72,69,0.1)", border: "1px solid rgba(74,72,69,0.2)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>🔒</span>
                <span style={{ fontSize: 12, color: "#4A4845" }}>Some information is hidden by this investor. Only verified members can see public data.</span>
              </div>
            )}
          </div>
        )}

        {/* ── POSTS TAB ── */}
        {activeTab === "posts" && (
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
            {profile.recentPosts.map(post => {
              const color = POST_TYPE_COLOR[post.type] || "#C9972A";
              return (
                <div key={post.id} style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2))", border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${color}`, borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ display: "absolute", top: 0, left: 0, right: 0, height: 2 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, border: `0.5px solid ${color}44`, padding: "2px 8px", borderRadius: 10 }}>{post.type.toUpperCase()}</span>
                    <span style={{ fontSize: 11, color: "#4A4845" }}>{post.timeAgo}</span>
                    <span style={{ fontSize: 11, color: "#C9972A", marginLeft: "auto" }}>✦ {post.reactions} reactions</span>
                  </div>
                  <div style={{ fontSize: 14, color: "#C8C5BF", lineHeight: 1.65 }}>{post.content}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PRIVACY TAB (own profile only) ── */}
        {activeTab === "privacy" && isOwn && (
          <div style={{ padding: "24px 28px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F0EDE8", marginBottom: 6 }}>Privacy Settings</div>
            <div style={{ fontSize: 13, color: "#4A4845", marginBottom: 20, lineHeight: 1.6 }}>
              Control exactly what other verified investors can see on your profile. Hiding data shows ranges instead — you still get credibility without revealing exact figures.
            </div>
            <PrivacyPanel privacy={profile.privacy} onChange={updatePrivacy} />
            <div style={{ marginTop: 20, fontSize: 12, color: "#2A2A30", lineHeight: 1.6, textAlign: "center" }}>
              🔒 Goldstream never shares your data with third parties. Changes apply instantly.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}