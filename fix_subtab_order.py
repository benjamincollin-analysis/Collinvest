
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '{ key: "active",   label: "Overview"   },\n    { key: "projects", label: "Projects"   },'
new = '{ key: "projects", label: "Projects"   },\n    { key: "active",   label: "Overview"   },'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
