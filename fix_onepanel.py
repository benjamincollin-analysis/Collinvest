
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('function LogSpendEntry')
end = c.find('\nfunction ', idx + 100)
old = c[idx:end]

new = '''function LogSpendEntry({ project, onLog, team, trades }: { project: any; onLog: (e: any) => void; team: any[]; trades: any[] }) {
  const [amount, setAmount] = useState("");
  const [quoted, setQuoted] = useState("");
  const [note, setNote] = useState("");
  const [trade, setTrade] = useState("");
  const [enteredBy, setEnteredBy] = useState("Owner");
  const [plannedDate, setPlannedDate] = useState("");
  const [mode, setMode] = useState<"paid"|"planned">("paid");
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRole, setNewPersonRole] = useState("Contractor");
  const [localTeam, setLocalTeam] = useState<any[]>(team);
  const IS2: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", fontFamily: "inherit", width: "100%" };
  const ALL_CATS = ["Architecture","Engineering","Permits","Demo","Foundation","Framing","Plumbing","Electrical","HVAC","Insulation","Drywall","Flooring","Painting","Roofing","Windows","Finishing","Landscaping","Other"];
  const accent = mode === "paid" ? "#f87171" : "#f59e0b";
  const accentBg = mode === "paid" ? "rgba(248,113,113,0.04)" : "rgba(245,158,11,0.04)";
  const accentBorder = mode === "paid" ? "rgba(248,113,113,0.15)" : "rgba(245,158,11,0.15)";

  function handleSave() {
    if (!amount) return;
    onLog({ amount: mode === "paid" ? parseFloat(amount) : 0, quoted: mode === "paid" ? (parseFloat(quoted) || 0) : parseFloat(amount), note, trade, enteredBy, planned: mode === "planned", plannedDate: mode === "planned" ? plannedDate : "", date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setAmount(""); setQuoted(""); setNote(""); setTrade(""); setEnteredBy("Owner"); setPlannedDate("");
  }

  function handleAddPerson() {
    if (!newPersonName.trim()) return;
    const person = { name: newPersonName.trim(), role: newPersonRole };
    setLocalTeam(t => [...t, person]);
    setEnteredBy(person.name);
    setNewPersonName("");
    setShowAddPerson(false);
  }

  return (
    <div style={{ background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: "16px", padding: "18px 20px", marginBottom: "24px", transition: "all 0.2s" }}>
      {/* Header with toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <p style={{ fontSize: "10px", color: accent, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "800" }}>{mode === "paid" ? "?? Log Payment" : "?? Plan Expense"}</p>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
          <button onClick={() => setMode("paid")} style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", border: "none", cursor: "pointer", background: mode === "paid" ? "#f87171" : "transparent", color: mode === "paid" ? "#000" : "rgba(255,255,255,0.35)", transition: "all 0.15s" }}>Paid</button>
          <button onClick={() => setMode("planned")} style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", border: "none", cursor: "pointer", background: mode === "planned" ? "#f59e0b" : "transparent", color: mode === "planned" ? "#000" : "rgba(255,255,255,0.35)", transition: "all 0.15s" }}>Planned</button>
        </div>
      </div>

      {/* Row 1: Amount + Quoted/Date + Category */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{mode === "paid" ? "Amount Paid ($) *" : "Expected Amount ($) *"}</p>
          <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "15px", fontWeight: "800", color: accent }} />
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{mode === "paid" ? "Quoted ($) opt." : "Expected Date opt."}</p>
          {mode === "paid"
            ? <input type="number" placeholder="e.g. 12000" value={quoted} onChange={e => setQuoted(e.target.value)} style={{ ...IS2, fontSize: "15px", fontWeight: "800", color: "#f59e0b" }} />
            : <input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} style={{ ...IS2, fontSize: "13px", color: "#f59e0b" }} />
          }
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Category opt.</p>
          <select value={trade} onChange={e => setTrade(e.target.value)} style={{ ...IS2 }}>
            <option value="">? Select ?</option>
            {ALL_CATS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Note + Entered By */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Note opt.</p>
          <input type="text" placeholder="e.g. First payment - roof work" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={IS2} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Entered By</p>
            <button onClick={() => setShowAddPerson(!showAddPerson)} style={{ fontSize: "9px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}>+ Quick add</button>
          </div>
          {showAddPerson && (
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
              <input type="text" placeholder="Name" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} style={{ ...IS2, flex: 2 }} />
              <input type="text" placeholder="Role" value={newPersonRole} onChange={e => setNewPersonRole(e.target.value)} style={{ ...IS2, flex: 1 }} />
              <button onClick={handleAddPerson} style={{ padding: "0 10px", background: "#a78bfa", color: "#000", borderRadius: "8px", fontWeight: "800", fontSize: "11px", border: "none", cursor: "pointer" }}>Add</button>
            </div>
          )}
          <select value={enteredBy} onChange={e => setEnteredBy(e.target.value)} style={{ ...IS2 }}>
            <option value="Owner">Owner (you)</option>
            {localTeam.map((m: any, i: number) => <option key={i} value={m.name}>{m.name} ? {m.role}</option>)}
          </select>
        </div>
      </div>

      <button onClick={handleSave} disabled={!amount} style={{ width: "100%", padding: "12px", background: amount ? accent : "rgba(255,255,255,0.05)", color: amount ? "#000" : "rgba(255,255,255,0.25)", borderRadius: "10px", fontWeight: "800", fontSize: "13px", border: "none", cursor: amount ? "pointer" : "not-allowed", transition: "all 0.2s" }}>{mode === "paid" ? "Save Payment" : "Save Planned Expense"}</button>
    </div>
  );
}

'''

c = c[:idx] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
