function FinancesTab({ properties, user }: { properties: Property[]; user: any }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const todayDayOfYear = Math.floor((Date.now() - new Date(currentYear, 0, 0).getTime()) / 86400000);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ property_id: "", category: "Mortgage", amount: "", date: new Date().toISOString().split("T")[0], note: "", recurring: false, year: currentYear });
  const [expenseErrors, setExpenseErrors] = useState<Record<string, boolean>>({});
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [expandedProps, setExpandedProps] = useState<Set<number>>(new Set());
  const [filterYear, setFilterYear] = useState(currentYear);

  const CATEGORIES = ["Mortgage", "Insurance", "Property Tax", "Repairs", "Management", "Utilities", "CapEx", "Other"];
  const CAT_COLORS: Record<string, string> = { Mortgage: "#f59e0b", Insurance: "#60a5fa", "Property Tax": "#a78bfa", Repairs: "#f87171", Management: "#34d399", Utilities: "#fb923c", CapEx: "#e879f9", Other: "rgba(255,255,255,0.4)" };
  const IS: React.CSSProperties = { width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  // Number formatting — max 2 decimals, clear K/M labels
  function fmtMoney(n: number) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(2)}`;
  }
  function fmtMoneyFull(n: number) {
    const sign = n < 0 ? "-$" : "$";
    return sign + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false })
      .then(({ data }) => { setExpenses(data || []); setLoading(false); });
  }, [user]);

  async function handleAddExpense() {
    const errs: Record<string, boolean> = {};
    if (!form.property_id) errs.property_id = true;
    if (!form.amount) errs.amount = true;
    if (Object.keys(errs).length > 0) { setExpenseErrors(errs); return; }
    setExpenseErrors({});
    const newExp = { user_id: user.id, property_id: parseInt(form.property_id), category: form.category, amount: parseFloat(form.amount), date: form.date, note: form.note, recurring: form.recurring, year: form.year };
    if (editingExpenseId !== null) {
      const { error } = await supabase.from("expenses").update(newExp).eq("id", editingExpenseId);
      if (!error) { const { data: refreshed } = await supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }); setExpenses(refreshed || []); resetForm(); }
    } else {
      const { data, error } = await supabase.from("expenses").insert(newExp).select().single();
      if (!error && data) { setExpenses([data, ...expenses]); resetForm(); }
    }
  }

  function resetForm() { setShowForm(false); setEditingExpenseId(null); setForm({ property_id: "", category: "Mortgage", amount: "", date: new Date().toISOString().split("T")[0], note: "", recurring: false, year: currentYear }); }
  function openEditExpense(e: any) { setEditingExpenseId(e.id); setForm({ property_id: String(e.property_id), category: e.category, amount: String(e.amount), date: e.date, note: e.note || "", recurring: e.recurring || false, year: e.year || currentYear }); setShowForm(true); }
  function toggleProp(id: number) { setExpandedProps(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function handleDelete(id: number) { await supabase.from("expenses").delete().eq("id", id); setExpenses(expenses.filter(e => e.id !== id)); }

  const years = Array.from(new Set([currentYear, currentYear - 1, currentYear - 2, ...expenses.map(e => e.year || currentYear)])).sort((a, b) => b - a);
  const curExpenses = expenses.filter(e => (e.year || currentYear) === filterYear);
  const prevExpenses = expenses.filter(e => (e.year || currentYear) === filterYear - 1);

  const propPnL = properties.map(p => {
    const cur = curExpenses.filter(e => e.property_id === p.id);
    const prev = prevExpenses.filter(e => e.property_id === p.id);
    const annualExp = cur.reduce((s: number, e: any) => s + e.amount, 0);
    const prevAnnualExp = prev.reduce((s: number, e: any) => s + e.amount, 0);
    const rent = p.occupancyStatus === "occupied" ? p.rent : 0;
    const annualRent = rent * 12;
    const annualNet = annualRent - annualExp;
    const monthlyNet = annualNet / 12;
    const dailyNet = annualNet / 365;
    const yoyDelta = prevAnnualExp > 0 ? annualExp - prevAnnualExp : null;
    const margin = annualRent > 0 ? (annualNet / annualRent) * 100 : null;
    const expenseRatio = annualRent > 0 ? (annualExp / annualRent) * 100 : null;
    // NOI = Revenue - Operating Expenses (excluding mortgage/debt)
    const mortgageExp = cur.filter((e: any) => e.category === "Mortgage").reduce((s: number, e: any) => s + e.amount, 0);
    const noi = annualRent - (annualExp - mortgageExp);
    // Cash reserve: months of expenses covered (assumes 3 months savings rule)
    const monthlyExp = annualExp / 12;
    const cashReserveMonths = monthlyExp > 0 ? Math.floor(p.mortgage > 0 ? (p.value - p.mortgage) * 0.05 / monthlyExp : annualRent * 0.1 / monthlyExp) : null;
    return { ...p, cur, prev, annualExp, prevAnnualExp, annualRent, annualNet, monthlyNet, dailyNet, monthlyExp, yoyDelta, margin, expenseRatio, noi, cashReserveMonths };
  });

  const totalAnnualRent = propPnL.reduce((s, p) => s + p.annualRent, 0);
  const totalAnnualExp = propPnL.reduce((s, p) => s + p.annualExp, 0);
  const totalAnnualNet = totalAnnualRent - totalAnnualExp;
  const totalDailyNet = totalAnnualNet / 365;
  const totalMonthlyNet = totalAnnualNet / 12;
  const totalMargin = totalAnnualRent > 0 ? ((totalAnnualNet / totalAnnualRent) * 100).toFixed(1) : null;
  const totalNOI = propPnL.reduce((s, p) => s + p.noi, 0);
  // Today's earnings: daily rate × days elapsed this year
  const todayEarnings = totalDailyNet * todayDayOfYear;

  // 12-month data
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyData = MONTHS.map((label, i) => {
    const monthExp = curExpenses.filter((e: any) => { const d = new Date(e.date); return d.getMonth() === i; }).reduce((s: number, e: any) => s + e.amount, 0);
    const monthRent = totalAnnualRent / 12;
    const net = i <= currentMonth ? monthRent - monthExp : null; // null = future
    const projected = i > currentMonth ? monthRent - (totalAnnualExp / 12) : null;
    return { label, monthExp, monthRent, net, projected, isFuture: i > currentMonth, isCurrent: i === currentMonth };
  });
  const maxBarVal = Math.max(...monthlyData.map(m => Math.abs(m.net ?? m.projected ?? 0)), 1);

  const catTotals: Record<string, number> = {};
  curExpenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });

  function healthColor(margin: number | null) {
    if (margin === null) return "rgba(255,255,255,0.2)";
    if (margin >= 40) return "#34d399";
    if (margin >= 15) return "#f59e0b";
    return "#f87171";
  }
  function healthLabel(margin: number | null) {
    if (margin === null) return "No data";
    if (margin >= 40) return "Healthy";
    if (margin >= 15) return "Watch";
    return "At risk";
  }

  // Period color scheme
  const PERIOD_THEME = {
    daily:   { label: "DAILY",   accent: "#60a5fa", bg: "rgba(96,165,250,0.06)",   border: "rgba(96,165,250,0.15)",   desc: "per day" },
    monthly: { label: "MONTHLY", accent: "#f59e0b", bg: "rgba(245,158,11,0.06)",   border: "rgba(245,158,11,0.15)",   desc: "per month" },
    annual:  { label: "ANNUAL",  accent: "#34d399", bg: "rgba(52,211,153,0.06)",   border: "rgba(52,211,153,0.15)",   desc: "per year" },
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite" }} />
            <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>Financial Intelligence · P&L + Expense Tracking</span>
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: "900", letterSpacing: "-0.5px" }}>Finances</h2>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "3px" }}>Daily · Monthly · Annual · YoY comparison</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#fff", cursor: "pointer", fontWeight: "700", outline: "none" }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "#f59e0b", color: "#000", borderRadius: "10px", fontWeight: "800", fontSize: "13px", border: "none", cursor: "pointer" }}>+ Log Expense</button>
        </div>
      </div>

      {/* Today's Earnings Counter */}
      <div style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(52,211,153,0.05))", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "16px", padding: "18px 24px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>📈 YTD Earnings Counter <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: "400", letterSpacing: "0" }}>· income accumulated since Jan 1</span></p>
          <p style={{ fontSize: "32px", fontWeight: "900", color: todayEarnings >= 0 ? "#34d399" : "#f87171", letterSpacing: "-1px" }}>{todayEarnings >= 0 ? "+" : ""}{fmtMoneyFull(todayEarnings)}</p>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>Day {todayDayOfYear} of {filterYear} · {fmtMoney(totalDailyNet)}/day net rate</p>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px" }}>NOI <span style={{ color: "rgba(255,255,255,0.2)" }}>· Net Operating Income</span></p>
            <p style={{ fontSize: "18px", fontWeight: "800", color: "#f59e0b" }}>{fmtMoneyFull(totalNOI)}/yr</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px" }}>Profit Margin</p>
            <p style={{ fontSize: "18px", fontWeight: "800", color: totalMargin !== null ? healthColor(parseFloat(totalMargin)) : "rgba(255,255,255,0.3)" }}>{totalMargin !== null ? `${totalMargin}%` : "—"}</p>
          </div>
        </div>
      </div>

      {/* Color-coded Daily / Monthly / Annual strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
        {([
          { theme: PERIOD_THEME.daily,   income: totalAnnualRent / 365, exp: totalAnnualExp / 365, net: totalDailyNet },
          { theme: PERIOD_THEME.monthly, income: totalAnnualRent / 12,  exp: totalAnnualExp / 12,  net: totalMonthlyNet },
          { theme: PERIOD_THEME.annual,  income: totalAnnualRent,        exp: totalAnnualExp,        net: totalAnnualNet },
        ] as const).map(({ theme, income, exp, net }) => (
          <div key={theme.label} style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontSize: "10px", fontWeight: "800", color: theme.accent, letterSpacing: "1.5px" }}>{theme.label}</span>
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>{theme.desc}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>Income</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#34d399" }}>{fmtMoney(income)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>Expenses</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#f87171" }}>{fmtMoney(exp)}</span>
              </div>
              <div style={{ height: "1px", background: `${theme.accent}33` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: theme.accent, fontWeight: "700" }}>Net</span>
                <span style={{ fontSize: "18px", fontWeight: "900", color: net >= 0 ? "#34d399" : "#f87171", letterSpacing: "-0.5px" }}>{net >= 0 ? "+" : ""}{fmtMoney(net)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 12-Month Bar Chart */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📅 12-Month Net P&L <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: "400", letterSpacing: "0", textTransform: "none" }}>· past months real · future projected</span></p>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px", justifyContent: "space-between" }}>
          {monthlyData.map((m, i) => {
            const val = m.net ?? m.projected ?? 0;
            const barH = Math.max(4, (Math.abs(val) / maxBarVal) * 100);
            const color = m.isFuture ? "rgba(96,165,250,0.3)" : val >= 0 ? "#34d399" : "#f87171";
            const borderColor = m.isCurrent ? "#f59e0b" : "transparent";
            return (
              <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%" }}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                  <div title={`${m.label}: ${fmtMoney(val)}`} style={{ width: "100%", height: `${barH}%`, background: color, borderRadius: "4px 4px 0 0", border: `1px solid ${borderColor}`, boxShadow: m.isCurrent ? `0 0 8px rgba(245,158,11,0.4)` : "none", transition: "all 0.3s", cursor: "default", position: "relative" }} />
                </div>
                <span style={{ fontSize: "9px", color: m.isCurrent ? "#f59e0b" : "rgba(255,255,255,0.25)", fontWeight: m.isCurrent ? "800" : "400", whiteSpace: "nowrap" }}>{m.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "16px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#34d399" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Positive month</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(96,165,250,0.3)" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Projected</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#f87171" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Negative month</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "transparent", border: "1px solid #f59e0b" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Current month</span></div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Expense Ratio", sublabel: "expenses ÷ revenue", value: totalAnnualRent > 0 ? `${((totalAnnualExp / totalAnnualRent) * 100).toFixed(1)}%` : "—", color: "#f59e0b" },
          { label: "YoY Expenses", sublabel: `vs ${filterYear - 1}`, value: (() => { const p = prevExpenses.reduce((s: number, e: any) => s + e.amount, 0); return p > 0 ? `${totalAnnualExp >= p ? "+" : ""}${((totalAnnualExp - p) / p * 100).toFixed(1)}%` : "No prior data"; })(), color: (() => { const p = prevExpenses.reduce((s: number, e: any) => s + e.amount, 0); return p > 0 && totalAnnualExp < p ? "#34d399" : "#f87171"; })() },
          { label: "Break-Even Occ.", sublabel: "min occupancy to cover costs", value: totalAnnualRent > 0 ? `${Math.min(100, (totalAnnualExp / totalAnnualRent) * 100).toFixed(0)}%` : "—", color: "#a78bfa" },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px 20px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "2px", fontWeight: "600" }}>{m.label}</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "8px" }}>{m.sublabel}</p>
            <p style={{ fontSize: "22px", fontWeight: "800", color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* P&L per property */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📊 P&L Per Property — {filterYear}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
        {propPnL.map(p => {
          const hc = healthColor(p.margin);
          return (
            <div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${hc}22`, borderRadius: "16px", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: hc, boxShadow: `0 0 6px ${hc}` }} />
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: "800" }}>{p.name}</h4>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>{p.type} · <span style={{ color: hc, fontWeight: "700" }}>{healthLabel(p.margin)}</span>{p.margin !== null ? ` · ${p.margin.toFixed(1)}% margin` : ""}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {/* Cash Reserve */}
                  {p.cashReserveMonths !== null && (
                    <span title="Cash Reserve: estimated months of expenses covered by equity buffer" style={{ fontSize: "10px", color: p.cashReserveMonths >= 6 ? "#34d399" : p.cashReserveMonths >= 3 ? "#f59e0b" : "#f87171", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "3px 10px", borderRadius: "999px", fontWeight: "700" }}>
                      🛡 {p.cashReserveMonths}mo reserve <span style={{ fontWeight: "400", color: "rgba(255,255,255,0.2)" }}>· vacancy buffer</span>
                    </span>
                  )}
                  {p.yoyDelta !== null && (
                    <span style={{ fontSize: "11px", fontWeight: "700", color: p.yoyDelta <= 0 ? "#34d399" : "#f87171", background: p.yoyDelta <= 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", padding: "3px 10px", borderRadius: "999px", border: `1px solid ${p.yoyDelta <= 0 ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                      {p.yoyDelta <= 0 ? "▼" : "▲"} {fmtMoney(Math.abs(p.yoyDelta))} exp vs {filterYear - 1}
                    </span>
                  )}
                  <span style={{ fontSize: "16px", fontWeight: "800", color: p.annualNet >= 0 ? "#34d399" : "#f87171" }}>{p.annualNet >= 0 ? "+" : ""}{fmtMoney(p.annualNet)}/yr</span>
                  <button onClick={() => toggleProp(p.id)} style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontWeight: "600" }}>{expandedProps.has(p.id) ? "▲ Hide" : "▼ Expenses"}</button>
                </div>
              </div>

              {/* Daily / Monthly / Annual per property */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
                {([
                  { theme: PERIOD_THEME.daily,   income: p.annualRent / 365, exp: p.annualExp / 365, net: p.dailyNet },
                  { theme: PERIOD_THEME.monthly, income: p.annualRent / 12,  exp: p.monthlyExp,      net: p.monthlyNet },
                  { theme: PERIOD_THEME.annual,  income: p.annualRent,        exp: p.annualExp,        net: p.annualNet },
                ] as const).map(({ theme, income, exp, net }, idx) => (
                  <div key={theme.label} style={{ padding: "14px 16px", borderRight: idx < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <p style={{ fontSize: "9px", color: theme.accent, letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "800", marginBottom: "8px" }}>{theme.label}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>In</span><span style={{ fontSize: "12px", fontWeight: "700", color: "#34d399" }}>{fmtMoney(income)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>Out</span><span style={{ fontSize: "12px", fontWeight: "700", color: "#f87171" }}>{fmtMoney(exp)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px", paddingTop: "3px", borderTop: `1px solid ${theme.accent}22` }}><span style={{ fontSize: "9px", color: theme.accent, fontWeight: "700" }}>Net</span><span style={{ fontSize: "14px", fontWeight: "800", color: net >= 0 ? "#34d399" : "#f87171" }}>{net >= 0 ? "+" : ""}{fmtMoney(net)}</span></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* NOI per property */}
              <div style={{ padding: "10px 16px", background: "rgba(245,158,11,0.03)", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
                <div><span style={{ fontSize: "9px", color: "rgba(245,158,11,0.6)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>NOI </span><span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>· Net Operating Income (excl. mortgage)</span><span style={{ fontSize: "13px", fontWeight: "800", color: "#f59e0b", marginLeft: "8px" }}>{fmtMoney(p.noi)}/yr</span></div>
                <div style={{ flex: 1, minWidth: "120px" }}>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, p.expenseRatio ?? 0)}%`, background: healthColor(p.margin), borderRadius: "999px" }} />
                  </div>
                  <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "3px" }}>Expense ratio: {p.expenseRatio !== null ? `${p.expenseRatio.toFixed(1)}%` : "—"} · Break-even: {p.annualRent > 0 ? `${Math.min(100, (p.annualExp / p.annualRent) * 100).toFixed(0)}%` : "—"} occupancy</p>
                </div>
              </div>

              {expandedProps.has(p.id) && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px", background: "rgba(0,0,0,0.2)" }}>
                  {p.cur.length === 0
                    ? <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "8px" }}>No expenses logged for {filterYear}.</p>
                    : p.cur.map((e: any) => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 8px", borderRadius: "8px", marginBottom: "4px", background: "rgba(255,255,255,0.02)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: `${CAT_COLORS[e.category] || "rgba(255,255,255,0.1)"}22`, color: CAT_COLORS[e.category] || "rgba(255,255,255,0.5)", fontWeight: "700" }}>{e.category}</span>
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{e.date}</span>
                          {e.note && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>{e.note}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#f87171" }}>{fmtMoneyFull(e.amount)}</span>
                          <button onClick={() => openEditExpense(e)} style={{ fontSize: "10px", padding: "2px 7px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Edit</button>
                          <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "16px" }}>×</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Category Breakdown */}
      {Object.keys(catTotals).length > 0 && <>
        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>🏷️ Expense Breakdown — {filterYear}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "24px" }}>
          {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
            <div key={cat} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${CAT_COLORS[cat] || "rgba(255,255,255,0.08)"}33`, borderRadius: "12px", padding: "14px" }}>
              <p style={{ fontSize: "9px", color: CAT_COLORS[cat] || "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", marginBottom: "6px" }}>{cat}</p>
              <p style={{ fontSize: "16px", fontWeight: "800", color: "#fff" }}>{fmtMoneyFull(total)}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "3px" }}>{totalAnnualExp > 0 ? `${((total / totalAnnualExp) * 100).toFixed(1)}% of total` : ""}</p>
            </div>
          ))}
        </div>
      </>}

      {/* Expense History */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📋 Expense History — {filterYear}</p>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden", marginBottom: "24px" }}>
        {loading ? <p style={{ padding: "24px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Loading...</p> : curExpenses.length === 0
          ? <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No expenses for {filterYear}. Log one above.</div>
          : <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
            <thead><tr style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px", textTransform: "uppercase" }}>
              {["Date", "Property", "Category", "Amount", "Note", ""].map(h => <th key={h} style={{ textAlign: h === "Amount" ? "right" : "left", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {curExpenses.map((e: any) => {
                const prop = properties.find(p => p.id === e.property_id);
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.4)" }}>{e.date}</td>
                    <td style={{ padding: "12px 16px", fontWeight: "600" }}>{prop?.name || "—"}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: `${CAT_COLORS[e.category] || "rgba(255,255,255,0.1)"}22`, color: CAT_COLORS[e.category] || "rgba(255,255,255,0.5)", fontWeight: "700" }}>{e.category}</span></td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#f87171" }}>{fmtMoneyFull(e.amount)}</td>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>{e.note || "—"}</td>
                    <td style={{ padding: "12px 10px" }}><div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button onClick={() => openEditExpense(e)} style={{ fontSize: "10px", padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Edit</button>
                      <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "16px" }}>×</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
      </div>

      {/* Log Expense Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: "100px 20px 20px" }}>
          <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", padding: "36px", width: "100%", maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "800" }}>{editingExpenseId !== null ? "Edit Expense" : "Log Expense"}</h2>
              <button onClick={resetForm} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Property">
                <select value={form.property_id} onChange={e => { setForm({ ...form, property_id: e.target.value }); setExpenseErrors(f => ({ ...f, property_id: false })); }} style={{ ...IS, border: expenseErrors.property_id ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)" }}>
                  <option value="">Select property...</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={IS}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <Field label="Amount ($)">
                  <input type="number" placeholder="1200" value={form.amount} onChange={e => { setForm({ ...form, amount: e.target.value }); setExpenseErrors(f => ({ ...f, amount: false })); }} style={{ ...IS, border: expenseErrors.amount ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)" }} />
                </Field>
                <Field label="Date">
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={IS} />
                </Field>
                <Field label="Year">
                  <select value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} style={IS}>
                    {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Note (optional)">
                <input type="text" placeholder="e.g. Roof repair after storm" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={IS} />
              </Field>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" id="recurring" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} />
                <label htmlFor="recurring" style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Recurring monthly expense</label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button onClick={resetForm} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
              <button onClick={handleAddExpense} style={{ flex: 1, padding: "12px", background: "#f59e0b", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>
                {editingExpenseId !== null ? "Save Changes" : "Log Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}