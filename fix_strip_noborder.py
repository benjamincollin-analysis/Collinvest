
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '<div key={m.label} className="strip-cell" style={{ borderBottom: `2px solid ${m.color}33` }}>'
new = '<div key={m.label} className="strip-cell">'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
