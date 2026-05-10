"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupMember {
  id: string;
  initials: string;
  name: string;
  isFounder: boolean;
  isVerified: boolean;
  portfolioValue: number;   // their individual portfolio value in $
  weeklyCoins: number;      // CollinCoins earned this week
  lastActivity: string;     // e.g. "Added a property 2h ago"
  devScore: number;         // their Development Score 0-1000
}

interface GroupUnlock {
  label: string;
  unlocked: boolean;
  requiredTier: string;
}

interface GroupPortfolioProps {
  /** Group display name */
  groupName: string;
  /** 3-letter group code */
  groupCode: string;
  /** Group founding date */
  foundedDate: string;
  /** Current group tier (based on combined value) */
  groupTier: string;
  /** Next group tier */
  nextGroupTier: string;
  /** Combined portfolio value needed for next tier */
  nextTierValue: number;
  /** All group members */
  members: GroupMember[];
  /** Max members allowed */
  maxMembers: number;
  /** Combined monthly cash flow */
  combinedCashFlow: number;
  /** Combined equity */
  combinedEquity: number;
  /** Total properties across all members */
  totalProperties: number;
  /** Number of markets covered */
  totalMarkets: number;
  /** Monthly value change */
  monthlyValueChange: number;
  /** Group active streak in days */
  streakDays: number;
  /** Rival group name */
  rivalGroupName?: string;
  /** Rival group value difference (positive = rival behind) */
  rivalDelta?: number;
  /** Group rank in region */
  regionalRank?: number;
  /** Region name e.g. "Texas" */
  region?: string;
  /** Weekly member spotlight */
  spotlightMember?: string;
  /** Tier unlocks */
  unlocks: GroupUnlock[];
  /** Invite link */
  inviteLink: string;
  /** Current user's id — to highlight their row */
  currentUserId: string;
  /** Callback for leaderboard */
  onLeaderboardClick?: () => void;
  /** Callback for copy invite */
  onCopyInvite?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function fmtDelta(n: number) {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${fmt(Math.abs(n))}`;
}

function useCountUp(target: number, duration = 1400, delay = 150) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(ease * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [target, duration, delay]);
  return val;
}

// ─── Avatar colors per member index ──────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "#C9972A22", text: "#C9972A" }, // gold — founder
  { bg: "#378ADD22", text: "#378ADD" },
  { bg: "#1D9E7522", text: "#1D9E75" },
  { bg: "#7F77DD22", text: "#7F77DD" },
  { bg: "#D85A3022", text: "#D85A30" },
  { bg: "#D4537E22", text: "#D4537E" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GroupPortfolio({
  groupName,
  groupCode,
  foundedDate,
  groupTier,
  nextGroupTier,
  nextTierValue,
  members,
  maxMembers,
  combinedCashFlow,
  combinedEquity,
  totalProperties,
  totalMarkets,
  monthlyValueChange,
  streakDays,
  rivalGroupName,
  rivalDelta,
  regionalRank,
  region,
  spotlightMember,
  unlocks,
  inviteLink,
  currentUserId,
  onLeaderboardClick,
  onCopyInvite,
}: GroupPortfolioProps) {
  const [barsVisible, setBarsVisible] = useState(false);
  const combinedValue = members.reduce((s, m) => s + m.portfolioValue, 0);
  const animatedValue = useCountUp(combinedValue, 1600, 200);
  const progressPct = Math.min(Math.round((combinedValue / nextTierValue) * 100), 100);

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  const openSpots = maxMembers - members.length;

  return (
    <div style={s.root}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.groupAvatar}>{groupCode}</div>
          <div>
            <div style={s.groupName}>{groupName}</div>
            <div style={s.groupMeta}>
              {members.length} members · Founded {foundedDate}
              {openSpots > 0 && (
                <span style={s.spotsTag}>{openSpots} spot{openSpots > 1 ? "s" : ""} left</span>
              )}
            </div>
          </div>
        </div>
        <div style={s.headerRight}>
          {streakDays > 0 && (
            <div style={s.streakPill}>
              <span style={s.streakDot} />
              {streakDays}-day group streak
            </div>
          )}
          <div style={s.tierBadge}>
            <span style={s.tierGem} />
            {groupTier} — Group Tier
          </div>
        </div>
      </div>

      {/* ── Hero value + progress to next tier ─────────────────────── */}
      <div style={s.heroSection}>
        <div style={s.heroLeft}>
          <div style={s.heroLabel}>Combined portfolio value</div>
          <div style={s.heroValue}>{fmt(animatedValue)}</div>
          <div style={s.heroDelta}>
            <span style={{ color: monthlyValueChange >= 0 ? "#1D9E75" : "#E24B4A" }}>
              {fmtDelta(monthlyValueChange)}
            </span>
            <span style={s.heroDeltaLabel}> this month</span>
          </div>
        </div>
        <div style={s.heroRight}>
          {regionalRank && region && (
            <div style={s.rankCard}>
              <div style={s.rankNum}>#{regionalRank}</div>
              <div style={s.rankLabel}>syndicate in {region}</div>
            </div>
          )}
          {spotlightMember && (
            <div style={s.spotlightCard}>
              <div style={s.spotlightLabel}>Member spotlight</div>
              <div style={s.spotlightName}>{spotlightMember}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar to next tier ───────────────────────────────── */}
      <div style={s.progressSection}>
        <div style={s.progressTop}>
          <span style={s.progressLabel}>Progress to {nextGroupTier}</span>
          <span style={s.progressPct}>{progressPct}% — {fmt(nextTierValue - combinedValue)} to go</span>
        </div>
        <div style={s.progressTrack}>
          <div
            style={{
              ...s.progressFill,
              width: barsVisible ? `${progressPct}%` : "0%",
            }}
          />
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div style={s.statsRow}>
        {[
          { label: "Combined equity",    value: fmt(combinedEquity),       sub: "net owned value" },
          { label: "Monthly cash flow",  value: fmt(combinedCashFlow),     sub: "across group" },
          { label: "Properties",         value: String(totalProperties),   sub: `${totalMarkets} markets` },
          { label: "Active members",     value: `${members.length}/${maxMembers}`, sub: `${openSpots} spots open` },
        ].map((stat, i) => (
          <div key={i} style={{ ...s.stat, borderRight: i < 3 ? "0.5px solid #2A2A30" : "none" }}>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={s.statVal}>{stat.value}</div>
            <div style={s.statSub}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Group multiplier callout ────────────────────────────────── */}
      <div style={s.multiplierBanner}>
        <span style={s.multiplierDot} />
        <span style={s.multiplierText}>
          <strong style={{ color: "#F0EDE8" }}>Group multiplier active.</strong> When any member adds a property, completes verification, or posts in community — <strong style={{ color: "#C9972A" }}>everyone earns bonus Development Score points.</strong> Push your group to stay active.
        </span>
      </div>

      {/* ── Members list ────────────────────────────────────────────── */}
      <div style={s.membersSection}>
        <div style={s.secLabel}>Members & contributions</div>
        {members.map((member, i) => {
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const pct = Math.round((member.portfolioValue / combinedValue) * 100);
          const isMe = member.id === currentUserId;
          return (
            <div
              key={member.id}
              style={{
                ...s.memberRow,
                background: isMe ? "#1A1A0A" : "transparent",
                borderBottom: i < members.length - 1 ? "0.5px solid #2A2A30" : "none",
              }}
            >
              {/* Avatar — founder gets crown ring */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  style={{
                    ...s.avatar,
                    width: member.isFounder ? 40 : 32,
                    height: member.isFounder ? 40 : 32,
                    fontSize: member.isFounder ? 13 : 11,
                    background: color.bg,
                    color: color.text,
                    border: member.isFounder ? `2px solid ${color.text}` : "none",
                  }}
                >
                  {member.initials}
                </div>
                {member.isFounder && (
                  <div style={s.crownBadge}>♛</div>
                )}
              </div>

              {/* Name + activity */}
              <div style={s.memberInfo}>
                <div style={s.memberNameRow}>
                  <span style={s.memberName}>{member.name}</span>
                  {member.isFounder && <span style={s.founderTag}>Founder</span>}
                  {isMe && <span style={s.meTag}>You</span>}
                  {member.isVerified && <span style={s.verifiedDot} />}
                </div>
                <div style={s.memberActivity}>{member.lastActivity}</div>
              </div>

              {/* Dev score */}
              <div style={s.memberScore}>
                <div style={s.memberScoreVal}>{member.devScore}</div>
                <div style={s.memberScoreLabel}>dev score</div>
              </div>

              {/* Contribution bar */}
              <div style={s.memberBarWrap}>
                <div style={s.memberBarBg}>
                  <div
                    style={{
                      ...s.memberBarFill,
                      background: color.text,
                      width: barsVisible ? `${pct}%` : "0%",
                      transitionDelay: `${i * 80}ms`,
                    }}
                  />
                </div>
                <div style={s.memberPct}>{pct}%</div>
              </div>

              {/* Value */}
              <div style={s.memberVal}>{fmt(member.portfolioValue)}</div>

              {/* Coins this week */}
              <div style={s.coinsTag}>
                <span style={s.coinsDot} />
                +{member.weeklyCoins} pts
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom: unlocks + invite ────────────────────────────────── */}
      <div style={s.bottom}>
        <div style={s.unlocksCol}>
          <div style={s.secLabel}>Group tier unlocks</div>
          {unlocks.map((u, i) => (
            <div key={i} style={{ ...s.unlockRow, borderBottom: i < unlocks.length - 1 ? "0.5px solid #2A2A30" : "none" }}>
              <span style={{ ...s.unlockDot, background: u.unlocked ? "#1D9E75" : "#4A4845" }} />
              <span style={s.unlockLabel}>{u.label}</span>
              <span style={u.unlocked ? s.unlockedTag : s.lockedTag}>
                {u.unlocked ? "Unlocked" : u.requiredTier}
              </span>
            </div>
          ))}
        </div>

        <div style={s.inviteCol}>
          <div style={s.secLabel}>Invite members</div>
          <div style={s.inviteBox}>
            <div style={s.inviteBoxLabel}>Group invite link</div>
            <div style={s.inviteLink}>{inviteLink}</div>
          </div>
          <button style={s.inviteBtn} onClick={onCopyInvite}>
            Copy invite link
          </button>
          <div style={s.inviteNote}>Anyone with this link can request to join. You approve.</div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div style={s.footer}>
        <div style={s.footerText}>
          {rivalGroupName && rivalDelta !== undefined ? (
            <>
              Rival: <strong style={{ color: "#8A8780" }}>{rivalGroupName}</strong> is{" "}
              <strong style={{ color: "#C9972A" }}>{fmt(Math.abs(rivalDelta))}</strong>{" "}
              {rivalDelta > 0 ? "behind" : "ahead of"} your group
            </>
          ) : (
            "No rival group yet — climb the group leaderboard"
          )}
        </div>
        <button style={s.footerCta} onClick={onLeaderboardClick}>
          Group leaderboard ›
        </button>
      </div>

    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    background: "#0D0D0F",
    borderRadius: 16,
    border: "0.5px solid #2A2A30",
    overflow: "hidden",
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: "#F0EDE8",
  },
  header: {
    background: "#141417",
    borderBottom: "0.5px solid #2A2A30",
    padding: "1.25rem 1.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  groupAvatar: {
    width: 44, height: 44, borderRadius: 10,
    background: "#1E1800", border: "0.5px solid #3D2E00",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, color: "#C9972A", letterSpacing: -0.5,
  },
  groupName: { fontSize: 16, fontWeight: 500, color: "#F0EDE8", lineHeight: 1.2 },
  groupMeta: { fontSize: 11, color: "#4A4845", marginTop: 3, display: "flex", alignItems: "center", gap: 8 },
  spotsTag: {
    fontSize: 10, color: "#1D9E75", background: "#0A1A0A",
    border: "0.5px solid #1A3A1A", padding: "2px 7px", borderRadius: 10,
  },
  headerRight: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  streakPill: {
    display: "inline-flex", alignItems: "center", gap: 5,
    background: "#0D1A0D", border: "0.5px solid #1A3A1A",
    color: "#5DCAA5", fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
  },
  streakDot: { display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#1D9E75" },
  tierBadge: {
    display: "inline-flex", alignItems: "center", gap: 5,
    background: "#1E1800", border: "0.5px solid #3D2E00",
    color: "#EFC96E", fontSize: 11, fontWeight: 500, padding: "4px 12px", borderRadius: 20,
  },
  tierGem: {
    display: "inline-block", width: 6, height: 6,
    borderRadius: 1, background: "#C9972A", transform: "rotate(45deg)",
  },

  heroSection: {
    padding: "1.5rem 1.5rem 0",
    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem",
  },
  heroLeft: {},
  heroLabel: { fontSize: 10, fontWeight: 500, letterSpacing: ".08em", color: "#4A4845", textTransform: "uppercase", marginBottom: 6 },
  heroValue: { fontSize: 42, fontWeight: 500, color: "#F0EDE8", letterSpacing: -2, lineHeight: 1 },
  heroDelta: { fontSize: 13, marginTop: 6 },
  heroDeltaLabel: { color: "#4A4845" },
  heroRight: { display: "flex", gap: 10, flexShrink: 0 },
  rankCard: {
    background: "#141417", border: "0.5px solid #2A2A30",
    borderRadius: 10, padding: "10px 16px", textAlign: "center",
  },
  rankNum: { fontSize: 24, fontWeight: 500, color: "#C9972A", lineHeight: 1 },
  rankLabel: { fontSize: 10, color: "#4A4845", marginTop: 4 },
  spotlightCard: {
    background: "#141417", border: "0.5px solid #2A2A30",
    borderRadius: 10, padding: "10px 16px",
  },
  spotlightLabel: { fontSize: 9, letterSpacing: ".08em", color: "#4A4845", textTransform: "uppercase", marginBottom: 4 },
  spotlightName: { fontSize: 13, color: "#EFC96E", fontWeight: 500 },

  progressSection: { padding: "1.25rem 1.5rem" },
  progressTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  progressLabel: { fontSize: 11, color: "#4A4845" },
  progressPct: { fontSize: 11, color: "#C9972A", fontWeight: 500 },
  progressTrack: { height: 6, background: "#222228", borderRadius: 3, overflow: "hidden" },
  progressFill: {
    height: 6, borderRadius: 3, background: "#C9972A",
    width: "0%", transition: "width 1.6s cubic-bezier(.4,0,.2,1)",
  },

  statsRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderTop: "0.5px solid #2A2A30", borderBottom: "0.5px solid #2A2A30" },
  stat: { padding: "1rem 1.25rem" },
  statLabel: { fontSize: 10, fontWeight: 500, letterSpacing: ".08em", color: "#4A4845", textTransform: "uppercase", marginBottom: 6 },
  statVal: { fontSize: 20, fontWeight: 500, color: "#F0EDE8", letterSpacing: -0.5, lineHeight: 1 },
  statSub: { fontSize: 10, color: "#4A4845", marginTop: 4 },

  multiplierBanner: {
    margin: "0 1.5rem 1.25rem",
    background: "#141417",
    borderLeft: "2px solid #7A5415",
    padding: "10px 14px",
    display: "flex", alignItems: "flex-start", gap: 10,
  },
  multiplierDot: { width: 6, height: 6, borderRadius: "50%", background: "#C9972A", flexShrink: 0, marginTop: 4 },
  multiplierText: { fontSize: 12, color: "#8A8780", lineHeight: 1.6 },

  membersSection: { padding: "0 1.5rem 1.25rem" },
  secLabel: { fontSize: 10, fontWeight: 500, letterSpacing: ".08em", color: "#4A4845", textTransform: "uppercase", marginBottom: 12 },
  memberRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 8px", borderRadius: 8, transition: "background .15s",
  },
  avatar: {
    borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center", fontWeight: 500,
  },
  crownBadge: {
    position: "absolute", top: -8, left: "50%",
    transform: "translateX(-50%)",
    fontSize: 10, color: "#C9972A",
  },
  memberInfo: { flex: 1, minWidth: 0 },
  memberNameRow: { display: "flex", alignItems: "center", gap: 6 },
  memberName: { fontSize: 13, color: "#F0EDE8", fontWeight: 400 },
  founderTag: {
    fontSize: 9, color: "#C9972A", background: "#1E1800",
    border: "0.5px solid #3D2E00", padding: "2px 7px", borderRadius: 10,
  },
  meTag: {
    fontSize: 9, color: "#378ADD", background: "#0A1828",
    border: "0.5px solid #0C447C", padding: "2px 7px", borderRadius: 10,
  },
  verifiedDot: { width: 6, height: 6, borderRadius: "50%", background: "#1D9E75" },
  memberActivity: { fontSize: 10, color: "#4A4845", marginTop: 2 },
  memberScore: { textAlign: "center", flexShrink: 0 },
  memberScoreVal: { fontSize: 14, fontWeight: 500, color: "#C9972A", lineHeight: 1 },
  memberScoreLabel: { fontSize: 9, color: "#4A4845", marginTop: 2 },
  memberBarWrap: { width: 120, flexShrink: 0 },
  memberBarBg: { height: 4, background: "#222228", borderRadius: 2, overflow: "hidden", marginBottom: 3 },
  memberBarFill: { height: 4, borderRadius: 2, width: "0%", transition: "width 1.2s cubic-bezier(.4,0,.2,1)" },
  memberPct: { fontSize: 9, color: "#4A4845", textAlign: "right" },
  memberVal: { fontSize: 12, color: "#8A8780", minWidth: 60, textAlign: "right", flexShrink: 0 },
  coinsTag: {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: 10, color: "#1D9E75", background: "#0A1A0A",
    border: "0.5px solid #1A3A1A", padding: "2px 8px", borderRadius: 10, flexShrink: 0,
  },
  coinsDot: { width: 5, height: 5, borderRadius: "50%", background: "#1D9E75" },

  bottom: { display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "0.5px solid #2A2A30" },
  unlocksCol: { padding: "1.25rem 1.5rem", borderRight: "0.5px solid #2A2A30", background: "#141417" },
  unlockRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0" },
  unlockDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  unlockLabel: { fontSize: 12, color: "#8A8780", flex: 1 },
  unlockedTag: {
    fontSize: 10, fontWeight: 500, color: "#1D9E75",
    background: "#0A1A0A", border: "0.5px solid #1A3A1A", padding: "2px 8px", borderRadius: 10,
  },
  lockedTag: {
    fontSize: 10, fontWeight: 500, color: "#4A4845",
    background: "#1A1A1F", border: "0.5px solid #2A2A30", padding: "2px 8px", borderRadius: 10,
  },

  inviteCol: { padding: "1.25rem 1.5rem", background: "#141417" },
  inviteBox: {
    background: "#0D0D0F", border: "0.5px solid #2A2A30",
    borderRadius: 10, padding: "10px 12px", marginBottom: 10,
  },
  inviteBoxLabel: { fontSize: 9, color: "#4A4845", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 },
  inviteLink: { fontSize: 11, color: "#C9972A", fontFamily: "monospace", letterSpacing: ".02em" },
  inviteBtn: {
    width: "100%", background: "#1E1800", border: "0.5px solid #3D2E00",
    color: "#EFC96E", fontSize: 12, fontWeight: 500, padding: 9,
    borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif",
    marginBottom: 8,
  },
  inviteNote: { fontSize: 10, color: "#4A4845", lineHeight: 1.5 },

  footer: {
    background: "#0D0D0F", borderTop: "0.5px solid #2A2A30",
    padding: "10px 1.5rem", display: "flex",
    alignItems: "center", justifyContent: "space-between",
  },
  footerText: { fontSize: 11, color: "#4A4845" },
  footerCta: {
    fontSize: 11, color: "#C9972A", fontWeight: 500,
    background: "transparent", border: "none", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
};