
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Project name - bigger, more visible
old1 = 'fontSize: "22px", fontWeight: "900", color: "rgba(255,255,255,0.15)", letterSpacing: "-1px", textTransform: "uppercase"'
new1 = 'fontSize: "28px", fontWeight: "900", color: "rgba(255,255,255,0.5)", letterSpacing: "-1px", textTransform: "uppercase"'
print('Name found:', old1 in c)
c = c.replace(old1, new1)

# Type text - more visible
old2 = 'fontSize: "10px", color: "rgba(255,255,255,0.15)", marginTop: "4px"'
new2 = 'fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "4px", fontWeight: "600"'
print('Type found:', old2 in c)
c = c.replace(old2, new2)

# Smaller side numbers
old3 = 'fontSize: "36px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-2px", lineHeight: 1, textShadow: "0 0 40px rgba(167,139,250,0.3)"'
new3 = 'fontSize: "28px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-1px", lineHeight: 1, textShadow: "0 0 40px rgba(167,139,250,0.3)"'
print('Left num found:', old3 in c)
c = c.replace(old3, new3)

old4 = 'fontSize: "36px", fontWeight: "900", color: overBudget ? "#f87171" : "#fff", letterSpacing: "-3px", lineHeight: 1'
new4 = 'fontSize: "28px", fontWeight: "900", color: overBudget ? "#f87171" : "#fff", letterSpacing: "-1px", lineHeight: 1'
print('Right num found:', old4 in c)
c = c.replace(old4, new4)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
