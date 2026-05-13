
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = '<div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${hc}22`, borderRadius: "20px", overflow: "hidden" }}>'
new = '<div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${hc}33`, borderRadius: "20px", overflow: "hidden", position: "relative", backgroundImage: `url(${p.type === "Flip" ? "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&q=60" : p.type === "New Build" ? "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=60" : p.type === "Land Development" ? "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&q=60" : p.type === "Short-Term Rental Setup" ? "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=60" : "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60"})`, backgroundSize: "cover", backgroundPosition: "center" }}>'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
