
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('section === "budget"')
end = c.find('section === "activity"', idx)
end = c.rfind('{/*', 0, end) - 1
old = c[idx:end]
print('Length:', len(old))

new = '''section === "budget" && (
                      <div style={{ padding: "24px" }}>

                        {/* FORECAST BAR */}
                        {(() => {
                          const plannedTotal = (p.budgetHistory || []).filter((e: any) => e.planned).reduce((s: number, e: any) => s + (e.quoted || 0), 0);
                          const committed = p.spent + plannedTotal;
                          const remaining = Math.max(0, p.budget - committed);
                          const paidPct = p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0;
                          const plannedPct = p.budget > 0 ? Math.min(100 - paidPct, (plannedTotal / p.budget) * 100) : 0;
                          const overBudget = committed > p.budget;
                          return (
                            <div style={{ marginBottom: "24px" }}>
                              {/* 3 hero numbers */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                                {[
                                  { label: "Paid", value: fmtMoney(p.spent), sub: `${paidPct.toFixed(1)}% of budget`, color: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.15)" },
                                  { label: "Planned", value: fmtMoney(plannedTotal), sub: `${plannedPct.toFixed(1)}% upcoming`, color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)" },
                                  { label: "Remaining", value: fmtMoney(remaining), sub: overBudget ? "? over budget" : "available to spend", color: remaining > 0 ? "#34d399" : "#f87171", bg: remaining > 0 ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)", border: remaining > 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)" },
                                ].map(m => (
                                  <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: "16px", padding: "18px 20px" }}>
                                    <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "700", marginBottom: "8px" }}>{m.label}</p>
                                    <p style={{ fontSize: "26px", fontWeight: "900", color: m.color, letterSpacing: "-1px", lineHeight: 1 }}>{m.value}</p>
                                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "6px" }}>{m.sub}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Stacked forecast bar */}
                              <div style={{ marginBottom: "8px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>Budget Forecast</span>
                                  <span style={{ fontSize: "10px", color: overBudget ? "#f87171" : "rgba(255,255,255,0.4)", fontWeight: "700" }}>{fmtMoney(committed)} committed of {fmtMoney(p.budget)}</span>
                                </div>
                                <div style={{ height: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                                  <div style={{ width: `${paidPct}%`, background: "#f87171", borderRadius: "999px 0 0 999px", transition: "width 0.8s", boxShadow: "0 0 8px rgba(248,113,113,0.4)" }} />
                                  <div style={{ width: `${plannedPct}%`, background: "#f59e0b", transition: "width 0.8s", boxShadow: "0 0 8px rgba(245,158,11,0.3)", backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)" }} />
                                </div>
                                <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                                  {[{ color: "#f87171", label: "Paid" }, { color: "#f59e0b", label: "Planned" }, { color: "rgba(255,255,255,0.15)", label: "Remaining" }].map(l => (
                                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                      <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: l.color }} />
                                      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>{l.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* LOG SPEND */}
                        <ProjectIntelligence project={p} />
                        <LogSpendEntry project={p} onLog={(entry: any) => {
                          const history = [...(p.budgetHistory || []), entry];
                          const newSpent = entry.planned ? p.spent : p.spent + entry.amount;
                          supabase.from("projects").update({ budget_history: history, spent: newSpent }).eq("id", p.id);
                          setProjects(projects.map(pr => pr.id === p.id ? { ...pr, budgetHistory: history, spent: newSpent } : pr));
                        }} team={p.team} trades={p.trades || []} />

                        {/* SPEND HISTORY */}
                        {p.budgetHistory && p.budgetHistory.length > 0 && (
                          <div style={{ marginTop: "24px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Spend History</p>
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{p.budgetHistory.length} entries</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {[...(p.budgetHistory || [])].reverse().map((entry: any, ei: number) => (
                                <div key={ei} style={{ background: entry.planned ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.03)", border: `1px solid ${entry.planned ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.07)"}`, borderRadius: "14px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                      {entry.planned && <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: "800", border: "1px solid rgba(245,158,11,0.3)" }}>PLANNED</span>}
                                      {entry.trade && <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontWeight: "800", border: "1px solid rgba(167,139,250,0.25)" }}>{entry.trade}</span>}
                                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{entry.date}</span>
                                      {entry.enteredBy && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: "600" }}>by {entry.enteredBy}</span>}
                                      {entry.quoted > 0 && !entry.planned && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>Quoted: <span style={{ color: entry.quoted > entry.amount ? "#34d399" : "#f87171", fontWeight: "700" }}>{fmtMoney(entry.quoted)}</span></span>}
                                    </div>
                                    {entry.note && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>{entry.note}</p>}
                                    {entry.planned && entry.plannedDate && <p style={{ fontSize: "10px", color: "rgba(245,158,11,0.6)", fontWeight: "600" }}>Due: {entry.plannedDate}</p>}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                                    <div style={{ textAlign: "right" }}>
                                      {entry.planned
                                        ? <span style={{ fontSize: "18px", fontWeight: "900", color: "#f59e0b" }}>~{fmtMoney(entry.quoted || 0)}</span>
                                        : <span style={{ fontSize: "20px", fontWeight: "900", color: "#f87171" }}>-{fmtMoney(entry.amount)}</span>
                                      }
                                    </div>
                                    <button onClick={() => {
                                      const original = [...(p.budgetHistory || [])];
                                      original.reverse();
                                      original.splice(ei, 1);
                                      original.reverse();
                                      const newSpent = entry.planned ? p.spent : p.spent - entry.amount;
                                      supabase.from("projects").update({ budget_history: original, spent: Math.max(0, newSpent) }).eq("id", p.id);
                                      setProjects(projects.map(pr => pr.id === p.id ? { ...pr, budgetHistory: original, spent: Math.max(0, newSpent) } : pr));
                                    }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "18px" }}>x</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )'''

c = c[:idx] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE', 'Length written:', len(new))
