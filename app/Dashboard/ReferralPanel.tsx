"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReferralTrack = "investor" | "pro" | "partner";

interface ReferralMilestone {
  count: number;
  reward: string;
  detail: string;
  achieved: boolean;
}

interface ProReferral {
  name: string;
  trade: string;
  converted: boolean;
  date: string;
}

interface ReferralPanelProps {
  userName: string;
  userCode: string;       // e.g. "MARC-X7K2"
  referralCount: number;  // total confirmed referrals
  proReferrals: ProReferral[];
  freeDaysEarned: number;
  mode?: "full" | "compact"; // full = settings page, compact = sidebar card
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const INVESTOR_LADDER: ReferralMilestone[] = [
  { count: 1,  reward: "14 days Premium",        detail: "For you + the person you invited",     achieved: false },
  { count: 3,  reward: "1 month free + Badge",   detail: "Connector badge appears on your profile", achieved: false },
  { count: 5,  reward: "3 months free",          detail: "Both sides unlocked",                  achieved: false },
  { count: 10, reward: "10% revenue share",      detail: "For 12 months on each paying referral", achieved: false },
  { count: 20, reward: "15% forever",            detail: "Permanent revenue share",               achieved: false },
];

const PRO_TRACK_INFO = [
  { icon: "🔨", role: "Contractor",  benefit: "20% off Pro Request credits per referral" },
  { icon: "⚖️", role: "Real Estate Lawyer", benefit: "Featured in Weekly Intelligence Brief" },
  { icon: "🏦", role: "Lender / Broker", benefit: "Priority listing in Connect tab" },
  { icon: "🏡", role: "Realtor",     benefit: "Verified Partner badge on your profile" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(name: string) {
  const colors = ["#C9972A", "#378ADD", "#1D9E75", "#7F77DD", "#D85A30"];
  return colors[name.charCodeAt(0) % colors.length];
}

// ─── Compact Card (sidebar / community feed) ──────────────────────────────────

export function ReferralCompactCard({ userName, userCode, referralCount, freeDaysEarned }: Omit<ReferralPanelProps, "proReferrals" | "mode">) {
  const [copied, setCopied] = useState(false);
  const link = `https://goldstream.app/join/${userCode}`;
  const next = INVESTOR_LADDER.find(m => m.count > referralCount);

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ background: "#141417", border: "0.5px solid #2A2A30", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#4A4845", letterSpacing: "0.1em" }}>INVITE & EARN</span>
        {freeDaysEarned > 0 && (
          <span style={{ fontSize: 9, color: "#1D9E75", background: "#0A1A0A", border: "0.5px solid #1A3A1A", padding: "1px 6px", borderRadius: 10 }}>+{freeDaysEarned} days earned</span>
        )}
      </div>

      {next && (
        <div style={{ fontSize: 11, color: "#8A8780" }}>
          <span style={{ color: "#C9972A", fontWeight: 700 }}>{referralCount}/{next.count} referrals</span> → unlock <span style={{ color: "#F0EDE8" }}>{next.reward}</span>
        </div>
      )}

      {/* Progress bar */}
      {next && (
        <div style={{ height: 3, borderRadius: 2, background: "#1A1A1F" }}>
          <div style={{ height: "100%", borderRadius: 2, background: "#C9972A", width: `${Math.min((referralCount / next.count) * 100, 100)}%`, transition: "width 0.6s ease" }} />
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, background: "#0D0D0F", border: "0.5px solid #2A2A30", borderRadius: 7, padding: "6px 10px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          goldstream.app/join/{userCode}
        </div>
        <button onClick={copy} style={{ padding: "6px 12px", background: copied ? "rgba(29,158,117,0.15)" : "#1E1800", border: `0.5px solid ${copied ? "rgba(29,158,117,0.4)" : "#3D2E00"}`, borderRadius: 7, color: copied ? "#1D9E75" : "#C9972A", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          {copied ? "✓ Copied" : "Share"}
        </button>
      </div>
    </div>
  );
}

// ─── Full Panel (profile / settings page) ────────────────────────────────────

export function ReferralPanel({ userName, userCode, referralCount, proReferrals, freeDaysEarned }: ReferralPanelProps) {
  const [track, setTrack] = useState<ReferralTrack>("investor");
  const [copied, setCopied] = useState<"investor" | "pro" | null>(null);

  const investorLink = `https://goldstream.app/join/${userCode}`;
  const proLink      = `https://goldstream.app/partner/${userCode}`;
  const externalLink = `https://goldstream.app/ref/${userCode}`;

  const copy = (type: "investor" | "pro") => {
    navigator.clipboard.writeText(type === "investor" ? investorLink : proLink);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const milestones = INVESTOR_LADDER.map(m => ({ ...m, achieved: referralCount >= m.count }));
  const nextMilestone = milestones.find(m => !m.achieved);
  const ptsToNext = nextMilestone ? nextMilestone.count - referralCount : 0;

  return (
    <div style={{ background: "#0D0D0F", borderRadius: 16, border: "0.5px solid #2A2A30", overflow: "hidden", fontFamily: "'Inter', -apple-system, sans-serif", color: "#F0EDE8" }}>

      {/* Header */}
      <div style={{ background: "#141417", borderBottom: "0.5px solid #2A2A30", padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#F0EDE8" }}>Referral & Partner Program</div>
          {freeDaysEarned > 0 && (
            <div style={{ fontSize: 11, color: "#1D9E75", background: "#0A1A0A", border: "0.5px solid #1A3A1A", padding: "4px 10px", borderRadius: 20 }}>
              ✓ {freeDaysEarned} free days earned
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#4A4845" }}>
          {referralCount} confirmed referrals · {nextMilestone ? `${ptsToNext} more to unlock ${nextMilestone.reward}` : "Max tier reached 🎉"}
        </div>
      </div>

      {/* Track selector */}
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid #2A2A30" }}>
        {([
          { key: "investor", label: "👥 Investors" },
          { key: "pro",      label: "🔨 Trade Pros" },
          { key: "partner",  label: "🌐 Partners" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTrack(t.key)} style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: "12px 8px", cursor: "pointer", fontFamily: "inherit", border: "none", borderBottom: `2px solid ${track === t.key ? "#C9972A" : "transparent"}`, background: "transparent", color: track === t.key ? "#EFC96E" : "#4A4845", transition: "all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── INVESTOR TRACK ── */}
        {track === "investor" && (
          <>
            {/* Link */}
            <div>
              <div style={{ fontSize: 10, color: "#4A4845", letterSpacing: "0.08em", marginBottom: 8 }}>YOUR INVITE LINK</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "#141417", border: "0.5px solid #2A2A30", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {investorLink}
                </div>
                <button onClick={() => copy("investor")} style={{ padding: "10px 16px", background: copied === "investor" ? "rgba(29,158,117,0.15)" : "#1E1800", border: `0.5px solid ${copied === "investor" ? "rgba(29,158,117,0.4)" : "#3D2E00"}`, borderRadius: 8, color: copied === "investor" ? "#1D9E75" : "#C9972A", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  {copied === "investor" ? "✓ Copied" : "Copy link"}
                </button>
              </div>
              <div style={{ fontSize: 10, color: "#4A4845", marginTop: 6 }}>Both you and the person you invite get 14 days Premium free</div>
            </div>

            {/* Share buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "WhatsApp", color: "#25D366", bg: "rgba(37,211,102,0.08)", border: "rgba(37,211,102,0.2)" },
                { label: "X / Twitter", color: "#1DA1F2", bg: "rgba(29,161,242,0.08)", border: "rgba(29,161,242,0.2)" },
                { label: "LinkedIn", color: "#0A66C2", bg: "rgba(10,102,194,0.08)", border: "rgba(10,102,194,0.2)" },
              ].map(s => (
                <button key={s.label} style={{ flex: 1, padding: "8px 4px", background: s.bg, border: `0.5px solid ${s.border}`, borderRadius: 8, color: s.color, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Ladder */}
            <div>
              <div style={{ fontSize: 10, color: "#4A4845", letterSpacing: "0.08em", marginBottom: 12 }}>REWARD LADDER</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {milestones.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: m.achieved ? "#0A1A0A" : "#141417", border: `0.5px solid ${m.achieved ? "#1A3A1A" : "#2A2A30"}`, borderRadius: 10, opacity: m.achieved ? 1 : 0.7 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.achieved ? "#0A1A0A" : "#1A1A1F", border: `1.5px solid ${m.achieved ? "#1D9E75" : "#2A2A30"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                      {m.achieved ? "✓" : m.count}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: m.achieved ? "#1D9E75" : "#F0EDE8" }}>{m.reward}</div>
                      <div style={{ fontSize: 10, color: "#4A4845" }}>{m.detail}</div>
                    </div>
                    {!m.achieved && nextMilestone?.count === m.count && (
                      <div style={{ fontSize: 9, color: "#C9972A", fontWeight: 700, background: "#1E1800", border: "0.5px solid #3D2E00", padding: "2px 7px", borderRadius: 10 }}>
                        {ptsToNext} to go
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── TRADE PRO TRACK ── */}
        {track === "pro" && (
          <>
            <div style={{ background: "#141417", border: "0.5px solid #2A2A30", borderRadius: 12, padding: "16px 18px", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F0EDE8", marginBottom: 6 }}>For trade professionals & service providers</div>
              <div style={{ fontSize: 12, color: "#4A4845", lineHeight: 1.6 }}>
                Send this link to investors you work with — contractors, lawyers, realtors, lenders. When they join and go Premium, you both win.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: "#141417", border: "0.5px solid #2A2A30", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {proLink}
              </div>
              <button onClick={() => copy("pro")} style={{ padding: "10px 16px", background: "#1E1800", border: "0.5px solid #3D2E00", borderRadius: 8, color: "#C9972A", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                {copied === "pro" ? "✓ Copied" : "Copy"}
              </button>
            </div>

            <div style={{ fontSize: 10, color: "#4A4845", letterSpacing: "0.08em", marginTop: 4 }}>PRO TRACK BENEFITS BY ROLE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PRO_TRACK_INFO.map(p => (
                <div key={p.role} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#141417", border: "0.5px solid #2A2A30", borderRadius: 10 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#F0EDE8" }}>{p.role}</div>
                    <div style={{ fontSize: 10, color: "#4A4845" }}>{p.benefit}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Existing pro referrals */}
            {proReferrals.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: "#4A4845", letterSpacing: "0.08em" }}>YOUR PRO REFERRALS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {proReferrals.map(r => (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#141417", border: "0.5px solid #2A2A30", borderRadius: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${getAvatarColor(r.name)}22`, border: `1px solid ${getAvatarColor(r.name)}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: getAvatarColor(r.name), fontWeight: 600, flexShrink: 0 }}>
                        {r.name.split(" ").map(w => w[0]).join("")}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "#F0EDE8" }}>{r.name}</div>
                        <div style={{ fontSize: 9, color: "#4A4845" }}>{r.trade} · {r.date}</div>
                      </div>
                      <span style={{ fontSize: 9, color: r.converted ? "#1D9E75" : "#4A4845", background: r.converted ? "#0A1A0A" : "#1A1A1F", border: `0.5px solid ${r.converted ? "#1A3A1A" : "#2A2A30"}`, padding: "2px 7px", borderRadius: 10 }}>
                        {r.converted ? "✓ Premium" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── PARTNER TRACK ── */}
        {track === "partner" && (
          <>
            <div style={{ background: "#141417", border: "0.5px solid #7F77DD33", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F0EDE8", marginBottom: 6 }}>For influencers, educators & REIA groups</div>
              <div style={{ fontSize: 12, color: "#4A4845", lineHeight: 1.6 }}>
                Larger audiences get a custom revenue share deal. Used by real estate educators, podcast hosts, and investment group leaders.
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "#4A4845", letterSpacing: "0.08em", marginBottom: 8 }}>YOUR EXTERNAL SHARE LINK</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "#141417", border: "0.5px solid #2A2A30", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {externalLink}
                </div>
                <button onClick={() => { navigator.clipboard.writeText(externalLink); }} style={{ padding: "10px 16px", background: "#0F0F20", border: "0.5px solid #7F77DD44", borderRadius: 8, color: "#7F77DD", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  Copy
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Quarterly leaderboard", detail: "Top 3 referrers each quarter win platform-wide spotlight for 30 days" },
                { label: "Custom revenue share", detail: "15–25% recurring — negotiated based on audience size" },
                { label: "Featured in Intelligence Brief", detail: "Your name + link in the Weekly Brief sent to all premium users" },
                { label: "White-label referral page", detail: "Your own branded landing page at goldstream.app/[yourname]" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: "#141417", border: "0.5px solid #2A2A30", borderRadius: 10 }}>
                  <span style={{ color: "#7F77DD", marginTop: 1, flexShrink: 0 }}>◈</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#F0EDE8" }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: "#4A4845" }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <button style={{ width: "100%", padding: "11px", background: "rgba(127,119,221,0.1)", border: "0.5px solid rgba(127,119,221,0.3)", borderRadius: 10, color: "#7F77DD", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Apply for Partner Program →
            </button>
          </>
        )}

      </div>
    </div>
  );
}