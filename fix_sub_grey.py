
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = ': <span style={{ color: "rgba(255,255,255,0.3)" }}>{m.sub}</span>'
new = ': <span style={{ color: "rgba(255,255,255,0.6)" }}>{m.sub}</span>'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
