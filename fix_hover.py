
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '<button key={key} onClick={() => setActiveTab(key)} style={tabStyle(key)}>'
new = '<button key={key} onClick={() => setActiveTab(key)} style={tabStyle(key)} onMouseEnter={e => { if (activeTab !== key) { e.currentTarget.style.background = "rgba(245,166,35,0.08)"; e.currentTarget.style.color = "rgba(245,166,35,0.7)"; }}} onMouseLeave={e => { if (activeTab !== key) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}}>'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
