
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'const [showCompare, setShowCompare] = useState(false);'
new = 'const [showCompare, setShowCompare] = useState(false);\n  const [showProfileMenu, setShowProfileMenu] = useState(false);'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE' if 'showProfileMenu' in open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read() else 'FAILED')
