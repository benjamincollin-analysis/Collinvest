
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('{/* Trade Breakdown */}')
end = c.find('</div>\n                        {p.budgetHistory', idx)
old = c[idx:end]
print('Length:', len(old))
print('Preview:', repr(old[:100]))
c = c[:idx] + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
