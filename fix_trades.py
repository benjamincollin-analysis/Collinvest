
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# 1. Add email to quick add person in LogSpendEntry
old = '''              <input type="text" placeholder="Name" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} style={{ ...IS2, flex: 2 }} />
              <input type="text" placeholder="Role" value={newPersonRole} onChange={e => setNewPersonRole(e.target.value)} style={{ ...IS2, flex: 1 }} />
              <button onClick={handleAddPerson} style={{ padding: "0 12px", background: "#a78bfa", color: "#000", borderRadius: "8px", fontWeight: "800", fontSize: "12px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>'''
new = '''              <input type="text" placeholder="Name" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} style={{ ...IS2, flex: 2 }} />
              <input type="text" placeholder="Role e.g. Architect" value={newPersonRole} onChange={e => setNewPersonRole(e.target.value)} style={{ ...IS2, flex: 1 }} />
              <button onClick={handleAddPerson} style={{ padding: "0 12px", background: "#a78bfa", color: "#000", borderRadius: "8px", fontWeight: "800", fontSize: "12px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>'''
print('Quick add found:', old in c)
c = c.replace(old, new)

# 2. Remove Trade Breakdown section header + grid
old2 = '''<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", marginTop: "24px" }}>
                          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Trade Breakdown <span style={{ color: "rgba(255,255,255,0.2)", textTransform: "none", letterSpacing: "0", fontWeight: "400" }}>? quoted vs actual ? press Enter to save</span></p>
                          <button onClick={() => { const newTrades = [...(p.trades || []), { name: "New Trade", quoted: 0, actual: 0, assignedTo: "" }]; updateTrades(p, newTrades); }} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "6px", color: "#a78bfa", cursor: "pointer", fontWeight: "700" }}>+ Add Trade</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" }}>'''
new2 = '''<div style={{ display: "none" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" }}>'''
print('Trade breakdown found:', old2 in c)
c = c.replace(old2, new2)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
