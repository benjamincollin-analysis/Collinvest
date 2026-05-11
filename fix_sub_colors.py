
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('Investor Rank')
print(repr(c[idx:idx+250]))
