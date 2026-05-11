
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'sub: `Top ${Math.max(1, 12 - properties.length)}% · Builder II`, glow: "rgba(245,158,11,0.08)"'
new = 'sub: `Top ${Math.max(1, 12 - properties.length)}%`, subB: " · Builder II", glow: "rgba(245,158,11,0.08)"'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
