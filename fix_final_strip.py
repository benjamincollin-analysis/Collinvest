
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Fix Investor Rank sub split
old = 'sub: `Top ${Math.max(1, 12 - properties.length)}% ? Builder II`, glow: "rgba(245,158,11,0.08)"'
new = 'sub: `Top ${Math.max(1, 12 - properties.length)}%`, subB: " ? Builder II", glow: "rgba(245,158,11,0.08)"'
print('Rank found:', old in c)
c = c.replace(old, new)

# Fix arrow ? use text arrow instead of unicode
old2 = '{m.label === "Portfolio" || m.label === "Net Cash Flow" ? "? " : ""}'
new2 = '{m.label === "Portfolio" || m.label === "Net Cash Flow" ? "^ " : ""}'
print('Arrow found:', old2 in c)
c = c.replace(old2, new2)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
