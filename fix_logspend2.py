
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = '''function LogSpendEntry({ project, onLog, team, trades }: { project: any; onLog: (e: any) => void; team: any[]; trades: any[] }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [trade, setTrade] = useState("");
  const [enteredBy, setEnteredBy] = useState("Owner");
  function handleSave() {
    if (!amount) return;
    onLog({ amount: parseFloat(amount), note, trade, enteredBy, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setAmount(""); setNote(""); setTrade(""); setEnteredBy("Owner");
  }'''

new = '''function LogSpendEntry({ project, onLog, team, trades }: { project: any; onLog: (e: any) => void; team: any[]; trades: any[] }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [trade, setTrade] = useState("");
  const [enteredBy, setEnteredBy] = useState("Owner");
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonRole, setNewPersonRole] = useState("Contractor");
  const [localTeam, setLocalTeam] = useState<any[]>(team);

  function handleSave() {
    if (!amount) return;
    onLog({ amount: parseFloat(amount), note, trade, enteredBy, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setAmount(""); setNote(""); setTrade(""); setEnteredBy("Owner");
  }

  function handleAddPerson() {
    if (!newPersonName.trim()) return;
    const person = { name: newPersonName.trim(), role: newPersonRole };
    const updated = [...localTeam, person];
    setLocalTeam(updated);
    setEnteredBy(person.name);
    setNewPersonName("");
    setShowAddPerson(false);
  }'''

print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
