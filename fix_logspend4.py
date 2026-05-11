
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('function LogSpendEntry')
end = c.find('\nfunction ', idx + 100)
old_func = c[idx:end]
print('Length:', len(old_func))

new_func = '''function LogSpendEntry({ project, onLog, team, trades }: { project: any; onLog: (e: any) => void; team: any[]; trades: any[] }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [trade, setTrade] = useState("");
  const [enteredBy, setEnteredBy] = useState("Owner");
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRole, setNewPersonRole] = useState("Contractor");
  const [localTeam, setLocalTeam] = useState<any[]>(team);
  const IS2: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", fontFamily: "inherit", width: "100%" };
  const ALL_CATS = ["Architecture","Engineering","Permits","Demo","Foundation","Framing","Plumbing","Electrical","HVAC","Insulation","Drywall","Flooring","Painting","Roofing","Windows","Finishing","Landscaping","Other"];

  function handleSave() {
    if (!amount) return;
    onLog({ amount: parseFloat(amount), note, trade, enteredBy, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setAmount(""); setNote(""); setTrade(""); setEnteredBy("Owner");
  }

  function handleAddPerson() {
    if (!newPersonName.trim()) return;
    const person = { name: newPersonName.trim(), role: newPersonRole };
    const updated = [...localTeam, person];
    setLocalTeam(updated);
    setEnteredBy(person.name);
    setNewPersonName("");
    setShowAddPerson(false);
  }

  return (
    <div style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: "14px", padding: "16px 20px" }}>
      <p style={{ fontSize: "10px", color: "rgba(248,113,113,0.7)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>?? Log Spend</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Amount ($) *</p>
          <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f87171" }} />
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Category / Trade</p>
          <select value={trade} onChange={e => setTrade(e.target.value)} style={{ ...IS2 }}>
            <option value="">? Select category ?</option>
            {trades.length > 0 && trades.map((t: any, i: number) => <option key={"t"+i} value={t.name}>{t.name}</option>)}
            {ALL_CATS.filter(cat => !trades.find((t: any) => t.name === cat)).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Note</p>
          <input type="text" placeholder="e.g. First payment ? roof work" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={IS2} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Entered By</p>
            <button onClick={() => setShowAddPerson(!showAddPerson)} style={{ fontSize: "9px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}>+ Quick add</button>
          </div>
          {showAddPerson && (
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
              <input type="text" placeholder="Name" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} style={{ ...IS2, flex: 2 }} />
              <input type="text" placeholder="Role" value={newPersonRole} onChange={e => setNewPersonRole(e.target.value)} style={{ ...IS2, flex: 1 }} />
              <button onClick={handleAddPerson} style={{ padding: "0 12px", background: "#a78bfa", color: "#000", borderRadius: "8px", fontWeight: "800", fontSize: "12px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
            </div>
          )}
          <select value={enteredBy} onChange={e => setEnteredBy(e.target.value)} style={{ ...IS2 }}>
            <option value="Owner">Owner (you)</option>
            {localTeam.map((m: any, i: number) => <option key={i} value={m.name}>{m.name} ? {m.role}</option>)}
          </select>
        </div>
      </div>
      <button onClick={handleSave} disabled={!amount} style={{ width: "100%", padding: "12px", background: amount ? "#f87171" : "rgba(248,113,113,0.2)", color: amount ? "#000" : "rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "800", fontSize: "14px", border: "none", cursor: amount ? "pointer" : "not-allowed" }}>Save Spend Entry</button>
    </div>
  );
}

'''

c = c[:idx] + new_func + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
