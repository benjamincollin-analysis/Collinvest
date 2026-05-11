
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# 1. Fix sub text ? colored arrow + pct, grey for the rest
old = '''<span className="gs-strip-sub">
              <span style={{ color: m.color, fontWeight: "800" }}>? {m.sub.split(" to ")[0]}</span>
              {m.sub.includes(" to ") && <span style={{ color: "rgba(255,255,255,0.3)" }}> to {m.sub.split(" to ")[1]}</span>}
            </span>'''
if old not in c:
    old = '<span className="gs-strip-sub" style={{ color: "rgba(255,255,255,0.3)" }}>{m.sub}</span>'
new = '''<span className="gs-strip-sub">
              {m.sub && m.sub.includes(" to ") ? <>
                <span style={{ color: m.color, fontWeight: "800" }}>? {m.sub.split(" to ")[0]}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}> to {m.sub.split(" to ")[1]}</span>
              </> : m.sub && m.sub.includes(" ? ") ? <>
                <span style={{ color: m.color, fontWeight: "800" }}>{m.sub.split(" ? ")[0]}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}> ? {m.sub.split(" ? ")[1]}</span>
              </> : <span style={{ color: "rgba(255,255,255,0.3)" }}>{m.sub}</span>}
            </span>'''
print('Sub found:', old in c)
c = c.replace(old, new)

# 2. Fix Today Income sub text to white/grey
old2 = '''<p style={{ fontSize: "18px", fontWeight: "900", color: "#34d399", letterSpacing: "-1px", lineHeight: 1 }}>+${earned.toFixed(2)}</p>
      <p style'''
print('Income p found:', old2 in c)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
