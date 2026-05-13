
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = '<div style={{ textAlign: "center" }}>'
new = '<div style={{ textAlign: "center", flex: 1 }}>'
print('Center div found:', old in c)
c = c.replace(old, new)

old2 = 'fontSize: "28px", fontWeight: "900", color: "rgba(255,255,255,0.5)"'
new2 = 'fontSize: "32px", fontWeight: "900", color: "rgba(255,255,255,0.85)"'
print('Name color found:', old2 in c)
c = c.replace(old2, new2)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
