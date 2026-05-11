
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Center align all strip cells and improve sub text size
old = '.gs-strip-desktop .strip-cell { display:flex; flex-direction:column; justify-content:center; padding:11px 16px; border-right:1px solid rgba(255,255,255,0.05); gap:2px; }'
new = '.gs-strip-desktop .strip-cell { display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:11px 16px; border-right:1px solid rgba(255,255,255,0.05); gap:3px; }'
print('Cell style found:', old in c)
c = c.replace(old, new)

# Bigger sub text
old2 = '.gs-strip-sub { font-size:9px; color:rgba(255,255,255,0.2); margin-top:1px; }'
new2 = '.gs-strip-sub { font-size:10px; color:rgba(255,255,255,0.3); margin-top:1px; }'
print('Sub style found:', old2 in c)
c = c.replace(old2, new2)

# Bigger label text
old3 = '.gs-strip-label { font-size:8px; color:rgba(255,255,255,0.25); letter-spacing:1.8px; text-transform:uppercase; font-weight:700; display:flex; align-items:center; gap:5px; }'
new3 = '.gs-strip-label { font-size:9px; color:rgba(255,255,255,0.35); letter-spacing:1.5px; text-transform:uppercase; font-weight:700; display:flex; align-items:center; gap:5px; }'
print('Label style found:', old3 in c)
c = c.replace(old3, new3)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
