
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# 1. Fix sub text in strip cells ? arrow + colored pct + grey text
old = '<span className="gs-strip-sub">{m.sub}</span>'
new = '''<span className="gs-strip-sub">
              {m.sub && m.sub.includes(" to ") ? <><span style={{ color: m.color, fontWeight: "800" }}>&#8593; {m.sub.split(" to ")[0]}</span><span style={{ color: "rgba(255,255,255,0.3)" }}> to {m.sub.split(" to ")[1]}</span></> : m.sub && m.sub.includes(" ? ") ? <><span style={{ color: m.color, fontWeight: "800" }}>{m.sub.split(" ? ")[0]}</span><span style={{ color: "rgba(255,255,255,0.3)" }}> ? {m.sub.split(" ? ")[1]}</span></> : <span style={{ color: "rgba(255,255,255,0.3)" }}>{m.sub}</span>}
            </span>'''
print('Sub found:', old in c)
c = c.replace(old, new)

# 2. Fix LiveIncomeCounter ? green dot + bigger + grey sub
old2 = '''<div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "3px" }}>
      <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "1.5px", fontWeight: "700", textTransform: "uppercase" as const }}>Today\'s Income</span>
      <p style={{ fontSize: "18px", fontWeight: "900", color: "#34d399", letterSpacing: "-0.8px", lineHeight: 1 }}>+${earned.toFixed(2)}</p>'''
new2 = '''<div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "3px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite" }} />
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "1.5px", fontWeight: "700", textTransform: "uppercase" as const }}>Today\'s Income</span>
      </div>
      <p style={{ fontSize: "22px", fontWeight: "900", color: "#34d399", letterSpacing: "-0.8px", lineHeight: 1 }}>+${earned.toFixed(2)}</p>'''
print('Income found:', old2 in c)
c = c.replace(old2, new2)

# 3. Fix sub text color below income counter
old3 = '<p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}'
new3 = '<p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}'
print('Income sub found:', old3 in c)
c = c.replace(old3, new3)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
