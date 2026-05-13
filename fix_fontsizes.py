
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Smaller header numbers
old1 = 'fontSize: "48px", fontWeight: "900", color: "#a78bfa"'
new1 = 'fontSize: "36px", fontWeight: "900", color: "#a78bfa"'
print('Header 1 found:', old1 in c)
c = c.replace(old1, new1)

old2 = 'fontSize: "48px", fontWeight: "900", color: overBudget ? "#f87171" : "#fff"'
new2 = 'fontSize: "36px", fontWeight: "900", color: overBudget ? "#f87171" : "#fff"'
print('Header 2 found:', old2 in c)
c = c.replace(old2, new2)

# Smaller card numbers
old3 = 'fontSize: "34px", fontWeight: "900", color: m.color'
new3 = 'fontSize: "26px", fontWeight: "900", color: m.color'
print('Card numbers found:', old3 in c)
c = c.replace(old3, new3)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
