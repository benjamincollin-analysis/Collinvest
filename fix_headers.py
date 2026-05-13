
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old1 = '}>?? Log Payment</p>'
new1 = '}>LOG PAYMENT</p>'
old2 = '}>?? Plan Expense</p>'
new2 = '}>PLAN EXPENSE</p>'
print('Header 1:', old1 in c)
print('Header 2:', old2 in c)
c = c.replace(old1, new1).replace(old2, new2)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
