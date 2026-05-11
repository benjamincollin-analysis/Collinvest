
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '<button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "#a78bfa"'
new = '<button data-new-project onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "#a78bfa"'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
