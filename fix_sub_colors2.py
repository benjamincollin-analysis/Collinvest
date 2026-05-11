
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Fix Investor Rank ? Top X% colored, rest grey
old = 'sub: `Top ${Math.max(1, 12 - properties.length)}% ? Builder II`, glow: "rgba(245,158,11,0.08)"'
new = 'sub: `Top ${Math.max(1, 12 - properties.length)}%`, subB: " ? Builder II", glow: "rgba(245,158,11,0.08)"'
print('Rank found:', old in c)
c = c.replace(old, new)

# Fix JSX to handle Investor Rank sub coloring
old2 = '''{m.subB ? <>
                <span style={{ color: m.color, fontWeight: "800" }}>&#8593; {m.sub}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}> {m.subB}</span>
              </> : <span style={{ color: "rgba(255,255,255,0.3)" }}>{m.sub}</span>}'''

new2 = '''{m.subB ? <>
                <span style={{ color: m.color, fontWeight: "800" }}>{m.label === "Portfolio" || m.label === "Net Cash Flow" ? "? " : ""}{m.sub}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>{m.subB}</span>
              </> : <span style={{ color: "rgba(255,255,255,0.3)" }}>{m.sub}</span>}'''

print('JSX found:', old2 in c)
c = c.replace(old2, new2)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
