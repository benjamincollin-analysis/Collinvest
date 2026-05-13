
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '<p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "2.5px", fontWeight: "800", marginBottom: "8px" }}>Committed</p>'
new = '''<div style={{ textAlign: "center" }}>
                              <p style={{ fontSize: "22px", fontWeight: "900", color: "rgba(255,255,255,0.15)", letterSpacing: "-1px", textTransform: "uppercase" }}>{p.name}</p>
                              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", marginTop: "4px" }}>{p.type}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "2.5px", fontWeight: "800", marginBottom: "8px" }}>Committed</p>'''
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
