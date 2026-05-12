
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'placeholder="e.g. First payment — roof work"'
new = 'placeholder="e.g. First payment - roof work"'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
