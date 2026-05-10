
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# The strip map closing '))}'  at line 699 is orphaned ? need to add </nav> before the strip
old = '''        ))}
        <div className="strip-cell" style={{ borderLeft: "1px solid rgba(52,211,153,0.12)"'''

new = '''        ))}
      </nav>

      <div className="gs-strip-desktop">
        <div className="strip-cell" style={{ borderLeft: "1px solid rgba(52,211,153,0.12)"'''

print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
