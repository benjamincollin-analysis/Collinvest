
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'const [sub, setSub] = useState<"active"|"projects">("active");'
new = 'const [sub, setSub] = useState<"active"|"projects">("projects");'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
