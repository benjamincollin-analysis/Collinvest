
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('function LiveIncomeCounter')
print(repr(c[idx+500:idx+900]))
