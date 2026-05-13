
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'padding: "22px", position: "relative", overflow: "hidden", boxShadow'
new = 'padding: "16px 18px", position: "relative", overflow: "hidden", boxShadow'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
