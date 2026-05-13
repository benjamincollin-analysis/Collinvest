
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'aiReport.split("\n").map'
new = 'aiReport.split("\\n").map'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
