
old_file = open('temp_old.tsx', 'r', encoding='utf-16').read()

start1 = old_file.find('function OnboardingModal(')
start2 = old_file.find('function SettingsModal(')
end2 = old_file.find('\nfunction ', start2 + 100)

modals = old_file[start1:end2]
print('Extracted length:', len(modals))
print('Has OnboardingModal:', 'function OnboardingModal' in modals)
print('Has SettingsModal:', 'function SettingsModal' in modals)

current = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
inject_point = 'function Dashboard() {'
new = modals + '\n\n' + inject_point
current = current.replace(inject_point, new, 1)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(current)
print('DONE' if 'function OnboardingModal' in open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read() else 'FAILED')
