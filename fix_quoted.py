
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Add quoted state
old = '  const [amount, setAmount] = useState("");'
new = '  const [amount, setAmount] = useState("");\n  const [quoted, setQuoted] = useState("");'
print('State found:', old in c)
c = c.replace(old, new)

# Reset quoted on save
old2 = 'setAmount(""); setNote(""); setTrade(""); setEnteredBy("Owner");'
new2 = 'setAmount(""); setQuoted(""); setNote(""); setTrade(""); setEnteredBy("Owner");'
print('Reset found:', old2 in c)
c = c.replace(old2, new2)

# Add quoted to onLog
old3 = 'onLog({ amount: parseFloat(amount), note, trade, enteredBy, date'
new3 = 'onLog({ amount: parseFloat(amount), quoted: parseFloat(quoted) || 0, note, trade, enteredBy, date'
print('onLog found:', old3 in c)
c = c.replace(old3, new3)

# Add quoted input field next to amount
old4 = '''<p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Amount ($) *</p>
          <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f87171" }} />'''
new4 = '''<div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Amount Paid ($) *</p>
              <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f87171" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Quoted ($) <span style={{ color: "rgba(255,255,255,0.2)" }}>optional</span></p>
              <input type="number" placeholder="e.g. 12000" value={quoted} onChange={e => setQuoted(e.target.value)} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f59e0b" }} />
            </div>
          </div>'''
print('Input found:', old4 in c)
c = c.replace(old4, new4)

# Show quoted in spend history
old5 = '{entry.enteredBy && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: "600" }}>by {entry.enteredBy}</span>}'
new5 = '''{entry.enteredBy && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: "600" }}>by {entry.enteredBy}</span>}
                                      {entry.quoted > 0 && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>Quoted: <span style={{ color: entry.quoted > entry.amount ? "#34d399" : entry.quoted < entry.amount ? "#f87171" : "#f59e0b", fontWeight: "700" }}>{fmtMoney(entry.quoted)}</span></span>}'''
print('History found:', old5 in c)
c = c.replace(old5, new5)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
