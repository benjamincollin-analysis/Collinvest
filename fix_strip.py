
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = '''.gs-strip-desktop {
          display:grid; grid-template-columns:1fr 1fr 1fr 1fr 200px;
          border-bottom:1px solid rgba(255,255,255,0.04);
          background: rgba(5,5,5,0.9);
          backdrop-filter:blur(20px);
          position:sticky; top:0; z-index:9; padding:0 40px;
          box-shadow: 0 1px 0 rgba(245,166,35,0.06), 0 4px 20px rgba(0,0,0,0.4);
        }
        .gs-strip-desktop .strip-cell { display:flex; flex-direction:column; justify-content:center; padding:10px 18px; border-right:1px solid rgba(255,255,255,0.04); gap:3px; }
        .gs-strip-desktop .strip-cell:last-child { border-right:none; }
        .gs-strip-label { font-size:8px; color:rgba(255,255,255,0.25); letter-spacing:1.8px; text-transform:uppercase; font-weight:700; }
        .gs-strip-value { font-size:16px; font-weight:900; letter-spacing:-0.5px; }
        .gs-strip-sub { font-size:10px; color:rgba(255,255,255,0.18); }'''

new = '''.gs-strip-desktop {
          display:grid; grid-template-columns:1.3fr 1.3fr 1fr 1fr 1.1fr 1.2fr auto;
          border-bottom:1px solid rgba(255,255,255,0.06);
          background:rgba(5,5,5,0.95);
          backdrop-filter:blur(20px);
          position:sticky; top:0; z-index:9; padding:0 32px;
          box-shadow:0 1px 0 rgba(245,166,35,0.08), 0 4px 24px rgba(0,0,0,0.5);
        }
        .gs-strip-desktop .strip-cell { display:flex; flex-direction:column; justify-content:center; padding:11px 16px; border-right:1px solid rgba(255,255,255,0.05); gap:2px; }
        .gs-strip-desktop .strip-cell:last-child { border-right:none; }
        .gs-strip-goal-row { display:flex; align-items:center; gap:12px; padding:5px 32px; border-bottom:1px solid rgba(255,255,255,0.04); background:rgba(5,5,5,0.95); position:sticky; top:58px; z-index:8; }
        .gs-strip-label { font-size:8px; color:rgba(255,255,255,0.25); letter-spacing:1.8px; text-transform:uppercase; font-weight:700; display:flex; align-items:center; gap:5px; }
        .gs-strip-value { font-size:16px; font-weight:900; letter-spacing:-0.5px; line-height:1; }
        .gs-strip-sub { font-size:9px; color:rgba(255,255,255,0.2); margin-top:1px; }
        .gs-strip-dot { width:5px; height:5px; border-radius:50%; background:#34d399; box-shadow:0 0 5px #34d399; animation:gsdotpulse 2s infinite; display:inline-block; }
        @keyframes gsdotpulse { 0%,100%{opacity:1} 50%{opacity:0.25} }'''

print('OLD FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('STEP 1 DONE' if 'gs-strip-goal-row' in open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read() else 'STEP 1 FAILED')
