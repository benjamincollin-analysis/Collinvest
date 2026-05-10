
c = open('app/Dashboard/CommunityFeed.tsx', 'r', encoding='utf-8').read()
old = 'else setNetworkInvestors(prev => prev.map(i => i.id === connectModal.id ? { ...i, requestSent: true } : i));'
new = 'else setNetworkInvestors(prev => prev.map(i => i.id === connectModal?.id ? { ...i, requestSent: true } : i));'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/CommunityFeed.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
