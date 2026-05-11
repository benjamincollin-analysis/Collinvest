
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Remove dot above income
old = '<span className="gs-strip-dot" style={{ marginBottom: "4px" }} />'
new = ''
print('Dot found:', old in c)
c = c.replace(old, new)

# Fix LiveIncomeCounter alignment to match other cells
old2 = 'function LiveIncomeCounter({ monthlyCashFlow }: { monthlyCashFlow: number }) {'
print('LiveIncomeCounter found:', old2 in c)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
