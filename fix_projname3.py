
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Just add project name between the two numbers in the header
old = '<p style={{ fontSize: "36px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-2px", lineHeight: 1, textShadow: "0 0 40px rgba(167,139,250,0.3)" }}>{fmtMoney(p.budget)}</p>'
new = '''<p style={{ fontSize: "36px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-2px", lineHeight: 1, textShadow: "0 0 40px rgba(167,139,250,0.3)" }}>{fmtMoney(p.budget)}</p>
                            <p style={{ fontSize: "28px", fontWeight: "900", color: "rgba(255,255,255,0.08)", letterSpacing: "-1px", textTransform: "uppercase", position: "absolute", left: "50%", transform: "translateX(-50%)", top: "50%", marginTop: "-14px", whiteSpace: "nowrap" as const }}>{p.name}</p>'''
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
