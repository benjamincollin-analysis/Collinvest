
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '''                            <div style={{ textAlign: "right" }}>
                              <div style={{ textAlign: "center" }}>
                              <p style={{ fontSize: "22px", fontWeight: "900", color: "rgba(255,255,255,0.15)", letterSpacing: "-1px", textTransform: "uppercase" }}>{p.name}</p>
                              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", marginTop: "4px" }}>{p.type}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>'''
new = '''                            <div style={{ textAlign: "center" }}>
                              <p style={{ fontSize: "22px", fontWeight: "900", color: "rgba(255,255,255,0.15)", letterSpacing: "-1px", textTransform: "uppercase" }}>{p.name}</p>
                              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", marginTop: "4px" }}>{p.type}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>'''
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
