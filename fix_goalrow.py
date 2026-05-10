
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = '''        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>{fmtFull(monthlyCashFlow)}/mo / ${GOAL_CASHFLOW.toLocaleString()} - {cashFlowPct.toFixed(1)}%</span>
      </div'''
new = '''        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>{fmtFull(monthlyCashFlow)}/mo / ${GOAL_CASHFLOW.toLocaleString()} - {cashFlowPct.toFixed(1)}%</span>
      </div>'''
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('FIXED' if '      </div>' in c else 'FAILED')
