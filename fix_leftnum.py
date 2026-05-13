
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'fontSize: "36px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-3px", lineHeight: 1, textShadow: "0 0 40px rgba(167,139,250,0.3)"'
new = 'fontSize: "28px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-1px", lineHeight: 1, textShadow: "0 0 40px rgba(167,139,250,0.3)"'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
