
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('function LogSpendEntry')
end = c.find('\nfunction ', idx + 100)
old = c[idx:end]

new = '''function LogSpendEntry({ project, onLog, team, trades }: { project: any; onLog: (e: any) => void; team: any[]; trades: any[] }) {
  const [paidAmount, setPaidAmount] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [paidTrade, setPaidTrade] = useState("");
  const [paidBy, setPaidBy] = useState("Owner");
  const [paidQuoted, setPaidQuoted] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planTrade, setPlanTrade] = useState("");
  const [planBy, setPlanBy] = useState("Owner");
  const [planDate, setPlanDate] = useState("");
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRole, setNewPersonRole] = useState("Contractor");
  const [localTeam, setLocalTeam] = useState<any[]>(team);
  const IS2: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", fontFamily: "inherit", width: "100%" };
  const ALL_CATS = ["Architecture","Engineering","Permits","Demo","Foundation","Framing","Plumbing","Electrical","HVAC","Insulation","Drywall","Flooring","Painting","Roofing","Windows","Finishing","Landscaping","Other"];

  function handleAddPerson() {
    if (!newPersonName.trim()) return;
    const person = { name: newPersonName.trim(), role: newPersonRole };
    setLocalTeam(t => [...t, person]);
    setPaidBy(person.name);
    setPlanBy(person.name);
    setNewPersonName("");
    setShowAddPerson(false);
  }

  function savePaid() {
    if (!paidAmount) return;
    onLog({ amount: parseFloat(paidAmount), quoted: parseFloat(paidQuoted) || 0, note: paidNote, trade: paidTrade, enteredBy: paidBy, planned: false, plannedDate: "", date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setPaidAmount(""); setPaidNote(""); setPaidTrade(""); setPaidBy("Owner"); setPaidQuoted("");
  }

  function savePlan() {
    if (!planAmount) return;
    onLog({ amount: 0, quoted: parseFloat(planAmount), note: planNote, trade: planTrade, enteredBy: planBy, planned: true, plannedDate: planDate, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setPlanAmount(""); setPlanNote(""); setPlanTrade(""); setPlanBy("Owner"); setPlanDate("");
  }

  const personSelect = (val: string, setter: (v: string) => void) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
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
      <select value={val} onChange={e => setter(e.target.value)} style={{ ...IS2 }}>
        <option value="Owner">Owner (you)</option>
        {localTeam.map((m: any, i: number) => <option key={i} value={m.name}>{m.name} ? {m.role}</option>)}
      </select>
    </div>
  );

  const catSelect = (val: string, setter: (v: string) => void) => (
    <div>
      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Category</p>
      <select value={val} onChange={e => setter(e.target.value)} style={{ ...IS2 }}>
        <option value="">? Select ?</option>
        {ALL_CATS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
      {/* PAID */}
      <div style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: "16px", padding: "18px" }}>
        <p style={{ fontSize: "10px", color: "rgba(248,113,113,0.8)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "800", marginBottom: "14px" }}>?? Log Payment</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Amount Paid *</p>
              <input type="number" placeholder="e.g. 15000" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && savePaid()} style={{ ...IS2, fontSize: "15px", fontWeight: "800", color: "#f87171" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Quoted <span style={{ opacity: 0.5 }}>opt.</span></p>
              <input type="number" placeholder="e.g. 12000" value={paidQuoted} onChange={e => setPaidQuoted(e.target.value)} style={{ ...IS2, fontSize: "15px", fontWeight: "800", color: "#f59e0b" }} />
            </div>
          </div>
          {catSelect(paidTrade, setPaidTrade)}
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Note <span style={{ opacity: 0.5 }}>opt.</span></p>
            <input type="text" placeholder="e.g. First payment - roof work" value={paidNote} onChange={e => setPaidNote(e.target.value)} onKeyDown={e => e.key === "Enter" && savePaid()} style={IS2} />
          </div>
          {personSelect(paidBy, setPaidBy)}
          <button onClick={savePaid} disabled={!paidAmount} style={{ width: "100%", padding: "11px", background: paidAmount ? "#f87171" : "rgba(248,113,113,0.15)", color: paidAmount ? "#000" : "rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "800", fontSize: "13px", border: "none", cursor: paidAmount ? "pointer" : "not-allowed" }}>Save Payment</button>
        </div>
      </div>

      {/* PLANNED */}
      <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "16px", padding: "18px" }}>
        <p style={{ fontSize: "10px", color: "rgba(245,158,11,0.8)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "800", marginBottom: "14px" }}>?? Plan Expense</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Expected Amount *</p>
              <input type="number" placeholder="e.g. 25000" value={planAmount} onChange={e => setPlanAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && savePlan()} style={{ ...IS2, fontSize: "15px", fontWeight: "800", color: "#f59e0b" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Expected Date <span style={{ opacity: 0.5 }}>opt.</span></p>
              <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} style={{ ...IS2, fontSize: "13px", fontWeight: "700", color: "#f59e0b" }} />
            </div>
          </div>
          {catSelect(planTrade, setPlanTrade)}
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Note <span style={{ opacity: 0.5 }}>opt.</span></p>
            <input type="text" placeholder="e.g. Roofing quote from ABC Co." value={planNote} onChange={e => setPlanNote(e.target.value)} onKeyDown={e => e.key === "Enter" && savePlan()} style={IS2} />
          </div>
          {personSelect(planBy, setPlanBy)}
          <button onClick={savePlan} disabled={!planAmount} style={{ width: "100%", padding: "11px", background: planAmount ? "#f59e0b" : "rgba(245,158,11,0.15)", color: planAmount ? "#000" : "rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "800", fontSize: "13px", border: "none", cursor: planAmount ? "pointer" : "not-allowed" }}>Save Planned Expense</button>
        </div>
      </div>
    </div>
  );
}

'''

c = c[:idx] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
