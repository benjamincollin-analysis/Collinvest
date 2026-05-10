"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreCategory {
  name: string;
  pts: number;
  max: number;
  color: string;
}

interface NextAction {
  pts: number;
  label: string;
  category: string;
  href: string; // route inside your Next.js app
}

interface IntelligenceScoreProps {
  /** User's first name, pulled from Supabase auth */
  userName: string;
  /** City from user profile */
  userCity?: string;
  /** Current score 0–1000, from `intelligence_score` table */
  score: number;
  /** Current tier label, derived from score */
  tier: string;
  /** Next tier label */
  nextTier: string;
  /** Score threshold to unlock next tier */
  nextTierThreshold: number;
  /** Consecutive-day login/action streak */
  streakDays: number;
  /** Global percentile 0–100 (lower = better) */
  percentile: number;
  /** Personalized AI-generated insight string */
  insight: string;
  /** Exactly 3 next actions to show */
  nextActions: [NextAction, NextAction, NextAction];
  /** Score breakdown by category */
  categories: ScoreCategory[];
  /** Last 7 daily scores (oldest → newest) */
  weeklyHistory: number[];
  /** Rival's display name */
  rivalName?: string;
  /** Points difference with rival (positive = rival is behind) */
  rivalDelta?: number;
  /** Callback when leaderboard CTA is clicked */
  onLeaderboardClick?: () => void;
}

// ─── Tier config ─────────────────────────────────────────────────────────────
// Adjust thresholds to match your tier system

export const TIERS = [
  { name: "Scout",      min: 0,   max: 99  },
  { name: "Builder I",  min: 100, max: 249 },
  { name: "Builder II", min: 250, max: 449 },
  { name: "Builder III",min: 450, max: 599 },
  { name: "Architect",  min: 600, max: 799 },
  { name: "Magnate",    min: 800, max: 949 },
  { name: "Sovereign",  min: 950, max: 1000},
];

export function getTierFromScore(score: number) {
  return TIERS.find((t) => score >= t.min && score <= t.max) ?? TIERS[0];
}

export function getNextTier(score: number) {
  const idx = TIERS.findIndex((t) => score >= t.min && score <= t.max);
  return TIERS[idx + 1] ?? null;
}

// ─── Animated counter hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500, delay = 100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(ease * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntelligenceScore({
  userName,
  userCity,
  score,
  tier,
  nextTier,
  nextTierThreshold,
  streakDays,
  percentile,
  insight,
  nextActions,
  categories,
  weeklyHistory,
  rivalName,
  rivalDelta,
  onLeaderboardClick,
}: IntelligenceScoreProps) {
  const animatedScore = useCountUp(score, 1500, 120);
  const ringRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const [catsVisible, setCatsVisible] = useState(false);

  const RADIUS = 54;
  const CIRC = 2 * Math.PI * RADIUS;
  const gap = nextTierThreshold - score;
  const weekMax = Math.max(...weeklyHistory);

  // Animate ring after mount
  useEffect(() => {
    const t = setTimeout(() => {
      const offset = CIRC * (1 - score / 1000);
      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(offset);
      if (glowRef.current) glowRef.current.style.strokeDashoffset = String(offset);
      setCatsVisible(true);
    }, 120);
    return () => clearTimeout(t);
  }, [score, CIRC]);

  return (
    <div style={styles.root}>
      {/* ── Hero row ─────────────────────────────────────────────── */}
      <div style={styles.hero}>

        {/* Left — ring + tier */}
        <div style={styles.left}>
          {/* Animated score ring */}
          <div style={styles.ringWrap}>
            <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)", display: "block" }}>
              <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#2A2A30" strokeWidth="6" />
              {/* glow layer */}
              <circle
                ref={glowRef}
                cx="60" cy="60" r={RADIUS}
                fill="none"
                stroke="#7A5415"
                strokeWidth="10"
                strokeOpacity="0.35"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC}
                style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1)" }}
              />
              {/* main gold ring */}
              <circle
                ref={ringRef}
                cx="60" cy="60" r={RADIUS}
                fill="none"
                stroke="#C9972A"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC}
                style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1)" }}
              />
            </svg>
            <div style={styles.ringCenter}>
              <span style={styles.ringScore}>{animatedScore}</span>
              <span style={styles.ringMax}>/ 1000</span>
            </div>
          </div>

          {/* Tier badge */}
          <div style={styles.tierBadge}>
            <span style={styles.tierGem} />
            {tier}
          </div>

          <div style={styles.tierNext}>
            {nextTier} unlocks at <span style={{ color: "#C9972A" }}>{nextTierThreshold}</span>
            <br />
            <span style={{ color: "#C9972A", fontWeight: 500 }}>{gap}</span> pts to go
          </div>

          {/* Streak */}
          <div style={styles.streakPill}>
            <span style={styles.streakDot} />
            {streakDays}-day streak
          </div>
        </div>

        {/* Right — name, insight, actions */}
        <div style={styles.right}>
          <div style={styles.userRow}>
            <div>
              <div style={styles.userName}>{userName}&apos;s<br />Intelligence</div>
              <div style={styles.userMeta}>
                {userCity && `${userCity} · `}Updated just now
              </div>
            </div>
            <div style={styles.percentileTag}>Top {percentile}% globally</div>
          </div>

          {/* Insight */}
          <div style={styles.insight}>
            <div style={styles.insightLabel}>Personalized insight</div>
            <div style={styles.insightText} dangerouslySetInnerHTML={{ __html: insight }} />
          </div>

          {/* Next 3 actions */}
          <div>
            <div style={styles.sectionLabel}>Your next 3 moves</div>
            {nextActions.map((action, i) => (
              <a
                key={i}
                href={action.href}
                style={styles.action}
                onMouseEnter={(e) => {
                  (e.currentTarget.querySelector(".a-label") as HTMLElement).style.color = "#EFC96E";
                  (e.currentTarget.querySelector(".a-arr") as HTMLElement).style.color = "#C9972A";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget.querySelector(".a-label") as HTMLElement).style.color = "#F0EDE8";
                  (e.currentTarget.querySelector(".a-arr") as HTMLElement).style.color = "#4A4845";
                }}
              >
                <div style={styles.actionPts}>+{action.pts} pts</div>
                <div className="a-label" style={styles.actionLabel}>{action.label}</div>
                <div style={styles.actionCat}>{action.category}</div>
                <div className="a-arr" style={styles.actionArr}>›</div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom row ───────────────────────────────────────────── */}
      <div style={styles.bottom}>

        {/* Category breakdown */}
        <div style={styles.catsCol}>
          <div style={styles.sectionLabel}>Score breakdown</div>
          {categories.map((cat, i) => (
            <div key={i} style={styles.catRow}>
              <div style={styles.catName}>{cat.name}</div>
              <div style={styles.catTrack}>
                <div
                  style={{
                    ...styles.catFill,
                    background: cat.color,
                    width: catsVisible ? `${Math.round((cat.pts / cat.max) * 100)}%` : "0%",
                    transitionDelay: `${i * 60}ms`,
                  }}
                />
              </div>
              <div style={styles.catVal}>{cat.pts}/{cat.max}</div>
            </div>
          ))}
        </div>

        {/* Weekly trend */}
        <div style={styles.trendCol}>
          <div style={styles.sectionLabel}>7-day trend</div>
          <div style={styles.bars}>
            {weeklyHistory.map((v, i) => {
              const h = Math.round((v / weekMax) * 100);
              const isLatest = i === weeklyHistory.length - 1;
              return (
                <div
                  key={i}
                  style={{
                    ...styles.bar,
                    height: `${h}%`,
                    background: isLatest ? "#C9972A" : "#2A2A30",
                  }}
                />
              );
            })}
          </div>
          <div style={styles.trendFoot}>
            <span style={styles.trendRange}>Mon — Sun</span>
            <span style={styles.trendGain}>
              +{weeklyHistory[weeklyHistory.length - 1] - weeklyHistory[0]} this week
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div style={styles.footer}>
        <div style={styles.footerText}>
          {rivalName && rivalDelta !== undefined ? (
            <>
              Rivals: <strong style={{ color: "#8A8780" }}>{rivalName}</strong> is{" "}
              <strong style={{ color: "#C9972A" }}>{Math.abs(rivalDelta)} pts</strong>{" "}
              {rivalDelta > 0 ? "behind" : "ahead of"} you
            </>
          ) : (
            "No rivals yet — climb the leaderboard"
          )}
        </div>
        <button onClick={onLeaderboardClick} style={styles.footerCta}>
          View leaderboard ›
        </button>
      </div>
    </div>
  );
}

// ─── Inline styles (dark theme, matches Goldstream's #0D0D0F bg) ──────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    background: "#0D0D0F",
    borderRadius: 16,
    border: "0.5px solid #2A2A30",
    overflow: "hidden",
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: "#F0EDE8",
  },
  hero: {
    display: "flex",
    borderBottom: "0.5px solid #2A2A30",
  },
  left: {
    padding: "1.75rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.875rem",
    borderRight: "0.5px solid #2A2A30",
    minWidth: 180,
    background: "#141417",
  },
  ringWrap: {
    position: "relative",
    width: 120,
    height: 120,
  },
  ringCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  ringScore: {
    fontFamily: "'Syne', 'Inter', sans-serif",
    fontSize: 30,
    fontWeight: 700,
    color: "#F0EDE8",
    letterSpacing: -1.5,
    lineHeight: 1,
  },
  ringMax: {
    fontSize: 10,
    color: "#4A4845",
    fontWeight: 400,
    letterSpacing: ".05em",
  },
  tierBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "#1E1800",
    border: "0.5px solid #3D2E00",
    color: "#EFC96E",
    fontSize: 11,
    fontWeight: 500,
    padding: "4px 12px",
    borderRadius: 20,
    letterSpacing: ".03em",
  },
  tierGem: {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: 1,
    background: "#C9972A",
    transform: "rotate(45deg)",
  },
  tierNext: {
    fontSize: 10,
    color: "#4A4845",
    textAlign: "center",
    lineHeight: 1.6,
  },
  streakPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "#0D1A0D",
    border: "0.5px solid #1A3A1A",
    color: "#5DCAA5",
    fontSize: 10,
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: 20,
  },
  streakDot: {
    display: "inline-block",
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#1D9E75",
  },
  right: {
    flex: 1,
    padding: "1.75rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.125rem",
    background: "#0D0D0F",
  },
  userRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
  },
  userName: {
    fontFamily: "'Syne', 'Inter', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: "#F0EDE8",
    lineHeight: 1.2,
    letterSpacing: -.3,
  },
  userMeta: {
    fontSize: 11,
    color: "#4A4845",
    marginTop: 3,
  },
  percentileTag: {
    fontSize: 10,
    color: "#EFC96E",
    background: "#1E1800",
    border: "0.5px solid #3D2E00",
    padding: "3px 10px",
    borderRadius: 20,
    whiteSpace: "nowrap",
    fontWeight: 500,
    flexShrink: 0,
  },
  insight: {
    background: "#141417",
    borderRadius: 0,
    borderLeft: "2px solid #7A5415",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  insightLabel: {
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: ".1em",
    color: "#7A5415",
    textTransform: "uppercase",
  },
  insightText: {
    fontSize: 12,
    color: "#8A8780",
    lineHeight: 1.6,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: ".1em",
    color: "#4A4845",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  action: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 0",
    borderBottom: "0.5px solid #2A2A30",
    cursor: "pointer",
    textDecoration: "none",
    transition: "padding-left .15s",
  },
  actionPts: {
    fontSize: 10,
    fontWeight: 500,
    color: "#C9972A",
    background: "#1A1200",
    border: "0.5px solid #3D2E00",
    borderRadius: 10,
    padding: "2px 8px",
    minWidth: 50,
    textAlign: "center",
    flexShrink: 0,
  },
  actionLabel: {
    fontSize: 12,
    color: "#F0EDE8",
    flex: 1,
    transition: "color .15s",
  },
  actionCat: {
    fontSize: 10,
    color: "#4A4845",
  },
  actionArr: {
    fontSize: 12,
    color: "#4A4845",
    transition: "color .15s",
  },
  bottom: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    borderTop: "0.5px solid #2A2A30",
  },
  catsCol: {
    padding: "1.25rem 1.5rem",
    borderRight: "0.5px solid #2A2A30",
    background: "#141417",
  },
  catRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  catName: {
    fontSize: 11,
    color: "#8A8780",
    width: 80,
    flexShrink: 0,
  },
  catTrack: {
    flex: 1,
    height: 4,
    background: "#222228",
    borderRadius: 2,
    overflow: "hidden",
  },
  catFill: {
    height: 4,
    borderRadius: 2,
    width: 0,
    transition: "width 1.3s cubic-bezier(.4,0,.2,1)",
  },
  catVal: {
    fontSize: 10,
    color: "#4A4845",
    width: 44,
    textAlign: "right",
    flexShrink: 0,
  },
  trendCol: {
    padding: "1.25rem 1.5rem",
    background: "#141417",
  },
  bars: {
    display: "flex",
    alignItems: "flex-end",
    gap: 4,
    height: 56,
    marginBottom: 10,
  },
  bar: {
    flex: 1,
    borderRadius: "2px 2px 0 0",
    transition: "height .9s ease",
  },
  trendFoot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trendRange: {
    fontSize: 10,
    color: "#4A4845",
  },
  trendGain: {
    fontSize: 10,
    fontWeight: 500,
    color: "#5DCAA5",
    background: "#0A1A0A",
    border: "0.5px solid #1A3A1A",
    padding: "2px 9px",
    borderRadius: 10,
  },
  footer: {
    background: "#141417",
    borderTop: "0.5px solid #2A2A30",
    padding: "10px 1.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 11,
    color: "#4A4845",
  },
  footerCta: {
    fontSize: 11,
    color: "#C9972A",
    fontWeight: 500,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    letterSpacing: ".02em",
    fontFamily: "'Inter', sans-serif",
  },
};