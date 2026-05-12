
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Add mode state to LogSpendEntry
old = '  const [amount, setAmount] = useState("");\n  const [quoted, setQuoted] = useState("");'
new = '  const [amount, setAmount] = useState("");\n  const [quoted, setQuoted] = useState("");\n  const [mode, setMode] = useState<"paid"|"planned">("paid");\n  const [plannedDate, setPlannedDate] = useState("");'
print('State found:', old in c)
c = c.replace(old, new)

# Add mode reset
old2 = 'setAmount(""); setQuoted(""); setNote(""); setTrade(""); setEnteredBy("Owner");'
new2 = 'setAmount(""); setQuoted(""); setNote(""); setTrade(""); setEnteredBy("Owner"); setPlannedDate("");'
print('Reset found:', old2 in c)
c = c.replace(old2, new2)

# Add planned to onLog
old3 = 'onLog({ amount: parseFloat(amount), quoted: parseFloat(quoted) || 0, note, trade, enteredBy, date'
new3 = 'onLog({ amount: mode === "planned" ? 0 : parseFloat(amount), quoted: parseFloat(quoted) || parseFloat(amount) || 0, note, trade, enteredBy, planned: mode === "planned", plannedDate: mode === "planned" ? plannedDate : "", date'
print('onLog found:', old3 in c)
c = c.replace(old3, new3)

# Add mode toggle before the form fields
old4 = '<p style={{ fontSize: "10px", color: "rgba(248,113,113,0.7)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>?? Log Spend</p>'
new4 = '''<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <p style={{ fontSize: "10px", color: mode === "paid" ? "rgba(248,113,113,0.7)" : "rgba(245,158,11,0.7)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700" }}>{mode === "paid" ? "?? Log Spend" : "?? Plan Expense"}</p>
        <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "3px" }}>
          <button onClick={() => setMode("paid")} style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", border: "none", cursor: "pointer", background: mode === "paid" ? "#f87171" : "transparent", color: mode === "paid" ? "#000" : "rgba(255,255,255,0.4)" }}>Paid</button>
          <button onClick={() => setMode("planned")} style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", border: "none", cursor: "pointer", background: mode === "planned" ? "#f59e0b" : "transparent", color: mode === "planned" ? "#000" : "rgba(255,255,255,0.4)" }}>Planned</button>
        </div>
      </div>'''
print('Header found:', old4 in c)
c = c.replace(old4, new4)

# Change Amount label based on mode + add planned date
old5 = '''<p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Amount Paid ($) *</p>
              <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f87171" }} />'''
new5 = '''<p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{mode === "paid" ? "Amount Paid ($) *" : "Expected Amount ($)"}</p>
              <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: mode === "paid" ? "#f87171" : "#f59e0b" }} />'''
print('Amount label found:', old5 in c)
c = c.replace(old5, new5)

# Add planned date field after quoted
old6 = '''<p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Quoted ($) <span style={{ color: "rgba(255,255,255,0.2)" }}>optional</span></p>
              <input type="number" placeholder="e.g. 12000" value={quoted} onChange={e => setQuoted(e.target.value)} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f59e0b" }} />'''
new6 = '''<p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{mode === "paid" ? "Quoted ($)" : "Expected Date"} <span style={{ color: "rgba(255,255,255,0.2)" }}>optional</span></p>
              {mode === "paid" ? <input type="number" placeholder="e.g. 12000" value={quoted} onChange={e => setQuoted(e.target.value)} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f59e0b" }} /> : <input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} style={{ ...IS2, fontSize: "14px", fontWeight: "700", color: "#f59e0b" }} />}'''
print('Quoted field found:', old6 in c)
c = c.replace(old6, new6)

# Fix save button label
old7 = '>Save Spend Entry</button>'
new7 = '>{mode === "paid" ? "Save Spend Entry" : "Save Planned Expense"}</button>'
print('Button found:', old7 in c)
c = c.replace(old7, new7)

# Show planned badge in history
old8 = '{entry.trade && <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontWeight: "800", border: "1px solid rgba(167,139,250,0.25)" }}>{entry.trade}</span>}'
new8 = '''{entry.planned && <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: "800", border: "1px solid rgba(245,158,11,0.3)" }}>PLANNED</span>}
                                      {entry.trade && <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontWeight: "800", border: "1px solid rgba(167,139,250,0.25)" }}>{entry.trade}</span>}'''
print('History badge found:', old8 in c)
c = c.replace(old8, new8)

# Show planned amount differently in history
old9 = '<span style={{ fontSize: "20px", fontWeight: "900", color: "#f87171" }}>-{fmtMoney(entry.amount)}</span>'
new9 = '''<div style={{ textAlign: "right" }}>
                                    {entry.planned ? <span style={{ fontSize: "16px", fontWeight: "900", color: "#f59e0b" }}>~{fmtMoney(entry.quoted || 0)}</span> : <span style={{ fontSize: "20px", fontWeight: "900", color: "#f87171" }}>-{fmtMoney(entry.amount)}</span>}
                                    {entry.planned && entry.plannedDate && <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>Due {entry.plannedDate}</p>}
                                  </div>'''
print('Amount display found:', old9 in c)
c = c.replace(old9, new9)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('ALL DONE')
