"use client";

import { useState, useEffect } from "react";
import ProfilePage from "./ProfilePage";

type CommunityTab = "feed" | "groups" | "connect";
type PostType = "deal" | "win" | "hottake" | "question" | "poll";
type Reaction = "smart" | "risky" | "in" | "disagree";
type CommentReaction = "agree" | "insightful" | "disagree";
type ConnectReason = "jv" | "intel" | "partner" | "mentor" | "other";

interface Poll { question: string; options: string[]; votes: number[]; userVote: number | null; endsAt: string; }
interface Comment { id: string; authorName: string; authorTier: string; authorVerified: boolean; content: string; timeAgo: string; reactions: { agree: number; insightful: number; disagree: number }; userReaction: CommentReaction | null; respectScore: number; }
interface Post { id: string; type: PostType; authorId: string; authorName: string; authorInitials: string; authorTier: string; authorVerified: boolean; authorPortfolioValue?: number; authorInfluenceScore?: number; content: string; dealAddress?: string; dealValue?: number; dealVerified?: boolean; timeAgo: string; market?: string; isNationalSignal?: boolean; reactions: { smart: number; risky: number; in: number; disagree: number }; userReaction: Reaction | null; didThisToo: number; userDidThisToo: boolean; passedOnThis: number; userPassedOnThis: boolean; comments: Comment[]; showComments: boolean; poll?: Poll; isMilestone?: boolean; calledItCorrect?: boolean; }
interface LocalInvestor { id: string; name: string; initials: string; tier: string; city: string; strategy: string; portfolioValue: number; influenceScore: number; verified: boolean; connected: boolean; requestSent: boolean; commonMarkets: number; }
interface NetworkInvestor { id: string; name: string; initials: string; tier: string; strategy: string; markets: string[]; portfolioValue: number; influenceScore: number; verified: boolean; connected: boolean; requestSent: boolean; whyMatch: string; }
interface CommunityFeedProps { currentUserId: string; currentUserName: string; currentUserTier: string; currentUserVerified: boolean; }

// ─── Public Groups Data ───────────────────────────────────────────────────────
interface PublicGroup {
  id: string; name: string; initials: string; tier: string; combinedValue: number;
  members: number; rank: number; rankArea: string; streak: number; weeklyPoints: number;
  dealsThisWeek: number; isMyGroup: boolean; challenged: boolean;
}

const ALL_GROUPS: PublicGroup[] = [
  { id: "g1", name: "Houston Syndicate", initials: "HTX", tier: "Architect", combinedValue: 1700000, members: 3, rank: 1, rankArea: "Texas", streak: 8, weeklyPoints: 2847, dealsThisWeek: 4, isMyGroup: true, challenged: false },
  { id: "g2", name: "Dallas Capital Club", initials: "DCC", tier: "Builder III", combinedValue: 1420000, members: 5, rank: 2, rankArea: "Texas", streak: 12, weeklyPoints: 2341, dealsThisWeek: 3, isMyGroup: false, challenged: false },
  { id: "g3", name: "Miami BRRRR Squad", initials: "MBS", tier: "Builder II", combinedValue: 980000, members: 4, rank: 3, rankArea: "Florida", streak: 5, weeklyPoints: 1998, dealsThisWeek: 2, isMyGroup: false, challenged: false },
  { id: "g4", name: "ATL Wealth Builders", initials: "AWB", tier: "Builder II", combinedValue: 840000, members: 6, rank: 4, rankArea: "Georgia", streak: 3, weeklyPoints: 1654, dealsThisWeek: 5, isMyGroup: false, challenged: false },
  { id: "g5", name: "Austin STR Collective", initials: "ASC", tier: "Builder I", combinedValue: 620000, members: 4, rank: 5, rankArea: "Texas", streak: 7, weeklyPoints: 1203, dealsThisWeek: 1, isMyGroup: false, challenged: false },
];

const MOCK_POSTS: Post[] = [
  { id: "1", type: "deal", authorId: "jordan-id", authorName: "Jordan V.", authorInitials: "JV", authorTier: "Architect", authorVerified: true, authorPortfolioValue: 1200000, authorInfluenceScore: 847, content: "Just closed on a $640K triplex in Midtown Houston. 7.2% cap rate, fully occupied. Took 3 months to find this one — patience paid off.", dealAddress: "2847 Midtown Blvd, Houston TX", dealValue: 640000, dealVerified: true, timeAgo: "2h ago", market: "Houston", reactions: { smart: 47, risky: 3, in: 28, disagree: 1 }, userReaction: null, didThisToo: 12, userDidThisToo: false, passedOnThis: 4, userPassedOnThis: false, comments: [{ id: "c1", authorName: "Aisha L.", authorTier: "Builder III", authorVerified: true, content: "7.2% in Midtown is solid. What was the financing?", timeAgo: "1h ago", reactions: { agree: 8, insightful: 14, disagree: 0 }, userReaction: null, respectScore: 892 }], showComments: false, calledItCorrect: true },
  { id: "2", type: "poll", authorId: "platform", authorName: "Goldstream", authorInitials: "GS", authorTier: "Platform", authorVerified: true, content: "Weekly Pulse — Miami market this week:", timeAgo: "6h ago", market: "Miami", isNationalSignal: true, reactions: { smart: 0, risky: 0, in: 0, disagree: 0 }, userReaction: null, didThisToo: 0, userDidThisToo: false, passedOnThis: 0, userPassedOnThis: false, comments: [], showComments: false, poll: { question: "Miami cap rates — next 30 days?", options: ["Compressing", "Holding", "Expanding", "Major correction"], votes: [234, 189, 421, 87], userVote: null, endsAt: "Friday 11:59PM EST" } },
  { id: "3", type: "hottake", authorId: "marcus-id", authorName: "Marcus B.", authorInitials: "MB", authorTier: "Builder II", authorVerified: true, authorPortfolioValue: 840000, authorInfluenceScore: 612, content: "Houston multifamily is the most underrated market in America right now. Population growth + no state income tax + still affordable. People sleeping on this.", timeAgo: "4h ago", market: "Houston", reactions: { smart: 89, risky: 12, in: 64, disagree: 23 }, userReaction: null, didThisToo: 0, userDidThisToo: false, passedOnThis: 0, userPassedOnThis: false, comments: [], showComments: false },
  { id: "4", type: "win", authorId: "aisha-id", authorName: "Aisha L.", authorInitials: "AL", authorTier: "Builder III", authorVerified: true, authorPortfolioValue: 1000000, authorInfluenceScore: 731, content: "Portfolio just crossed $1M. Took 3 years, 4 properties, and a lot of patience. If you're early — keep going.", timeAgo: "1d ago", market: "Dallas", reactions: { smart: 203, risky: 0, in: 178, disagree: 0 }, userReaction: null, didThisToo: 34, userDidThisToo: false, passedOnThis: 0, userPassedOnThis: false, comments: [], showComments: false, isMilestone: true },
];

const MOCK_LOCAL: LocalInvestor[] = [
  { id: "l1", name: "Jordan V.", initials: "JV", tier: "Architect", city: "Houston", strategy: "Multifamily", portfolioValue: 1200000, influenceScore: 847, verified: true, connected: false, requestSent: false, commonMarkets: 2 },
  { id: "l2", name: "Dev P.", initials: "DP", tier: "Builder I", city: "Houston", strategy: "BRRRR", portfolioValue: 280000, influenceScore: 203, verified: true, connected: true, requestSent: false, commonMarkets: 3 },
  { id: "l3", name: "Carmen R.", initials: "CR", tier: "Builder II", city: "Houston", strategy: "STR", portfolioValue: 520000, influenceScore: 441, verified: true, connected: false, requestSent: true, commonMarkets: 1 },
];

const MOCK_NETWORK: NetworkInvestor[] = [
  { id: "n1", name: "Aisha L.", initials: "AL", tier: "Builder III", strategy: "BRRRR", markets: ["Dallas", "Atlanta"], portfolioValue: 1000000, influenceScore: 731, verified: true, connected: false, requestSent: false, whyMatch: "Both doing BRRRR in Sun Belt markets" },
  { id: "n2", name: "Theo W.", initials: "TW", tier: "Builder II", strategy: "Multifamily", markets: ["Miami", "Houston"], portfolioValue: 720000, influenceScore: 558, verified: true, connected: false, requestSent: false, whyMatch: "Active in your Houston market" },
];

const DEAL_PULSE = [
  { city: "Houston", deals: 47, trend: "up", heat: 94 },
  { city: "Dallas", deals: 31, trend: "up", heat: 72 },
  { city: "Miami", deals: 28, trend: "flat", heat: 65 },
  { city: "Atlanta", deals: 19, trend: "up", heat: 51 },
  { city: "Austin", deals: 14, trend: "down", heat: 38 },
];

const LEADERBOARD = [
  { rank: 1, name: "Jordan V.", initials: "JV", pts: 2847, delta: 12, influenceScore: 847 },
  { rank: 2, name: "Aisha L.", initials: "AL", pts: 2341, delta: 4, influenceScore: 731 },
  { rank: 3, name: "Marcus B.", initials: "MB", pts: 1998, delta: -2, influenceScore: 612 },
  { rank: 11, name: "Sam T.", initials: "ST", pts: 912, delta: 3, influenceScore: 287, isRival: true },
  { rank: 12, name: "You", initials: "ME", pts: 891, delta: 2, influenceScore: 203, isUser: true },
];

const POST_TYPE_CONFIG = {
  deal:     { label: "Deal",     color: "#C9972A", bg: "#1E1800" },
  win:      { label: "Win",      color: "#1D9E75", bg: "#0A1A0A" },
  hottake:  { label: "Hot Take", color: "#D85A30", bg: "#1A0A00" },
  question: { label: "Question", color: "#378ADD", bg: "#0A1020" },
  poll:     { label: "Poll",     color: "#7F77DD", bg: "#0F0F20" },
};

const AVATAR_COLORS = ["#C9972A", "#378ADD", "#1D9E75", "#7F77DD", "#D85A30", "#D4537E"];
const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${n}`;
const heatColor = (h: number) => h >= 80 ? "#D85A30" : h >= 60 ? "#C9972A" : h >= 40 ? "#378ADD" : "#4A4845";

// ─── Shared Components ────────────────────────────────────────────────────────

function Av({ initials, size = 40 }: { initials: string; size?: number }) {
  const c = getAvatarColor(initials);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `${c}22`, border: `1.5px solid ${c}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: c, flexShrink: 0 }}>{initials}</div>;
}

function TierBadge({ tier, verified }: { tier: string; verified: boolean }) {
  if (tier === "Platform") return <span style={{ fontSize: 11, color: "#C9972A", background: "#1E1800", border: "0.5px solid #3D2E00", padding: "3px 8px", borderRadius: 10 }}>◆ Goldstream</span>;
  return <span style={{ fontSize: 11, color: "#8A8780", background: "#1A1A1F", border: "0.5px solid #2A2A30", padding: "3px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 5 }}>{verified && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1D9E75", display: "inline-block" }} />}{tier}</span>;
}

function PostTypeBadge({ type }: { type: PostType }) {
  const c = POST_TYPE_CONFIG[type];
  return <span style={{ fontSize: 11, fontWeight: 700, color: c.color, background: c.bg, border: `0.5px solid ${c.color}55`, padding: "3px 10px", borderRadius: 10 }}>{c.label}</span>;
}

function PollBlock({ poll, onVote }: { poll: Poll; onVote: (i: number) => void }) {
  const total = poll.votes.reduce((a, b) => a + b, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 15, color: "#F0EDE8", fontWeight: 600 }}>{poll.question}</div>
      {poll.options.map((opt, i) => {
        const pct = total > 0 ? Math.round((poll.votes[i] / total) * 100) : 0;
        const voted = poll.userVote === i;
        const revealed = poll.userVote !== null;
        return (
          <div key={i} onClick={() => !revealed && onVote(i)} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${voted ? "#C9972A" : "#2A2A30"}`, cursor: revealed ? "default" : "pointer", background: "#0D0D0F" }}>
            {revealed && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: voted ? "#C9972A22" : "#2A2A3044", transition: "width 0.8s ease" }} />}
            <div style={{ position: "relative", padding: "11px 14px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: voted ? "#EFC96E" : "#8A8780" }}>{opt}</span>
              {revealed && <span style={{ fontSize: 13, color: "#4A4845" }}>{pct}%</span>}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 12, color: "#4A4845" }}>{total.toLocaleString()} votes · Closes {poll.endsAt}</div>
    </div>
  );
}

function CommentBlock({ comment }: { comment: Comment }) {
  const c = getAvatarColor(comment.authorName);
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "0.5px solid #1A1A1F" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${c}22`, border: `1px solid ${c}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: c, flexShrink: 0, fontWeight: 700 }}>{comment.authorName.split(" ").map(w => w[0]).join("")}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 600 }}>{comment.authorName}</span>
          {comment.authorVerified && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1D9E75", display: "inline-block" }} />}
          <span style={{ fontSize: 12, color: "#4A4845" }}>{comment.timeAgo}</span>
          <span style={{ fontSize: 11, color: "#C9972A", marginLeft: "auto" }}>✦ {comment.respectScore}</span>
        </div>
        <div style={{ fontSize: 14, color: "#8A8780", lineHeight: 1.6 }}>{comment.content}</div>
      </div>
    </div>
  );
}

// ─── FEED TAB ─────────────────────────────────────────────────────────────────

function FeedTab({ currentUserId, currentUserName, currentUserTier, currentUserVerified, onOpenProfile }: CommunityFeedProps & { onOpenProfile: (id: string) => void }) {
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostType, setNewPostType] = useState<PostType>("hottake");
  const [composing, setComposing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | PostType>("all");
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [ticker] = useState(["🔴 Miami cap rates compressing — 3rd week running", "🟢 Houston multifamily +12% YoY", "🟡 Austin inventory up 8% this month", "🔴 LA single-family demand softening"]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [lbView, setLbView] = useState<"global" | "city">("global");

  useEffect(() => {
    const t = setInterval(() => setTickerIdx(i => (i + 1) % ticker.length), 3500);
    return () => clearInterval(t);
  }, [ticker.length]);

  const react = (postId: string, reaction: Reaction) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const was = p.userReaction === reaction;
      return { ...p, userReaction: was ? null : reaction, reactions: { ...p.reactions, [reaction]: p.reactions[reaction] + (was ? -1 : 1), ...(p.userReaction && !was ? { [p.userReaction]: p.reactions[p.userReaction] - 1 } : {}) } };
    }));
  };

  const toggleDidThisToo = (id: string) => setPosts(prev => prev.map(p => p.id !== id ? p : { ...p, userDidThisToo: !p.userDidThisToo, didThisToo: p.didThisToo + (p.userDidThisToo ? -1 : 1) }));
  const togglePassedOn = (id: string) => setPosts(prev => prev.map(p => p.id !== id ? p : { ...p, userPassedOnThis: !p.userPassedOnThis, passedOnThis: p.passedOnThis + (p.userPassedOnThis ? -1 : 1) }));
  const toggleComments = (id: string) => setPosts(prev => prev.map(p => p.id === id ? { ...p, showComments: !p.showComments } : p));

  const voteOnPoll = (postId: string, idx: number) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId || !p.poll) return p;
      const v = [...p.poll.votes]; v[idx]++;
      return { ...p, poll: { ...p.poll, votes: v, userVote: idx } };
    }));
  };

  const submitComment = (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    const c: Comment = { id: `c${Date.now()}`, authorName: currentUserName, authorTier: currentUserTier, authorVerified: currentUserVerified, content, timeAgo: "just now", reactions: { agree: 0, insightful: 0, disagree: 0 }, userReaction: null, respectScore: 120 };
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, c] } : p));
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
  };

  const submitPost = () => {
    if (!newPostContent.trim() || !currentUserVerified) return;
    const p: Post = { id: `p${Date.now()}`, type: newPostType, authorId: currentUserId, authorName: currentUserName, authorInitials: currentUserName.split(" ").map(w => w[0]).join(""), authorTier: currentUserTier, authorVerified: currentUserVerified, content: newPostContent, timeAgo: "just now", reactions: { smart: 0, risky: 0, in: 0, disagree: 0 }, userReaction: null, didThisToo: 0, userDidThisToo: false, passedOnThis: 0, userPassedOnThis: false, comments: [], showComments: false };
    setPosts(prev => [p, ...prev]);
    setNewPostContent("");
    setComposing(false);
  };

  const filtered = posts.filter(p => !mutedUsers.includes(p.authorId) && (activeFilter === "all" || p.type === activeFilter));

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {/* ── FEED ── */}
      <div style={{ flex: "1 1 0", minWidth: 0, padding: "20px 20px 20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Compose */}
        {currentUserVerified ? (
          <div style={{ background: "linear-gradient(135deg, rgba(20,20,23,0.8), rgba(10,10,14,0.9))", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 14, overflow: "hidden" }}>
            {!composing ? (
              <div onClick={() => setComposing(true)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer" }}>
                <Av initials={currentUserName.split(" ").map(w => w[0]).join("")} size={40} />
                <span style={{ flex: 1, fontSize: 15, color: "#4A4845" }}>Share a deal, win, or hot take…</span>
                <button style={{ fontSize: 13, fontWeight: 700, color: "#000", background: "#C9972A", border: "none", padding: "9px 22px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Post</button>
              </div>
            ) : (
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                  {(Object.keys(POST_TYPE_CONFIG) as PostType[]).map(t => (
                    <button key={t} onClick={() => setNewPostType(t)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", background: newPostType === t ? POST_TYPE_CONFIG[t].bg : "transparent", color: newPostType === t ? POST_TYPE_CONFIG[t].color : "#4A4845", border: `1px solid ${newPostType === t ? POST_TYPE_CONFIG[t].color + "66" : "#2A2A30"}` }}>
                      {POST_TYPE_CONFIG[t].label}
                    </button>
                  ))}
                </div>
                <textarea value={newPostContent} onChange={e => setNewPostContent(e.target.value)} placeholder="Drop your take…" style={{ width: "100%", background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 10, color: "#F0EDE8", fontSize: 15, padding: "12px 14px", fontFamily: "inherit", resize: "none" as const, outline: "none", lineHeight: 1.6 }} rows={4} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#4A4845" }}>✦ AI moderated before posting</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setComposing(false)} style={{ fontSize: 13, color: "#4A4845", background: "transparent", border: "1px solid #2A2A30", padding: "7px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    <button onClick={submitPost} style={{ fontSize: 13, fontWeight: 700, color: "#000", background: "#C9972A", border: "none", padding: "7px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Post to feed</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "#141417", border: "1px solid #2A2A30", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <span style={{ fontSize: 15, color: "#4A4845", flex: 1 }}>Verify your identity to post</span>
            <button style={{ fontSize: 13, fontWeight: 700, color: "#000", background: "#C9972A", border: "none", padding: "8px 18px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Get Verified</button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {(["all", "deal", "win", "hottake", "question", "poll"] as const).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", background: activeFilter === f ? "#1E1800" : "transparent", color: activeFilter === f ? "#EFC96E" : "#4A4845", border: `1px solid ${activeFilter === f ? "#C9972A55" : "#2A2A30"}` }}>
              {f === "all" ? "All" : POST_TYPE_CONFIG[f].label}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(post => (
            <div key={post.id} style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.5), rgba(0,0,0,0.3))", borderRadius: 14, overflow: "hidden", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, border: post.isNationalSignal ? "1px solid rgba(201,151,42,0.35)" : "1px solid rgba(255,255,255,0.07)", borderLeft: post.isNationalSignal ? "3px solid #C9972A" : post.type === "win" ? "3px solid #1D9E75" : post.type === "hottake" ? "3px solid #D85A30" : post.type === "deal" ? "3px solid #C9972A" : "3px solid rgba(255,255,255,0.08)", position: "relative" as const }}>
              {post.isNationalSignal && <div style={{ fontSize: 12, fontWeight: 600, color: "#C9972A", background: "#1E1800", margin: "-18px -20px 0", padding: "8px 20px", display: "flex", alignItems: "center", gap: 8, borderBottom: "0.5px solid #3D2E00" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C9972A", display: "inline-block" }} />National Signal — {post.market} market moving</div>}
              {post.isMilestone && <div style={{ fontSize: 13, fontWeight: 600, color: "#1D9E75", background: "#0A1A0A", margin: "-18px -20px 0", padding: "8px 20px", borderBottom: "0.5px solid #1A3A1A" }}>🎉 Portfolio Milestone</div>}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <Av initials={post.authorInitials} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 4 }}>
                    <span onClick={() => onOpenProfile(post.authorId)} style={{ fontSize: 15, fontWeight: 700, color: "#F0EDE8", cursor: "pointer" }}>{post.authorName}</span>
                    {post.authorPortfolioValue && <span style={{ fontSize: 12, color: "#C9972A", fontWeight: 600 }}>{fmt(post.authorPortfolioValue)}</span>}
                    {post.authorInfluenceScore && <span style={{ fontSize: 11, color: "#C9972A", fontWeight: 700 }}>✦ {post.authorInfluenceScore}</span>}
                    <TierBadge tier={post.authorTier} verified={post.authorVerified} />
                    <PostTypeBadge type={post.type} />
                    {post.calledItCorrect && <span style={{ fontSize: 12, color: "#EFC96E" }}>👑 Called it</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#4A4845" }}>{post.market && `${post.market} · `}{post.timeAgo}</div>
                </div>
                <button onClick={() => setMutedUsers(prev => [...prev, post.authorId])} style={{ fontSize: 18, color: "#2A2A30", background: "transparent", border: "none", cursor: "pointer", padding: "0 4px", flexShrink: 0, fontFamily: "inherit" }}>···</button>
              </div>

              {post.dealVerified && <div style={{ fontSize: 12, color: "#1D9E75", background: "#0A1A0A", border: "1px solid #1A3A1A", borderRadius: 8, padding: "7px 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75", display: "inline-block", flexShrink: 0 }} />Record Verified · {post.dealAddress} · {fmt(post.dealValue!)}</div>}

              <div style={{ fontSize: 15, color: "#C8C5BF", lineHeight: 1.7, fontStyle: post.type === "hottake" ? "italic" : "normal", borderLeft: post.type === "hottake" ? "3px solid #D85A30" : "none", paddingLeft: post.type === "hottake" ? 14 : 0 }}>
                {post.type === "hottake" && <span style={{ color: "#D85A30", fontWeight: 600, fontStyle: "normal" }}>🔥 </span>}{post.content}
              </div>

              {post.poll && <PollBlock poll={post.poll} onVote={(i) => voteOnPoll(post.id, i)} />}

              {post.type !== "poll" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                  {([{ key: "smart" as Reaction, label: "Smart move" }, { key: "risky" as Reaction, label: "Risky" }, { key: "in" as Reaction, label: "I'm in" }, { key: "disagree" as Reaction, label: "Disagree" }]).map(r => (
                    <button key={r.key} onClick={() => react(post.id, r.key)} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", background: post.userReaction === r.key ? "#1E1800" : "transparent", color: post.userReaction === r.key ? "#EFC96E" : "#4A4845", border: `1px solid ${post.userReaction === r.key ? "#C9972A55" : "#2A2A30"}`, display: "flex", alignItems: "center", gap: 4 }}>
                      {r.label}{post.reactions[r.key] > 0 && <span style={{ color: "#C9972A", marginLeft: 4, fontWeight: 700 }}>{post.reactions[r.key]}</span>}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 16, borderTop: "1px solid #1A1A1F", paddingTop: 12, flexWrap: "wrap" as const }}>
                {post.type === "deal" && <>
                  <button onClick={() => toggleDidThisToo(post.id)} style={{ fontSize: 13, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: post.userDidThisToo ? "#1D9E75" : "#4A4845" }}>✓ Did this too {post.didThisToo > 0 && `(${post.didThisToo})`}</button>
                  <button onClick={() => togglePassedOn(post.id)} style={{ fontSize: 13, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: post.userPassedOnThis ? "#D85A30" : "#4A4845" }}>✗ Passed {post.passedOnThis > 0 && `(${post.passedOnThis})`}</button>
                </>}
                <button onClick={() => toggleComments(post.id)} style={{ fontSize: 13, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "#4A4845" }}>💬 {post.comments.length > 0 ? `${post.comments.length} comments` : "Comment"}</button>
              </div>

              {post.showComments && (
                <div style={{ borderTop: "1px solid #1A1A1F", paddingTop: 12 }}>
                  {post.comments.map(c => <CommentBlock key={c.id} comment={c} />)}
                  {currentUserVerified && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12 }}>
                      <Av initials={currentUserName.split(" ").map(w => w[0]).join("")} size={32} />
                      <input value={commentInputs[post.id] || ""} onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && submitComment(post.id)} placeholder="Add a comment…" style={{ flex: 1, background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 20, color: "#F0EDE8", fontSize: 14, padding: "9px 14px", fontFamily: "inherit", outline: "none" }} />
                      <button onClick={() => submitComment(post.id)} style={{ width: 36, height: 36, borderRadius: "50%", background: "#C9972A", border: "none", color: "#000", fontSize: 16, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700 }}>↑</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 280, flexShrink: 0, padding: "20px 24px 20px 0", display: "flex", flexDirection: "column", gap: 12, position: "sticky" as const, top: 0, alignSelf: "flex-start" as const }}>

        {/* Deal Pulse */}
        <div style={SC.card}>
          <div style={SC.hdr}><span style={SC.lbl}>DEAL PULSE</span><span style={{ fontSize: 10, color: "#D85A30", background: "#1A0A00", border: "0.5px solid #D85A3044", padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>LIVE</span></div>
          {DEAL_PULSE.map((m, i) => (
            <div key={m.city} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: "#2A2A30", width: 16, textAlign: "right", flexShrink: 0 }}>#{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>{m.city}</span>
                  <span style={{ fontSize: 12, color: heatColor(m.heat), fontWeight: 700 }}>{m.trend === "up" ? "↑" : m.trend === "down" ? "↓" : "→"} {m.deals}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "#1A1A1F" }}><div style={{ height: "100%", borderRadius: 2, background: heatColor(m.heat), width: `${m.heat}%`, opacity: 0.85 }} /></div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#2A2A30" }}>deals posted this week</div>
        </div>

        {/* Leaderboard */}
        <div style={SC.card}>
          <div style={SC.hdr}>
            <span style={SC.lbl}>THIS WEEK</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["global", "city"] as const).map(v => <button key={v} onClick={() => setLbView(v)} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", border: `0.5px solid ${lbView === v ? "#C9972A44" : "#2A2A30"}`, background: lbView === v ? "#1E1800" : "transparent", color: lbView === v ? "#EFC96E" : "#4A4845" }}>{v}</button>)}
            </div>
          </div>
          <div style={{ background: "#1A1500", border: "1px solid #C9972A33", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13, color: "#C9972A", fontWeight: 800 }}>#12</span>
              <span style={{ fontSize: 13, color: "#EFC96E", fontWeight: 700, flex: 1 }}>You</span>
              <span style={{ fontSize: 12, color: "#C9972A", fontWeight: 700 }}>891 pts</span>
            </div>
            <span style={{ fontSize: 11, color: "#4A4845" }}>↑ 2 spots · 47 pts to #11 · reset in 5d</span>
          </div>
          {LEADERBOARD.filter(e => !e.isUser).map((e, idx) => {
            const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : null;
            const isRival = (e as any).isRival;
            if (idx === 3) return <div key="sep" style={{ textAlign: "center", fontSize: 10, color: "#2A2A30" }}>· · ·</div>;
            return (
              <div key={e.rank} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: isRival ? "#1A0A1A" : "transparent", border: isRival ? "0.5px solid #D4537E33" : "none" }}>
                <span style={{ fontSize: 12, color: "#4A4845", width: 22, textAlign: "center" }}>{medal || `#${e.rank}`}</span>
                <Av initials={e.initials} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: isRival ? "#D4537E" : "#C8C5BF", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isRival ? "⚠ " : ""}{e.name}</div>
                  <div style={{ fontSize: 10, color: "#C9972A" }}>✦ {e.influenceScore}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 700 }}>{e.pts.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: e.delta > 0 ? "#1D9E75" : e.delta < 0 ? "#D85A30" : "#4A4845" }}>{e.delta > 0 ? "↑" : "↓"}{Math.abs(e.delta)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Market */}
        <div style={SC.card}>
          <div style={SC.hdr}><span style={SC.lbl}>YOUR MARKET</span></div>
          <div style={{ fontSize: 14, color: "#8A8780" }}><span style={{ color: "#C9972A", fontWeight: 700 }}>47 investors</span> watching Houston</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 13, color: "#4A4845" }}>📈 Most buying: multifamily</div>
            <div style={{ fontSize: 13, color: "#4A4845" }}>⚠️ Avoiding: SFR &gt;$500K</div>
            <div style={{ fontSize: 13, color: "#4A4845" }}>💬 Hot: Midtown cap rates</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GROUPS TAB ───────────────────────────────────────────────────────────────

function GroupsTab({ currentUserName }: { currentUserName: string }) {
  const [view, setView] = useState<"mygroup" | "leaderboard">("mygroup");
  const [groups, setGroups] = useState<PublicGroup[]>(ALL_GROUPS);
  const [challenged, setChallenged] = useState<string[]>([]);
  const [projectComment, setProjectComment] = useState("");
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);

  const myGroup = groups.find(g => g.isMyGroup)!;
  const rival = groups.find(g => g.rank === myGroup.rank + 1);

  const challenge = (id: string) => {
    setChallenged(prev => [...prev, id]);
    setGroups(prev => prev.map(g => g.id === id ? { ...g, challenged: true } : g));
  };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Competition Banner */}
      <div style={{ background: "linear-gradient(135deg, #1A0A00 0%, #0D1A0D 100%)", border: "1px solid #C9972A44", borderRadius: 16, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🏆</div>
          <div>
            <div style={{ fontSize: 12, color: "#C9972A", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Weekly Group Battle — 5d left</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F0EDE8" }}>Houston Syndicate <span style={{ color: "#4A4845", fontWeight: 400 }}>vs</span> Dallas Capital Club</div>
            <div style={{ fontSize: 13, color: "#4A4845", marginTop: 2 }}>2,847 pts · You're ahead by <span style={{ color: "#1D9E75", fontWeight: 700 }}>506 pts</span></div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#4A4845", marginBottom: 6 }}>Prize this week</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#C9972A" }}>30 days Premium</div>
          <div style={{ fontSize: 11, color: "#4A4845" }}>for all members</div>
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", gap: 0, background: "#141417", border: "1px solid #2A2A30", borderRadius: 12, overflow: "hidden", alignSelf: "flex-start" }}>
        {([{ key: "mygroup", label: "My Group" }, { key: "leaderboard", label: "All Groups" }] as const).map(v => (
          <button key={v.key} onClick={() => setView(v.key)} style={{ fontSize: 13, fontWeight: 700, padding: "10px 22px", cursor: "pointer", fontFamily: "inherit", border: "none", background: view === v.key ? "#C9972A" : "transparent", color: view === v.key ? "#000" : "#4A4845" }}>
            {v.label}
          </button>
        ))}
      </div>

      {view === "mygroup" && (
        <>
          {/* My Group Card */}
          <div style={{ background: "#141417", border: "1px solid #2A2A30", borderRadius: 16, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#1D9E7522", border: "1px solid #1D9E7544", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#1D9E75" }}>{myGroup.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#F0EDE8" }}>{myGroup.name}</span>
                  <span style={{ fontSize: 11, color: "#1D9E75", background: "#0A1A0A", border: "1px solid #1A3A1A", padding: "3px 10px", borderRadius: 20 }}>● {myGroup.streak}-day streak</span>
                  <span style={{ fontSize: 11, color: "#C9972A", background: "#1E1800", border: "1px solid #3D2E00", padding: "3px 10px", borderRadius: 20 }}>◆ {myGroup.tier} tier</span>
                </div>
                <div style={{ fontSize: 13, color: "#4A4845" }}>{myGroup.members} members · #{myGroup.rank} syndicate in {myGroup.rankArea}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#F0EDE8" }}>{fmt(myGroup.combinedValue)}</div>
                <div style={{ fontSize: 12, color: "#4A4845" }}>combined portfolio</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              {[{ label: "This week", value: `${myGroup.weeklyPoints.toLocaleString()} pts`, color: "#C9972A" }, { label: "Deals closed", value: `${myGroup.dealsThisWeek} deals`, color: "#1D9E75" }, { label: "Group rank", value: `#${myGroup.rank} Texas`, color: "#378ADD" }].map(s => (
                <div key={s.label} style={{ background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#4A4845", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Rival */}
            {rival && (
              <div style={{ background: "#1A0A1A", border: "1px solid #D4537E33", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#D4537E", fontWeight: 700, marginBottom: 3 }}>⚔ RIVAL GROUP</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#F0EDE8" }}>{rival.name}</div>
                  <div style={{ fontSize: 12, color: "#4A4845" }}>{fmt(rival.combinedValue)} · {rival.weeklyPoints.toLocaleString()} pts</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: "#1D9E75", fontWeight: 700 }}>You're ahead by {fmt(myGroup.combinedValue - rival.combinedValue)}</div>
                  <div style={{ fontSize: 11, color: "#4A4845" }}>Keep pushing</div>
                </div>
              </div>
            )}
          </div>

          {/* Shared Projects */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#F0EDE8" }}>Shared Projects</div>
                <div style={{ fontSize: 12, color: "#4A4845" }}>Projects your group members are building</div>
              </div>
              <button style={{ fontSize: 13, fontWeight: 700, color: "#000", background: "#C9972A", border: "none", padding: "8px 18px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>+ Share a project</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[{ id: "p1", title: "Oak Cliff Duplex Conversion", author: "Marcus B.", authorInitials: "MB", phase: "Renovation", phasePct: 62, city: "Dallas", budget: 180000, spent: 112000, sharedWith: "full" as const, comments: 7, timeAgo: "3h ago", needsAdvice: true, adviceTopic: "Anyone know good HVAC contractors in Oak Cliff?" }, { id: "p2", title: "Midtown Triplex Acquisition", author: "You", authorInitials: "ME", phase: "Due Diligence", phasePct: 35, city: "Houston", budget: 640000, spent: 8400, sharedWith: "value" as const, comments: 3, timeAgo: "1d ago" }].map(proj => (
                <div key={proj.id} style={{ background: "#141417", border: `1px solid ${proj.needsAdvice ? "#C9972A44" : "#2A2A30"}`, borderRadius: 14, overflow: "hidden" }}>
                  {proj.needsAdvice && (
                    <div style={{ background: "#1E1800", borderBottom: "1px solid #3D2E00", padding: "8px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 10, color: "#C9972A", fontWeight: 800, letterSpacing: "0.1em" }}>ADVICE NEEDED</span>
                      <span style={{ fontSize: 13, color: "#EFC96E" }}>{proj.adviceTopic}</span>
                    </div>
                  )}
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      <Av initials={proj.authorInitials} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#F0EDE8", marginBottom: 3 }}>{proj.title}</div>
                        <div style={{ fontSize: 12, color: "#4A4845" }}>{proj.author} · {proj.city} · {proj.timeAgo}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#4A4845", background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 8, padding: "4px 10px" }}>{proj.sharedWith === "full" ? "Full access" : "Value only"}</div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: "#C9972A", fontWeight: 600 }}>{proj.phase}</span>
                        <span style={{ fontSize: 12, color: "#4A4845" }}>{proj.phasePct}% complete</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "#1A1A1F" }}><div style={{ height: "100%", borderRadius: 3, background: "#C9972A", width: `${proj.phasePct}%` }} /></div>
                    </div>
                    {proj.sharedWith === "full" && (
                      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                        {[{ label: "BUDGET", value: fmt(proj.budget), color: "#F0EDE8" }, { label: "SPENT", value: fmt(proj.spent), color: proj.spent / proj.budget > 0.8 ? "#f87171" : "#F0EDE8" }, { label: "REMAINING", value: fmt(proj.budget - proj.spent), color: "#1D9E75" }].map(s => (
                          <div key={s.label} style={{ flex: 1, background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 10, padding: "10px 14px" }}>
                            <div style={{ fontSize: 10, color: "#4A4845", marginBottom: 3 }}>{s.label}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ borderTop: "1px solid #1A1A1F", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <button onClick={() => setOpenCommentId(openCommentId === proj.id ? null : proj.id)} style={{ fontSize: 13, background: "transparent", border: "none", cursor: "pointer", color: "#4A4845", fontFamily: "inherit", padding: 0 }}>💬 {proj.comments} comments {openCommentId === proj.id ? "▲" : "▼"}</button>
                      {proj.needsAdvice && <button style={{ fontSize: 12, fontWeight: 700, color: "#C9972A", background: "#1E1800", border: "1px solid #3D2E00", padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}>Give advice</button>}
                    </div>
                    {openCommentId === proj.id && (
                      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                        <Av initials={currentUserName.split(" ").map(w => w[0]).join("")} size={32} />
                        <input value={projectComment} onChange={e => setProjectComment(e.target.value)} placeholder="Comment on this project…" style={{ flex: 1, background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 20, color: "#F0EDE8", fontSize: 14, padding: "9px 14px", fontFamily: "inherit", outline: "none" }} />
                        <button onClick={() => setProjectComment("")} style={{ width: 36, height: 36, borderRadius: "50%", background: "#C9972A", border: "none", color: "#000", fontSize: 16, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>↑</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === "leaderboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "#4A4845", marginBottom: 4 }}>All groups are public. See how others perform, challenge them, or find inspiration.</div>
          {groups.map((g, i) => {
            const isMine = g.isMyGroup;
            const isChall = challenged.includes(g.id);
            return (
              <div key={g.id} style={{ background: isMine ? "#1A1500" : "#141417", border: `1px solid ${isMine ? "#C9972A44" : "#2A2A30"}`, borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? "#C9972A" : i === 1 ? "#8A8780" : i === 2 ? "#D85A30" : "#2A2A30", width: 36, textAlign: "center", flexShrink: 0 }}>#{g.rank}</div>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: isMine ? "#1D9E7522" : "#2A2A3022", border: `1px solid ${isMine ? "#1D9E7555" : "#2A2A3055"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: isMine ? "#1D9E75" : "#8A8780", flexShrink: 0 }}>{g.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#F0EDE8" }}>{g.name}</span>
                    {isMine && <span style={{ fontSize: 11, color: "#1D9E75", background: "#0A1A0A", border: "1px solid #1A3A1A", padding: "2px 8px", borderRadius: 10 }}>Your group</span>}
                    <span style={{ fontSize: 11, color: "#C9972A", background: "#1E1800", border: "1px solid #3D2E00", padding: "2px 8px", borderRadius: 10 }}>{g.tier}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 13, color: "#4A4845" }}>{g.members} members</span>
                    <span style={{ fontSize: 13, color: "#C9972A", fontWeight: 600 }}>{fmt(g.combinedValue)}</span>
                    <span style={{ fontSize: 13, color: "#4A4845" }}>{g.weeklyPoints.toLocaleString()} pts this week</span>
                    <span style={{ fontSize: 13, color: "#1D9E75" }}>🔥 {g.streak}d streak</span>
                    <span style={{ fontSize: 13, color: "#378ADD" }}>{g.dealsThisWeek} deals this week</span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {isMine ? (
                    <span style={{ fontSize: 13, color: "#1D9E75", fontWeight: 700 }}>Your group</span>
                  ) : isChall ? (
                    <span style={{ fontSize: 13, color: "#4A4845", background: "#141417", border: "1px solid #2A2A30", padding: "7px 16px", borderRadius: 10 }}>⚔ Challenged</span>
                  ) : (
                    <button onClick={() => challenge(g.id)} style={{ fontSize: 13, fontWeight: 700, color: "#D85A30", background: "#1A0A00", border: "1px solid #D85A3044", padding: "7px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>⚔ Challenge</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CONNECT TAB ──────────────────────────────────────────────────────────────

function ConnectTab({ currentUserVerified, onOpenProfile }: { currentUserVerified: boolean; onOpenProfile: (id: string) => void }) {
  const [panel, setPanel] = useState<"local" | "network">("local");
  const [localInvestors, setLocalInvestors] = useState<LocalInvestor[]>(MOCK_LOCAL);
  const [networkInvestors, setNetworkInvestors] = useState<NetworkInvestor[]>(MOCK_NETWORK);
  const [connectModal, setConnectModal] = useState<{ id: string; name: string; isLocal: boolean } | null>(null);
  const [reason, setReason] = useState<ConnectReason>("jv");
  const [message, setMessage] = useState("");

  const sendRequest = () => {
    if (!message.trim()) return;
    if (connectModal?.isLocal) setLocalInvestors(prev => prev.map(i => i.id === connectModal.id ? { ...i, requestSent: true } : i));
    else setNetworkInvestors(prev => prev.map(i => i.id === connectModal?.id ? { ...i, requestSent: true } : i));
    setConnectModal(null); setMessage("");
  };

  const REASONS: { key: ConnectReason; label: string }[] = [{ key: "jv", label: "JV Opportunity" }, { key: "intel", label: "Market Intel" }, { key: "partner", label: "Deal Partner" }, { key: "mentor", label: "Mentorship" }, { key: "other", label: "Other" }];

  if (!currentUserVerified) return (
    <div style={{ padding: "3rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
      <div style={{ fontSize: 36 }}>🔒</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#F0EDE8" }}>Verify your portfolio to connect</div>
      <div style={{ fontSize: 14, color: "#4A4845", maxWidth: 340, lineHeight: 1.6 }}>Only verified investors with real portfolios can connect. This protects everyone on the platform.</div>
      <button style={{ fontSize: 14, fontWeight: 700, color: "#000", background: "#C9972A", border: "none", padding: "10px 24px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Get Verified</button>
    </div>
  );

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 0, background: "#141417", border: "1px solid #2A2A30", borderRadius: 12, overflow: "hidden", alignSelf: "flex-start" }}>
        {([{ key: "local", label: "📍 Local — Houston" }, { key: "network", label: "🌐 Same Strategy" }] as const).map(p => (
          <button key={p.key} onClick={() => setPanel(p.key)} style={{ fontSize: 13, fontWeight: 700, padding: "10px 20px", cursor: "pointer", fontFamily: "inherit", border: "none", background: panel === p.key ? "#C9972A" : "transparent", color: panel === p.key ? "#000" : "#4A4845", borderRight: p.key === "local" ? "1px solid #2A2A30" : "none" }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 14, color: "#4A4845" }}>{panel === "local" ? "Verified investors in your city. Connect to share market intel, find JV partners, or get local advice." : "Investors doing the same strategy as you, anywhere."}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(panel === "local" ? localInvestors : networkInvestors).map(investor => (
          <div key={investor.id} style={{ background: "#141417", border: "1px solid #2A2A30", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <Av initials={investor.initials} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" as const }}>
                <span onClick={() => onOpenProfile(investor.id)} style={{ fontSize: 15, fontWeight: 700, color: "#F0EDE8", cursor: "pointer" }}>{investor.name}</span>
                {investor.verified ? <span style={{ fontSize: 11, color: "#1D9E75", background: "#0A1A0A", border: "1px solid #1A3A1A", padding: "2px 8px", borderRadius: 10 }}>✓ Verified</span> : <span style={{ fontSize: 11, color: "#4A4845", background: "#141417", border: "1px solid #2A2A30", padding: "2px 8px", borderRadius: 10 }}>Unverified</span>}
                <TierBadge tier={investor.tier} verified={investor.verified} />
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 13, color: "#4A4845" }}>{"city" in investor ? investor.city : (investor as NetworkInvestor).markets.join(", ")}</span>
                <span style={{ fontSize: 13, color: "#4A4845" }}>{investor.strategy}</span>
                <span style={{ fontSize: 13, color: "#C9972A", fontWeight: 600 }}>{fmt(investor.portfolioValue)}</span>
                <span style={{ fontSize: 13, color: "#C9972A" }}>✦ {investor.influenceScore}</span>
              </div>
              {"whyMatch" in investor && <div style={{ marginTop: 5, fontSize: 13, color: "#7F77DD" }}>◈ {(investor as NetworkInvestor).whyMatch}</div>}
              {"commonMarkets" in investor && (investor as LocalInvestor).commonMarkets > 0 && <div style={{ marginTop: 5, fontSize: 13, color: "#378ADD" }}>◈ {(investor as LocalInvestor).commonMarkets} markets in common</div>}
            </div>
            {investor.connected ? <span style={{ fontSize: 13, color: "#1D9E75", background: "#0A1A0A", border: "1px solid #1A3A1A", padding: "7px 14px", borderRadius: 10 }}>✓ Connected</span>
              : investor.requestSent ? <span style={{ fontSize: 13, color: "#4A4845", background: "#141417", border: "1px solid #2A2A30", padding: "7px 14px", borderRadius: 10 }}>Sent</span>
              : !investor.verified ? <span style={{ fontSize: 13, color: "#4A4845", padding: "7px 14px", borderRadius: 10, background: "#141417", border: "1px solid #2A2A30" }}>Not verified</span>
              : <button onClick={() => { const inv = (panel === "local" ? localInvestors : networkInvestors).find(i => i.id === investor.id); if (inv) setConnectModal({ id: investor.id, name: inv.name, isLocal: panel === "local" }); }} style={{ fontSize: 13, fontWeight: 700, color: "#000", background: "#C9972A", border: "none", padding: "7px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Connect</button>}
          </div>
        ))}
      </div>

      {connectModal && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#141417", border: "1px solid #2A2A30", borderRadius: 18, padding: "28px", width: 400, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#F0EDE8" }}>Connect with {connectModal.name}</div>
            <div style={{ fontSize: 14, color: "#4A4845", lineHeight: 1.6 }}>They'll see your verified portfolio before deciding. One message — make it count.</div>
            <div>
              <div style={{ fontSize: 11, color: "#4A4845", marginBottom: 8, letterSpacing: "0.08em", fontWeight: 700 }}>WHY YOU'RE CONNECTING</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                {REASONS.map(r => <button key={r.key} onClick={() => setReason(r.key)} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", background: reason === r.key ? "#1E1800" : "transparent", color: reason === r.key ? "#EFC96E" : "#4A4845", border: `1px solid ${reason === r.key ? "#C9972A55" : "#2A2A30"}` }}>{r.label}</button>)}
              </div>
            </div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="One sentence — why should they connect with you?" style={{ width: "100%", background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 10, color: "#F0EDE8", fontSize: 14, padding: "12px 14px", fontFamily: "inherit", resize: "none" as const, outline: "none", lineHeight: 1.6 }} rows={3} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConnectModal(null)} style={{ fontSize: 13, color: "#4A4845", background: "transparent", border: "1px solid #2A2A30", padding: "8px 18px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={sendRequest} style={{ fontSize: 13, fontWeight: 700, color: "#000", background: "#C9972A", border: "none", padding: "8px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", opacity: message.trim() ? 1 : 0.4 }}>Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CommunityFeed({ currentUserId, currentUserName, currentUserTier, currentUserVerified }: CommunityFeedProps) {
  const [activeTab, setActiveTab] = useState<CommunityTab>("feed");
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [ticker] = useState(["🔴 Miami cap rates compressing — 3rd week running", "🟢 Houston multifamily +12% YoY", "🟡 Austin inventory up 8% this month", "🔴 LA single-family demand softening"]);
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTickerIdx(i => (i + 1) % ticker.length), 3500);
    return () => clearInterval(t);
  }, [ticker.length]);

  const TABS = [{ key: "feed", label: "Feed" }, { key: "groups", label: "Groups" }, { key: "connect", label: "Connect" }] as const;

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(8,8,18,0.99), rgba(4,4,12,0.97))", borderRadius: 18, border: "1px solid rgba(245,158,11,0.2)", overflow: "hidden", fontFamily: "'Inter', -apple-system, sans-serif", color: "#F0EDE8", marginTop: 0 }}>
      <div style={{ background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(245,158,11,0.15)", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 40px" }}>
        <div />
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ fontSize: 14, fontWeight: 700, padding: "16px 28px", cursor: "pointer", fontFamily: "inherit", border: "none", borderBottom: `2px solid ${activeTab === t.key ? "#C9972A" : "transparent"}`, background: "transparent", color: activeTab === t.key ? "#EFC96E" : "#4A4845", transition: "all .15s" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div />
      </div>
      <div style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#D85A30", background: "#1A0A00", border: "0.5px solid #D85A3044", padding: "3px 8px", borderRadius: 4, letterSpacing: ".08em", flexShrink: 0 }}>LIVE</span>
        <span style={{ fontSize: 13, color: "#4A4845" }}>{ticker[tickerIdx]}</span>
      </div>
      {activeTab === "feed" && <FeedTab currentUserId={currentUserId} currentUserName={currentUserName} currentUserTier={currentUserTier} currentUserVerified={currentUserVerified} onOpenProfile={(id) => setOpenProfileId(id)} />}
      {activeTab === "groups" && <GroupsTab currentUserName={currentUserName} />}
      {activeTab === "connect" && <ConnectTab currentUserVerified={currentUserVerified} onOpenProfile={(id) => setOpenProfileId(id)} />}
      {openProfileId && <ProfilePage profileId={openProfileId} onClose={() => setOpenProfileId(null)} viewingOwnProfile={openProfileId === currentUserId} />}
    </div>
  );
}

const SC: Record<string, React.CSSProperties> = {
  card: { background: "linear-gradient(135deg, rgba(0,0,0,0.5), rgba(0,0,0,0.3))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, position: "relative" as const },
  hdr: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  lbl: { fontSize: 10, fontWeight: 700, color: "#4A4845", letterSpacing: "0.1em" },
};