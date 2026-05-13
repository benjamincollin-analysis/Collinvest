
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('section === "budget"')
end = c.find('section === "activity"', idx)
end = c.rfind('{/*', 0, end) - 1

new = '''section === "budget" && (
                      <div style={{ padding: "24px", background: "linear-gradient(180deg, rgba(10,10,20,0.8) 0%, rgba(5,5,15,0.95) 100%)", minHeight: "100%" }}>
                        {(() => {
                          const plannedTotal = (p.budgetHistory || []).filter((e: any) => e.planned).reduce((s: number, e: any) => s + (e.quoted || 0), 0);
                          const committed = p.spent + plannedTotal;
                          const remaining = Math.max(0, p.budget - committed);
                          const paidPct = p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0;
                          const plannedPct = p.budget > 0 ? Math.min(100 - paidPct, (plannedTotal / p.budget) * 100) : 0;
                          const overBudget = committed > p.budget;
                          const budgetPct = paidPct;
                          return (<>

                          {/* HEADER */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <div>
                              <p style={{ fontSize: "9px", color: "rgba(167,139,250,0.6)", textTransform: "uppercase", letterSpacing: "2.5px", fontWeight: "800", marginBottom: "8px" }}>Total Budget</p>
                              <p style={{ fontSize: "48px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-3px", lineHeight: 1, textShadow: "0 0 40px rgba(167,139,250,0.3)" }}>{fmtMoney(p.budget)}</p>
                              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "8px" }}>across {p.budgetHistory?.length || 0} transactions ? {p.name}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "2.5px", fontWeight: "800", marginBottom: "8px" }}>Committed</p>
                              <p style={{ fontSize: "48px", fontWeight: "900", color: overBudget ? "#f87171" : "#fff", letterSpacing: "-3px", lineHeight: 1 }}>{fmtMoney(committed)}</p>
                              <p style={{ fontSize: "11px", color: overBudget ? "#f87171" : "rgba(255,255,255,0.25)", marginTop: "8px" }}>{overBudget ? "? over budget" : `${p.budget > 0 ? ((committed/p.budget)*100).toFixed(1) : 0}% deployed`}</p>
                            </div>
                          </div>

                          {/* 3 HERO CARDS */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                            {[
                              { label: "Paid", value: fmtMoney(p.spent), sub: `${paidPct.toFixed(1)}% of budget`, color: "#f87171", glow: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.35)" },
                              { label: "Planned", value: fmtMoney(plannedTotal), sub: `${plannedPct.toFixed(1)}% upcoming`, color: "#f59e0b", glow: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.35)" },
                              { label: "Remaining", value: fmtMoney(remaining), sub: overBudget ? "? over budget" : "available to spend", color: remaining > 0 ? "#34d399" : "#f87171", glow: remaining > 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", border: remaining > 0 ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)" },
                            ].map((m: any) => (
                              <div key={m.label} style={{ background: m.glow, border: `1px solid ${m.border}`, borderRadius: "18px", padding: "22px", position: "relative", overflow: "hidden", boxShadow: `0 4px 24px ${m.glow}` }}>
                                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: m.color, boxShadow: `0 0 12px ${m.color}` }} />
                                <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "800", marginBottom: "12px" }}>{m.label}</p>
                                <p style={{ fontSize: "34px", fontWeight: "900", color: m.color, letterSpacing: "-1.5px", lineHeight: 1, textShadow: `0 0 20px ${m.color}55` }}>{m.value}</p>
                                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "10px", fontWeight: "600" }}>{m.sub}</p>
                              </div>
                            ))}
                          </div>

                          {/* FORECAST BAR */}
                          <div style={{ marginBottom: "24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "18px 22px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "2px" }}>Budget Forecast</p>
                              <p style={{ fontSize: "11px", color: overBudget ? "#f87171" : "rgba(255,255,255,0.4)", fontWeight: "700" }}>{fmtMoney(committed)} of {fmtMoney(p.budget)}</p>
                            </div>
                            <div style={{ height: "20px", background: "rgba(255,255,255,0.04)", borderRadius: "999px", overflow: "hidden", display: "flex", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)" }}>
                              <div style={{ width: `${paidPct}%`, background: "linear-gradient(90deg,#f87171,#f43f5e)", transition: "width 1s", boxShadow: "0 0 12px rgba(248,113,113,0.6)", borderRadius: paidPct > 0 ? "999px 0 0 999px" : "0" }} />
                              <div style={{ width: `${plannedPct}%`, background: "linear-gradient(90deg,#f59e0b,#f97316)", transition: "width 1s", boxShadow: "0 0 12px rgba(245,158,11,0.5)", backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.1) 5px,rgba(0,0,0,0.1) 10px)" }} />
                            </div>
                            <div style={{ display: "flex", gap: "20px", marginTop: "12px" }}>
                              {[{ color: "#f87171", label: `Paid ? ${paidPct.toFixed(1)}%` }, { color: "#f59e0b", label: `Planned ? ${plannedPct.toFixed(1)}%` }, { color: "rgba(255,255,255,0.2)", label: `Remaining ? ${Math.max(0,100-paidPct-plannedPct).toFixed(1)}%` }].map(l => (
                                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                  <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
                                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>{l.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* PROJECT INTELLIGENCE */}
                          <ProjectIntelligence project={p} />

                          {/* LOG SPEND */}
                          <LogSpendEntry project={p} onLog={(entry: any) => {
                            const history = [...(p.budgetHistory || []), entry];
                            const newSpent = entry.planned ? p.spent : p.spent + entry.amount;
                            supabase.from("projects").update({ budget_history: history, spent: newSpent }).eq("id", p.id);
                            setProjects(projects.map(pr => pr.id === p.id ? { ...pr, budgetHistory: history, spent: newSpent } : pr));
                          }} team={p.team} trades={p.trades || []} />

                          {/* SPEND HISTORY - always visible */}
                          <div style={{ marginTop: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "2px", fontWeight: "800" }}>Spend History</p>
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontWeight: "600" }}>{(p.budgetHistory || []).length} entries</span>
                            </div>
                            {(!p.budgetHistory || p.budgetHistory.length === 0) ? (
                              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "32px", textAlign: "center" }}>
                                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>No transactions yet</p>
                                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.12)", marginTop: "4px" }}>Log a payment or plan an expense above</p>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {[...(p.budgetHistory || [])].reverse().map((entry: any, ei: number) => (
                                  <div key={ei} style={{ background: entry.planned ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${entry.planned ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: "14px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", boxShadow: entry.planned ? "0 0 16px rgba(245,158,11,0.06)" : "none" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                        {entry.planned && <span style={{ fontSize: "10px", padding: "2px 9px", borderRadius: "999px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: "800", border: "1px solid rgba(245,158,11,0.3)", letterSpacing: "0.5px" }}>PLANNED</span>}
                                        {entry.trade && <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontWeight: "800", border: "1px solid rgba(167,139,250,0.25)" }}>{entry.trade}</span>}
                                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: "600" }}>{entry.date}</span>
                                        {entry.enteredBy && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>by {entry.enteredBy}</span>}
                                        {entry.quoted > 0 && !entry.planned && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>Quoted: <span style={{ color: entry.quoted > entry.amount ? "#34d399" : "#f87171", fontWeight: "700" }}>{fmtMoney(entry.quoted)}</span></span>}
                                      </div>
                                      {entry.note && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>{entry.note}</p>}
                                      {entry.planned && entry.plannedDate && <p style={{ fontSize: "10px", color: "#f59e0b", fontWeight: "700" }}>Due: {entry.plannedDate}</p>}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                                      {entry.planned
                                        ? <span style={{ fontSize: "22px", fontWeight: "900", color: "#f59e0b", textShadow: "0 0 12px rgba(245,158,11,0.4)" }}>~{fmtMoney(entry.quoted || 0)}</span>
                                        : <span style={{ fontSize: "22px", fontWeight: "900", color: "#f87171", textShadow: "0 0 12px rgba(248,113,113,0.4)" }}>-{fmtMoney(entry.amount)}</span>
                                      }
                                      <button onClick={() => {
                                        const original = [...(p.budgetHistory || [])];
                                        original.reverse();
                                        original.splice(ei, 1);
                                        original.reverse();
                                        const newSpent = entry.planned ? p.spent : Math.max(0, p.spent - entry.amount);
                                        supabase.from("projects").update({ budget_history: original, spent: newSpent }).eq("id", p.id);
                                        setProjects(projects.map(pr => pr.id === p.id ? { ...pr, budgetHistory: original, spent: newSpent } : pr));
                                      }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", cursor: "pointer", fontSize: "18px", padding: "4px 8px", borderRadius: "6px", transition: "all 0.15s" }}
                                        onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                                        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.15)"}>x</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          </>);
                        })()}
                      </div>
                    )}'''

c = c[:idx] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE, length:', len(new))
