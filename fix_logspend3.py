
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = '''<p style={{ fontSize: "10px", color: "rgba(248,113,113,0.7)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>?? Log Spend</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Amount ($) *</p>
          <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f87171" }} />
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Trade</p>
          <select value={trade} onChange={e => setTrade(e.target.value)} style={{ ...IS2 }}>
            <option value="">? Select trade ?</option>
            {trades.map((t: any, i: number) => <option key={i} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Note</p>
          <input type="text" placeholder="e.g. First payment ? roof work" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={IS2} />
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Entered By</p>
          <select value={enteredBy} onChange={e => setEnteredBy(e.target.value)} style={{ ...IS2 }}>
            <option value="Owner">Owner (you)</option>
            <option value="Owner">Owner</option>
            {team.map((m: any, i: number) => <option key={i} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <button onClick={handleSave} disabled={!amount || !enteredBy} style={{ width: "100%", padding: "12px", background: (amount && enteredBy) ? "#f87171" : "rgba(248,113,113,0.2)", color: amount ? "#000" : "rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "800", fontSize: "14px", border: "none", cursor: amount ? "pointer" : "not-allowed" }}>Save Spend Entr'''

new = '''<p style={{ fontSize: "10px", color: "rgba(248,113,113,0.7)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>?? Log Spend</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Amount ($) *</p>
          <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f87171" }} />
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Category / Trade</p>
          <select value={trade} onChange={e => setTrade(e.target.value)} style={{ ...IS2 }}>
            <option value="">? Select category ?</option>
            {trades.length > 0 && trades.map((t: any, i: number) => <option key={i} value={t.name}>{t.name}</option>)}
            {["Architecture","Engineering","Permits","Demo","Foundation","Framing","Plumbing","Electrical","HVAC","Insulation","Drywall","Flooring","Painting","Roofing","Windows","Finishing","Landscaping","Other"].map(cat => (
              !trades.find((t: any) => t.name === cat) && <option key={cat} value={cat}>{cat}</option>
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
            <button onClick={() => setShowAddPerson(!showAddPerson)} style={{ fontSize: "9px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}>+ Add person</button>
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
      <button onClick={handleSave} disabled={!amount} style={{ width: "100%", padding: "12px", background: amount ? "#f87171" : "rgba(248,113,113,0.2)", color: amount ? "#000" : "rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "800", fontSize: "14px", border: "none", cursor: amount ? "pointer" : "not-allowed" }}>Save Spend Entr'''

print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
