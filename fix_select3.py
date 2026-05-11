
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('Select person')
start = c.rfind('<option', 0, idx)
end = c.find('</option>', idx) + 9
old = c[start:end]
print('OLD:', repr(old))
new = '<option value="Owner">Owner (you)</option>'
c = c[:start] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
