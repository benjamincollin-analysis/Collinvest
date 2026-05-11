
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Default enteredBy to Owner
old = 'const [enteredBy, setEnteredBy] = useState("");'
new = 'const [enteredBy, setEnteredBy] = useState("Owner");'
print('enteredBy found:', old in c)
c = c.replace(old, new)

# Reset also sets Owner
old2 = 'setAmount(""); setNote(""); setTrade(""); setEnteredBy("");'
new2 = 'setAmount(""); setNote(""); setTrade(""); setEnteredBy("Owner");'
print('Reset found:', old2 in c)
c = c.replace(old2, new2)

# Remove the empty option from Entered By select
old3 = '''<option value="">? Select person ?</option>
        <option value="Owner">Owner</option>'''
new3 = '<option value="Owner">Owner (you)</option>'
print('Select found:', old3 in c)
c = c.replace(old3, new3)

# Make save button always active (enteredBy always has value)
old4 = 'disabled={!amount}'
new4 = 'disabled={!amount || !enteredBy}'
print('Button found:', old4 in c)
c = c.replace(old4, new4, 1)

old5 = "background: amount ? "#f87171" : "rgba(248,113,113,0.2)", color: amount ? "#000" : "rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "800", fontSize: "14px", border: "none", cursor: amount ? "pointer" : "not-allowed""
new5 = "background: (amount && enteredBy) ? "#f87171" : "rgba(248,113,113,0.2)", color: (amount && enteredBy) ? "#000" : "rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "800", fontSize: "14px", border: "none", cursor: (amount && enteredBy) ? "pointer" : "not-allowed""
print('Button style found:', old5 in c)
c = c.replace(old5, new5)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
