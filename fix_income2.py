
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Fix income sub text color
old = '<p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}'
new = '<p style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}'
print('Sub found:', old in c)
c = c.replace(old, new)

# Fix Today Income title color to match other labels
old2 = '<span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "1.5px", fontWeight: "700", textTransform: "uppercase" as const }}>Today\'s Income</span>'
new2 = '<span style={{ fontSize: "9px", color: "rgba(255,255,255,0.6)", letterSpacing: "1.5px", fontWeight: "700", textTransform: "uppercase" as const }}>Today\'s Income</span>'
print('Title found:', old2 in c)
c = c.replace(old2, new2)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
