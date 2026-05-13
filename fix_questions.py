
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Fix emoji rendering - replace emoji with plain text
old1 = '\U0001f4b8 Log Payment'
new1 = 'LOG PAYMENT'
print('Paid header:', old1 in c)
c = c.replace(old1, new1)

old2 = '\U0001f4cb Plan Expense'
new2 = 'PLAN EXPENSE'
print('Plan header:', old2 in c)
c = c.replace(old2, new2)

# Fix category placeholder
old3 = '<option value="">? Category ?</option>'
new3 = '<option value="">Select category</option>'
print('Category:', old3 in c)
c = c.replace(old3, new3)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
