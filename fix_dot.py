
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '{m.name} ? {m.role}'
new = '{m.name} - {m.role}'
print('FOUND:', c.count(old), 'times')
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
