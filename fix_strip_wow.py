
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Remove the TODAY label
old = '<span className="gs-strip-label"><span className="gs-strip-dot" />Today</span>'
new = '<span className="gs-strip-label"><span className="gs-strip-dot" />Live</span>'
print('TODAY label found:', old in c)
c = c.replace(old, new)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
