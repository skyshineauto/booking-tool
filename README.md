:root{
  --bg0:#070a10;
  --bg1:#0a1020;
  --card: rgba(10, 12, 18, 0.88);
  --card2: rgba(12, 16, 26, 0.90);
  --border: rgba(255,255,255,0.10);
  --border2: rgba(255,255,255,0.14);

  --text: rgba(255,255,255,0.92);
  --muted: rgba(255,255,255,0.62);
  --muted2: rgba(255,255,255,0.45);

  --cyan:#35d6ff;
  --orange:#ff8a2a;
  --green:#29d78a;
  --red:#ff4d5a;

  --shadow: 0 18px 60px rgba(0,0,0,0.55);
  --shadow2: 0 10px 30px rgba(0,0,0,0.45);

  --r: 16px;
  --r2: 20px;
}

*{ box-sizing:border-box; }

.app{
  color: var(--text);
  min-height:100vh;
  position:relative;
  z-index:1;
}

.bg{
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
}

.bgBlur{
  position:absolute;
  inset:-40px;
  background:
    radial-gradient(1200px 700px at 20% 20%, rgba(53,214,255,0.16), transparent 55%),
    radial-gradient(900px 650px at 80% 30%, rgba(255,138,42,0.14), transparent 60%),
    radial-gradient(1000px 650px at 50% 85%, rgba(130,80,255,0.10), transparent 62%),
    linear-gradient(180deg, #05070c 0%, #090f1d 40%, #05060a 100%);
  filter: blur(18px) saturate(1.2);
  transform: scale(1.05);
}

.bokeh{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  opacity:0.9;
}

.vignette{
  position:absolute;
  inset:0;
  background:
    radial-gradient(900px 700px at 50% 35%, rgba(0,0,0,0.10), rgba(0,0,0,0.68) 75%, rgba(0,0,0,0.82) 100%),
    radial-gradient(1400px 900px at 50% 55%, rgba(0,0,0,0.05), rgba(0,0,0,0.80) 80%);
}

/* Top bar */
.topbar{
  position:sticky;
  top:0;
  z-index:10;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  padding:16px 18px;
  background: rgba(5,7,10,0.72);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(6px);
}

.brand{
  display:flex;
  align-items:center;
  gap:14px;
  min-width: 280px;
}

.logo{
  width:56px;
  height:56px;
  object-fit:contain;
  filter: drop-shadow(0 10px 18px rgba(0,0,0,0.55));
}

.brandTitle{
  font-weight:800;
  letter-spacing:-0.02em;
  font-size: 16px;
  line-height:1.1;
}

.brandMeta{
  margin-top:4px;
  font-size: 12px;
  color: var(--muted);
}

.tabs{ display:flex; gap:10px; align-items:center; }

.tabBtn{
  appearance:none;
  border:1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.22);
  color: var(--text);
  border-radius: 999px;
  padding: 9px 12px;
  font-weight: 700;
  font-size: 12px;
  cursor:pointer;
  transition: 160ms ease;
}
.tabBtn:hover{ border-color: rgba(255,255,255,0.22); }
.tabBtn.isActive{
  border-color: rgba(53,214,255,0.55);
  box-shadow: 0 0 0 2px rgba(53,214,255,0.14) inset, 0 12px 40px rgba(0,0,0,0.35);
}

/* Layout */
.layout{
  width: min(1200px, calc(100vw - 32px));
  margin: 18px auto 120px;
  display:grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  align-items:start;
}

.inputsCol{ order: 1; }
.decisionCol{ order: 2; position:sticky; top: 88px; }

@media (max-width: 980px){
  .layout{
    grid-template-columns: 1fr;
    margin-bottom: 160px;
  }
  .decisionCol{
    position: sticky;
    top: 78px;
    order: 1;
    z-index: 5;
  }
  .inputsCol{ order: 2; }
}

.page{
  width: min(1200px, calc(100vw - 32px));
  margin: 18px auto 80px;
}

.pageInner{ display:flex; flex-direction:column; gap:14px; }
.pageHead{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; }
.pageTitle{ font-weight: 900; letter-spacing:-0.02em; font-size: 18px; }

/* Cards (crisp, not foggy) */
.card{
  position:relative;
  border-radius: var(--r2);
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow:hidden;
}
.card::before{
  content:"";
  position:absolute;
  inset:0;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 28%);
  pointer-events:none;
}
.cardHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding: 14px 16px 10px;
}
.cardTitle{
  font-weight: 900;
  letter-spacing:-0.02em;
  font-size: 13px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.86);
}
.cardRight{ color: var(--muted); font-size: 12px; }
.cardBody{ padding: 12px 16px 16px; }

.decisionCard{ background: var(--card2); }

.divider{ height:1px; background: rgba(255,255,255,0.08); margin: 12px 0; }

/* Inputs */
.inputsStack{ display:flex; flex-direction:column; gap:16px; }
.grid2{ display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 680px){ .grid2{ grid-template-columns: 1fr; } }

.label{
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.72);
  margin-bottom: 8px;
}
.hint{ margin-top:8px; color: var(--muted2); font-size: 12px; line-height:1.25; }
.hintInline{ color: var(--muted2); font-size: 12px; }
.muted{ color: var(--muted); font-size: 12px; }
.mutedSm{ color: var(--muted2); font-size: 12px; margin-top: 8px; }

.pillRow, .chipRow{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.pill{
  position:relative;
  display:inline-flex;
  align-items:center;
  gap:10px;
  border-radius: 999px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(0,0,0,0.22);
  color: rgba(255,255,255,0.88);
  cursor:pointer;
  transition: 160ms ease;
  font-weight: 800;
  font-size: 12px;
}
.pill:hover{
  border-color: rgba(255,255,255,0.28);
  box-shadow: 0 0 0 2px rgba(255,255,255,0.06) inset;
}
.pill.isSelected{
  background: rgba(12,16,26,0.92);
  border-color: rgba(53,214,255,0.55);
  box-shadow: 0 0 0 2px rgba(53,214,255,0.14) inset, 0 0 26px rgba(53,214,255,0.18);
}
.pill.tone-orange.isSelected{
  border-color: rgba(255,138,42,0.60);
  box-shadow: 0 0 0 2px rgba(255,138,42,0.14) inset, 0 0 26px rgba(255,138,42,0.18);
}
.pillCheck{
  width: 18px;
  height: 18px;
  border-radius: 6px;
  display:grid;
  place-items:center;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.18);
  font-size: 12px;
  color: rgba(255,255,255,0.92);
}

.chip{
  display:inline-flex;
  align-items:center;
  gap:8px;
  border-radius: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.18);
  cursor:pointer;
  transition: 160ms ease;
  color: rgba(255,255,255,0.86);
}
.chip:hover{ border-color: rgba(255,255,255,0.22); }
.chip.isSelected{
  border-color: rgba(255,138,42,0.6);
  box-shadow: 0 0 0 2px rgba(255,138,42,0.14) inset, 0 0 22px rgba(255,138,42,0.14);
}
.chipName{ font-weight: 900; font-size: 12px; }
.chipMeta{ color: var(--muted); font-size: 12px; }
.chipCheck{ margin-left:6px; color: rgba(255,255,255,0.9); }

.chipGrid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:10px;
}
@media (max-width: 740px){ .chipGrid{ grid-template-columns: 1fr; } }

.tray{
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
  padding: 12px;
}
.trayHead{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:10px;
  margin-bottom:10px;
}
.trayTitle{ font-weight: 900; letter-spacing:-0.01em; }
.trayMeta{ color: var(--muted); font-size: 12px; }
.trayList{ display:flex; flex-direction:column; gap:8px; }
.trayItem{
  display:grid;
  grid-template-columns: 1fr auto auto;
  align-items:center;
  gap:10px;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.18);
}
.trayItemName{ font-weight: 900; font-size: 12px; }
.trayItemMeta{ color: var(--muted); font-size: 12px; }

.warnBox{
  margin-top: 12px;
  border-radius: 16px;
  padding: 10px 12px;
  border: 1px solid rgba(255,77,90,0.25);
  background: rgba(255,77,90,0.08);
  color: rgba(255,255,255,0.90);
  font-weight: 700;
}

.row{ display:flex; align-items:center; gap:10px; }

.input{
  width: 100%;
  height: 38px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.22);
  color: rgba(255,255,255,0.90);
  outline:none;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.input:focus{
  border-color: rgba(53,214,255,0.55);
  box-shadow: 0 0 0 3px rgba(53,214,255,0.12);
}

/* Buttons */
.actions{ display:flex; gap:10px; margin-top: 12px; }
.btn{
  appearance:none;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(0,0,0,0.25);
  color: rgba(255,255,255,0.92);
  border-radius: 14px;
  padding: 10px 12px;
  font-weight: 900;
  cursor:pointer;
  transition: 160ms ease;
}
.btn:hover{ border-color: rgba(255,255,255,0.25); }
.btn.ghost{ background: rgba(255,255,255,0.06); }
.btn.danger{ border-color: rgba(255,77,90,0.35); color: rgba(255,255,255,0.95); }
.btn.small{ padding: 10px 12px; border-radius: 14px; }

.iconBtn{
  appearance:none;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.22);
  color: rgba(255,255,255,0.88);
  cursor:pointer;
}
.iconBtn:hover{ border-color: rgba(255,255,255,0.24); }

/* Decision */
.decisionWrap{ display:flex; flex-direction:column; gap: 14px; }
.goNoGoGrid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 980px){ .goNoGoGrid{ grid-template-columns: 1fr; } }

.goCard{
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.22);
  padding: 14px 14px;
  box-shadow: var(--shadow2);
}
.goCard.isGood{ border-color: rgba(41,215,138,0.35); }
.goCard.isBad{ border-color: rgba(255,77,90,0.35); }

.goHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom: 10px;
}
.goTitle{
  font-weight: 1000;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 12px;
  color: rgba(255,255,255,0.82);
}

.badge{
  display:inline-flex;
  align-items:center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.16);
  font-weight: 1000;
  letter-spacing: 0.04em;
  font-size: 11px;
}
.badge-good{ border-color: rgba(41,215,138,0.4); background: rgba(41,215,138,0.10); color: rgba(255,255,255,0.92); }
.badge-bad{ border-color: rgba(255,77,90,0.4); background: rgba(255,77,90,0.10); color: rgba(255,255,255,0.92); }
.badge-neutral{ border-color: rgba(53,214,255,0.35); background: rgba(53,214,255,0.08); color: rgba(255,255,255,0.92); }

.goBig{
  padding: 10px 10px;
  border-radius: 16px;
  background: rgba(0,0,0,0.22);
  border: 1px solid rgba(255,255,255,0.08);
}
.goBigLabel{
  font-weight: 900;
  color: rgba(255,255,255,0.74);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.goBigValue{
  margin-top: 6px;
  font-size: 26px;
  font-weight: 1000;
  letter-spacing:-0.02em;
  font-variant-numeric: tabular-nums;
}
.goBigSub{
  margin-top: 2px;
  color: rgba(255,255,255,0.70);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.goStats{
  margin-top: 10px;
  display:flex;
  flex-direction:column;
  gap: 8px;
}
.statRow{
  display:grid;
  grid-template-columns: 1fr auto;
  gap:10px;
  align-items:baseline;
}
.statLabel{ color: var(--muted); font-weight: 800; font-size: 12px; }
.statValue{ font-weight: 1000; font-variant-numeric: tabular-nums; }
.statSub{ grid-column: 1 / -1; color: var(--muted2); font-size: 12px; margin-top: 2px; }

.goHint{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
  font-size: 12px;
  color: rgba(255,255,255,0.86);
}
.accentOrange{ color: rgba(255,138,42,0.95); font-weight: 900; }

.fixWrap{
  margin-top: 14px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
  padding: 12px 12px;
}
.fixTitle{
  font-weight: 1000;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 11px;
  color: rgba(255,255,255,0.78);
  margin-bottom: 10px;
}
.fixGrid{ display:flex; flex-direction:column; gap:10px; }
.fixRow{
  display:grid;
  grid-template-columns: 110px 1fr 1fr;
  gap:10px;
  align-items:stretch;
}
@media (max-width: 520px){
  .fixRow{ grid-template-columns: 1fr; }
}

.fixRowHead{
  font-weight: 1000;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 11px;
  color: rgba(255,255,255,0.78);
  display:flex;
  align-items:center;
}
.fixCell{
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.22);
  padding: 10px 12px;
}
.fixLabel{
  color: var(--muted);
  font-weight: 800;
  font-size: 12px;
}
.fixValue{
  margin-top: 6px;
  font-weight: 1000;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

/* Transparency */
.grid3{
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}
@media (max-width: 800px){ .grid3{ grid-template-columns: 1fr; } }

.bigNum{
  font-size: 28px;
  font-weight: 1000;
  letter-spacing:-0.02em;
  font-variant-numeric: tabular-nums;
}

/* HUD bottom */
.hud{
  position:fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  padding: 12px 14px;
  background: rgba(5,7,10,0.88);
  border-top: 1px solid rgba(255,255,255,0.10);
  backdrop-filter: blur(6px);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 14px;
}
.hudTitle{
  font-weight: 1000;
  letter-spacing:-0.01em;
  font-size: 12px;
}
.hudMeta{
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}
.hudRight{
  display:flex;
  align-items:center;
  gap: 10px;
}
.hudBox{
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.22);
  padding: 10px 12px;
  min-width: 150px;
}
.hudBoxTitle{
  font-weight: 1000;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.72);
}
.hudBoxRow{
  display:flex;
  justify-content:space-between;
  gap:10px;
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255,255,255,0.84);
}
.hudBoxRow b{ font-variant-numeric: tabular-nums; }

/* Settings admin layout */
.settingsShell{
  display:grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
}
@media (max-width: 900px){
  .settingsShell{ grid-template-columns: 1fr; }
}
.settingsLeft{
  border-radius: var(--r2);
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  padding: 14px 14px;
}
.settingsTitle{
  font-weight: 1000;
  letter-spacing:-0.02em;
  font-size: 16px;
}
.settingsNav{
  margin-top: 12px;
  display:flex;
  flex-direction:column;
  gap: 8px;
}
.navBtn{
  appearance:none;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.22);
  color: rgba(255,255,255,0.90);
  border-radius: 14px;
  padding: 10px 12px;
  font-weight: 900;
  cursor:pointer;
  text-align:left;
}
.navBtn:hover{ border-color: rgba(255,255,255,0.22); }
.navBtn.isActive{
  border-color: rgba(53,214,255,0.55);
  box-shadow: 0 0 0 2px rgba(53,214,255,0.14) inset;
}
.settingsActions{
  margin-top: 12px;
  display:flex;
  flex-wrap:wrap;
  gap: 10px;
}
.settingsMeta{
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.settingsRight{ display:flex; flex-direction:column; gap: 16px; }

.formGrid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 900px){ .formGrid{ grid-template-columns: 1fr; } }
.field{ display:flex; flex-direction:column; gap: 8px; }
.field.span2{ grid-column: 1 / -1; }

.miniGrid{
  display:grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
@media (max-width: 1100px){ .miniGrid{ grid-template-columns: 1fr 1fr; } }
.mini{ display:flex; flex-direction:column; gap: 6px; }

.checkRow{
  display:flex;
  align-items:center;
  gap: 10px;
  margin-top: 10px;
  color: rgba(255,255,255,0.82);
  font-weight: 800;
}

/* tables */
.table{
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  overflow:hidden;
}
.tRow{
  display:grid;
  grid-template-columns: 1.2fr 0.7fr 0.7fr 0.7fr 54px;
  gap: 10px;
  padding: 10px 10px;
  align-items:center;
  background: rgba(0,0,0,0.18);
  border-top: 1px solid rgba(255,255,255,0.06);
}
.tHead{
  background: rgba(0,0,0,0.28);
  border-top: none;
  font-weight: 1000;
  color: rgba(255,255,255,0.78);
}
@media (max-width: 900px){
  .tRow{ grid-template-columns: 1fr; }
}

/* Pricing grids */
.gridPricing{
  display:flex;
  flex-direction:column;
  gap: 14px;
  margin-top: 12px;
}
.gridBlock{
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.18);
  padding: 12px 12px;
}
.gridBlockTitle{
  font-weight: 1000;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 11px;
  color: rgba(255,255,255,0.80);
  margin-bottom: 10px;
}
.gridRow{
  display:grid;
  grid-template-columns: 120px repeat(3, 1fr);
  gap: 10px;
  align-items:end;
  margin-top: 10px;
}
.gridRowLabel{
  font-weight: 1000;
  color: rgba(255,255,255,0.80);
  font-size: 12px;
}
.gridCell{ display:flex; flex-direction:column; gap: 6px; }
@media (max-width: 900px){
  .gridRow{ grid-template-columns: 1fr; }
  .gridRowLabel{ margin-top: 10px; }
}

/* helper editor */
.helperGroup{ margin-top: 14px; }
.helperGroupTitle{
  font-weight: 1000;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 11px;
  color: rgba(255,255,255,0.80);
  margin: 8px 0;
}
.helperRow{
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.18);
  padding: 10px 12px;
  margin-top: 10px;
}
.helperRowTitle{ font-weight: 1000; margin-bottom: 8px; }

/* Toast */
.toast{
  position:fixed;
  left: 50%;
  top: 86px;
  transform: translateX(-50%) translateY(-8px);
  z-index: 999;
  background: rgba(0,0,0,0.72);
  border: 1px solid rgba(255,255,255,0.14);
  padding: 10px 12px;
  border-radius: 14px;
  color: rgba(255,255,255,0.92);
  font-weight: 900;
  opacity:0;
  pointer-events:none;
  transition: 180ms ease;
}
.toast.show{
  opacity:1;
  transform: translateX(-50%) translateY(0);
}
