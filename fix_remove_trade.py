
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
start = c.find('{/* Trade Breakdown */}')
# Find end ? after the closing of the trade grid div, before Spend History
end = c.find('{p.budgetHistory && p.budgetHistory.length > 0', start)
old = c[start:end]
print('Length:', len(old))
print('Preview end:', repr(old[-100:]))
c = c[:start] + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
