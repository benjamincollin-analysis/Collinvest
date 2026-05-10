
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = '''        </div>
                {[
                  { label: "Goals and Settings", action: () => { setShowSettings(true); setShowProfileMenu(false); }, color: "rgba(255,255,255,0.7)" },
                  { label: "Referral Program", action: () => { setShowProfile(true); setShowProfileMenu(false); }, color: "#f59e0b" },
                  { label: "Log out", action: handleLogout, color: "#f87171" },
                ].map(item => (
                  <button key={item.label} onClick={item.action} style={{ width: "100%", padding: "9px 12px", background: "none", border: "none", borderRadius: "8px", color: item.color, fontSize: "12px", fontWeight: "600", cursor: "pointer", textAlign: "left" as const, display: "block" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        ))}
      </nav>'''

new = '''        </div>
                {[
                  { label: "Goals and Settings", action: () => { setShowSettings(true); setShowProfileMenu(false); }, color: "rgba(255,255,255,0.7)" },
                  { label: "Referral Program", action: () => { setShowProfile(true); setShowProfileMenu(false); }, color: "#f59e0b" },
                  { label: "Log out", action: handleLogout, color: "#f87171" },
                ].map(item => (
                  <button key={item.label} onClick={item.action} style={{ width: "100%", padding: "9px 12px", background: "none", border: "none", borderRadius: "8px", color: item.color, fontSize: "12px", fontWeight: "600", cursor: "pointer", textAlign: "left" as const, display: "block" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>'''

print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
