
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '<option value="">? Select person ?</option>\n            <option value="Owner">Owner</option>'
new = '<option value="Owner">Owner (you)</option>'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
