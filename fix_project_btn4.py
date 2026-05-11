
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = 'onClick={() => { setActiveTab("myprojects"); setTimeout(() => { const btn = document.querySelector("[data-new-project]") as HTMLButtonElement; if(btn) btn.click(); }, 800); }}'
new = 'onClick={() => { setActiveTab("myprojects"); setTimeout(() => { const projectsBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Projects") as HTMLButtonElement; if(projectsBtn) projectsBtn.click(); setTimeout(() => { const btn = document.querySelector("[data-new-project]") as HTMLButtonElement; if(btn) btn.click(); }, 400); }, 400); }}'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
