
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# 1. Improve Spend History rows ? bigger, cleaner
old = '''<div key={ei} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", flexWrap: "wrap", gap: "8px" }}>
                                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{entry.date}</span>
                                    {entry.trade && <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontWeight: "700" }}>{entry.trade}</span>}
                                    {entry.enteredBy && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>by {entry.enteredBy}</span>}
                                    {entry.note && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>{entry.note}</span>}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontSize: "14px", fontWeight: "800", color: "#f87171" }}>-{fmtMoney(entry.amount)}</span>
                                    <button onClick={() => {
                                      const original = [...(p.budgetHistory || [])];
                                      original.reverse();
                                      original.splice(ei, 1);
                                      original.reverse();
                                      supabase.from("projects").update({ budget_history: original }).eq("id", p.id);
                                      setProjects(projects.map(pr => pr.id === p.id ? { ...pr, budgetHistory: original } : pr));
                                    }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "16px", padding: "0 4px" }} title="Delete entry">?</button>
                                  </div>
                                </div>'''

new = '''<div key={ei} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                      {entry.trade && <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontWeight: "800", border: "1px solid rgba(167,139,250,0.25)" }}>{entry.trade}</span>}
                                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{entry.date}</span>
                                      {entry.enteredBy && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: "600" }}>by {entry.enteredBy}</span>}
                                    </div>
                                    {entry.note && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>{entry.note}</p>}
                                    {(() => {
                                      const matchedTrade = (p.trades || []).find((t: any) => t.name === entry.trade);
                                      return matchedTrade && matchedTrade.quoted > 0 ? (
                                        <div style={{ display: "flex", gap: "12px", marginTop: "2px" }}>
                                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>Quoted: <span style={{ color: "#f59e0b", fontWeight: "700" }}>{fmtMoney(matchedTrade.quoted)}</span></span>
                                          {matchedTrade.actual > 0 && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>Actual: <span style={{ color: matchedTrade.actual > matchedTrade.quoted ? "#f87171" : "#34d399", fontWeight: "700" }}>{fmtMoney(matchedTrade.actual)}</span></span>}
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                                    <span style={{ fontSize: "20px", fontWeight: "900", color: "#f87171" }}>-{fmtMoney(entry.amount)}</span>
                                    <button onClick={() => {
                                      const original = [...(p.budgetHistory || [])];
                                      original.reverse();
                                      original.splice(ei, 1);
                                      original.reverse();
                                      supabase.from("projects").update({ budget_history: original }).eq("id", p.id);
                                      setProjects(projects.map(pr => pr.id === p.id ? { ...pr, budgetHistory: original } : pr));
                                    }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "18px", padding: "0 4px" }} title="Delete entry">?</button>
                                  </div>
                                </div>'''

print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
