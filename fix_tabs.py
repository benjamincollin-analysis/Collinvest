
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'background: activeTab === t ? "rgba(245,166,35,0.12)" : "transparent", color: activeTab === t ? "#f5a623" : "rgba(255,255,255,0.3)", boxShadow: activeTab === t ? "inset 0 0 0 1px rgba(245,166,35,0.25)" : "none"'
new = 'background: activeTab === t ? "rgba(245,166,35,0.15)" : "transparent", color: activeTab === t ? "#f5a623" : "rgba(255,255,255,0.4)", boxShadow: activeTab === t ? "inset 0 0 0 1.5px rgba(245,166,35,0.6)" : "none", borderColor: activeTab === t ? "rgba(245,166,35,0.5)" : "transparent"'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
