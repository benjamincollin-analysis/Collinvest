
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('className="gs-nav-user">')
marker = '</div>' + chr(10) + '      </nav>'
end = c.find(marker, idx) + len(marker)
old = c[idx:end]
print('OLD FOUND, length:', len(old))
