"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart, Bar } from "recharts";

// ── UNIT CONVERSION ───────────────────────────────────────────────────────────
// Density factors (bbl/mt) — used ONLY when $/mt symbol not available
// Naphtha: 9.088, Gasoline: 8.4 per user's Platts assessments
const DENSITY = { naphtha: 9.088, gasoline: 8.4, gasoil: 7.45, fo: 6.35 };

// Symbol → product type for fallback conversion
const SYM_PRODUCT = {
  AAPKA00:"naphtha",                     // MOPS strip $/bbl (AAPKB00 is now FO380 BalMo — do NOT use for naphtha)
  PAAAP00:"naphtha",                     // FOB Spore spot $/bbl (PAAAQ00/R00 are now Mo01/Mo02 fwd — not spot)
  AAPLD00:"naphtha",                     // FOB Spore Financial BalMo $/bbl
  PAAAQ00:"naphtha", PAAAR00:"naphtha",  // FOB Spore Financial Mo01/Mo02 $/bbl
  PGAEY00:"gasoline",PGAEZ00:"gasoline", // Gas92 spot $/bbl, $/mt
  AAXEK00:"gasoline",AAXEL00:"gasoline",AAXEM00:"gasoline", // Gas92 fwd BalMo/Mo01/Mo02 $/bbl
  AAOVC00:"gasoil",  AAOVC01:"gasoil",   // GO 10ppm $/bbl, $/mt
  AACUE00:"gasoil",  AACUE01:"gasoil",   // GO 0.25% $/bbl, $/mt
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt   = (v, d=2) => v === null || v === undefined || isNaN(v) ? "—" : Number(v).toFixed(d);
const pct   = (val, arr) => { if (!arr.length || val === null) return null; const s = [...arr].sort((a,b)=>a-b); return Math.round(s.filter(v=>v<=val).length/s.length*100); };
const minOf = arr => arr.length ? Math.min(...arr) : null;
const maxOf = arr => arr.length ? Math.max(...arr) : null;
const fmtK  = d => d?.slice(5) || "";

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const hdr = lines[0].split(",");
  return lines.slice(1).map(l => { const c = l.split(","); const r = {}; hdr.forEach((h,i) => r[h.trim()] = c[i]?.trim()); return r; });
}

// Build time series AND capture units per symbol from CSV metadata.
// Forward-fills each symbol's last known value so dates that only have a
// subset of symbols (e.g. the latest export date) still show full data.
function buildTS(rows) {
  const byDate = {};
  const units  = {};  // sym → "USD/mt" | "USD/bbl"
  const lastVal = {}; // sym → most recent value seen (for forward-fill)

  for (const r of rows) {
    const sym  = r["Symbol Code"], date = r["TimeStamp"];
    const val  = parseFloat(r["Value/mt"] || "") || parseFloat(r["Value"] || "");
    if (!sym || sym === "Symbol Code" || !date || date === "TimeStamp" || isNaN(val)) continue;
    if (!byDate[date]) byDate[date] = { date };
    byDate[date][sym] = val;
    lastVal[sym] = val;
    if (!units[sym]) units[sym] = r["Currency/UOM"]?.trim() || "";
  }

  // Sort chronologically, then forward-fill any gaps
  const sorted = Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date));
  const carry = {};
  for (const row of sorted) {
    // bring in any symbol we've seen before that's missing from this row
    for (const sym of Object.keys(lastVal)) {
      if (row[sym] === undefined && carry[sym] !== undefined) {
        row[sym] = carry[sym];
      }
    }
    // update carry with this row's values
    for (const sym of Object.keys(row)) {
      if (sym !== "date") carry[sym] = row[sym];
    }
  }

  return { ts: sorted, units };
}

// Convert a raw value to $/mt. If already $/mt → return as-is.
// If $/bbl → multiply by density factor. Returns {value, wasConverted, factor}
function toMT(raw, sym, units) {
  if (raw === null || raw === undefined) return { value: null, wasConverted: false, factor: null };
  const uom = units[sym] || "";
  if (uom === "USD/mt" || uom.includes("/mt")) return { value: raw, wasConverted: false, factor: null };
  // It's $/bbl — convert using density
  const product = SYM_PRODUCT[sym] || "naphtha";
  const factor = DENSITY[product];
  return { value: raw * factor, wasConverted: true, factor };
}

// Helper: get value in $/mt for a symbol on a given row, or null
function getMT(row, sym, units) {
  const raw = row[sym] ?? null;
  return toMT(raw, sym, units).value;
}

// ── PERCENTILE BADGE ─────────────────────────────────────────────────────────
function PBadge({ v, size="sm" }) {
  if (v === null || v === undefined) return null;
  const c = v >= 80 ? "#00e5a0" : v >= 60 ? "#7eb8d4" : v >= 40 ? "#ffd166" : v >= 20 ? "#ff9f43" : "#ff4757";
  const fs = size === "lg" ? 13 : 10;
  return <span style={{background:c+"1a",color:c,border:`1px solid ${c}44`,borderRadius:4,padding:size==="lg"?"4px 10px":"2px 6px",fontSize:fs,fontWeight:700,letterSpacing:.5,fontFamily:"monospace"}}>{v}p</span>;
}

// ── SIGNAL CHIP ───────────────────────────────────────────────────────────────
function Signal({ text, type }) {
  const colors = { bullish:"#00e5a0", bearish:"#ff4757", neutral:"#ffd166", info:"#7eb8d4" };
  const c = colors[type] || colors.info;
  return <div style={{background:c+"15",border:`1px solid ${c}33`,borderRadius:6,padding:"7px 12px",fontSize:11,color:c,lineHeight:1.5}}>{text}</div>;
}

// ── MINI SPARKLINE ────────────────────────────────────────────────────────────
function Spark({ data, color="#7eb8d4", height=36 }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{top:2,right:0,left:0,bottom:0}}>
        <defs><linearGradient id={`sg${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={.35}/><stop offset="100%" stopColor={color} stopOpacity={0}/>
        </linearGradient></defs>
        <ReferenceLine y={0} stroke="#1e3448" strokeDasharray="2 2"/>
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#sg${color.replace("#","")})`} strokeWidth={1.5} dot={false}/>
        <YAxis hide domain={["auto","auto"]}/><XAxis hide/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── ARB CARD ─────────────────────────────────────────────────────────────────
function ArbCard({ title, route, gross, freight, misc=3, hedgeRoll=0, history, onSelect, selected }) {
  const net   = gross !== null ? gross - freight - misc - hedgeRoll : null;
  const netH  = history.map(h => h.v !== null ? h.v - freight - misc : null).filter(v=>v!==null);
  const netPct = pct(net, netH);
  const status = net === null ? "NO DATA" : net > 8 ? "OPEN" : net > -5 ? "MARGINAL" : "CLOSED";
  const sc = { OPEN:"#00e5a0", MARGINAL:"#ffd166", CLOSED:"#ff4757", "NO DATA":"#445566" }[status];

  return (
    <div onClick={onSelect} style={{background: selected?"#0f2235":"#0a1825",border:`1px solid ${selected?sc+"99":sc+"33"}`,borderRadius:10,padding:"16px 18px",flex:1,minWidth:190,cursor:"pointer",transition:"all .2s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{color:"#4a6680",fontSize:9,letterSpacing:2,marginBottom:2,fontFamily:"monospace"}}>{route}</div>
          <div style={{color:"#c8d8e8",fontSize:12,fontWeight:600}}>{title}</div>
        </div>
        <div style={{background:sc+"22",color:sc,border:`1px solid ${sc}55`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:1.5}}>{status}</div>
      </div>
      <div style={{display:"flex",gap:16,marginBottom:8,flexWrap:"wrap"}}>
        <div><div style={{color:"#445566",fontSize:9,letterSpacing:1,marginBottom:2}}>GROSS</div>
          <div style={{color:"#c8d8e8",fontFamily:"monospace",fontSize:18,fontWeight:700}}>{fmt(gross)}</div></div>
        <div><div style={{color:"#445566",fontSize:9,letterSpacing:1,marginBottom:2}}>NET ARB</div>
          <div style={{color:sc,fontFamily:"monospace",fontSize:18,fontWeight:700}}>{fmt(net)}</div></div>
        {hedgeRoll !== 0 && <div><div style={{color:"#445566",fontSize:9,letterSpacing:1,marginBottom:2}}>ROLL COST</div>
          <div style={{color:hedgeRoll>0?"#ff9f43":"#00e5a0",fontFamily:"monospace",fontSize:18,fontWeight:700}}>{hedgeRoll>0?"-":"+"}{ fmt(Math.abs(hedgeRoll))}</div></div>}
        <div style={{marginLeft:"auto",paddingTop:4}}>{netPct!==null && <PBadge v={netPct} size="lg"/>}</div>
      </div>
      <Spark data={history.slice(-90)} color={sc}/>
    </div>
  );
}

// ── SPREAD ROW ────────────────────────────────────────────────────────────────
function SpreadRow({ label, sublabel, value, history, unit="$/mt", change, onSelect, selected }) {
  const p = pct(value, history);
  const mn = minOf(history), mx = maxOf(history);
  const barW = mn!==null && mx!==null && mn!==mx ? Math.max(2,Math.min(100,((value-mn)/(mx-mn))*100)) : 50;
  const cc = change > 0 ? "#00e5a0" : change < 0 ? "#ff4757" : "#445566";
  const rc = p >= 80 ? "#00e5a0" : p >= 60 ? "#7eb8d4" : p >= 40 ? "#ffd166" : p >= 20 ? "#ff9f43" : "#ff4757";
  return (
    <tr onClick={onSelect} style={{borderBottom:"1px solid #0d1e2d",cursor:"pointer",background:selected?"#0d2035":"transparent",transition:"background .15s"}}>
      <td style={{padding:"9px 12px"}}>
        <div style={{color:"#c8d8e8",fontSize:12}}>{label}</div>
        {sublabel && <div style={{color:"#334d63",fontSize:9,letterSpacing:.5,marginTop:1}}>{sublabel}</div>}
      </td>
      <td style={{padding:"9px 12px",textAlign:"right",fontFamily:"monospace",color:"#e4f0fa",fontSize:13,fontWeight:700}}>{fmt(value)}</td>
      <td style={{padding:"9px 8px",textAlign:"right",fontFamily:"monospace",color:cc,fontSize:11}}>{change!==null?`${change>0?"+":""}${fmt(change)}`:""}</td>
      <td style={{padding:"9px 8px",textAlign:"right"}}><PBadge v={p}/></td>
      <td style={{padding:"9px 16px 9px 8px",width:110}}>
        <div style={{background:"#081520",borderRadius:3,height:5,overflow:"hidden"}}>
          <div style={{width:`${barW}%`,height:"100%",background:rc,borderRadius:3,transition:"width .3s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#223344",marginTop:2}}>
          <span>{fmt(mn,0)}</span><span>{fmt(mx,0)}</span>
        </div>
      </td>
      <td style={{padding:"9px 12px",color:"#334d63",fontSize:9}}>{unit}</td>
    </tr>
  );
}

// ── SECTION HEADER ────────────────────────────────────────────────────────────
function SectionHeader({ label, icon }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0 6px",marginBottom:4}}>
      <span style={{fontSize:14}}>{icon}</span>
      <span style={{color:"#4a6680",fontSize:9,letterSpacing:3,fontWeight:700}}>{label}</span>
      <div style={{flex:1,height:1,background:"#0d1e2d",marginLeft:4}}/>
    </div>
  );
}

// ── PRICE TILE ────────────────────────────────────────────────────────────────
function PriceTile({ label, value, prev, unit, pctile }) {
  const chg = value !== null && prev !== null ? value - prev : null;
  const cc = chg > 0 ? "#00e5a0" : chg < 0 ? "#ff4757" : "#445566";
  return (
    <div style={{background:"#060f18",borderRadius:7,padding:"10px 12px",border:"1px solid #0d1e2d"}}>
      <div style={{color:"#334d63",fontSize:9,letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{color:"#e4f0fa",fontFamily:"monospace",fontSize:14,fontWeight:700,marginBottom:2}}>{fmt(value,2)}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        {chg!==null && <span style={{color:cc,fontSize:9,fontFamily:"monospace"}}>{chg>0?"▲":"▼"}{Math.abs(chg).toFixed(2)}</span>}
        <span style={{color:"#223344",fontSize:9}}>{unit}</span>
        {pctile!==null && <PBadge v={pctile}/>}
      </div>
    </div>
  );
}

// ── CREDENTIALS MODAL ────────────────────────────────────────────────────────
function CredentialsModal({ onClose }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [hint, setHint]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const [status, setStatus]     = useState(null); // null | "ok" | "err"

  // Load current (masked) settings on open
  useEffect(() => {
    fetch("/api/platts-settings").then(r=>r.json()).then(d=>{
      if (d.email) setEmail(d.email);
      if (d.passwordHint) setHint(d.passwordHint);
    }).catch(()=>{});
  }, []);

  const handleSave = async () => {
    if (!email || !password) { setStatus("err"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/platts-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (d.ok) { setStatus("ok"); setTimeout(onClose, 800); }
      else setStatus("err");
    } catch { setStatus("err"); }
    setSaving(false);
  };

  const INP = { background:"#040d14",border:"1px solid #0d2035",borderRadius:6,color:"#c8d8e8",fontFamily:"monospace",fontSize:12,padding:"9px 12px",width:"100%",outline:"none",boxSizing:"border-box" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#071525",border:"1px solid #0d2035",borderRadius:14,padding:"28px 32px",width:400,maxWidth:"90vw"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{color:"#daeaf8",fontSize:14,fontWeight:700,letterSpacing:1}}>PLATTS CONNECT CREDENTIALS</div>
            <div style={{color:"#334d63",fontSize:9,letterSpacing:.5,marginTop:3}}>S&P Global Commodity Insights — same login as platts.com/connect</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#334d63",fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{color:"#334d63",fontSize:9,letterSpacing:1,marginBottom:5}}>EMAIL</div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={INP} autoFocus/>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{color:"#334d63",fontSize:9,letterSpacing:1,marginBottom:5}}>
            PASSWORD {hint && <span style={{color:"#1e3a52"}}>— current: {hint}</span>}
          </div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="enter new password to update" style={INP}/>
        </div>

        <div style={{background:"#040e18",border:"1px solid #0a1a28",borderRadius:6,padding:"10px 14px",marginBottom:20,fontSize:9,color:"#334d63",lineHeight:1.8}}>
          Credentials are stored only on this machine in <code style={{color:"#5a7a96"}}>data/platts-settings.json</code> — never sent anywhere except directly to the S&P Global API.
        </div>

        {status==="ok"  && <div style={{color:"#00e5a0",fontSize:10,marginBottom:12,letterSpacing:.5}}>✓ Credentials saved successfully</div>}
        {status==="err" && <div style={{color:"#ff4757",fontSize:10,marginBottom:12}}>Fill in both email and password</div>}

        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"transparent",border:"1px solid #0d2035",borderRadius:6,padding:"8px 18px",color:"#334d63",fontSize:10,cursor:"pointer",fontFamily:"monospace",letterSpacing:1}}>CANCEL</button>
          <button onClick={handleSave} disabled={saving} style={{background:"#062a1a",border:"1px solid #00e5a044",borderRadius:6,padding:"8px 22px",color:"#00e5a0",fontSize:10,cursor:"pointer",fontFamily:"monospace",letterSpacing:1,fontWeight:700}}>
            {saving?"SAVING…":"SAVE"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [ts, setTs] = useState([]);
  const [symUnits, setSymUnits] = useState({});
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [showCreds, setShowCreds] = useState(false);
  const [freight, setFreight] = useState({ nj:78, ns:32, fo80:22 });
  const [misc, setMisc] = useState({ naph:4, fo:3 });
  const [hedgeRoll, setHedgeRoll] = useState(0);   // MOPJ BalMo−Mo01 roll benefit (+ = backwardation = earn)
  const [chartKey, setChartKey] = useState("naph_jp_ag");
  const [chartDays, setChartDays] = useState(252);
  const [tab, setTab] = useState("arb");

  // Live sync from S&P Global API — builds a single-row TS from the latest values
  const handleLiveSync = useCallback(async () => {
    setLoading(true);
    setSyncError(null);
    try {
      const res  = await fetch("/api/platts-prices");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Unknown API error");

      // Build a single-row time series from the live snapshot
      const row = { date: data.latestDate, ...data.prices };
      // Merge with existing historical ts: replace or append the latest date row
      setTs(prev => {
        const without = prev.filter(r => r.date !== data.latestDate);
        const merged  = [...without, row].sort((a,b)=>a.date.localeCompare(b.date));
        return merged;
      });
      setSymUnits(data.units || {});

      // Auto-populate hedge roll from BalMo − Mo01
      const balmo = data.prices["RAXFM00"], mo01 = data.prices["AAXFE00"];
      if (balmo != null && mo01 != null) setHedgeRoll(Math.round((balmo - mo01) * 100) / 100);
    } catch (e) {
      setSyncError(e.message);
    }
    setLoading(false);
  }, []);

  const handleFile = useCallback(file => {
    if (!file) return;
    setLoading(true);
    const r = new FileReader();
    r.onload = e => {
      const { ts: newTs, units: newUnits } = buildTS(parseCSV(e.target.result));
      setTs(newTs);
      setSymUnits(newUnits);
      // Auto-populate hedge roll from latest BalMo − Mo01
      const rows = Object.values(newTs.reduce((acc, row) => { acc[row.date] = row; return acc; }, {}));
      const latest = [...rows].sort((a,b)=>a.date.localeCompare(b.date)).pop();
      if (latest && latest["RAXFM00"] != null && latest["AAXFE00"] != null) {
        setHedgeRoll(Math.round((latest["RAXFM00"] - latest["AAXFE00"]) * 100) / 100);
      }
      setLoading(false);
    };
    r.readAsText(file);
  }, []);

  // Which symbols are being auto-converted from $/bbl → $/mt
  const convertedSyms = useMemo(() => Object.entries(symUnits)
    .filter(([,u]) => u === "USD/bbl")
    .map(([sym]) => sym), [symUnits]);

  // ── COMPUTED SPREADS ───────────────────────────────────────────────────────
  const spreads = useMemo(() => ts.map(row => {
    const g = (sym) => getMT(row, sym, symUnits);

    // Prefer $/mt symbols; fall back to $/bbl symbols with auto-conversion
    const nAG   = g("PAAAA00");                          // FOB AG — always $/mt
    const nJP   = g("PAAAD00");                          // C+F Japan — always $/mt
    const nSP   = g("PAAAP00");                          // FOB Spore SPOT only — PAAAQ00/R00 are now fwd months
    const nMOPS = g("AAPKA00");                          // MOPS Strip $/bbl ×9.088 — no native $/mt in file
    const g92   = g("PGAEZ00") ?? g("PGAEY00");          // Gasoline 92 — prefer $/mt symbol
    const go10  = g("AAOVC01") ?? g("AAOVC00");          // Gasoil 10ppm — prefer $/mt symbol
    const go25  = g("AACUE01") ?? g("AACUE00");          // Gasoil 0.25% — prefer $/mt symbol
    const f180S = g("PUADV00");                          // FO180 Spore — always $/mt
    const f380S = g("PPXDK00");                          // FO380 Spore — always $/mt
    const f180A = g("PUABE00");                          // FO180 AG — always $/mt
    const f380A = g("AAIDC00");                          // FO380 AG — always $/mt
    const vlsfo = g("AMFSA00");                          // VLSFO — always $/mt
    const vSprd = g("PPXDM00");                          // FO180/380 spread AG
    const balmo = g("RAXFM00");                          // MOPJ BalMo — always $/mt
    const mo01  = g("AAXFE00");                          // MOPJ Mo01 — always $/mt
    const mo02  = g("AAXFF00");                          // MOPJ Mo02 — always $/mt
    // Naphtha AG financial forward curve
    const nagfm0 = g("NAGFM00");                         // AG Naph Financial BalMo $/mt
    const nagfm1 = g("NAGFM01");                         // AG Naph Financial Mo01 $/mt
    const nagfm2 = g("NAGFM02");                         // AG Naph Financial Mo02 $/mt
    // FO380 Spore forward curve (AAPKB00 is FO380 BalMo — NOT naphtha)
    const fo380_0 = g("AAPKB00");                        // FO380 Spore Financial BalMo $/mt
    const fo380_1 = g("AAPKC00");                        // FO380 Spore Financial Mo01 $/mt
    const fo380_2 = g("AAPKD00");                        // FO380 Spore Financial Mo02 $/mt
    // FO180 Spore forward curve
    const fo180_0 = g("AAPML00");                        // FO180 Spore Financial BalMo $/mt
    const fo180_1 = g("PUAXZ00");                        // FO180 Spore Financial Mo01 $/mt
    const fo180_2 = g("PUAYF00");                        // FO180 Spore Financial Mo02 $/mt
    // Gas92 forward curve ($/bbl → $/mt ×8.4)
    const gas0 = g("AAXEK00");                           // Gas92 Financial BalMo $/mt (auto-conv)
    const gas1 = g("AAXEL00");                           // Gas92 Financial Mo01 $/mt (auto-conv)
    const gas2 = g("AAXEM00");                           // Gas92 Financial Mo02 $/mt (auto-conv)

    return {
      date: row.date,
      // ── ARB GROSS ──────────────────────────────────
      naph_jp_ag:    nJP && nAG ? nJP - nAG : null,
      naph_sp_ag:    nSP && nAG ? nSP - nAG : null,
      fo180_sp_ag:   f180S && f180A ? f180S - f180A : null,
      fo380_sp_ag:   f380S && f380A ? f380S - f380A : null,
      // ── BLENDING & CRACK ────────────────────────────
      gas_naph_mops: g92 && nMOPS ? g92 - nMOPS : null,
      gas_naph_ag:   g92 && nAG   ? g92 - nAG   : null,
      naph_jp_mops:  nJP && nMOPS ? nJP - nMOPS : null,
      naph_mops_ag:  nMOPS && nAG ? nMOPS - nAG : null,
      // ── INTER-PRODUCT ────────────────────────────────
      light_dark:    g92 && f380S ? g92 - f380S : null,
      go_fo:         go10 && f380S ? go10 - f380S : null,
      go_sulfur:     go10 && go25 ? go10 - go25 : null,
      fo_visc_sp:    f180S && f380S ? f180S - f380S : null,
      fo_visc_ag:    vSprd,
      vlsfo_fo180:   vlsfo && f180S ? vlsfo - f180S : null,
      vlsfo_fo380:   vlsfo && f380S ? vlsfo - f380S : null,
      // ── MOPJ CURVE ──────────────────────────────────
      balmo_roll:    balmo && mo01 ? balmo - mo01 : null,  // positive = backwardation = cost
      // ── NAPHTHA ARB STRIP (financial) ────────────────
      arb_balmo:     balmo && nagfm0 ? balmo - nagfm0 : null,  // MOPJ BalMo − AG BalMo gross
      arb_mo01:      mo01  && nagfm1 ? mo01  - nagfm1 : null,  // MOPJ Mo01 − AG Mo01 gross
      arb_mo02:      mo02  && nagfm2 ? mo02  - nagfm2 : null,  // MOPJ Mo02 − AG Mo02 gross
      // ── FO CURVE STRUCTURE ───────────────────────────
      fo380_m0m1:    fo380_0 && fo380_1 ? fo380_0 - fo380_1 : null,
      fo380_m1m2:    fo380_1 && fo380_2 ? fo380_1 - fo380_2 : null,
      fo180_m0m1:    fo180_0 && fo180_1 ? fo180_0 - fo180_1 : null,
      fo180_m1m2:    fo180_1 && fo180_2 ? fo180_1 - fo180_2 : null,
      // ── RAW ─────────────────────────────────────────
      _nAG:nAG, _nJP:nJP, _nSP:nSP, _nMOPS:nMOPS, _g92:g92,
      _go10:go10, _go25:go25, _f180S:f180S, _f380S:f380S,
      _f180A:f180A, _f380A:f380A, _vlsfo:vlsfo, _balmo:balmo, _mo01:mo01,
      // forward raw
      _nagfm0:nagfm0, _nagfm1:nagfm1, _nagfm2:nagfm2,
      _mo02:mo02,
      _fo380_0:fo380_0, _fo380_1:fo380_1, _fo380_2:fo380_2,
      _fo180_0:fo180_0, _fo180_1:fo180_1, _fo180_2:fo180_2,
      _gas0:gas0, _gas1:gas1, _gas2:gas2,
    };
  }), [ts]);

  const L  = spreads[spreads.length-1] ?? {};
  const L1 = spreads[spreads.length-2] ?? {};
  const allV = k => spreads.map(s=>s[k]).filter(v=>v!==null && !isNaN(v));
  const chg  = k => L[k]!==null && L1[k]!==null ? L[k]-L1[k] : null;
  const hist = (k,n=9999) => spreads.slice(-n).map(s=>({date:fmtK(s.date),v:s[k]}));

  const chartData = spreads.slice(-chartDays).map(s=>({date:s.date?.slice(5),v:s[chartKey]}));
  const chartVals = allV(chartKey);
  const chartPct  = pct(L[chartKey], chartVals);

  // ── SIGNAL GENERATOR ──────────────────────────────────────────────────────
  const signals = useMemo(() => {
    const out = [];
    const p = k => pct(L[k], allV(k));
    if (p("naph_jp_ag") >= 80) out.push({ text:`Naph AG→Japan arb at ${p("naph_jp_ag")}p — historically very open. Execute physical cargoes or buy the spread financially.`, type:"bullish" });
    if (p("naph_jp_mops") >= 85) out.push({ text:`Japan paying ${p("naph_jp_mops")}p premium over MOPS — direct cargoes to Japan over Singapore.`, type:"bullish" });
    if (p("gas_naph_mops") >= 75) out.push({ text:`Blending spread Gas92/Naph MOPS at ${p("gas_naph_mops")}p — naphtha feedstock for blending into gasoline is highly rewarded. Favour gasoline-bound cargoes.`, type:"bullish" });
    if (p("go_fo") >= 85) out.push({ text:`Gasoil vs FO380 spread at ${p("go_fo")}p — clean products at near-record premium. Strong signal to move clean product flows vs dirty.`, type:"bullish" });
    if (p("naph_mops_ag") <= 20) out.push({ text:`MOPS Spore at only ${p("naph_mops_ag")}p vs AG — Singapore is unusually cheap vs origin. Watch for arb flow normalization or Singapore-bound cargo opportunity.`, type:"bearish" });
    if (p("vlsfo_fo380") !== null && p("vlsfo_fo380") >= 75) out.push({ text:`VLSFO premium at ${p("vlsfo_fo380")}p — scrubber spread compression. Fuel oil blending toward 0.5% sulfur specs favoured.`, type:"info" });
    if (p("fo_visc_sp") !== null && Math.abs(p("fo_visc_sp")-50) < 15) out.push({ text:`FO viscosity spread (180 vs 380 Spore) at ${p("fo_visc_sp")}p — near neutral. No strong directional blending call.`, type:"neutral" });
    if (p("naph_jp_ag") <= 20) out.push({ text:`Japan arb at ${p("naph_jp_ag")}p — arb effectively closed. Hold off on AG→Japan nominations.`, type:"bearish" });
    const rollP = p("balmo_roll");
    if (rollP !== null && rollP >= 85) out.push({ text:`MOPJ backwardation at ${rollP}p — BalMo/Mo01 roll cost at historically extreme level. Steep cost to roll hedge forward. Consider pricing cargo off BalMo or negotiating pricing period carefully.`, type:"bearish" });
    if (rollP !== null && rollP <= 15) out.push({ text:`MOPJ near contango (roll at ${rollP}p) — rolling hedge forward is cheap or earns. Favourable for long physical AG→Japan positions.`, type:"bullish" });
    if (!out.length) out.push({ text:"No extreme signals currently. Spreads broadly within historical norms.", type:"neutral" });
    return out;
  }, [spreads]);

  const CHART_OPTS = [
    { k:"naph_jp_ag",    l:"Naphtha AG→Japan Gross Spread" },
    { k:"naph_sp_ag",    l:"Naphtha AG→Spore Gross Spread" },
    { k:"fo180_sp_ag",   l:"FO 180 AG→Spore Gross Spread" },
    { k:"fo380_sp_ag",   l:"FO 380 AG→Spore Gross Spread" },
    { k:"gas_naph_mops", l:"Gas92 vs Naphtha MOPS (Blending)" },
    { k:"gas_naph_ag",   l:"Gas92 vs Naphtha AG (Reforming)" },
    { k:"naph_jp_mops",  l:"Naphtha Japan vs MOPS (East Asia Pull)" },
    { k:"naph_mops_ag",  l:"Naphtha MOPS vs AG (Location)" },
    { k:"light_dark",    l:"Light-Dark Spread (Gas92 vs FO380)" },
    { k:"go_fo",         l:"Clean-Dirty Spread (Gasoil vs FO380)" },
    { k:"go_sulfur",     l:"Gasoil Sulfur Premium (10ppm vs 0.25%)" },
    { k:"fo_visc_sp",    l:"FO Viscosity Spread (180 vs 380 Spore)" },
    { k:"vlsfo_fo380",   l:"VLSFO vs FO380 Premium" },
    { k:"balmo_roll",    l:"MOPJ Backwardation — BalMo vs Mo01 Roll" },
    { k:"arb_balmo",     l:"Naph AG→Japan Arb — BalMo (Financial)" },
    { k:"arb_mo01",      l:"Naph AG→Japan Arb — Mo01 (Financial)" },
    { k:"arb_mo02",      l:"Naph AG→Japan Arb — Mo02 (Financial)" },
    { k:"fo380_m0m1",    l:"FO380 Spore Backwardation — BalMo vs Mo01" },
    { k:"fo180_m0m1",    l:"FO180 Spore Backwardation — BalMo vs Mo01" },
  ];

  const TABS = ["arb","curve","spreads","signals","prices"];
  const tabLabel = { arb:"ARB STATUS", curve:"FORWARD CURVE", spreads:"SPREAD MONITOR", signals:"SIGNALS", prices:"PRICES" };

  const INPS = { background:"#050e16",border:"1px solid #0d1e2d",borderRadius:5,color:"#c8d8e8",fontFamily:"monospace",fontSize:11,padding:"5px 8px",width:60,textAlign:"right" };

  return (
    <div style={{background:"#060f18",minHeight:"100vh",color:"#c8d8e8",fontFamily:"'IBM Plex Mono','Courier New',monospace",paddingBottom:40}}>
      {showCreds && <CredentialsModal onClose={()=>setShowCreds(false)}/>}

      {/* ── HEADER ── */}
      <div style={{background:"#04090f",borderBottom:"1px solid #0a1a28",padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:ts.length?"#00e5a0":"#223344",boxShadow:ts.length?"0 0 8px #00e5a0":""}}/>
          <span style={{color:"#daeaf8",fontWeight:700,fontSize:14,letterSpacing:1.5}}>REFINED PRODUCTS DESK</span>
          <span style={{color:"#1a3048"}}>|</span>
          <span style={{color:"#334d63",fontSize:10,letterSpacing:3}}>ME · EAST ASIA</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {ts.length>0 && <span style={{color:"#223344",fontSize:9,letterSpacing:.5}}>{ts[0].date} → {ts[ts.length-1].date} · {ts.length} sessions</span>}
          {syncError && (
            <span style={{color:"#ff9f43",fontSize:8,maxWidth:260,fontFamily:"monospace",cursor:"pointer"}} title={syncError} onClick={()=>setSyncError(null)}>
              ⚠ API: {syncError.length>60?syncError.slice(0,57)+"…":syncError}
            </span>
          )}
          {/* Credentials settings */}
          <button onClick={()=>setShowCreds(true)}
            style={{background:"transparent",border:"1px solid #0d2035",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:11,color:"#334d63",letterSpacing:0,fontFamily:"monospace"}}
            title="Platts Connect credentials">⚙</button>
          {/* Live API sync button */}
          <button
            onClick={()=>{ setSyncError(null); handleLiveSync(); }}
            disabled={loading}
            style={{background:"#061a0e",border:"1px solid #00e5a044",borderRadius:6,padding:"6px 14px",cursor:loading?"wait":"pointer",fontSize:10,color:"#00e5a0",letterSpacing:1,fontFamily:"monospace",opacity:loading?.6:1}}>
            {loading?"SYNCING…":"⚡ SYNC LIVE"}
          </button>
          {/* CSV fallback */}
          <label style={{background:"#0a1825",border:"1px solid #0d2035",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:10,color:"#7eb8d4",letterSpacing:1,fontFamily:"monospace"}}>
            {loading?"LOADING…":"↑ CSV"}
            <input type="file" accept=".csv,.CSV" style={{display:"none"}} onChange={e=>{handleFile(e.target.files[0]);e.target.value="";} }/>
          </label>
        </div>
      </div>

      {/* ── UPLOAD ZONE ── */}
      {!ts.length ? (
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"75vh"}}>
          <div style={{textAlign:"center",maxWidth:500}}>
            {/* Live API option */}
            <button onClick={()=>{ setSyncError(null); handleLiveSync(); }} disabled={loading}
              style={{display:"block",width:"100%",background:"#061a0e",border:"2px solid #00e5a044",borderRadius:12,padding:"28px 40px",marginBottom:16,cursor:loading?"wait":"pointer",transition:"all .2s"}}>
              <div style={{fontSize:28,marginBottom:10}}>⚡</div>
              <div style={{color:"#00e5a0",fontSize:16,fontWeight:700,letterSpacing:1,marginBottom:6}}>{loading?"SYNCING FROM PLATTS…":"SYNC LIVE FROM PLATTS"}</div>
              <div style={{color:"#334d63",fontSize:10,lineHeight:1.8}}>Uses your Platts Connect credentials to pull today's prices automatically</div>
              <div style={{color:"#1e3a52",fontSize:9,marginTop:6}}>
                First time? <span style={{color:"#5a7a96",textDecoration:"underline",cursor:"pointer"}} onClick={e=>{e.stopPropagation();setShowCreds(true);}}>⚙ Enter credentials</span>
              </div>
            </button>
            {syncError && <div style={{color:"#ff9f43",fontSize:10,marginBottom:12,fontFamily:"monospace",padding:"8px 12px",background:"#1a0f00",borderRadius:6,border:"1px solid #ff9f4344"}}>⚠ {syncError}</div>}
            {/* Divider */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{flex:1,height:1,background:"#0d2035"}}/>
              <span style={{color:"#1e3a52",fontSize:9,letterSpacing:2}}>OR UPLOAD CSV</span>
              <div style={{flex:1,height:1,background:"#0d2035"}}/>
            </div>
            {/* CSV drop zone */}
            <div onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0])}} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)}
              style={{border:`2px dashed ${dragging?"#00e5a0":"#0d2035"}`,borderRadius:12,padding:"28px 40px",textAlign:"center",background:dragging?"#00e5a008":"transparent",transition:"all .2s"}}>
              <div style={{fontSize:24,marginBottom:10}}>⬆</div>
              <div style={{color:"#7eb8d4",fontSize:13,marginBottom:6}}>Drop your Platts Static CSV here</div>
              <div style={{color:"#1e3a52",fontSize:9,lineHeight:2}}>PAAAA00 · PAAAD00 · PAAAP00 · RAXFM00 · AAXFE00 + all other symbols</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{padding:"16px 24px"}}>

          {/* ── VOYAGE + HEDGING COSTS ── */}
          <div style={{background:"#081420",border:"1px solid #0a1a28",borderRadius:9,padding:"12px 18px",marginBottom:16,display:"flex",gap:24,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{color:"#334d63",fontSize:9,letterSpacing:2}}>VOYAGE COSTS $/mt</span>
            {[{k:"nj",l:"Naph AG→Japan (55kt)"},{k:"ns",l:"Naph AG→Spore (30kt)"},{k:"fo80",l:"FO AG→Spore (80kt)"}].map(({k,l})=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:"#5a7a96",fontSize:9}}>{l}</span>
                <input style={INPS} type="number" value={freight[k]} onChange={e=>setFreight(f=>({...f,[k]:+e.target.value}))}/>
              </div>
            ))}
            <div style={{borderLeft:"1px solid #0a1a28",paddingLeft:20,display:"flex",gap:14}}>
              {[{k:"naph",l:"Misc Naph"},{k:"fo",l:"Misc FO"}].map(({k,l})=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:"#5a7a96",fontSize:9}}>{l}</span>
                  <input style={INPS} type="number" value={misc[k]} onChange={e=>setMisc(m=>({...m,[k]:+e.target.value}))}/>
                </div>
              ))}
            </div>
            <div style={{borderLeft:"1px solid #0a1a28",paddingLeft:20,display:"flex",alignItems:"center",gap:10}}>
              <span style={{color:"#7eb8d4",fontSize:9,letterSpacing:2}}>HEDGING $/mt</span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div>
                  <span style={{color:"#5a7a96",fontSize:9}}>MOPJ Roll (BalMo−Mo01)</span>
                  {L._balmo != null && L._mo01 != null &&
                    <span style={{color:"#1e4a30",fontSize:8,marginLeft:6,fontFamily:"monospace"}}>
                      live: {L._balmo?.toFixed(0)}−{L._mo01?.toFixed(0)}
                    </span>}
                </div>
                <input style={{...INPS, borderColor: hedgeRoll > 0 ? "#00e5a044" : hedgeRoll < 0 ? "#ff475744" : "#0d1e2d"}}
                  type="number" value={hedgeRoll} onChange={e=>setHedgeRoll(+e.target.value)}/>
                <span style={{color:hedgeRoll>0?"#ff9f43":hedgeRoll<0?"#00e5a0":"#334d63",fontSize:8,fontFamily:"monospace",minWidth:60}}>
                  {hedgeRoll>0?"▼ cost/mt":hedgeRoll<0?"▲ earn/mt":"neutral"}
                </span>
              </div>
            </div>
          </div>

          {/* ── UNIT WARNING BANNER ── */}
          {convertedSyms.length > 0 && (
            <div style={{background:"#1a1200",border:"1px solid #ffd16633",borderRadius:8,padding:"9px 16px",marginBottom:14,display:"flex",alignItems:"flex-start",gap:10}}>
              <span style={{color:"#ffd166",fontSize:13,marginTop:1}}>⚠</span>
              <div>
                <span style={{color:"#ffd166",fontSize:10,fontWeight:700,letterSpacing:1}}>AUTO-CONVERTING $/bbl → $/mt </span>
                <span style={{color:"#8a7040",fontSize:10}}>using standard density factors. For exact values, download the $/mt symbols from Platts:</span>
                <div style={{marginTop:5,display:"flex",gap:8,flexWrap:"wrap"}}>
                  {convertedSyms.map(sym => {
                    const fixes = { AAPKA00:"→ AAPKB00 (MOPS Naph $/mt)", PAAAP00:"→ PAAAQ00 (FOB Spore $/mt)", PGAEY00:"→ PGAEZ00 (Gas92 $/mt)", AAOVC00:"→ AAOVC01 (GO 10ppm $/mt)", AACUE00:"→ AACUE01 (GO 0.25% $/mt)" };
                    const factors = { AAPKA00:"×9.088 bbl/mt", PAAAP00:"×9.088 bbl/mt", PGAEY00:"×8.4 bbl/mt", AAOVC00:"×7.45 bbl/mt", AACUE00:"×7.45 bbl/mt" };
                    return (
                      <span key={sym} style={{background:"#2a1e00",border:"1px solid #ffd16622",borderRadius:4,padding:"2px 8px",fontSize:9,color:"#a08030",fontFamily:"monospace"}}>
                        {sym} {factors[sym] || ""} {fixes[sym] || ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TABS ── */}
          <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"1px solid #0a1a28"}}>
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"#0a1a28":"transparent",border:"none",borderBottom:tab===t?"2px solid #7eb8d4":"2px solid transparent",color:tab===t?"#7eb8d4":"#334d63",padding:"8px 18px",fontSize:10,letterSpacing:2,cursor:"pointer",fontFamily:"monospace"}}>
                {tabLabel[t]}
              </button>
            ))}
          </div>

          {/* ═══════════ TAB: ARB ═══════════ */}
          {tab==="arb" && (
            <div>
              <SectionHeader icon="⛽" label="ARBITRAGE — AG TO EAST ASIA"/>
              <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                <ArbCard title="Naphtha AG→Japan" route="PAAAA00 → PAAAD00 (C+F)" gross={L.naph_jp_ag} freight={freight.nj} misc={misc.naph} hedgeRoll={hedgeRoll} history={hist("naph_jp_ag")} onSelect={()=>{setChartKey("naph_jp_ag");setTab("arb")}} selected={chartKey==="naph_jp_ag"}/>
                <ArbCard title="Naphtha AG→Spore" route="PAAAA00 → PAAAP00 (FOB)" gross={L.naph_sp_ag} freight={freight.ns} misc={misc.naph} history={hist("naph_sp_ag")} onSelect={()=>setChartKey("naph_sp_ag")} selected={chartKey==="naph_sp_ag"}/>
                <ArbCard title="FO 180 AG→Spore" route="PUABE00 → PUADV00" gross={L.fo180_sp_ag} freight={freight.fo80} misc={misc.fo} history={hist("fo180_sp_ag")} onSelect={()=>setChartKey("fo180_sp_ag")} selected={chartKey==="fo180_sp_ag"}/>
                <ArbCard title="FO 380 AG→Spore" route="AAIDC00 → PPXDK00" gross={L.fo380_sp_ag} freight={freight.fo80} misc={misc.fo} history={hist("fo380_sp_ag")} onSelect={()=>setChartKey("fo380_sp_ag")} selected={chartKey==="fo380_sp_ag"}/>
              </div>

              {/* ── MOPJ CURVE ANALYTICS ── */}
              {L._balmo != null && (
                <div style={{background:"#08121c",border:"1px solid #0a1a28",borderRadius:10,marginBottom:16,padding:"14px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span style={{color:"#4a6680",fontSize:9,letterSpacing:3,fontWeight:700}}>📐 MOPJ CURVE STRUCTURE — RAXFM00 / AAXFE00</span>
                    <div style={{flex:1,height:1,background:"#0d1e2d"}}/>
                    <span style={{color:"#334d63",fontSize:8}}>BalMo = Balance {ts[ts.length-1]?.date?.slice(0,7)} · Mo01 = next month</span>
                  </div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    {/* Three stat tiles */}
                    {[
                      { l:"BalMo (RAXFM00)", v:L._balmo, prev:L1._balmo, sub:"Balance month swap" },
                      { l:"Mo01 (AAXFE00)",  v:L._mo01,  prev:L1._mo01,  sub:"Next month swap" },
                      { l:"Roll Spread",     v:L.balmo_roll, prev:L1.balmo_roll, sub:"BalMo − Mo01 · + = backwardation" },
                    ].map(({l,v,prev,sub})=>{
                      const c = v != null && prev != null ? v - prev : null;
                      const isRoll = l === "Roll Spread";
                      const vc = isRoll ? (v > 0 ? "#00e5a0" : v < 0 ? "#ff4757" : "#c8d8e8") : "#e4f0fa";
                      const p = isRoll ? pct(v, allV("balmo_roll")) : null;
                      return (
                        <div key={l} style={{background:"#060f18",borderRadius:8,padding:"12px 16px",minWidth:160,flex:"0 0 auto",border:isRoll?`1px solid ${v>0?"#00e5a033":"#ff475733"}`:"1px solid #0d1e2d"}}>
                          <div style={{color:"#334d63",fontSize:9,letterSpacing:.5,marginBottom:6}}>{l}</div>
                          <div style={{color:vc,fontFamily:"monospace",fontSize:20,fontWeight:700,marginBottom:4}}>{fmt(v)}</div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                            {c!=null && <span style={{color:c>0?"#00e5a0":c<0?"#ff4757":"#445566",fontSize:9,fontFamily:"monospace"}}>{c>0?"▲":"▼"}{Math.abs(c).toFixed(2)}</span>}
                            {p!=null && <PBadge v={p} size="lg"/>}
                            <span style={{color:"#1a3448",fontSize:8}}>{sub}</span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Roll chart */}
                    <div style={{flex:"1 1 260px",minWidth:220}}>
                      <div style={{color:"#223344",fontSize:8,letterSpacing:1,marginBottom:4}}>ROLL HISTORY (BalMo−Mo01)</div>
                      <ResponsiveContainer width="100%" height={80}>
                        <AreaChart data={spreads.slice(-252).map(s=>({date:s.date?.slice(5),v:s.balmo_roll}))} margin={{top:2,right:4,left:0,bottom:0}}>
                          <defs>
                            <linearGradient id="rollGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#00e5a0" stopOpacity={.25}/>
                              <stop offset="100%" stopColor="#00e5a0" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <ReferenceLine y={0} stroke="#0d2035" strokeDasharray="3 3"/>
                          <XAxis dataKey="date" hide/>
                          <YAxis hide domain={["auto","auto"]}/>
                          <Tooltip contentStyle={{background:"#0a1825",border:"1px solid #0d2035",borderRadius:6,fontSize:10,fontFamily:"monospace"}} labelStyle={{color:"#445566"}} itemStyle={{color:"#00e5a0"}} formatter={v=>[fmt(v)+" $/mt (roll)",""]}/>
                          <Area type="monotone" dataKey="v" stroke="#00e5a0" fill="url(#rollGrad)" strokeWidth={1.5} dot={false}/>
                        </AreaChart>
                      </ResponsiveContainer>
                      {/* 4Y context row */}
                      <div style={{display:"flex",gap:10,marginTop:4}}>
                        {[["4Y High",maxOf(allV("balmo_roll"))],["4Y Low",minOf(allV("balmo_roll"))],["4Y Avg",allV("balmo_roll").reduce((a,b)=>a+b,0)/(allV("balmo_roll").length||1)]].map(([l,v])=>(
                          <div key={l} style={{background:"#060f18",borderRadius:4,padding:"4px 8px",flex:1}}>
                            <div style={{color:"#1a3448",fontSize:7}}>{l}</div>
                            <div style={{color:"#5a7a96",fontFamily:"monospace",fontSize:10,fontWeight:700}}>{fmt(v)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart + Breakdown */}
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <div style={{background:"#08121c",border:"1px solid #0a1a28",borderRadius:10,flex:"1 1 400px"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid #0a1a28",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    <select value={chartKey} onChange={e=>setChartKey(e.target.value)} style={{background:"#04090f",border:"1px solid #0d2035",color:"#c8d8e8",borderRadius:5,padding:"5px 10px",fontSize:10,fontFamily:"monospace",flex:1}}>
                      {CHART_OPTS.map(o=><option key={o.k} value={o.k}>{o.l}</option>)}
                    </select>
                    <div style={{display:"flex",gap:3}}>
                      {[[60,"3M"],[120,"6M"],[252,"1Y"],[504,"2Y"],[9999,"ALL"]].map(([d,l])=>(
                        <button key={d} onClick={()=>setChartDays(d)} style={{background:chartDays===d?"#0d2035":"transparent",border:`1px solid ${chartDays===d?"#1e4060":"#0a1a28"}`,borderRadius:4,color:chartDays===d?"#7eb8d4":"#334d63",padding:"4px 8px",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{padding:"10px 16px 4px",display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                    <div>
                      <div style={{color:"#334d63",fontSize:9,letterSpacing:1,marginBottom:2}}>{CHART_OPTS.find(o=>o.k===chartKey)?.l}</div>
                      <span style={{color:"#7eb8d4",fontFamily:"monospace",fontSize:22,fontWeight:700}}>{fmt(L[chartKey])}</span>
                      <span style={{fontSize:10,color:"#334d63",marginLeft:6}}>$/mt</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{color:"#223344",fontSize:8,letterSpacing:1,marginBottom:4}}>4Y PERCENTILE</div>
                      <PBadge v={chartPct} size="lg"/>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{top:4,right:16,left:4,bottom:0}}>
                      <defs><linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7eb8d4" stopOpacity={.2}/><stop offset="100%" stopColor="#7eb8d4" stopOpacity={0}/>
                      </linearGradient></defs>
                      <XAxis dataKey="date" tick={{fill:"#223344",fontSize:8}} tickLine={false} axisLine={false} interval={Math.floor(chartData.length/5)}/>
                      <YAxis tick={{fill:"#223344",fontSize:8}} tickLine={false} axisLine={false} width={40}/>
                      <Tooltip contentStyle={{background:"#0a1825",border:"1px solid #0d2035",borderRadius:6,fontSize:10,fontFamily:"monospace"}} labelStyle={{color:"#445566"}} itemStyle={{color:"#7eb8d4"}} formatter={v=>[fmt(v)+" $/mt",""]}/>
                      <ReferenceLine y={0} stroke="#0d2035" strokeDasharray="3 3"/>
                      <Area type="monotone" dataKey="v" stroke="#7eb8d4" fill="url(#mainGrad)" strokeWidth={1.5} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Location breakdown */}
                <div style={{background:"#08121c",border:"1px solid #0a1a28",borderRadius:10,flex:"0 0 260px"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid #0a1a28",color:"#334d63",fontSize:9,letterSpacing:2}}>LOCATION PREMIUMS</div>
                  <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
                    {[
                      {l:"Japan C+F vs AG",sl:"Freight-included basis",k:"naph_jp_ag"},
                      {l:"Japan C+F vs MOPS",sl:"East Asia pull over Singapore",k:"naph_jp_mops"},
                      {l:"MOPS Spore vs AG",sl:"Singapore location premium",k:"naph_mops_ag"},
                      {l:"Spore FOB vs AG",sl:"Spot Spore over origin",k:"naph_sp_ag"},
                    ].map(({l,sl,k})=>{
                      const v=L[k]; const p=pct(v,allV(k)); const c=chg(k);
                      const pc=p>=80?"#00e5a0":p>=50?"#7eb8d4":p>=20?"#ffd166":"#ff4757";
                      return (
                        <div key={k} onClick={()=>setChartKey(k)} style={{background:"#060f18",borderRadius:7,padding:"10px 12px",cursor:"pointer",border:`1px solid ${chartKey===k?"#1e4060":"#0a1a28"}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div><div style={{color:"#a8c8e0",fontSize:11}}>{l}</div><div style={{color:"#334d63",fontSize:9,marginTop:1}}>{sl}</div></div>
                            <PBadge v={p}/>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:6}}>
                            <span style={{color:pc,fontFamily:"monospace",fontSize:16,fontWeight:700}}>{fmt(v)}</span>
                            {c!==null && <span style={{color:c>0?"#00e5a055":c<0?"#ff475755":"#334d63",fontSize:9,fontFamily:"monospace"}}>{c>0?"+":""}{fmt(c)}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB: CURVE ═══════════ */}
          {tab==="curve" && (
            <div>

              {/* ── ARB STRIP ── */}
              <SectionHeader icon="📈" label="AG→JAPAN ARB STRIP — FINANCIAL (MOPJ − NAGFM)"/>
              <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                {[
                  { lbl:"Balance Month", mopj:L._balmo, ag:L._nagfm0, k:"arb_balmo", sym:"RAXFM00 − NAGFM00" },
                  { lbl:"Month 1 (Mo01)", mopj:L._mo01, ag:L._nagfm1, k:"arb_mo01",  sym:"AAXFE00 − NAGFM01" },
                  { lbl:"Month 2 (Mo02)", mopj:L._mo02, ag:L._nagfm2, k:"arb_mo02",  sym:"AAXFF00 − NAGFM02" },
                ].map(({lbl,mopj,ag,k,sym})=>{
                  const gross = L[k];
                  const net = gross != null ? gross - freight.nj - misc.naph : null;
                  const status = net === null ? "NO DATA" : net > 8 ? "OPEN" : net > -5 ? "MARGINAL" : "CLOSED";
                  const sc = { OPEN:"#00e5a0", MARGINAL:"#ffd166", CLOSED:"#ff4757", "NO DATA":"#445566" }[status];
                  const gHist = allV(k);
                  const netHist = gHist.map(v => v - freight.nj - misc.naph);
                  const p = pct(net, netHist);
                  const gP = pct(gross, gHist);
                  return (
                    <div key={k} style={{background:"#0a1825",border:`1px solid ${sc}33`,borderRadius:10,padding:"16px 18px",flex:1,minWidth:200}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div>
                          <div style={{color:"#4a6680",fontSize:9,letterSpacing:2,marginBottom:2,fontFamily:"monospace"}}>{sym}</div>
                          <div style={{color:"#c8d8e8",fontSize:13,fontWeight:700}}>{lbl}</div>
                        </div>
                        <div style={{background:sc+"22",color:sc,border:`1px solid ${sc}55`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:1.5}}>{status}</div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                        <div style={{background:"#060f18",borderRadius:6,padding:"8px 10px"}}>
                          <div style={{color:"#334d63",fontSize:8,letterSpacing:1,marginBottom:3}}>MOPJ</div>
                          <div style={{color:"#7eb8d4",fontFamily:"monospace",fontSize:14,fontWeight:700}}>{fmt(mopj)}</div>
                        </div>
                        <div style={{background:"#060f18",borderRadius:6,padding:"8px 10px"}}>
                          <div style={{color:"#334d63",fontSize:8,letterSpacing:1,marginBottom:3}}>AG FINANCIAL</div>
                          <div style={{color:"#7eb8d4",fontFamily:"monospace",fontSize:14,fontWeight:700}}>{fmt(ag)}</div>
                        </div>
                        <div style={{background:"#060f18",borderRadius:6,padding:"8px 10px"}}>
                          <div style={{color:"#334d63",fontSize:8,letterSpacing:1,marginBottom:3}}>GROSS</div>
                          <div style={{color:"#c8d8e8",fontFamily:"monospace",fontSize:14,fontWeight:700}}>{fmt(gross)}</div>
                          {gP != null && <div style={{marginTop:3}}><PBadge v={gP}/></div>}
                        </div>
                        <div style={{background:"#060f18",borderRadius:6,padding:"8px 10px"}}>
                          <div style={{color:"#334d63",fontSize:8,letterSpacing:1,marginBottom:3}}>NET (−frt−misc)</div>
                          <div style={{color:sc,fontFamily:"monospace",fontSize:14,fontWeight:700}}>{fmt(net)}</div>
                          {p != null && <div style={{marginTop:3}}><PBadge v={p}/></div>}
                        </div>
                      </div>
                      <Spark data={hist(k).slice(-90)} color={sc}/>
                    </div>
                  );
                })}
              </div>

              {/* ── FORWARD CURVE STRIP CHART ── */}
              <SectionHeader icon="📊" label="FORWARD PRICE STRIP — BalMo · Mo01 · Mo02"/>
              <div style={{background:"#08121c",border:"1px solid #0a1a28",borderRadius:10,padding:"16px 18px",marginBottom:16}}>
                {[
                  { label:"Naphtha C+F Japan (MOPJ)", vals:[L._balmo, L._mo01, L._mo02], color:"#7eb8d4" },
                  { label:"Naphtha AG Financial",      vals:[L._nagfm0, L._nagfm1, L._nagfm2], color:"#4a8aaa" },
                  { label:"Gas92 Spore",               vals:[L._gas0, L._gas1, L._gas2], color:"#ffd166" },
                  { label:"FO 380 Spore",              vals:[L._fo380_0, L._fo380_1, L._fo380_2], color:"#ff9f43" },
                  { label:"FO 180 Spore",              vals:[L._fo180_0, L._fo180_1, L._fo180_2], color:"#ff6b6b" },
                ].map(({label, vals, color})=>{
                  const [v0,v1,v2] = vals;
                  if (!v0) return null;
                  const maxV = Math.max(...vals.filter(Boolean));
                  const minV = Math.min(...vals.filter(Boolean));
                  const range = maxV - minV || 1;
                  const slope = v0 && v2 ? v2 - v0 : null;
                  const slopeC = slope > 0 ? "#ff4757" : slope < 0 ? "#00e5a0" : "#445566";
                  const slopeL = slope > 2 ? "▲ contango" : slope < -2 ? "▼ backwardation" : "≈ flat";
                  return (
                    <div key={label} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid #0a1a28"}}>
                      <div style={{width:190,color:"#a8c8e0",fontSize:11,flexShrink:0}}>{label}</div>
                      <div style={{display:"flex",gap:8,flex:1,alignItems:"flex-end"}}>
                        {["BalMo","Mo01","Mo02"].map((m,i)=>{
                          const v = vals[i];
                          if (!v) return <div key={m} style={{flex:1}}/>;
                          const barH = Math.max(12, Math.round(((v-minV)/range)*40)+12);
                          return (
                            <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                              <div style={{color:"#e4f0fa",fontFamily:"monospace",fontSize:11,fontWeight:700}}>{fmt(v,0)}</div>
                              <div style={{width:"100%",height:barH,background:color+"44",border:`1px solid ${color}66`,borderRadius:"3px 3px 0 0",position:"relative"}}>
                                <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${Math.min(100,((v-minV)/range)*100)}%`,background:color+"88",borderRadius:"3px 3px 0 0"}}/>
                              </div>
                              <div style={{color:"#334d63",fontSize:8}}>{m}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{width:130,textAlign:"right"}}>
                        <span style={{color:slopeC,fontSize:10,fontFamily:"monospace",fontWeight:700}}>{slopeL}</span>
                        {slope != null && <div style={{color:slopeC,fontSize:9,fontFamily:"monospace"}}>{slope>0?"+":""}{fmt(slope,1)} $/mt</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── FO STRUCTURE PANEL ── */}
              <SectionHeader icon="⚓" label="FUEL OIL FORWARD STRUCTURE"/>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {[
                  { label:"FO 380 Spore", syms:"AAPKB00 · AAPKC00 · AAPKD00",
                    v0:L._fo380_0, v1:L._fo380_1, v2:L._fo380_2,
                    m0m1k:"fo380_m0m1", m1m2k:"fo380_m1m2", color:"#ff9f43" },
                  { label:"FO 180 Spore", syms:"AAPML00 · PUAXZ00 · PUAYF00",
                    v0:L._fo180_0, v1:L._fo180_1, v2:L._fo180_2,
                    m0m1k:"fo180_m0m1", m1m2k:"fo180_m1m2", color:"#ff6b6b" },
                ].map(({label,syms,v0,v1,v2,m0m1k,m1m2k,color})=>{
                  if (!v0) return null;
                  const m0m1 = L[m0m1k]; const m1m2 = L[m1m2k];
                  const total = v0 && v2 ? v0 - v2 : null;
                  const pm0m1 = pct(m0m1, allV(m0m1k));
                  const pm1m2 = pct(m1m2, allV(m1m2k));
                  const structure = total > 5 ? "BACKWARDATED" : total < -5 ? "CONTANGO" : "FLAT";
                  const sc2 = total > 5 ? "#00e5a0" : total < -5 ? "#ff4757" : "#ffd166";
                  return (
                    <div key={label} style={{background:"#08121c",border:"1px solid #0a1a28",borderRadius:10,padding:"16px 18px",flex:"1 1 300px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <div>
                          <div style={{color:"#334d63",fontSize:9,letterSpacing:1,marginBottom:2,fontFamily:"monospace"}}>{syms}</div>
                          <div style={{color:"#c8d8e8",fontSize:13,fontWeight:700}}>{label}</div>
                        </div>
                        <div style={{background:sc2+"22",color:sc2,border:`1px solid ${sc2}55`,borderRadius:4,padding:"2px 8px",fontSize:9,fontWeight:800,letterSpacing:1}}>{structure}</div>
                      </div>
                      {/* Price strip */}
                      <div style={{display:"flex",gap:6,marginBottom:14}}>
                        {[["BalMo",v0],["Mo01",v1],["Mo02",v2]].map(([m,v])=>(
                          <div key={m} style={{flex:1,background:"#060f18",borderRadius:6,padding:"8px 10px",borderBottom:`2px solid ${color}55`}}>
                            <div style={{color:"#334d63",fontSize:8,letterSpacing:.5,marginBottom:3}}>{m}</div>
                            <div style={{color:"#e4f0fa",fontFamily:"monospace",fontSize:13,fontWeight:700}}>{fmt(v,0)}</div>
                          </div>
                        ))}
                      </div>
                      {/* Spread tiles */}
                      <div style={{display:"flex",gap:8,marginBottom:12}}>
                        {[[`BalMo−Mo01`,m0m1,pm0m1],[`Mo01−Mo02`,m1m2,pm1m2]].map(([lbl,val,p2])=>(
                          <div key={lbl} style={{flex:1,background:"#060f18",borderRadius:6,padding:"8px 10px",border:`1px solid ${val>0?color+"33":"#ff475733"}`}}>
                            <div style={{color:"#334d63",fontSize:8,marginBottom:3}}>{lbl}</div>
                            <div style={{color:val>0?color:"#ff4757",fontFamily:"monospace",fontSize:14,fontWeight:700}}>{val>0?"+":""}{fmt(val,1)}</div>
                            {p2!=null && <div style={{marginTop:3}}><PBadge v={p2}/></div>}
                          </div>
                        ))}
                        <div style={{flex:1,background:"#060f18",borderRadius:6,padding:"8px 10px",border:`1px solid ${sc2}33`}}>
                          <div style={{color:"#334d63",fontSize:8,marginBottom:3}}>BalMo−Mo02</div>
                          <div style={{color:sc2,fontFamily:"monospace",fontSize:14,fontWeight:700}}>{total>0?"+":""}{fmt(total,1)}</div>
                        </div>
                      </div>
                      {/* Sparkline of m0m1 spread history */}
                      <div style={{color:"#223344",fontSize:8,letterSpacing:1,marginBottom:4}}>BalMo−Mo01 HISTORY</div>
                      <Spark data={hist(m0m1k).slice(-252)} color={color} height={48}/>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ═══════════ TAB: SPREADS ═══════════ */}
          {tab==="spreads" && (
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 520px",background:"#08121c",border:"1px solid #0a1a28",borderRadius:10}}>
                {/* BLENDING */}
                <div style={{padding:"10px 14px",borderBottom:"1px solid #0a1a28",color:"#334d63",fontSize:9,letterSpacing:3}}>⚗ BLENDING & REFORMING</div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Spread","Value","1D","Pct","4Y Range",""].map(h=><th key={h} style={{padding:"7px 12px",color:"#223344",fontSize:8,letterSpacing:1,textAlign:h==="Spread"?"left":"right",fontWeight:600}}>{h}</th>)}</tr></thead>
                  <tbody>
                    <SpreadRow label="Gas92 vs Naphtha MOPS" sublabel="Blending margin — value of naphtha in gasoline pool" value={L.gas_naph_mops} history={allV("gas_naph_mops")} change={chg("gas_naph_mops")} onSelect={()=>setChartKey("gas_naph_mops")} selected={chartKey==="gas_naph_mops"}/>
                    <SpreadRow label="Gas92 vs Naphtha AG" sublabel="Reforming spread — value of converting AG naphtha to gasoline" value={L.gas_naph_ag} history={allV("gas_naph_ag")} change={chg("gas_naph_ag")} onSelect={()=>setChartKey("gas_naph_ag")} selected={chartKey==="gas_naph_ag"}/>
                    <SpreadRow label="Naphtha Japan vs MOPS" sublabel="East Asia pull — Japan premium over Singapore" value={L.naph_jp_mops} history={allV("naph_jp_mops")} change={chg("naph_jp_mops")} onSelect={()=>setChartKey("naph_jp_mops")} selected={chartKey==="naph_jp_mops"}/>
                    <SpreadRow label="Naphtha MOPS vs AG" sublabel="Singapore location premium over origin" value={L.naph_mops_ag} history={allV("naph_mops_ag")} change={chg("naph_mops_ag")} onSelect={()=>setChartKey("naph_mops_ag")} selected={chartKey==="naph_mops_ag"}/>
                  </tbody>
                </table>
                {/* CLEAN / DIRTY */}
                <div style={{padding:"10px 14px",borderTop:"1px solid #0a1a28",borderBottom:"1px solid #0a1a28",color:"#334d63",fontSize:9,letterSpacing:3}}>🛢 CLEAN / DIRTY</div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <tbody>
                    <SpreadRow label="Light-Dark (Gas92 vs FO380 Spore)" sublabel="Product quality premium" value={L.light_dark} history={allV("light_dark")} change={chg("light_dark")} onSelect={()=>setChartKey("light_dark")} selected={chartKey==="light_dark"}/>
                    <SpreadRow label="Clean-Dirty (Gasoil 10ppm vs FO380)" sublabel="Strongest signal for clean product flows" value={L.go_fo} history={allV("go_fo")} change={chg("go_fo")} onSelect={()=>setChartKey("go_fo")} selected={chartKey==="go_fo"}/>
                    <SpreadRow label="Gasoil Sulfur Premium (10ppm vs 0.25%)" sublabel="IMO compliance value" value={L.go_sulfur} history={allV("go_sulfur")} change={chg("go_sulfur")} onSelect={()=>setChartKey("go_sulfur")} selected={chartKey==="go_sulfur"}/>
                  </tbody>
                </table>
                {/* FUEL OIL */}
                <div style={{padding:"10px 14px",borderTop:"1px solid #0a1a28",borderBottom:"1px solid #0a1a28",color:"#334d63",fontSize:9,letterSpacing:3}}>⚓ FUEL OIL STRUCTURE</div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <tbody>
                    <SpreadRow label="FO Viscosity Spore (180 vs 380)" sublabel="Blending value of lower viscosity" value={L.fo_visc_sp} history={allV("fo_visc_sp")} change={chg("fo_visc_sp")} onSelect={()=>setChartKey("fo_visc_sp")} selected={chartKey==="fo_visc_sp"}/>
                    <SpreadRow label="FO Viscosity AG (180 vs 380)" sublabel="Origin market viscosity premium" value={L.fo_visc_ag} history={allV("fo_visc_ag")} change={chg("fo_visc_ag")} onSelect={()=>setChartKey("fo_visc_ag")} selected={chartKey==="fo_visc_ag"}/>
                    <SpreadRow label="VLSFO vs FO 180 Spore" sublabel="Low-sulfur premium — scrubber economics" value={L.vlsfo_fo180} history={allV("vlsfo_fo180")} change={chg("vlsfo_fo180")} onSelect={()=>setChartKey("vlsfo_fo180")} selected={chartKey==="vlsfo_fo180"}/>
                    <SpreadRow label="VLSFO vs FO 380 Spore" sublabel="IMO2020 switchover value" value={L.vlsfo_fo380} history={allV("vlsfo_fo380")} change={chg("vlsfo_fo380")} onSelect={()=>setChartKey("vlsfo_fo380")} selected={chartKey==="vlsfo_fo380"}/>
                  </tbody>
                </table>
              </div>

              {/* Chart panel */}
              <div style={{flex:"0 0 340px",background:"#08121c",border:"1px solid #0a1a28",borderRadius:10}}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid #0a1a28",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:"#334d63",fontSize:9,letterSpacing:2}}>SELECTED SPREAD</span>
                  <div style={{display:"flex",gap:3}}>
                    {[[60,"3M"],[252,"1Y"],[9999,"ALL"]].map(([d,l])=>(
                      <button key={d} onClick={()=>setChartDays(d)} style={{background:chartDays===d?"#0d2035":"transparent",border:`1px solid ${chartDays===d?"#1e4060":"#0a1a28"}`,borderRadius:4,color:chartDays===d?"#7eb8d4":"#334d63",padding:"3px 7px",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{padding:"12px 16px 4px",display:"flex",justifyContent:"space-between"}}>
                  <div>
                    <div style={{color:"#223344",fontSize:8,letterSpacing:1,marginBottom:2}}>{CHART_OPTS.find(o=>o.k===chartKey)?.l}</div>
                    <span style={{color:"#7eb8d4",fontFamily:"monospace",fontSize:20,fontWeight:700}}>{fmt(L[chartKey])}</span>
                    <span style={{color:"#334d63",fontSize:9,marginLeft:5}}>$/mt</span>
                  </div>
                  <PBadge v={chartPct} size="lg"/>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{top:4,right:12,left:4,bottom:0}}>
                    <defs><linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7eb8d4" stopOpacity={.2}/><stop offset="100%" stopColor="#7eb8d4" stopOpacity={0}/>
                    </linearGradient></defs>
                    <XAxis dataKey="date" tick={{fill:"#223344",fontSize:8}} tickLine={false} axisLine={false} interval={Math.floor(chartData.length/4)}/>
                    <YAxis tick={{fill:"#223344",fontSize:8}} tickLine={false} axisLine={false} width={40}/>
                    <Tooltip contentStyle={{background:"#0a1825",border:"1px solid #0d2035",borderRadius:6,fontSize:10,fontFamily:"monospace"}} labelStyle={{color:"#445566"}} itemStyle={{color:"#7eb8d4"}} formatter={v=>[fmt(v)+" $/mt",""]}/>
                    <ReferenceLine y={0} stroke="#0d2035" strokeDasharray="3 3"/>
                    <Area type="monotone" dataKey="v" stroke="#7eb8d4" fill="url(#sGrad)" strokeWidth={1.5} dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
                {/* Percentile context */}
                <div style={{padding:"12px 16px",borderTop:"1px solid #0a1a28"}}>
                  <div style={{color:"#223344",fontSize:8,letterSpacing:1,marginBottom:8}}>4-YEAR CONTEXT</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["4Y High",maxOf(chartVals)],["4Y Low",minOf(chartVals)],["4Y Mean",(chartVals.reduce((a,b)=>a+b,0)/chartVals.length||0)],["Current",L[chartKey]]].map(([l,v])=>(
                      <div key={l} style={{background:"#060f18",borderRadius:5,padding:"7px 10px"}}>
                        <div style={{color:"#223344",fontSize:8}}>{l}</div>
                        <div style={{color:"#a8c8e0",fontFamily:"monospace",fontSize:12,fontWeight:700}}>{fmt(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB: SIGNALS ═══════════ */}
          {tab==="signals" && (
            <div style={{maxWidth:900}}>
              <SectionHeader icon="⚡" label="ACTIONABLE SIGNALS — CURRENT SESSION"/>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
                {signals.map((s,i)=><Signal key={i} text={s.text} type={s.type}/>)}
              </div>
              <SectionHeader icon="📊" label="SPREAD DASHBOARD SNAPSHOT"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
                {CHART_OPTS.map(({k,l})=>{
                  const v=L[k], p=pct(v,allV(k)), c=chg(k);
                  const pc=p>=80?"#00e5a0":p>=60?"#7eb8d4":p>=40?"#ffd166":p>=20?"#ff9f43":"#ff4757";
                  return (
                    <div key={k} onClick={()=>{setChartKey(k);setTab("spreads")}} style={{background:"#08121c",border:`1px solid ${p>=80||p<=20?"#1e4060":"#0a1a28"}`,borderRadius:8,padding:"12px 14px",cursor:"pointer"}}>
                      <div style={{color:"#5a7a96",fontSize:9,marginBottom:6,lineHeight:1.3}}>{l}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                        <span style={{color:pc,fontFamily:"monospace",fontSize:17,fontWeight:700}}>{fmt(v)}</span>
                        <PBadge v={p} size="lg"/>
                      </div>
                      {c!==null && <div style={{color:c>0?"#00e5a066":c<0?"#ff475766":"#334d63",fontSize:9,fontFamily:"monospace",marginTop:4}}>{c>0?"+":""}{fmt(c)} 1d chg</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════ TAB: PRICES ═══════════ */}
          {tab==="prices" && (
            <div>
              <SectionHeader icon="💹" label="CURRENT PRICES — ALL IN $/mt"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:10,marginBottom:16}}>
                {[
                  {l:"Naphtha FOB AG",       k:"_nAG",   srcSym:"PAAAA00"},
                  {l:"Naphtha C+F Japan",    k:"_nJP",   srcSym:"PAAAD00"},
                  {l:"Naphtha FOB Spore",    k:"_nSP",   srcSym:"PAAAQ00|PAAAP00"},
                  {l:"Naphtha MOPS Strip",   k:"_nMOPS", srcSym:"AAPKB00|AAPKA00"},
                  {l:"Gasoline 92 Spore",    k:"_g92",   srcSym:"PGAEZ00|PGAEY00"},
                  {l:"Gasoil 10ppm Spore",   k:"_go10",  srcSym:"AAOVC01|AAOVC00"},
                  {l:"Gasoil 0.25% Spore",   k:"_go25",  srcSym:"AACUE01|AACUE00"},
                  {l:"FO 180 FOB Spore",     k:"_f180S", srcSym:"PUADV00"},
                  {l:"FO 380 FOB Spore",     k:"_f380S", srcSym:"PPXDK00"},
                  {l:"VLSFO FOB Spore",      k:"_vlsfo", srcSym:"AMFSA00"},
                  {l:"FO 180 FOB AG",        k:"_f180A", srcSym:"PUABE00"},
                  {l:"FO 380 FOB AG",        k:"_f380A", srcSym:"AAIDC00"},
                ].map(({l,k,srcSym})=>{
                  const v=L[k], pv=L1[k];
                  const allRaw = spreads.map(s=>s[k]).filter(x=>x!==null);
                  // Work out which source symbol is actually being used & whether it was converted
                  const syms = srcSym.split("|");
                  const usedSym = syms.find(s => symUnits[s]) || syms[0];
                  const isConverted = symUnits[usedSym] === "USD/bbl";
                  const uLabel = isConverted ? "$/mt (auto-conv)" : "$/mt (native)";
                  return (
                    <div key={k} style={{background:"#060f18",borderRadius:7,padding:"10px 12px",border:`1px solid ${isConverted?"#ffd16622":"#0d1e2d"}`}}>
                      <div style={{color:"#334d63",fontSize:9,letterSpacing:.5,marginBottom:4}}>{l}</div>
                      <div style={{color:"#e4f0fa",fontFamily:"monospace",fontSize:14,fontWeight:700,marginBottom:2}}>{fmt(v,2)}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                        {v!==null && pv!==null && <span style={{color:v-pv>0?"#00e5a0":v-pv<0?"#ff4757":"#445566",fontSize:9,fontFamily:"monospace"}}>{v-pv>0?"▲":"▼"}{Math.abs(v-pv).toFixed(2)}</span>}
                        <span style={{color:isConverted?"#8a6020":"#223344",fontSize:8,fontFamily:"monospace"}}>{usedSym}{isConverted?" ⚠":""}</span>
                        {pct(v,allRaw)!==null && <PBadge v={pct(v,allRaw)}/>}
                      </div>
                      <div style={{color:isConverted?"#6a4a10":"#1a3040",fontSize:8,marginTop:3}}>{uLabel}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{background:"#1a1200",border:"1px solid #ffd16622",borderRadius:6,padding:"8px 14px",fontSize:9,color:"#7a6030",lineHeight:1.8}}>
                <span style={{color:"#ffd166",fontWeight:700}}>⚠ AUTO-CONVERTED SYMBOLS</span> — tiles with orange border are sourced from $/bbl Platts assessments and multiplied by density factors (Naphtha 9.088 · Gasoline 8.4 · Gasoil 7.45 bbl/mt). Replace with native $/mt symbols (AAPKB00, PAAAQ00, PGAEZ00, AAOVC01, AACUE01) for exact values.
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}