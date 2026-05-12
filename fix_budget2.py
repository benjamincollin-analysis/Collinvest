
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('Spend History')
start = c.find('{[...(p.budgetHistory', idx)
end = c.find('\n                            </div>\n', start) + len('\n                            </div>\n')
old = c[start:end]
print('Length:', len(old))

new = '''{[...(p.budgetHistory || [])].reverse().map((entry: any, ei: number) => (
                                <div key={ei} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                      {entry.trade && <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontWeight: "800", border: "1px solid rgba(167,139,250,0.25)" }}>{entry.trade}</span>}
                                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{entry.date}</span>
                                      {entry.enteredBy && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: "600" }}>by {entry.enteredBy}</span>}
                                    </div>
                                    {entry.note && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>{entry.note}</p>}
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
                                    }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "18px" }}>x</button>
                                  </div>
                                </div>
                              ))}
                            </div>
'''

c = c[:start] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
