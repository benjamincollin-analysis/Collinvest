
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('className="gs-nav-user">')
end = c.find('</div>', idx)
end = c.find('</div>', end+1)
end = c.find('</div>', end+1) + 6
old = c[idx:end]
print('OLD length:', len(old))

new = '''className="gs-nav-user">
          <TierBadge portfolioValue={totalValue} size="sm" />
          <NotificationBell user={user} properties={properties} />
          <div style={{ position: "relative" }}>
            <div onClick={() => setShowProfileMenu(p => !p)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px", cursor: "pointer", height: "36px" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", fontWeight: "800", fontSize: "11px" }}>{(settings.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}</div>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.6)" }}>{displayName}</span>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>v</span>
            </div>
            {showProfileMenu && (
              <div style={{ position: "absolute", top: "46px", right: 0, width: "220px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "6px", zIndex: 200, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "4px" }}>
                  <p style={{ fontSize: "14px", fontWeight: "800", color: "#fff" }}>{displayName}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "3px" }}>{user?.email}</p>
                </div>
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
        </div>'''

c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('STEP 3 DONE' if 'showProfileMenu' in open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read() else 'STEP 3 FAILED')
