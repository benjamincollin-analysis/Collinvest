
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Only Portfolio and Cash Flow should have arrows ? others get plain grey sub
old = '''<span className="gs-strip-sub">
              <span style={{ color: m.color, fontWeight: "800" }}>&#8593; {m.sub}</span>
              {m.subB && <span style={{ color: "rgba(255,255,255,0.3)" }}> {m.subB}</span>}
            </span>'''

new = '''<span className="gs-strip-sub">
              {m.subB ? <>
                <span style={{ color: m.color, fontWeight: "800" }}>&#8593; {m.sub}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}> {m.subB}</span>
              </> : <span style={{ color: "rgba(255,255,255,0.3)" }}>{m.sub}</span>}
            </span>'''

print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
