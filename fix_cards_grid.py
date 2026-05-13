
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Add background image to card
old = '<div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${hc}22`, borderRadius: "20px", overflow: "hidden" }}>'
new = '''<div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${hc}33`, borderRadius: "20px", overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${p.type === "Flip" ? "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80" : p.type === "New Build" ? "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80" : p.type === "Land Development" ? "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80" : p.type === "Short-Term Rental Setup" ? "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80" : "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80"})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.07, filter: "blur(1px)", zIndex: 0 }} />
                <div style={{ position: "relative", zIndex: 1 }}>'''

print('FOUND:', old in c)
c = c.replace(old, new)

# Close the extra wrapper div at end of card - find the card closing
idx = c.find('<div key={p.id}')
end_card = c.find('\n            );\n          })', idx)
old2 = c[end_card:end_card+30]
print('End card:', repr(old2))

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
