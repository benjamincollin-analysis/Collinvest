
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '              </div>\n            );\n          })}\n        </div>'
new = '              </div>\n                </div>\n            );\n          })}\n        </div>'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
