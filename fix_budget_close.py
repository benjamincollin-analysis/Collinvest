
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = ')\n                    ) {/* ACTIVITY LOG */}'
new = ')\n                    )} {/* ACTIVITY LOG */}'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
