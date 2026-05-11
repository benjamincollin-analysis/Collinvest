
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '}}>+ New Project</button>'
new = '}} data-new-project>+ New Project</button>'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
