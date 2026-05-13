
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('function LogSpendEntry')
end = c.find('\nfunction ', idx + 100)

new = '''function LogSpendEntry({ project, onLog, team, trades }: { project: any; onLog: (e: any) => void; team: any[]; trades: any[] }) {
  const [paidAmt, setPaidAmt] = useState("");
  const [paidTrade, setPaidTrade] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [paidBy, setPaidBy] = useState("Owner");
  const [paidQuoted, setPaidQuoted] = useState("");
  const [planAmt, setPlanAmt] = useState("");
  const [planTrade, setPlanTrade] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Contractor");
  const [localTeam, setLocalTeam] = useState<any[]>(team);
  const IS: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", color: "#fff", outline: "none", fontFamily: "inherit", width: "100%" };
  const ALL_CATS = ["Architecture","Engineering","Permits","Demo","Foundation","Framing","Plumbing","Electrical","HVAC","Insulation","Drywall","Flooring","Painting","Roofing","Windows","Finishing","Landscaping","Other"];
  const lbl = (t: string) => <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>{t}</p>;

  function addPerson() {
    if (!newName.trim()) return;
    const p = { name: newName.trim(), role: newRole };
    setLocalTeam(t => [...t, p]);
    setPaidBy(p.name);
    setNewName("");
    setShowAddPerson(false);
  }

  function savePaid() {
    if (!paidAmt) return;
    onLog({ amount: parseFloat(paidAmt), quoted: parseFloat(paidQuoted) || 0, note: paidNote, trade: paidTrade, enteredBy: paidBy, planned: false, plannedDate: "", date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setPaidAmt(""); setPaidQuoted(""); setPaidNote(""); setPaidTrade(""); setPaidBy("Owner");
  }

  function savePlan() {
    if (!planAmt) return;
    onLog({ amount: 0, quoted: parseFloat(planAmt), note: planNote, trade: planTrade, enteredBy: "Owner", planned: true, plannedDate: planDate, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setPlanAmt(""); setPlanNote(""); setPlanTrade(""); setPlanDate("");
  }

  const catSelect = (val: string, set: (v: string) => void) => (
    <select value={val} onChange={e => set(e.target.value)} style={{ ...IS }}>
      <option value="">? Category ?</option>
      {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden", marginBottom: "24px" }}>

      {/* LOG PAYMENT */}
      <div style={{ padding: "16px 20px" }}>
        <p style={{ fontSize: "9px", color: "rgba(248,113,113,0.7)", letterSpacing: "1.8px", textTransform: "uppercase", fontWeight: "800", marginBottom: "12px" }}>?? Log Payment</p>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.5fr 1.2fr auto", gap: "8px", alignItems: "end" }}>
          <div>{lbl("Amount Paid *")}<input type="number" placeholder="15,000" value={paidAmt} onChange={e => setPaidAmt(e.target.value)} onKeyDown={e => e.key === "Enter" && savePaid()} style={{ ...IS, fontWeight: "800", color: "#f87171" }} /></div>
          <div>{lbl("Quoted opt.")}<input type="number" placeholder="12,000" value={paidQuoted} onChange={e => setPaidQuoted(e.target.value)} style={{ ...IS, color: "#f59e0b" }} /></div>
          <div>{lbl("Note opt.")}<input type="text" placeholder="First payment - roof" value={paidNote} onChange={e => setPaidNote(e.target.value)} style={IS} /></div>
          <div>{lbl("Category")}{catSelect(paidTrade, setPaidTrade)}</div>
          <button onClick={savePaid} disabled={!paidAmt} style={{ padding: "9px 18px", background: paidAmt ? "#f87171" : "rgba(248,113,113,0.15)", color: paidAmt ? "#000" : "rgba(255,255,255,0.25)", borderRadius: "8px", fontWeight: "800", fontSize: "12px", border: "none", cursor: paidAmt ? "pointer" : "not-allowed", whiteSpace: "nowrap" as const }}>Save</button>
        </div>
        <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            {lbl("Entered By")}
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)} style={{ ...IS }}>
              <option value="Owner">Owner (you)</option>
              {localTeam.map((m: any, i: number) => <option key={i} value={m.name}>{m.name} ? {m.role}</option>)}
            </select>
          </div>
          <button onClick={() => setShowAddPerson(!showAddPerson)} style={{ fontSize: "10px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: "700", marginTop: "12px" }}>+ Quick add</button>
        </div>
        {showAddPerson && (
          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
            <input type="text" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} style={{ ...IS, flex: 2 }} />
            <input type="text" placeholder="Role" value={newRole} onChange={e => setNewRole(e.target.value)} style={{ ...IS, flex: 1 }} />
            <button onClick={addPerson} style={{ padding: "0 12px", background: "#a78bfa", color: "#000", borderRadius: "8px", fontWeight: "800", fontSize: "12px", border: "none", cursor: "pointer" }}>Add</button>
          </div>
        )}
      </div>

      {/* DIVIDER */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "0 20px" }} />

      {/* PLAN EXPENSE */}
      <div style={{ padding: "16px 20px" }}>
        <p style={{ fontSize: "9px", color: "rgba(245,158,11,0.7)", letterSpacing: "1.8px", textTransform: "uppercase", fontWeight: "800", marginBottom: "12px" }}>?? Plan Expense</p>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.5fr 1.2fr auto", gap: "8px", alignItems: "end" }}>
          <div>{lbl("Expected Amount *")}<input type="number" placeholder="25,000" value={planAmt} onChange={e => setPlanAmt(e.target.value)} onKeyDown={e => e.key === "Enter" && savePlan()} style={{ ...IS, fontWeight: "800", color: "#f59e0b" }} /></div>
          <div>{lbl("Due Date opt.")}<input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} style={{ ...IS, color: "#f59e0b" }} /></div>
          <div>{lbl("Note opt.")}<input type="text" placeholder="Roofing quote from ABC Co." value={planNote} onChange={e => setPlanNote(e.target.value)} style={IS} /></div>
          <div>{lbl("Category")}{catSelect(planTrade, setPlanTrade)}</div>
          <button onClick={savePlan} disabled={!planAmt} style={{ padding: "9px 18px", background: planAmt ? "#f59e0b" : "rgba(245,158,11,0.15)", color: planAmt ? "#000" : "rgba(255,255,255,0.25)", borderRadius: "8px", fontWeight: "800", fontSize: "12px", border: "none", cursor: planAmt ? "pointer" : "not-allowed", whiteSpace: "nowrap" as const }}>Save</button>
        </div>
      </div>

    </div>
  );
}

'''

c = c[:idx] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
