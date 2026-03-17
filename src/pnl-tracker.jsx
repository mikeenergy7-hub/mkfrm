"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── FONT INJECT ───────────────────────────────────────────────────────────
const FontStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #080810; }
    ::-webkit-scrollbar-thumb { background: #1e1e32; border-radius: 2px; }
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
    input, select { outline: none; }
    .pos-row:hover { background: #0f0f20 !important; }
    .action-btn:hover { opacity: 1 !important; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    .fade-in { animation: fadeIn .25s ease forwards; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .pulse { animation: pulse 2s infinite; }
  `}</style>
);

// ── CONSTANTS ─────────────────────────────────────────────────────────────

const ROUTES = {
  naph_jp:  { label:"Naphtha AG → Japan",  icon:"🗾", buySymbol:"PAAAA00", sellSymbols:{ SPOT:"PAAAD00", BM:"RAXFM00", M1:"AAXFE00", M2:"AAXFF00" }, buyRisk:"Naph AG",  sellRisk:"MOPJ",        freightDef:78, miscDef:4, product:"naph" },
  naph_sp:  { label:"Naphtha AG → Spore",  icon:"🇸🇬", buySymbol:"PAAAA00", sellSymbols:{ SPOT:"PAAAP00", BM:"AAPLD00", M1:"PAAAQ00", M2:"PAAAR00" }, buyRisk:"Naph AG",  sellRisk:"Naph Spore",  freightDef:32, miscDef:4, product:"naph" },
  fo180_sp: { label:"FO 180 AG → Spore",   icon:"🛢",  buySymbol:"PUABE00", sellSymbols:{ SPOT:"PUADV00", BM:"AAPML00", M1:"PUAXZ00", M2:"PUAYF00" }, buyRisk:"FO180 AG", sellRisk:"FO180 Spore", freightDef:22, miscDef:3, product:"fo"   },
  fo380_sp: { label:"FO 380 AG → Spore",   icon:"⚓",  buySymbol:"AAIDC00", sellSymbols:{ SPOT:"PPXDK00", BM:"AAPKB00", M1:"AAPKC00", M2:"AAPKD00" }, buyRisk:"FO380 AG", sellRisk:"FO380 Spore", freightDef:22, miscDef:3, product:"fo"   },
  gas_med:  { label:"Gasoline Med B2B",    icon:"⛽",  buySymbol:"AAWZA00", sellSymbols:{ SPOT:"AAWZA00", BM:"ABWFB00", M1:"ABWFC00", M2:"ABWFD00" }, buyRisk:"Gas Med",  sellRisk:"Gas Med",     freightDef:0,  miscDef:0, product:"gas"  },
};

const INSTRUMENTS = [
  { id:"MOPJ_BM",  label:"MOPJ BalMo",        symbol:"RAXFM00", risk:"MOPJ"        },
  { id:"MOPJ_M1",  label:"MOPJ Mo01",          symbol:"AAXFE00", risk:"MOPJ"        },
  { id:"MOPJ_M2",  label:"MOPJ Mo02",          symbol:"AAXFF00", risk:"MOPJ"        },
  { id:"AG_BM",    label:"Naph AG BalMo",      symbol:"NAGFM00", risk:"Naph AG"     },
  { id:"AG_M1",    label:"Naph AG Mo01",       symbol:"NAGFM01", risk:"Naph AG"     },
  { id:"AG_M2",    label:"Naph AG Mo02",       symbol:"NAGFM02", risk:"Naph AG"     },
  { id:"SP_BM",    label:"Spore Naph BalMo",   symbol:"AAPLD00", risk:"Naph Spore"  },
  { id:"SP_M1",    label:"Spore Naph Mo01",    symbol:"PAAAQ00", risk:"Naph Spore"  },
  { id:"SP_M2",    label:"Spore Naph Mo02",    symbol:"PAAAR00", risk:"Naph Spore"  },
  { id:"FO180_BM", label:"FO180 Spore BalMo",  symbol:"AAPML00", risk:"FO180 Spore" },
  { id:"FO180_M1", label:"FO180 Spore Mo01",   symbol:"PUAXZ00", risk:"FO180 Spore" },
  { id:"FO180_M2", label:"FO180 Spore Mo02",   symbol:"PUAYF00", risk:"FO180 Spore" },
  { id:"FO380_BM", label:"FO380 Spore BalMo",  symbol:"AAPKB00", risk:"FO380 Spore" },
  { id:"FO380_M1", label:"FO380 Spore Mo01",   symbol:"AAPKC00", risk:"FO380 Spore" },
  { id:"FO380_M2", label:"FO380 Spore Mo02",   symbol:"AAPKD00", risk:"FO380 Spore" },
  { id:"G92_BM",      label:"Gas92 BalMo",          symbol:"AAXEK00", risk:"Gas92"    },
  { id:"G92_M1",      label:"Gas92 Mo01",            symbol:"AAXEL00", risk:"Gas92"    },
  { id:"GMED_BM",     label:"Gas Med Eurobob BalMo", symbol:"ABWFB00", risk:"Gas Med"  },
  { id:"GMED_M1",     label:"Gas Med Eurobob Mo01",  symbol:"ABWFC00", risk:"Gas Med"  },
  { id:"GMED_M2",     label:"Gas Med Eurobob Mo02",  symbol:"ABWFD00", risk:"Gas Med"  },
];

const RISK_CATS = ["Naph AG","MOPJ","Naph Spore","FO180 AG","FO180 Spore","FO380 AG","FO380 Spore","Gas92","Gas Med"];

const TENORS = ["SPOT","BM","M1","M2"];

// ── THEME ─────────────────────────────────────────────────────────────────
const T = {
  bg:       "#07070f",
  card:     "#0e0e1c",
  card2:    "#12122a",
  border:   "#1a1a2e",
  border2:  "#252540",
  text:     "#e8e8f5",
  muted:    "#4a4a6a",
  dim:      "#2a2a48",
  amber:    "#f59e0b",
  teal:     "#2dd4bf",
  green:    "#10b981",
  red:      "#ef4444",
  orange:   "#f97316",
  blue:     "#60a5fa",
  purple:   "#a78bfa",
  font:     "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  syne:     "'Syne', 'Trebuchet MS', sans-serif",
};

// ── HELPERS ───────────────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2,10);
const fmt  = (v,d=2) => v==null||isNaN(v) ? "—" : Number(v).toFixed(d);
const fmtK = v => v==null||isNaN(v) ? "—" : (v>=0?"+":"")+new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
const fmtMT= v => v==null ? "—" : new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(v)+" MT";
const today= () => new Date().toISOString().slice(0,10);
const pnlC = v => v==null ? T.muted : v>0 ? T.green : v<0 ? T.red : T.muted;
const pnlSign = v => v==null ? "—" : (v>=0?"+ ":"− ")+new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.abs(v));

// ── CSV helpers ────────────────────────────────────────────────────────────
function detectDelimiter(firstLine) {
  const counts = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  for (const ch of firstLine) if (ch in counts) counts[ch]++;
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}

function splitCSVLine(line, delim) {
  const cols = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && ch === delim) { cols.push(cur); cur = ""; }
    else cur += ch;
  }
  cols.push(cur);
  return cols.map(s => s.trim());
}

// Fuzzy column finder — case-insensitive, allows extra spaces/underscores
function findCol(hdr, ...candidates) {
  const norm = s => s.toLowerCase().replace(/[\s_\-]/g,"");
  const normed = hdr.map(norm);
  for (const c of candidates) {
    const idx = normed.indexOf(norm(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCSVtoMTM(text) {
  const prices = {};
  const priceDate = {};
  const lines = text.trim().split(/\r?\n/).filter(l=>l.trim());
  if (lines.length < 2) return { prices, latestDate:"", warn:"CSV appears empty" };

  const delim = detectDelimiter(lines[0]);
  const hdr   = splitCSVLine(lines[0], delim);

  // Accept multiple naming conventions used by different Platts exports
  const sI = findCol(hdr, "Symbol Code","SymbolCode","Symbol","Code","MDC");
  const dI = findCol(hdr, "TimeStamp","Timestamp","Date","Trade Date","AssessDate","PriceDate");
  const vI = findCol(hdr, "Value","Price","Close","Mid","Assess");
  const mI = findCol(hdr, "Value/mt","Value per mt","ValuePerMt","Value_mt","$/mt");

  if (sI<0||dI<0||vI<0) {
    return {
      prices, latestDate:"",
      warn:`Unrecognised columns. Found: [${hdr.join(", ")}]. Expected headers containing: Symbol Code, TimeStamp, Value.`,
    };
  }

  let latestDate = "";
  for (let i = 1; i < lines.length; i++) {
    const c   = splitCSVLine(lines[i], delim);
    const sym = c[sI];
    const date= c[dI];
    if (!sym || !date) continue;
    // skip repeated header rows embedded mid-file
    if (sym.toLowerCase().includes("symbol") || date.toLowerCase().includes("time")) continue;
    const rawMt  = mI >= 0 ? parseFloat(c[mI]) : NaN;
    const rawVal = parseFloat(c[vI]);
    const val    = (!isNaN(rawMt) && rawMt > 0) ? rawMt : rawVal;
    if (isNaN(val)) continue;
    if (!priceDate[sym] || date > priceDate[sym]) {
      prices[sym] = val;
      priceDate[sym] = date;
      if (date > latestDate) latestDate = date;
    }
  }
  return { prices, latestDate, warn: null };
}

function computeMTM(pos, prices) {
  if (pos.type==="physical") {
    const route = ROUTES[pos.route];
    if (!route) return {};

    // ── SELL LEG ───────────────────────────────────────────────────────────
    // Fixed sell: stored pos.sellPrice already includes sellPremDisc (computed at save time)
    // Floating sell: current market price + sellPremDisc
    const sellSym      = pos.sellFixed ? null : route.sellSymbols[pos.pricingTenor||"M1"];
    const rawSell      = pos.sellFixed ? parseFloat(pos.sellPrice) : (sellSym ? prices[sellSym] : null);
    const sellPremDisc = pos.sellFixed ? 0 : (parseFloat(pos.sellPremDisc) || 0);
    const mtmSell      = rawSell != null ? rawSell + sellPremDisc : null;

    // ── BUY LEG ────────────────────────────────────────────────────────────
    // Fixed buy: stored pos.buyPrice already includes buyPremDisc (computed at save time)
    // Floating buy: re-evaluate at CURRENT market + buyPremDisc so benchmark moves
    //   cancel out on B2B deals and the blotter tracks real margin, not market drift
    let effectiveBuy;
    if (pos.buyFixed) {
      effectiveBuy = parseFloat(pos.buyPrice);
    } else {
      const buySym    = BUY_SYMS[pos.route]?.[pos.pricingTenor||"M1"] || route.buySymbol;
      const buyBase   = prices[buySym] != null ? prices[buySym] : parseFloat(pos.buyPrice);
      const buyPremDisc = parseFloat(pos.buyPremDisc) || 0;
      effectiveBuy    = buyBase + buyPremDisc;
    }

    const effectiveSell = mtmSell != null ? parseFloat(mtmSell) : null;
    const freight = parseFloat(pos.freight) || 0;
    const misc    = parseFloat(pos.misc)    || 0;
    const volume  = parseFloat(pos.volume)  || 0;
    if (effectiveSell==null || isNaN(effectiveBuy)) return { mtmSell:null, pnl:null, unrealizedPnl:0, realizedPnl:0 };
    const grossPerMT = effectiveSell - effectiveBuy - freight - misc;
    const totalPnl   = grossPerMT * volume;
    return {
      mtmSell, mtmSellSym: sellSym, grossPerMT,
      pnl: totalPnl,
      unrealizedPnl: pos.sellFixed ? 0 : totalPnl,
      realizedPnl:   pos.sellFixed ? totalPnl : 0,
    };
  } else {
    const instr = INSTRUMENTS.find(i=>i.id===pos.instrument);
    if (!instr) return {};
    const currentPrice = prices[instr.symbol];
    const exitPrice    = pos.exitFixed ? parseFloat(pos.exitPrice) : currentPrice;
    const entryPrice   = parseFloat(pos.entryPrice);
    const volume       = parseFloat(pos.volume)||0;
    const dir          = pos.direction||1;
    if (exitPrice==null||isNaN(entryPrice)) return { currentPrice, pnl:null, unrealizedPnl:0, realizedPnl:0 };
    const diff     = (exitPrice - entryPrice) * dir;
    const totalPnl = diff * volume;
    return {
      currentPrice, exitPrice, priceDiff: diff,
      pnl: totalPnl,
      unrealizedPnl: pos.exitFixed ? 0 : totalPnl,
      realizedPnl:   pos.exitFixed ? totalPnl : 0,
    };
  }
}

function aggregateRisk(positions) {
  const risk = {};
  RISK_CATS.forEach(c => risk[c]=0);
  positions.forEach(pos => {
    if (pos.status==="CLOSED") return;
    const vol = parseFloat(pos.volume)||0;
    if (pos.type==="physical") {
      const route = ROUTES[pos.route];
      if (!route) return;
      risk[route.buyRisk]  = (risk[route.buyRisk]||0)  + vol;
      if (!pos.sellFixed)
        risk[route.sellRisk] = (risk[route.sellRisk]||0) - vol;
    } else {
      const instr = INSTRUMENTS.find(i=>i.id===pos.instrument);
      if (!instr) return;
      risk[instr.risk] = (risk[instr.risk]||0) + (pos.direction||1)*vol;
    }
  });
  return risk;
}

// ── BLANK FORMS ───────────────────────────────────────────────────────────
const ROUTE_DEFAULTS = {
  naph_jp:  { grade:"Naphtha",  buyQuotation:"MOPAG",    sellQuotation:"MOPJ"         },
  naph_sp:  { grade:"Naphtha",  buyQuotation:"MOPAG",    sellQuotation:"Spore Spot"   },
  fo180_sp: { grade:"FO 180",   buyQuotation:"FO180 AG Spot", sellQuotation:"FO180 Spore BalMo" },
  fo380_sp: { grade:"FO 380",   buyQuotation:"FO380 AG Spot", sellQuotation:"FO380 Spore BalMo" },
  gas_med:  { grade:"Gasoline 10ppm", buyQuotation:"Eurobob Mo01", sellQuotation:"Eurobob Mo01" },
};

const blankPhysical = (route="naph_jp") => ({
  type:"physical", route,
  cargoCode:"", seller:"",
  grade: ROUTE_DEFAULTS[route]?.grade || "Naphtha",
  uom:"MT",
  volume:25000, buyDate:today(),
  pricingTenor:"M1",
  buyQuotation:  ROUTE_DEFAULTS[route]?.buyQuotation  || "MOPAG",
  buyFlatPrice:"", buyPremDisc:"0",
  buyFixed:false,
  sellQuotation: ROUTE_DEFAULTS[route]?.sellQuotation || "MOPJ",
  sellFlatPrice:"", sellPremDisc:"0",
  sellFixed:false, sellDate:"", deliveryTerm:"CFR", deliveryPeriod:"",
  // Operation costs — each has a value + mode ("pmt" or "total") + editable label
  freightLabel:"Freight (Both DA Owner)", freightV: ROUTES[route]?.freightDef||78, freightMode:"pmt",
  demurrageLabel:"Demurrage",             demurrageV:"110000",   demurrageMode:"total",
  cargoLossLabel:"Cargo Loss",            cargoLossPct:"0.42",
  inspectionLabel:"Inspection",           inspectionV:"22912",   inspectionMode:"total",
  fxLossLabel:"FX Rate Loss",             fxLossV:"0",           fxLossMode:"total",
  daCostLabel:"DA Cost (Port)",           daCostV:"50000",       daCostMode:"total",
  customCosts:[],
  // Delivery date for backwardation calculation
  deliveryDate:"",
  // Finance costs
  hedgeCostPmt:"12", financeDays:"30", financeRatePct:"5.5",
  backwardationOverride:"",
  // Commissions — each has value + mode
  financierCommLabel:"Financier Comm",    financierCommV:"3",    financierCommMode:"pmt",
  brokerCommLabel:"Trade Broker Comm",   brokerCommV:"1",       brokerCommMode:"pmt",
  counterparty:"", buyer:"", notes:"", status:"OPEN",
  // Legacy fields for blotter MTM
  buyPrice:"", sellPrice:"", freight:ROUTES[route]?.freightDef||78, misc:0,
});
const blankPaper = () => ({
  type:"paper", instrument:"MOPJ_M1", direction:-1,
  entryPrice:"", volume:25000, entryDate:today(),
  exitFixed:false, exitDate:"", exitPrice:"",
  counterparty:"", notes:"", status:"OPEN",
});

// ── SMALL UI PIECES ───────────────────────────────────────────────────────
const INP = ({ label, value, onChange, type="text", step, min, style={}, note }) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...style}}>
    <label style={{color:T.muted,fontSize:9,letterSpacing:1.5,fontFamily:T.syne}}>{label}{note&&<span style={{color:T.dim,marginLeft:4,fontSize:8}}>{note}</span>}</label>
    <input type={type} step={step} min={min} value={value} onChange={e=>onChange(e.target.value)}
      style={{background:"#0a0a18",border:`1px solid ${T.border2}`,borderRadius:6,color:T.text,fontFamily:T.font,fontSize:11,padding:"7px 10px"}}/>
  </div>
);

const SEL = ({ label, value, onChange, options, style={} }) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...style}}>
    <label style={{color:T.muted,fontSize:9,letterSpacing:1.5,fontFamily:T.syne}}>{label}</label>
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{background:"#0a0a18",border:`1px solid ${T.border2}`,borderRadius:6,color:T.text,fontFamily:T.font,fontSize:11,padding:"7px 10px"}}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Toggle = ({ value, onChange, options }) => (
  <div style={{display:"flex",background:"#0a0a18",border:`1px solid ${T.border}`,borderRadius:8,padding:3,gap:2}}>
    {options.map(o=>(
      <button key={o.value} onClick={()=>onChange(o.value)}
        style={{padding:"6px 18px",borderRadius:6,border:"none",cursor:"pointer",fontFamily:T.syne,fontSize:10,fontWeight:600,letterSpacing:1,transition:"all .15s",
          background: value===o.value ? T.amber : "transparent",
          color:       value===o.value ? "#000"  : T.muted }}>
        {o.label}
      </button>
    ))}
  </div>
);

const Tag = ({text, color}) => (
  <span style={{background:color+"18",color,border:`1px solid ${color}44`,borderRadius:4,padding:"1px 7px",fontSize:9,fontFamily:T.font,fontWeight:700,letterSpacing:.5}}>{text}</span>
);

const PnLCell = ({v}) => (
  <span style={{color:pnlC(v),fontFamily:T.font,fontWeight:700}}>{v==null?"—":pnlSign(v)}</span>
);

const SectionLabel = ({icon,text}) => (
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
    <span style={{fontSize:12}}>{icon}</span>
    <span style={{color:T.muted,fontSize:9,letterSpacing:3,fontFamily:T.syne,fontWeight:700}}>{text}</span>
    <div style={{flex:1,height:1,background:T.border,marginLeft:4}}/>
  </div>
);

// ── RISK BAR ──────────────────────────────────────────────────────────────
function RiskBar({ cat, value }) {
  const abs = Math.abs(value);
  const isLong = value > 0;
  const maxBar = 100; // just visual scale
  const pct = Math.min(98, (abs/50000)*100); // scale relative to 50kt
  const c = isLong ? T.teal : T.orange;
  return (
    <div style={{background:T.card,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
        <span style={{color:T.muted,fontSize:9,fontFamily:T.syne,letterSpacing:.5}}>{cat}</span>
        <span style={{color:c,fontFamily:T.font,fontSize:12,fontWeight:700}}>{value===0?"FLAT":(isLong?"▲ LONG ":"▼ SHORT ")+fmtMT(abs)}</span>
      </div>
      <div style={{background:T.bg,borderRadius:3,height:5,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:c,borderRadius:3,transition:"width .4s"}}/>
      </div>
    </div>
  );
}

// ── DEAL COMPUTE ─────────────────────────────────────────────────────────

// Buy symbol map per route (benchmark for buy price per tenor)
const BUY_SYMS = {
  naph_jp:  { SPOT:"PAAAA00", BM:"NAGFM00", M1:"NAGFM01", M2:"NAGFM02" },
  naph_sp:  { SPOT:"PAAAA00", BM:"NAGFM00", M1:"NAGFM01", M2:"NAGFM02" },
  fo180_sp: { SPOT:"PUABE00", BM:"PUABE00", M1:"PUABE00", M2:"PUABE00" },
  fo380_sp: { SPOT:"AAIDC00", BM:"AAIDC00", M1:"AAIDC00", M2:"AAIDC00" },
  // Gas Med B2B — buy & sell both reference Eurobob (SPOT = physical Med cargo)
  gas_med:  { SPOT:"AAWZA00", BM:"ABWFB00", M1:"ABWFC00", M2:"ABWFD00" },
};

// Backwardation symbols M1−M2 per route (positive = backwardation = cost)
const BACK_SYMS = {
  naph_jp:  { m1:"AAXFE00", m2:"AAXFF00" },
  naph_sp:  { m1:"PAAAQ00", m2:"PAAAR00" },
  fo180_sp: { m1:"PUAXZ00", m2:"PUAYF00" },
  fo380_sp: { m1:"AAPKC00", m2:"AAPKD00" },
  gas_med:  { m1:"ABWFC00", m2:"ABWFD00" },  // Eurobob M1 / M2
};

// Quotation label options per route (descriptive — actual price driven by tenor + BUY_SYMS / sellSymbols)
const QUOTATION_OPTS = {
  naph_jp:  { buy:["MOPAG","MOPJ","AG Spot","Spore Spot","Fixed"],         sell:["MOPJ","MOPAG","Spore Spot","Japan Spot","Fixed"]    },
  naph_sp:  { buy:["MOPAG","Spore Spot","Fixed"],                           sell:["Spore Spot","MOPAG","Fixed"]                        },
  fo180_sp: { buy:["FO180 AG Spot","Fixed"],                                sell:["FO180 Spore Spot","FO180 Spore BalMo","Fixed"]      },
  fo380_sp: { buy:["FO380 AG Spot","Fixed"],                                sell:["FO380 Spore Spot","FO380 Spore BalMo","Fixed"]      },
  gas_med:  { buy:["Med Spot","Eurobob BalMo","Eurobob Mo01","Eurobob Mo02","Fixed"],
              sell:["Med Spot","Eurobob BalMo","Eurobob Mo01","Eurobob Mo02","Fixed"] },
};

// Resolve a cost: mode='pmt' → user entered $/mt, total=pmt×vol
//                mode='total' → user entered total $, pmt=total÷vol
function resolveCost(value, mode, vol) {
  const v = parseFloat(value) || 0;
  if (mode === "pmt")   return { pmt: v,              total: v * vol        };
  else                  return { pmt: vol > 0 ? v/vol : 0, total: v         };
}

function computeDeal(d, prices) {
  const vol = parseFloat(d.volume) || 0;
  // Expose date fields on d for backwardation calc below
  d = { buyDate: d.buyDate || "", deliveryDate: d.deliveryDate || "", ...d };

  // ── BUY PRICE ───────────────────────────────────────────────────────────
  const buySym  = BUY_SYMS[d.route]?.[d.pricingTenor || "M1"] || ROUTES[d.route]?.buySymbol;
  const buyBase = d.buyFixed
    ? parseFloat(d.buyFlatPrice) || 0
    : (prices[buySym] ?? parseFloat(d.buyFlatPrice) ?? 0);
  const buyPremDisc = parseFloat(d.buyPremDisc) || 0;
  const buyPrice    = buyBase + buyPremDisc;
  const cargoValue  = buyPrice * vol;         // Full cargo purchase value

  // ── SELL PRICE ──────────────────────────────────────────────────────────
  const sellSym  = ROUTES[d.route]?.sellSymbols[d.pricingTenor || "M1"];
  const sellBase = d.sellFixed
    ? parseFloat(d.sellFlatPrice) || 0
    : (prices[sellSym] ?? parseFloat(d.sellFlatPrice) ?? 0);
  const sellPremDisc = parseFloat(d.sellPremDisc) || 0;
  const sellPrice    = sellBase + sellPremDisc;
  const saleValue    = sellPrice * vol;        // Full cargo sale value

  // ── OPERATION COSTS ─────────────────────────────────────────────────────
  const freightC    = resolveCost(d.freightV,    d.freightMode    || "pmt",   vol);
  const demurrageC  = resolveCost(d.demurrageV,  d.demurrageMode  || "total", vol);
  const inspectionC = resolveCost(d.inspectionV, d.inspectionMode || "pmt",   vol);
  const fxLossC     = resolveCost(d.fxLossV,     d.fxLossMode     || "total", vol);
  const daCostC     = resolveCost(d.daCostV,     d.daCostMode     || "total", vol);
  // Cargo loss: % of buy value → always $/mt mode
  const cargoLossPct = parseFloat(d.cargoLossPct) || 0;
  const cargoLossPmt = (cargoLossPct / 100) * buyPrice;
  const cargoLossC   = { pmt: cargoLossPmt, total: cargoLossPmt * vol };
  // Custom costs
  const customCosts = (d.customCosts || []).map(c => ({
    ...c, ...resolveCost(c.value, c.mode || "pmt", vol),
  }));
  const totalCustomPmt = customCosts.reduce((a, c) => a + (c.pmt||0), 0);

  const totalOpsPmt = freightC.pmt + demurrageC.pmt + cargoLossC.pmt +
    inspectionC.pmt + fxLossC.pmt + daCostC.pmt + totalCustomPmt;
  const totalOpsTotal = totalOpsPmt * vol;

  // ── FINANCE COSTS ───────────────────────────────────────────────────────
  const hedgeCostPmt = parseFloat(d.hedgeCostPmt) || 0;
  const finRate      = (parseFloat(d.financeRatePct) || 0) / 100;
  const finDays      = parseFloat(d.financeDays) || 0;
  const finCostPmt   = cargoValue > 0 ? (cargoValue * finRate * finDays / 360) / vol : 0;

  // Backwardation cost — derived from delivery date vs trade date
  // Logic: if delivery is in a DIFFERENT calendar month from the trade date,
  //   the hedge (placed at M1 today) must be rolled when M1 expires → pay M1−M2 backwardation.
  //   If same month → hedge at BalMo, no roll needed.
  const backSyms = BACK_SYMS[d.route];
  const m1Price  = backSyms ? (prices[backSyms.m1] ?? 0) : 0;
  const m2Price  = backSyms ? (prices[backSyms.m2] ?? 0) : 0;

  // Parse trade month and delivery month
  const tradeDate    = d.buyDate || "";
  const deliveryDate = d.deliveryDate || "";
  let monthDiff      = null;  // null = unknown (no delivery date entered)
  let tradeMonthStr  = "";
  let delivMonthStr  = "";
  if (tradeDate && deliveryDate) {
    const tDate = new Date(tradeDate);
    const dDate = new Date(deliveryDate);
    const tYM   = tDate.getFullYear()*12 + tDate.getMonth();
    const dYM   = dDate.getFullYear()*12 + dDate.getMonth();
    monthDiff   = dYM - tYM;
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    tradeMonthStr = `${MONTHS[tDate.getMonth()]} ${tDate.getFullYear()}`;
    delivMonthStr = `${MONTHS[dDate.getMonth()]} ${dDate.getFullYear()}`;
  }

  // Apply backwardation only if delivery is in a different month (monthDiff >= 1)
  // monthDiff = 0 → same month, BM hedge, no roll needed
  // monthDiff = 1 → delivery next month, M1 hedge → rolls once at M1 expiry → M1−M2 cost
  // monthDiff >= 2 → multiple rolls possible, but we only have M1/M2 data so apply once
  const rollApplies = monthDiff === null
    ? (d.pricingTenor === "M1")           // fallback: use tenor if no dates entered
    : monthDiff >= 1;

  const rawBackCostPmt = (rollApplies && m1Price > 0 && m2Price > 0)
    ? Math.max(0, m1Price - m2Price)
    : 0;

  // Detect contango (m1 < m2) — in this case roll earns, not costs
  const rawBackEarn = (rollApplies && m1Price > 0 && m2Price > 0)
    ? Math.max(0, m2Price - m1Price)
    : 0;

  // Net: positive = backwardation cost, negative = contango earn
  const backCostPmt  = rawBackCostPmt;
  const backEarnPmt  = rawBackEarn;
  const netBackPmt   = rawBackCostPmt - rawBackEarn; // positive = cost, negative = earn

  const backwardationOverride = d.backwardationOverride !== "" ? parseFloat(d.backwardationOverride) : null;
  const effectiveBackCost     = backwardationOverride !== null && !isNaN(backwardationOverride)
    ? backwardationOverride
    : netBackPmt;

  // Store for display
  const backInfo = { rollApplies, monthDiff, tradeMonthStr, delivMonthStr, netBackPmt };

  const totalFinPmt   = hedgeCostPmt + finCostPmt + effectiveBackCost;
  const totalFinTotal = totalFinPmt * vol;

  // ── COMMISSIONS ─────────────────────────────────────────────────────────
  const finCommC  = resolveCost(d.financierCommV,  d.financierCommMode  || "pmt", vol);
  const brkCommC  = resolveCost(d.brokerCommV,     d.brokerCommMode     || "pmt", vol);
  const totalCommPmt   = finCommC.pmt + brkCommC.pmt;
  const totalCommTotal = totalCommPmt * vol;

  // ── TOTALS ───────────────────────────────────────────────────────────────
  const totalCostPmt   = totalOpsPmt + totalFinPmt + totalCommPmt;
  const totalCostTotal = totalCostPmt * vol;
  const landingCostPmt = buyPrice + totalCostPmt;   // ← what you need to recover
  const landingCostTotal = landingCostPmt * vol;
  const netPerMT       = sellPrice - landingCostPmt;
  const netTotal       = netPerMT * vol;

  return {
    // prices
    buyPrice, buyBase, buyPremDisc, buySym,
    sellPrice, sellBase, sellPremDisc, sellSym,
    cargoValue, saleValue,
    // ops
    freightC, demurrageC, cargoLossC, inspectionC, fxLossC, daCostC,
    customCosts, totalOpsPmt, totalOpsTotal,
    // finance
    hedgeCostPmt, finCostPmt, backCostPmt, effectiveBackCost,
    m1Price, m2Price,
    totalFinPmt, totalFinTotal,
    // comms
    finCommC, brkCommC, totalCommPmt, totalCommTotal,
    // totals
    totalCostPmt, totalCostTotal,
    landingCostPmt, landingCostTotal,
    netPerMT, netTotal,
    vol,
    // legacy
    cargoLoss: cargoLossC.pmt, finCostPmtVal: finCostPmt,
    freight: freightC.pmt, totalOps: totalOpsPmt,
    totalFin: totalFinPmt, totalComm: totalCommPmt, totalCost: totalCostPmt,
    cargoVal: cargoValue,
    backInfo,
  };
}

// ── COST ROW COMPONENT ────────────────────────────────────────────────────
// Dual-input: toggle between $/mt entry and Total $ entry
function CostRow({ label, labelField, valueField, modeField, data, set, vol, onDelete, note }) {
  const mode  = data[modeField] || "pmt";
  const v     = parseFloat(data[valueField]) || 0;
  const isPmt = mode === "pmt";
  const pmt   = isPmt ? v : (vol > 0 ? v / vol : 0);
  const total = isPmt ? v * vol : v;
  const IS2   = {
    background:"#0a0a18", border:`1px solid ${T.border2}`, borderRadius:4,
    color:T.orange, fontFamily:T.font, fontSize:10, padding:"3px 6px", width:"88px",
    textAlign:"right",
  };

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 102px 20px 110px 26px",
      gap:0, borderBottom:`1px solid ${T.border}`, padding:"4px 0", alignItems:"center"}}>
      <div style={{paddingLeft:8}}>
        {labelField ? (
          <input
            value={data[labelField] ?? label}
            onChange={e => set(labelField, e.target.value)}
            style={{background:"transparent", border:"none", borderBottom:`1px dashed ${T.border2}`,
              color:T.muted, fontFamily:T.syne, fontSize:9, padding:"1px 0", width:"90%",
              outline:"none"}}
            title="Click to rename"/>
        ) : (
          <span style={{color:T.muted, fontSize:9, fontFamily:T.syne}}>{label}</span>
        )}
        {note && <span style={{color:T.dim, fontSize:7, marginLeft:4}}>{note}</span>}
      </div>
      {/* $/mt input or computed */}
      <div style={{paddingRight:4}}>
        {isPmt ? (
          <input type="number" step="0.01" value={data[valueField]}
            onChange={e => set(valueField, e.target.value)} style={IS2}/>
        ) : (
          <span style={{color:T.muted, fontFamily:T.font, fontSize:10,
            textAlign:"right", display:"block", paddingRight:4}}>
            {pmt.toFixed(2)}
          </span>
        )}
      </div>
      {/* mode toggle */}
      <button onClick={() => set(modeField, isPmt ? "total" : "pmt")}
        title="Toggle $/mt ↔ Total"
        style={{background:"transparent", border:"none", cursor:"pointer",
          color:T.dim, fontSize:9, padding:"0 2px", lineHeight:1}}>
        {isPmt ? "⇄" : "⇄"}
      </button>
      {/* Total input or computed */}
      <div style={{paddingRight:4}}>
        {!isPmt ? (
          <input type="number" step="1" value={data[valueField]}
            onChange={e => set(valueField, e.target.value)}
            style={{...IS2, color:T.orange, width:"106px"}}/>
        ) : (
          <span style={{color:T.muted, fontFamily:T.font, fontSize:9,
            textAlign:"right", display:"block", paddingRight:4}}>
            {total > 0 ? `$${total.toLocaleString("en-US",{maximumFractionDigits:0})}` : "—"}
          </span>
        )}
      </div>
      {/* delete button (only for custom rows) */}
      <div style={{textAlign:"center"}}>
        {onDelete && (
          <button onClick={onDelete}
            style={{background:"transparent", border:"none", cursor:"pointer",
              color:T.red+"88", fontSize:11, padding:0, lineHeight:1}}>×</button>
        )}
      </div>
    </div>
  );
}

// ── DEAL ESTIMATE FORM ────────────────────────────────────────────────────
function DealEstimateForm({ data, set, prices }) {
  const d         = computeDeal(data, prices);
  const hasPrices = prices && Object.keys(prices).length > 0;
  const vol       = parseFloat(data.volume) || 0;

  const IS = {
    background:"#0a0a18", border:`1px solid ${T.border2}`, borderRadius:5,
    color:T.text, fontFamily:T.font, fontSize:11, padding:"6px 8px", width:"100%",
  };
  const SS = { ...IS, background:"#070710" };

  // Column header
  const ColHdr = () => (
    <div style={{display:"grid", gridTemplateColumns:"1fr 102px 20px 110px 26px",
      gap:0, marginBottom:4, paddingBottom:3, borderBottom:`1px solid ${T.border2}`}}>
      <span style={{color:T.dim, fontSize:8, fontFamily:T.syne, letterSpacing:1}}>ITEM</span>
      <span style={{color:T.dim, fontSize:8, fontFamily:T.syne, textAlign:"right", paddingRight:4}}>$/MT</span>
      <span/>
      <span style={{color:T.dim, fontSize:8, fontFamily:T.syne, textAlign:"right", paddingRight:4}}>TOTAL USD</span>
      <span/>
    </div>
  );

  const TotalRow = ({ label, pmt, total, color }) => (
    <div style={{display:"grid", gridTemplateColumns:"1fr 102px 20px 110px 26px",
      gap:0, padding:"5px 0", background:"#0e0e20", borderRadius:4, marginTop:2}}>
      <span style={{color:color||T.text, fontSize:10, fontFamily:T.syne, fontWeight:700}}>{label}</span>
      <span style={{color:color||T.text, fontFamily:T.font, fontSize:10, fontWeight:700,
        textAlign:"right", paddingRight:4}}>{pmt != null ? pmt.toFixed(2) : ""}</span>
      <span/>
      <span style={{color:color||T.text, fontFamily:T.font, fontSize:10, fontWeight:700,
        textAlign:"right", paddingRight:4}}>
        {total != null ? `$${Math.abs(total).toLocaleString("en-US",{maximumFractionDigits:0})}` : ""}
      </span>
      <span/>
    </div>
  );

  // Add custom cost
  const addCustom = () => {
    const existing = data.customCosts || [];
    set("customCosts", [...existing, { id: Math.random().toString(36).slice(2,8),
      label:"Custom Cost", value:"0", mode:"pmt" }]);
  };
  const setCustom = (id, field, val) => {
    set("customCosts", (data.customCosts||[]).map(c => c.id===id ? {...c,[field]:val} : c));
  };
  const delCustom = (id) => {
    set("customCosts", (data.customCosts||[]).filter(c => c.id!==id));
  };

  // Sensitivity
  const sens = [-20,-10,0,10,20].map(delta => ({
    delta, net:(d.netPerMT+delta)*vol, pmt:d.netPerMT+delta,
  }));

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 390px", gap:16, alignItems:"start"}}>

      {/* ══ LEFT: INPUTS ══ */}
      <div style={{display:"flex", flexDirection:"column", gap:14}}>

        {/* ── CARGO DETAILS ── */}
        <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px"}}>
          <div style={{color:T.amber, fontSize:9, letterSpacing:3, fontFamily:T.syne, fontWeight:700, marginBottom:12}}>📦 CARGO DETAILS</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:8}}>
            <div>
              <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>ROUTE</div>
              <select value={data.route} onChange={e=>{
                const key = e.target.value;
                const r   = ROUTES[key];
                const def = ROUTE_DEFAULTS[key] || {};
                set("route",           key);
                set("freightV",        r.freightDef);
                set("grade",           def.grade           || "Naphtha");
                set("buyQuotation",    def.buyQuotation    || "MOPAG");
                set("sellQuotation",   def.sellQuotation   || "MOPJ");
              }} style={{...SS, fontSize:10}}>
                {Object.entries(ROUTES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>VOLUME (MT)</div>
              <input type="number" step="1000" value={data.volume}
                onChange={e=>set("volume",e.target.value)} style={IS}/>
            </div>
            <div>
              <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>TRADE DATE</div>
              <input type="date" value={data.buyDate}
                onChange={e=>set("buyDate",e.target.value)} style={IS}/>
            </div>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8}}>
            {[["CARGO CODE","cargoCode","e.g. N-001"],["SELLER","seller",""],["BUYER","buyer",""],].map(([l,k,ph])=>(
              <div key={k}>
                <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>{l}</div>
                <input value={data[k]} onChange={e=>set(k,e.target.value)} style={IS} placeholder={ph}/>
              </div>
            ))}
            <div>
              <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>DELIVERY TERM</div>
              <select value={data.deliveryTerm} onChange={e=>set("deliveryTerm",e.target.value)} style={SS}>
                {["FOB","CFR","CIF","DES","DAP"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── BUY / SELL PRICING ── */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>

          {/* BUY LEG */}
          <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
              <span style={{color:T.orange, fontSize:9, letterSpacing:3, fontFamily:T.syne, fontWeight:700}}>📥 BUY LEG</span>
              <label style={{display:"flex", alignItems:"center", gap:5, cursor:"pointer"}}>
                <input type="checkbox" checked={data.buyFixed}
                  onChange={e=>set("buyFixed",e.target.checked)} style={{accentColor:T.amber}}/>
                <span style={{color:data.buyFixed?T.amber:T.muted, fontSize:8, fontFamily:T.syne}}>FIXED PRICE</span>
              </label>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:7}}>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6}}>
                <div>
                  <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>QUOTATION</div>
                  <select value={data.buyQuotation} onChange={e=>set("buyQuotation",e.target.value)} style={SS}>
                    {(QUOTATION_OPTS[data.route]?.buy || ["MOPAG","MOPJ","AG Spot","Spore Spot","Fixed"]).map(q=><option key={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>TENOR</div>
                  <select value={data.pricingTenor} onChange={e=>set("pricingTenor",e.target.value)} style={SS}>
                    {[["SPOT","Spot"],["BM","BalMo"],["M1","Mo01"],["M2","Mo02"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Live price from CSV */}
              {hasPrices && !data.buyFixed && (
                <div style={{background:"#0a0a15", borderRadius:5, padding:"6px 10px"}}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:2}}>
                    <span style={{color:T.dim, fontSize:8, fontFamily:T.syne}}>BENCHMARK ({d.buySym})</span>
                    <span style={{color:T.amber, fontFamily:T.font, fontSize:11, fontWeight:700}}>
                      {d.buyBase>0 ? d.buyBase.toFixed(2) : "—"} $/mt
                    </span>
                  </div>
                  <div style={{color:T.dim, fontSize:7, fontFamily:T.syne}}>Latest close from CSV</div>
                </div>
              )}
              {data.buyFixed && (
                <div>
                  <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>FLAT PRICE $/mt</div>
                  <input type="number" step="0.01" value={data.buyFlatPrice}
                    onChange={e=>set("buyFlatPrice",e.target.value)} style={{...IS, color:T.amber}}/>
                </div>
              )}
              <div>
                <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>PREM / DISC $/mt</div>
                <input type="number" step="0.01" value={data.buyPremDisc}
                  onChange={e=>set("buyPremDisc",e.target.value)} style={IS}/>
              </div>
              {/* Effective buy + cargo value */}
              <div style={{background:"#0a0510", borderRadius:6, padding:"8px 10px"}}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                  <span style={{color:T.muted, fontSize:9, fontFamily:T.syne}}>EFFECTIVE BUY</span>
                  <span style={{color:T.orange, fontFamily:T.font, fontSize:13, fontWeight:700}}>
                    {d.buyPrice>0 ? d.buyPrice.toFixed(2) : "—"} $/mt
                  </span>
                </div>
                <div style={{display:"flex", justifyContent:"space-between"}}>
                  <span style={{color:T.dim, fontSize:8, fontFamily:T.syne}}>CARGO VALUE ({(vol/1000).toFixed(0)}k MT)</span>
                  <span style={{color:T.orange+"aa", fontFamily:T.font, fontSize:11, fontWeight:700}}>
                    {d.cargoValue>0 ? `$${d.cargoValue.toLocaleString("en-US",{maximumFractionDigits:0})}` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SELL LEG */}
          <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
              <span style={{color:T.teal, fontSize:9, letterSpacing:3, fontFamily:T.syne, fontWeight:700}}>📤 SELL LEG</span>
              <label style={{display:"flex", alignItems:"center", gap:5, cursor:"pointer"}}>
                <input type="checkbox" checked={data.sellFixed}
                  onChange={e=>set("sellFixed",e.target.checked)} style={{accentColor:T.amber}}/>
                <span style={{color:data.sellFixed?T.amber:T.muted, fontSize:8, fontFamily:T.syne}}>FIXED PRICE</span>
              </label>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:7}}>
              <div>
                <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>QUOTATION BASIS</div>
                <select value={data.sellQuotation} onChange={e=>set("sellQuotation",e.target.value)} style={SS}>
                  {(QUOTATION_OPTS[data.route]?.sell || ["MOPJ","MOPAG","Spore Spot","Japan Spot","Fixed"]).map(q=><option key={q}>{q}</option>)}
                </select>
              </div>
              {hasPrices && !data.sellFixed && (
                <div style={{background:"#0a0a15", borderRadius:5, padding:"6px 10px"}}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:2}}>
                    <span style={{color:T.dim, fontSize:8, fontFamily:T.syne}}>BENCHMARK ({d.sellSym})</span>
                    <span style={{color:T.teal, fontFamily:T.font, fontSize:11, fontWeight:700}}>
                      {d.sellBase>0 ? d.sellBase.toFixed(2) : "—"} $/mt
                    </span>
                  </div>
                </div>
              )}
              {data.sellFixed && (
                <div>
                  <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>FLAT PRICE $/mt</div>
                  <input type="number" step="0.01" value={data.sellFlatPrice}
                    onChange={e=>set("sellFlatPrice",e.target.value)} style={{...IS, color:T.teal}}/>
                </div>
              )}
              <div>
                <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>PREM / DISC $/mt</div>
                <input type="number" step="0.01" value={data.sellPremDisc}
                  onChange={e=>set("sellPremDisc",e.target.value)} style={IS}/>
              </div>
              <div>
                <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:3, fontFamily:T.syne}}>DELIVERY PERIOD</div>
                <input value={data.deliveryPeriod}
                  onChange={e=>set("deliveryPeriod",e.target.value)} style={IS} placeholder="e.g. Apr 1–15"/>
              </div>
              {/* Effective sell + sale value */}
              <div style={{background:"#050a10", borderRadius:6, padding:"8px 10px"}}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                  <span style={{color:T.muted, fontSize:9, fontFamily:T.syne}}>EFFECTIVE SELL</span>
                  <span style={{color:T.teal, fontFamily:T.font, fontSize:13, fontWeight:700}}>
                    {d.sellPrice>0 ? d.sellPrice.toFixed(2) : "—"} $/mt
                  </span>
                </div>
                <div style={{display:"flex", justifyContent:"space-between"}}>
                  <span style={{color:T.dim, fontSize:8, fontFamily:T.syne}}>SALE VALUE</span>
                  <span style={{color:T.teal+"aa", fontFamily:T.font, fontSize:11, fontWeight:700}}>
                    {d.saleValue>0 ? `$${d.saleValue.toLocaleString("en-US",{maximumFractionDigits:0})}` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── OPERATION COSTS ── */}
        <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
            <span style={{color:"#f97316", fontSize:9, letterSpacing:3, fontFamily:T.syne, fontWeight:700}}>⚙ OPERATION COSTS</span>
            <span style={{color:T.dim, fontSize:7, fontFamily:T.syne}}>⇄ = toggle $/mt ↔ Total</span>
          </div>
          <ColHdr/>
          {/* Standard costs with dual-mode toggle */}
          <CostRow labelField="freightLabel" label="Freight (Both DA Owner)" valueField="freightV" modeField="freightMode" data={data} set={set} vol={vol}/>
          <CostRow labelField="demurrageLabel" label="Demurrage" valueField="demurrageV" modeField="demurrageMode" data={data} set={set} vol={vol}/>
          {/* Cargo loss: % special row */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 102px 20px 110px 26px",
            gap:0, borderBottom:`1px solid ${T.border}`, padding:"4px 0", alignItems:"center"}}>
            <div style={{paddingLeft:8}}>
              <span style={{color:T.muted, fontSize:9, fontFamily:T.syne}}>Cargo Loss</span>
              <span style={{color:T.dim, fontSize:7, marginLeft:4}}>% of buy price</span>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:3, paddingRight:4}}>
              <input type="number" step="0.01" min="0" value={data.cargoLossPct}
                onChange={e=>set("cargoLossPct",e.target.value)}
                style={{background:"#0a0a18", border:`1px solid ${T.border2}`, borderRadius:4,
                  color:T.orange, fontFamily:T.font, fontSize:10, padding:"3px 5px", width:"52px", textAlign:"right"}}/>
              <span style={{color:T.dim, fontSize:9}}>%</span>
            </div>
            <span/>
            <span style={{color:T.muted, fontFamily:T.font, fontSize:9, textAlign:"right", paddingRight:4}}>
              {d.cargoLossC.total>0 ? `$${d.cargoLossC.total.toLocaleString("en-US",{maximumFractionDigits:0})}` : "—"}
            </span>
            <span/>
          </div>
          <CostRow labelField="inspectionLabel" label="Inspection" valueField="inspectionV" modeField="inspectionMode" data={data} set={set} vol={vol}/>
          <CostRow labelField="fxLossLabel" label="FX Rate Loss" valueField="fxLossV" modeField="fxLossMode" data={data} set={set} vol={vol}/>
          <CostRow labelField="daCostLabel" label="DA Cost (Port)" valueField="daCostV" modeField="daCostMode" data={data} set={set} vol={vol}/>
          {/* Custom costs */}
          {(data.customCosts||[]).map(c=>(
            <div key={c.id}>
              {/* Editable label */}
              <div style={{paddingLeft:8, paddingTop:3, paddingBottom:1}}>
                <input value={c.label} onChange={e=>setCustom(c.id,"label",e.target.value)}
                  style={{background:"transparent", border:"none", color:T.muted, fontFamily:T.syne,
                    fontSize:9, padding:0, width:"180px"}} placeholder="Cost name..."/>
              </div>
              <CostRow
                label="" valueField="value" modeField="mode"
                data={c} set={(k,v)=>setCustom(c.id,k,v)} vol={vol}
                onDelete={()=>delCustom(c.id)}/>
            </div>
          ))}
          {/* Add cost button */}
          <button onClick={addCustom}
            style={{marginTop:8, background:"transparent", border:`1px dashed ${T.border2}`,
              borderRadius:5, color:T.muted, fontFamily:T.syne, fontSize:9, padding:"5px 12px",
              cursor:"pointer", width:"100%", letterSpacing:1}}>
            + ADD COST
          </button>
          <TotalRow label="OPERATIONS TOTAL" pmt={d.totalOpsPmt} total={d.totalOpsTotal} color="#f97316"/>
        </div>

        {/* ── FINANCE + COMMISSIONS ── */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>

          {/* FINANCE */}
          <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px"}}>
            <div style={{color:"#a78bfa", fontSize:9, letterSpacing:3, fontFamily:T.syne, fontWeight:700, marginBottom:10}}>💳 FINANCE COSTS</div>
            <ColHdr/>
            {/* Hedge/Roll */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 102px 20px 110px 26px",
              gap:0, borderBottom:`1px solid ${T.border}`, padding:"4px 0", alignItems:"center"}}>
              <span style={{color:T.muted, fontSize:9, fontFamily:T.syne, paddingLeft:8}}>Hedge / Roll Cost</span>
              <input type="number" step="0.01" value={data.hedgeCostPmt}
                onChange={e=>set("hedgeCostPmt",e.target.value)}
                style={{background:"#0a0a18", border:`1px solid ${T.border2}`, borderRadius:4,
                  color:T.orange, fontFamily:T.font, fontSize:10, padding:"3px 6px", width:"88px", textAlign:"right"}}/>
              <span/>
              <span style={{color:T.muted, fontFamily:T.font, fontSize:9, textAlign:"right", paddingRight:4}}>
                {`$${(parseFloat(data.hedgeCostPmt||0)*vol).toLocaleString("en-US",{maximumFractionDigits:0})}`}
              </span>
              <span/>
            </div>
            {/* Finance cost (auto-calc) */}
            <div style={{borderBottom:`1px solid ${T.border}`, padding:"4px 0"}}>
              <div style={{display:"grid", gridTemplateColumns:"1fr 102px 20px 110px 26px", alignItems:"center"}}>
                <span style={{color:T.muted, fontSize:9, fontFamily:T.syne, paddingLeft:8}}>Finance Cost</span>
                <div style={{display:"flex", gap:2, paddingRight:2}}>
                  <input type="number" step="0.1" value={data.financeRatePct}
                    onChange={e=>set("financeRatePct",e.target.value)}
                    style={{background:"#0a0a18", border:`1px solid ${T.border2}`, borderRadius:3,
                      color:T.muted, fontFamily:T.font, fontSize:9, padding:"2px 3px", width:"34px"}} placeholder="%"/>
                  <span style={{color:T.dim, fontSize:8, alignSelf:"center"}}>%</span>
                  <input type="number" step="1" value={data.financeDays}
                    onChange={e=>set("financeDays",e.target.value)}
                    style={{background:"#0a0a18", border:`1px solid ${T.border2}`, borderRadius:3,
                      color:T.muted, fontFamily:T.font, fontSize:9, padding:"2px 3px", width:"28px"}} placeholder="d"/>
                  <span style={{color:T.dim, fontSize:8, alignSelf:"center"}}>d</span>
                </div>
                <span/>
                <span style={{color:T.muted, fontFamily:T.font, fontSize:9, textAlign:"right", paddingRight:4}}>
                  {d.finCostPmt>0?`$${(d.finCostPmt*vol).toLocaleString("en-US",{maximumFractionDigits:0})}`:"-"}
                </span>
                <span/>
              </div>
              <div style={{color:T.dim, fontSize:7, paddingLeft:8}}>
                {d.finCostPmt>0 ? `${d.finCostPmt.toFixed(2)} $/mt · ${data.financeRatePct}% × ${data.financeDays}d` : `${data.financeRatePct}% p.a. × ${data.financeDays} days`}
              </div>
            </div>
            {/* Backwardation cost — delivery date aware */}
            <div style={{borderBottom:`1px solid ${T.border}`, padding:"6px 0"}}>
              {/* Delivery date input */}
              <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:8,
                alignItems:"center", paddingLeft:8, marginBottom:6}}>
                <div>
                  <span style={{color:T.muted, fontSize:9, fontFamily:T.syne}}>Backwardation (Roll Cost)</span>
                  <span style={{color:T.dim, fontSize:7, marginLeft:4}}>M1−M2 when delivery month ≠ trade month</span>
                </div>
                <div style={{display:"flex", alignItems:"center", gap:5}}>
                  <span style={{color:T.dim, fontSize:8, fontFamily:T.syne, whiteSpace:"nowrap"}}>DELIVERY DATE</span>
                  <input type="date" value={data.deliveryDate||""}
                    onChange={e=>set("deliveryDate", e.target.value)}
                    style={{background:"#0a0a18", border:`1px solid ${T.amber}44`, borderRadius:4,
                      color:T.text, fontFamily:T.font, fontSize:9, padding:"3px 7px"}}/>
                </div>
              </div>

              {/* Status chip — month logic */}
              {(()=>{
                const bi = d.backInfo;
                let chipC, chipT, det;
                if (!data.deliveryDate) {
                  chipC="#334d63"; chipT="NO DELIVERY DATE";
                  det="Enter delivery date above to auto-determine roll applicability.";
                } else if (bi.monthDiff===0) {
                  chipC=T.green; chipT="SAME MONTH — NO ROLL";
                  det=`Trade & delivery both in ${bi.tradeMonthStr}. Hedge at BalMo — no roll cost.`;
                } else if (bi.monthDiff===1) {
                  chipC=T.orange; chipT="NEXT MONTH — ROLL APPLIES";
                  det=`${bi.tradeMonthStr} → ${bi.delivMonthStr}. Hedge at M1, must roll to M2 at expiry.`;
                } else if (bi.monthDiff>=2) {
                  chipC=T.red; chipT=`+${bi.monthDiff} MONTHS — MULTIPLE ROLLS`;
                  det=`${bi.tradeMonthStr} → ${bi.delivMonthStr}. M1−M2 cost shown for first roll. Override if multiple rolls expected.`;
                } else {
                  chipC=T.muted; chipT="CHECK DATES"; det="Delivery appears before trade date.";
                }
                return (
                  <div style={{paddingLeft:8, marginBottom:6}}>
                    <div style={{display:"inline-flex", alignItems:"center", gap:5,
                      background:chipC+"15", border:`1px solid ${chipC}44`,
                      borderRadius:4, padding:"2px 9px", marginBottom:3}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:chipC}}/>
                      <span style={{color:chipC, fontSize:8, fontFamily:T.syne, fontWeight:700, letterSpacing:.5}}>{chipT}</span>
                    </div>
                    <div style={{color:T.dim, fontSize:7, fontFamily:T.syne}}>{det}</div>
                  </div>
                );
              })()}

              {/* Value + override row */}
              <div style={{display:"grid", gridTemplateColumns:"1fr 102px 20px 110px 26px", alignItems:"center"}}>
                <div style={{paddingLeft:8}}>
                  <span style={{color:T.dim, fontSize:8, fontFamily:T.syne}}>
                    {hasPrices && d.m1Price>0 && d.m2Price>0
                      ? `CSV: ${d.m1Price.toFixed(1)} M1 − ${d.m2Price.toFixed(1)} M2 = ${d.backCostPmt.toFixed(2)} $/mt`
                      : "Load CSV for auto · or enter override →"}
                  </span>
                </div>
                <input type="number" step="0.01"
                  value={data.backwardationOverride}
                  onChange={e=>set("backwardationOverride", e.target.value)}
                  placeholder={d.backInfo.rollApplies && d.backCostPmt>0 ? d.backCostPmt.toFixed(2) : "0.00"}
                  style={{background:"#0a0a18", border:`1px solid ${T.border2}`, borderRadius:4,
                    color:d.effectiveBackCost>0?T.orange:T.muted, fontFamily:T.font, fontSize:10,
                    padding:"3px 6px", width:"88px", textAlign:"right"}}/>
                <span/>
                <span style={{color:d.effectiveBackCost!==0?T.orange:T.muted,
                  fontFamily:T.font, fontSize:9, textAlign:"right", paddingRight:4}}>
                  {d.effectiveBackCost!==0
                    ? `${d.effectiveBackCost>0?"-":"+"}$${Math.abs(d.effectiveBackCost*vol).toLocaleString("en-US",{maximumFractionDigits:0})}`
                    : "—"}
                </span>
                <span/>
              </div>
              {data.backwardationOverride!=="" && d.backCostPmt>0 && (
                <div style={{color:T.amber+"99", fontSize:7, paddingLeft:8, marginTop:2, fontFamily:T.syne}}>
                  ⚠ Manual override · auto value: {d.backCostPmt.toFixed(2)} $/mt
                </div>
              )}
            </div>
            <TotalRow label="FINANCE TOTAL" pmt={d.totalFinPmt} total={d.totalFinTotal} color="#a78bfa"/>
          </div>

          {/* COMMISSIONS */}
          <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px"}}>
            <div style={{color:"#ec4899", fontSize:9, letterSpacing:3, fontFamily:T.syne, fontWeight:700, marginBottom:10}}>🤝 COMMISSIONS</div>
            <ColHdr/>
            <CostRow labelField="financierCommLabel" label="Financier Comm" valueField="financierCommV" modeField="financierCommMode" data={data} set={set} vol={vol}/>
            <CostRow labelField="brokerCommLabel" label="Trade Broker Comm" valueField="brokerCommV" modeField="brokerCommMode" data={data} set={set} vol={vol}/>
            <TotalRow label="COMM TOTAL" pmt={d.totalCommPmt} total={d.totalCommTotal} color="#ec4899"/>
          </div>
        </div>

        {/* ── NOTES ── */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
          {[["COUNTERPARTY","counterparty",""],["NOTES","notes","Additional notes"]].map(([l,k,ph])=>(
            <div key={k}>
              <div style={{color:T.muted, fontSize:8, letterSpacing:1, marginBottom:4, fontFamily:T.syne}}>{l}</div>
              <input value={data[k]} onChange={e=>set(k,e.target.value)} style={IS} placeholder={ph}/>
            </div>
          ))}
        </div>

      </div>{/* end left */}

      {/* ══ RIGHT: LIVE P&L PANEL ══ */}
      <div style={{display:"flex", flexDirection:"column", gap:10, position:"sticky", top:72}}>

        {/* Deal P&L Waterfall */}
        <div style={{background:T.card2, border:`1px solid ${T.border2}`, borderRadius:12, padding:"16px 18px"}}>
          <div style={{color:T.amber, fontSize:9, letterSpacing:3, fontFamily:T.syne, fontWeight:700, marginBottom:14}}>📊 DEAL ESTIMATE — LIVE</div>

          {/* Waterfall rows */}
          {[
            { label:"Sale Value",         value:d.saleValue,        pmt:d.sellPrice,      color:T.teal,     sign:"+", show:d.saleValue>0 },
            { label:"− Cargo Cost",       value:-d.cargoValue,       pmt:-d.buyPrice,     color:T.orange,   sign:"-", show:d.cargoValue>0 },
            { label:"− Operation Costs",  value:-d.totalOpsTotal,   pmt:-d.totalOpsPmt,   color:"#f97316",  sign:"-", show:true },
            { label:"− Finance Costs",    value:-d.totalFinTotal,   pmt:-d.totalFinPmt,   color:"#a78bfa",  sign:"-", show:true },
            { label:"− Commissions",      value:-d.totalCommTotal,  pmt:-d.totalCommPmt,  color:"#ec4899",  sign:"-", show:true },
          ].map(({label,value,pmt,color,show})=>show?(
            <div key={label} style={{display:"flex", justifyContent:"space-between",
              alignItems:"baseline", padding:"4px 0", borderBottom:`1px solid ${T.border}`}}>
              <span style={{color:T.muted, fontSize:9, fontFamily:T.syne}}>{label}</span>
              <div style={{textAlign:"right"}}>
                <div style={{color, fontFamily:T.font, fontSize:11, fontWeight:700}}>
                  {value>=0?"+":""}{value!==0?value.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}):"—"}
                </div>
                <div style={{color:color+"88", fontSize:8, fontFamily:T.font}}>
                  {pmt!==0?(pmt>=0?"+":"")+pmt.toFixed(2):""} $/mt
                </div>
              </div>
            </div>
          ):null)}

          {/* Landing Cost */}
          <div style={{background:"#0a0a18", borderRadius:6, padding:"8px 10px", margin:"8px 0"}}>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
              <span style={{color:T.muted, fontSize:9, fontFamily:T.syne, letterSpacing:.5}}>LANDING COST</span>
              <span style={{color:T.orange, fontFamily:T.font, fontSize:11, fontWeight:700}}>
                {d.landingCostPmt>0 ? `${d.landingCostPmt.toFixed(2)} $/mt` : "—"}
              </span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between"}}>
              <span style={{color:T.dim, fontSize:8, fontFamily:T.syne}}>Buy + all costs</span>
              <span style={{color:T.orange+"88", fontFamily:T.font, fontSize:10}}>
                {d.landingCostTotal>0 ? `$${d.landingCostTotal.toLocaleString("en-US",{maximumFractionDigits:0})}` : ""}
              </span>
            </div>
          </div>

          {/* Net Profit */}
          <div style={{background:d.netPerMT>=0?"#10b98115":"#ef444415",
            border:`1px solid ${d.netPerMT>=0?T.green+"44":T.red+"44"}`,
            borderRadius:8, padding:"12px 14px"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5}}>
              <span style={{color:T.muted, fontSize:9, fontFamily:T.syne, letterSpacing:1}}>NET PROFIT</span>
              <span style={{color:d.netPerMT>=0?T.green:T.red, fontFamily:T.font, fontSize:22, fontWeight:700}}>
                {d.netTotal!==0?(d.netTotal>=0?"+":"")+d.netTotal.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}):"—"}
              </span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between"}}>
              <span style={{color:T.dim, fontSize:8, fontFamily:T.syne}}>PER MT</span>
              <span style={{color:d.netPerMT>=0?T.green:T.red, fontFamily:T.font, fontSize:13, fontWeight:700}}>
                {d.netPerMT!==0?(d.netPerMT>=0?"+":"")+d.netPerMT.toFixed(2):""} $/mt
              </span>
            </div>
            {/* Margin % */}
            {d.saleValue>0&&(
              <div style={{display:"flex", justifyContent:"space-between", marginTop:4}}>
                <span style={{color:T.dim, fontSize:8, fontFamily:T.syne}}>MARGIN</span>
                <span style={{color:d.netPerMT>=0?T.green+"88":T.red+"88", fontFamily:T.font, fontSize:10}}>
                  {((d.netPerMT/d.sellPrice)*100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Cost stack breakdown */}
          <div style={{marginTop:12}}>
            <div style={{color:T.dim, fontSize:8, letterSpacing:1, fontFamily:T.syne, marginBottom:6}}>TOTAL COST BREAKDOWN $/MT</div>
            {[
              {l:"Freight",     v:d.freightC.pmt},
              {l:"Demurrage",   v:d.demurrageC.pmt},
              {l:"Cargo Loss",  v:d.cargoLossC.pmt},
              {l:"Inspection",  v:d.inspectionC.pmt},
              {l:"FX Loss",     v:d.fxLossC.pmt},
              {l:"DA Cost",     v:d.daCostC.pmt},
              ...(d.customCosts||[]).map(c=>({l:c.label, v:c.pmt||0})),
              {l:"Hedge/Roll",  v:d.hedgeCostPmt},
              {l:"Backwardtn",  v:d.effectiveBackCost},
              {l:"Finance",     v:d.finCostPmt},
              {l:"Commissions", v:d.totalCommPmt},
            ].filter(x=>x.v>0).map(({l,v})=>{
              const barW = d.totalCostPmt>0 ? Math.min(98,(v/d.totalCostPmt)*100) : 0;
              return (
                <div key={l} style={{display:"flex", alignItems:"center", gap:5, marginBottom:3}}>
                  <span style={{color:T.dim, fontSize:8, fontFamily:T.syne, width:70, flexShrink:0}}>{l}</span>
                  <div style={{flex:1, background:T.bg, borderRadius:2, height:4, overflow:"hidden"}}>
                    <div style={{width:`${barW}%`, height:"100%", background:"#f9731688", borderRadius:2}}/>
                  </div>
                  <span style={{color:T.muted, fontFamily:T.font, fontSize:9, width:38, textAlign:"right"}}>{v.toFixed(2)}</span>
                </div>
              );
            })}
            <div style={{display:"flex", justifyContent:"space-between", marginTop:5,
              borderTop:`1px solid ${T.border}`, paddingTop:5}}>
              <span style={{color:T.muted, fontSize:9, fontFamily:T.syne}}>TOTAL COST</span>
              <span style={{color:T.orange, fontFamily:T.font, fontSize:11, fontWeight:700}}>
                {d.totalCostPmt.toFixed(2)} $/mt
              </span>
            </div>
          </div>
        </div>

        {/* Sensitivity grid */}
        <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px"}}>
          <div style={{color:T.muted, fontSize:9, letterSpacing:3, fontFamily:T.syne, fontWeight:700, marginBottom:10}}>🎯 SENSITIVITY — SELL PRICE</div>
          <div style={{display:"flex", flexDirection:"column", gap:3}}>
            {sens.map(({delta,net,pmt})=>{
              const isBase = delta===0;
              const c = pmt>0?T.green:T.red;
              return (
                <div key={delta} style={{display:"grid", gridTemplateColumns:"60px 1fr 100px",
                  gap:6, alignItems:"center",
                  background:isBase?"#12122a":"transparent", borderRadius:isBase?5:0, padding:"3px 4px"}}>
                  <span style={{color:isBase?T.amber:delta>0?T.teal:T.orange,
                    fontFamily:T.font, fontSize:9, fontWeight:700}}>
                    {delta>0?`+${delta}`:delta===0?"BASE":delta} $/mt
                  </span>
                  <div style={{background:T.bg, borderRadius:2, height:5, overflow:"hidden"}}>
                    <div style={{width:`${Math.min(98,Math.max(2,(pmt+30)/60*100))}%`,
                      height:"100%", background:c+"66", borderRadius:2}}/>
                  </div>
                  <span style={{color:c, fontFamily:T.font, fontSize:9, fontWeight:700, textAlign:"right"}}>
                    {net!==0?(net>=0?"+":"")+net.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}):"—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Volume scenarios */}
        <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px"}}>
          <div style={{color:T.muted, fontSize:8, letterSpacing:2, fontFamily:T.syne, marginBottom:8}}>VOLUME SCENARIOS</div>
          <div style={{display:"flex", gap:6}}>
            {[15000,20000,25000,30000,35000].map(v=>{
              const n = d.netPerMT*v;
              const isSel = parseInt(data.volume)===v;
              return (
                <button key={v} onClick={()=>set("volume",v)}
                  style={{flex:1, background:isSel?"#1a1a30":T.bg,
                    border:`1px solid ${isSel?T.amber:T.border}`, borderRadius:5,
                    padding:"5px 4px", cursor:"pointer"}}>
                  <div style={{color:isSel?T.amber:T.muted, fontSize:7, fontFamily:T.syne, marginBottom:2}}>
                    {(v/1000).toFixed(0)}k MT
                  </div>
                  <div style={{color:pnlC(n), fontFamily:T.font, fontSize:8, fontWeight:700}}>
                    {n!==0?(n>=0?"+":"")+n.toLocaleString("en-US",{notation:"compact",maximumFractionDigits:0}):"—"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>{/* end right */}
    </div>
  );
}


// ── POSITION FORM (wrapper) ──────────────────────────────────────────────
function PositionForm({ initial, onSave, onCancel, prices={} }) {
  const [formType, setFormType] = useState(initial?.type || "physical");
  const [data, setData]         = useState(initial || blankPhysical());

  const set = (k,v) => setData(d => ({ ...d, [k]:v }));

  const handleTypeChange = (t) => {
    setFormType(t);
    setData(t==="physical" ? blankPhysical() : blankPaper());
  };

  const handleSave = () => {
    const id = data.id || uid();
    const d  = computeDeal(data, prices);
    onSave({
      ...data, id, type:formType,
      // Populate legacy blotter MTM fields
      buyPrice:  d.buyPrice,
      sellPrice: d.sellPrice,
      freight:   d.freightC?.pmt ?? d.buyPrice,
      misc:      d.totalCostPmt - (d.freightC?.pmt ?? 0),
    });
  };

  const isEdit = !!initial?.id;

  return (
    <div className="fade-in">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <span style={{color:T.text,fontFamily:T.syne,fontSize:14,fontWeight:700,letterSpacing:1}}>
          {isEdit?"EDIT POSITION":"NEW DEAL ESTIMATE"}
        </span>
        <Toggle value={formType} onChange={handleTypeChange}
          options={[{value:"physical",label:"📦 PHYSICAL CARGO"},{value:"paper",label:"📄 PAPER HEDGE"}]}/>
      </div>

      {formType==="physical" && (
        <DealEstimateForm data={data} set={set} prices={prices}/>
      )}

      {formType==="paper" && (
        <div style={{background:T.card2,border:`1px solid ${T.border2}`,borderRadius:12,padding:"20px 24px",maxWidth:700}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12}}>
              <SEL label="INSTRUMENT" value={data.instrument} onChange={v=>set("instrument",v)} options={INSTRUMENTS.map(i=>({value:i.id,label:i.label}))}/>
              <SEL label="DIRECTION" value={data.direction} onChange={v=>set("direction",parseInt(v))} options={[{value:1,label:"▲ LONG (Buy)"},{value:-1,label:"▼ SHORT (Sell)"}]}/>
              <INP label="ENTRY PRICE $/mt" value={data.entryPrice} onChange={v=>set("entryPrice",v)} type="number" step="0.01"/>
              <INP label="VOLUME (MT)" value={data.volume} onChange={v=>set("volume",v)} type="number" step="1000"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              <INP label="ENTRY DATE" value={data.entryDate} onChange={v=>set("entryDate",v)} type="date"/>
              <INP label="COUNTERPARTY" value={data.counterparty} onChange={v=>set("counterparty",v)}/>
              <INP label="NOTES" value={data.notes} onChange={v=>set("notes",v)}/>
            </div>
            {/* Current MTM price hint */}
            {prices&&Object.keys(prices).length>0&&(()=>{
              const instr=INSTRUMENTS.find(i=>i.id===data.instrument);
              const cur=instr?prices[instr.symbol]:null;
              return cur!=null?(
                <div style={{background:"#0a0a15",borderRadius:6,padding:"8px 12px",display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:T.dim,fontSize:9,fontFamily:T.syne}}>CURRENT MTM ({instr?.symbol})</span>
                  <span style={{color:T.amber,fontFamily:T.font,fontSize:12,fontWeight:700}}>{cur.toFixed(2)} $/mt</span>
                </div>
              ):null;
            })()}
            <div style={{background:"#0a0a18",borderRadius:8,padding:"14px 16px",border:`1px solid ${T.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <span style={{color:T.muted,fontSize:9,letterSpacing:2,fontFamily:T.syne}}>EXIT / CLOSE</span>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <input type="checkbox" checked={data.exitFixed} onChange={e=>set("exitFixed",e.target.checked)} style={{accentColor:T.amber,width:13,height:13}}/>
                  <span style={{color:data.exitFixed?T.amber:T.muted,fontSize:9,fontFamily:T.syne,letterSpacing:1}}>POSITION CLOSED</span>
                </label>
              </div>
              {data.exitFixed ? (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <INP label="EXIT PRICE $/mt" value={data.exitPrice} onChange={v=>set("exitPrice",v)} type="number" step="0.01"/>
                  <INP label="EXIT DATE" value={data.exitDate} onChange={v=>set("exitDate",v)} type="date"/>
                </div>
              ) : (
                <div style={{color:T.muted,fontSize:10,fontFamily:T.font,padding:"4px 0"}}>
                  MTM price: <span style={{color:T.amber}}>{INSTRUMENTS.find(i=>i.id===data.instrument)?.symbol}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
        <button onClick={onCancel} style={{padding:"9px 22px",background:"transparent",border:`1px solid ${T.border2}`,borderRadius:7,color:T.muted,fontFamily:T.syne,fontSize:10,cursor:"pointer",letterSpacing:1}}>CANCEL</button>
        <button onClick={handleSave} style={{padding:"9px 28px",background:T.amber,border:"none",borderRadius:7,color:"#000",fontFamily:T.syne,fontSize:10,fontWeight:800,cursor:"pointer",letterSpacing:1}}>
          {isEdit?"UPDATE POSITION":"SAVE TO BOOK"}
        </button>
      </div>
    </div>
  );
}

// ── PHYSICAL BLOTTER ROW ─────────────────────────────────────────────────
function PhysicalRow({ pos, mtm, onEdit, onClose, onDelete, onReview }) {
  const route  = ROUTES[pos.route];
  const isOpen = pos.status === "OPEN";
  const isReview = pos.status === "REVIEW";
  const pnl = mtm?.pnl;
  const pnlPerMT = mtm?.grossPerMT;
  const pnlC2 = pnlC(pnl);

  const statusColor = isOpen ? T.teal : isReview ? T.amber : T.muted;
  const statusLabel = isOpen ? "OPEN" : isReview ? "REVIEW" : "CLOSED";

  return (
    <tr
      className="pos-row"
      onClick={() => onEdit(pos)}
      style={{borderBottom:`1px solid ${T.border}`,transition:"background .12s",cursor:"pointer"}}
      title="Click to edit"
    >
      <td style={{padding:"10px 10px",whiteSpace:"nowrap"}}>
        <div style={{color:T.text,fontSize:10,fontFamily:T.syne,fontWeight:600}}>{route?.icon} {route?.label}</div>
        <div style={{color:T.muted,fontSize:8,marginTop:2,fontFamily:T.font}}>{pos.cargoCode||pos.counterparty||"—"}</div>
      </td>
      <td style={{padding:"10px 8px"}}>
        <Tag text={statusLabel} color={statusColor}/>
        {isReview && <div style={{color:T.amber,fontSize:7,marginTop:2,fontFamily:T.font,letterSpacing:.5}}>AWAITING APPROVAL</div>}
        <div style={{color:T.muted,fontSize:8,marginTop:3,fontFamily:T.font}}>{pos.buyDate}</div>
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        <div style={{color:T.text,fontFamily:T.font,fontSize:11,fontWeight:600}}>{fmt(pos.buyPrice)}</div>
        <div style={{color:T.muted,fontSize:8}}>buy $/mt</div>
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        {pos.sellFixed
          ? <><div style={{color:T.amber,fontFamily:T.font,fontSize:11,fontWeight:600}}>{fmt(pos.sellPrice)}</div><div style={{color:T.muted,fontSize:8}}>fixed</div></>
          : <><div style={{color:T.teal,fontFamily:T.font,fontSize:11,fontWeight:600}}>{fmt(mtm?.mtmSell)}</div><div style={{color:T.muted,fontSize:8}}>MTM {pos.pricingTenor} {mtm?.mtmSellSym||""}</div></>
        }
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        <div style={{color:T.muted,fontFamily:T.font,fontSize:10}}>{fmt(pos.freight)}/{fmt(pos.misc)}</div>
        <div style={{color:T.muted,fontSize:8}}>frt/misc</div>
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        <div style={{color:T.text,fontFamily:T.font,fontSize:11}}>{fmtMT(pos.volume)}</div>
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        <div style={{color:pnlC2,fontFamily:T.font,fontSize:11,fontWeight:700}}>{pnl==null?"—":pnlSign(pnl)}</div>
        <div style={{color:pnlC2+"88",fontSize:8,fontFamily:T.font}}>{pnlPerMT==null?"—":(pnlPerMT>=0?"+":"")+fmt(pnlPerMT,1)+" $/mt"}</div>
      </td>
      <td style={{padding:"10px 10px",textAlign:"right"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",gap:4,justifyContent:"flex-end",flexWrap:"wrap"}}>
          {(isOpen||isReview) && (
            <button className="action-btn" onClick={()=>onReview(pos.id)}
              style={{padding:"3px 8px",background:isReview?"#2a1a00":"#2a2000",border:`1px solid ${T.amber}44`,borderRadius:4,color:T.amber,fontSize:8,cursor:"pointer",opacity:.85,fontFamily:T.font,letterSpacing:.5}}>
              {isReview ? "↩ RECALL" : "⚑ REVIEW"}
            </button>
          )}
          {isOpen && (
            <button className="action-btn" onClick={()=>onClose(pos.id)}
              style={{padding:"3px 8px",background:"#1a2e1a",border:`1px solid ${T.green}44`,borderRadius:4,color:T.green,fontSize:8,cursor:"pointer",opacity:.7,fontFamily:T.font}}>CLOSE</button>
          )}
          <button className="action-btn" onClick={()=>onDelete(pos.id)}
            style={{padding:"3px 8px",background:"#2e1a1a",border:`1px solid ${T.red}44`,borderRadius:4,color:T.red,fontSize:8,cursor:"pointer",opacity:.7,fontFamily:T.font}}>DEL</button>
        </div>
      </td>
    </tr>
  );
}

// ── PAPER BLOTTER ROW ─────────────────────────────────────────────────────
function PaperRow({ pos, mtm, onEdit, onClose, onDelete, onReview }) {
  const instr  = INSTRUMENTS.find(i=>i.id===pos.instrument);
  const isOpen = pos.status === "OPEN";
  const isReview = pos.status === "REVIEW";
  const isLong = pos.direction === 1;
  const pnl = mtm?.pnl;
  const pnlPerMT = mtm?.priceDiff;

  const statusColor = isOpen ? T.teal : isReview ? T.amber : T.muted;
  const statusLabel = isOpen ? "OPEN" : isReview ? "REVIEW" : "CLOSED";

  return (
    <tr
      className="pos-row"
      onClick={() => onEdit(pos)}
      style={{borderBottom:`1px solid ${T.border}`,transition:"background .12s",cursor:"pointer"}}
      title="Click to edit"
    >
      <td style={{padding:"10px 10px",whiteSpace:"nowrap"}}>
        <div style={{color:T.text,fontSize:10,fontFamily:T.syne,fontWeight:600}}>{instr?.label||pos.instrument}</div>
        <div style={{color:T.muted,fontSize:8,marginTop:2,fontFamily:T.font}}>{pos.counterparty||"—"}</div>
      </td>
      <td style={{padding:"10px 8px"}}>
        <div style={{display:"flex",gap:4,flexDirection:"column"}}>
          <Tag text={statusLabel} color={statusColor}/>
          {isReview && <div style={{color:T.amber,fontSize:7,fontFamily:T.font,letterSpacing:.5}}>AWAITING APPROVAL</div>}
          <Tag text={isLong?"▲ LONG":"▼ SHORT"} color={isLong?T.blue:T.orange}/>
        </div>
        <div style={{color:T.muted,fontSize:8,marginTop:3,fontFamily:T.font}}>{pos.entryDate}</div>
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        <div style={{color:T.text,fontFamily:T.font,fontSize:11,fontWeight:600}}>{fmt(pos.entryPrice)}</div>
        <div style={{color:T.muted,fontSize:8}}>entry $/mt</div>
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        {pos.exitFixed
          ? <><div style={{color:T.amber,fontFamily:T.font,fontSize:11,fontWeight:600}}>{fmt(pos.exitPrice)}</div><div style={{color:T.muted,fontSize:8}}>closed</div></>
          : <><div style={{color:T.teal,fontFamily:T.font,fontSize:11,fontWeight:600}}>{fmt(mtm?.currentPrice)}</div><div style={{color:T.muted,fontSize:8}}>MTM live</div></>
        }
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        <div style={{color:pnlC(pnlPerMT),fontFamily:T.font,fontSize:10}}>
          {pnlPerMT==null?"—":(pnlPerMT>=0?"+":"")+fmt(pnlPerMT,1)+" $/mt"}
        </div>
        <div style={{color:T.muted,fontSize:8}}>price move</div>
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        <div style={{color:T.text,fontFamily:T.font,fontSize:11}}>{fmtMT(pos.volume)}</div>
      </td>
      <td style={{padding:"10px 8px",textAlign:"right"}}>
        <div style={{color:pnlC(pnl),fontFamily:T.font,fontSize:11,fontWeight:700}}>{pnl==null?"—":pnlSign(pnl)}</div>
      </td>
      <td style={{padding:"10px 10px",textAlign:"right"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",gap:4,justifyContent:"flex-end",flexWrap:"wrap"}}>
          {(isOpen||isReview) && (
            <button className="action-btn" onClick={()=>onReview(pos.id)}
              style={{padding:"3px 8px",background:isReview?"#2a1a00":"#2a2000",border:`1px solid ${T.amber}44`,borderRadius:4,color:T.amber,fontSize:8,cursor:"pointer",opacity:.85,fontFamily:T.font,letterSpacing:.5}}>
              {isReview ? "↩ RECALL" : "⚑ REVIEW"}
            </button>
          )}
          {isOpen && (
            <button className="action-btn" onClick={()=>onClose(pos.id)}
              style={{padding:"3px 8px",background:"#1a2e1a",border:`1px solid ${T.green}44`,borderRadius:4,color:T.green,fontSize:8,cursor:"pointer",opacity:.7,fontFamily:T.font}}>CLOSE</button>
          )}
          <button className="action-btn" onClick={()=>onDelete(pos.id)}
            style={{padding:"3px 8px",background:"#2e1a1a",border:`1px solid ${T.red}44`,borderRadius:4,color:T.red,fontSize:8,cursor:"pointer",opacity:.7,fontFamily:T.font}}>DEL</button>
        </div>
      </td>
    </tr>
  );
}

// ── TABLE HEADER ──────────────────────────────────────────────────────────
const TH = ({children, right}) => (
  <th style={{padding:"8px 8px",color:T.muted,fontSize:8,letterSpacing:1.5,fontFamily:"'Syne','Trebuchet MS',sans-serif",fontWeight:700,textAlign:right?"right":"left",borderBottom:`1px solid ${T.border2}`,whiteSpace:"nowrap"}}>
    {children}
  </th>
);

// ── MAIN ──────────────────────────────────────────────────────────────────
export default function PnLTracker() {
  const [positions, setPositions]  = useState([]);
  const [prices, setPrices]        = useState({});
  const [priceDate, setPriceDate]  = useState("");
  const [tab, setTab]              = useState("blotter");
  const [showForm, setShowForm]    = useState(false);
  const [editPos, setEditPos]      = useState(null);
  const [loading, setLoading]      = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [dragging, setDragging]    = useState(false);
  const [filter, setFilter]        = useState("ALL"); // ALL | OPEN | REVIEW | CLOSED
  const [csvWarn, setCsvWarn]      = useState(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [syncError, setSyncError]  = useState(null);

  // ── PERSISTENT STORAGE — server-side via /api/positions ────────────────
  useEffect(() => {
    fetch("/api/positions")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPositions(data); })
      .catch(() => {})
      .finally(() => setStorageReady(true));
  }, []);

  const savePositions = useCallback((newPositions) => {
    setPositions(newPositions);
    fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positions: newPositions }),
    }).catch(() => {});
  }, []);

  // ── CSV UPLOAD ──────────────────────────────────────────────────────────
  const handleFile = useCallback(file => {
    if (!file) return;
    setLoading(true);
    setCsvWarn(null);
    setCsvFileName(file.name);
    const r = new FileReader();
    r.onload = e => {
      const { prices:p, latestDate, warn } = parseCSVtoMTM(e.target.result);
      setPrices(p);
      setPriceDate(latestDate);
      setCsvWarn(warn || null);
      setLoading(false);
    };
    r.readAsText(file);
  }, []);

  // ── LIVE API SYNC ────────────────────────────────────────────────────────
  const handleLiveSync = useCallback(async () => {
    setLoading(true);
    setSyncError(null);
    setCsvWarn(null);
    try {
      const res  = await fetch("/api/platts-prices");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "API error");
      setPrices(data.prices || {});
      setPriceDate(data.latestDate || "");
      setCsvFileName("Live — " + (data.latestDate || ""));
    } catch (e) {
      setSyncError(e.message);
    }
    setLoading(false);
  }, []);

  // ── MTM COMPUTATION ─────────────────────────────────────────────────────
  const mtmMap = useMemo(() => {
    const map = {};
    positions.forEach(pos => { map[pos.id] = computeMTM(pos, prices); });
    return map;
  }, [positions, prices]);

  // ── RISK AGGREGATION ────────────────────────────────────────────────────
  const riskBook = useMemo(() => aggregateRisk(positions), [positions]);

  // ── P&L SUMMARY ─────────────────────────────────────────────────────────
  const pnlSummary = useMemo(() => {
    let totalUnrealized=0, totalRealized=0;
    const byProduct = {};
    positions.forEach(pos => {
      const m = mtmMap[pos.id] || {};
      totalUnrealized += m.unrealizedPnl || 0;
      totalRealized   += m.realizedPnl   || 0;
      const label = pos.type==="physical" ? (ROUTES[pos.route]?.label||pos.route) : (INSTRUMENTS.find(i=>i.id===pos.instrument)?.label||pos.instrument);
      const product = pos.type==="physical" ? ROUTES[pos.route]?.label : "Paper";
      if (!byProduct[product]) byProduct[product]={ unrealized:0, realized:0, label:product };
      byProduct[product].unrealized += m.unrealizedPnl||0;
      byProduct[product].realized   += m.realizedPnl||0;
    });
    return {
      totalUnrealized, totalRealized,
      total: totalUnrealized + totalRealized,
      byProduct: Object.values(byProduct),
    };
  }, [positions, mtmMap]);

  // ── POSITION ACTIONS ────────────────────────────────────────────────────
  const addOrUpdate = useCallback((pos) => {
    const newList = editPos
      ? positions.map(p => p.id===pos.id ? pos : p)
      : [...positions, { ...pos, id: pos.id||uid() }];
    savePositions(newList);
    setShowForm(false);
    setEditPos(null);
  }, [positions, editPos, savePositions]);

  const deletePos = useCallback(id => {
    if (window.confirm("Delete this position?")) savePositions(positions.filter(p=>p.id!==id));
  }, [positions, savePositions]);

  const closePos = useCallback(id => {
    const pos = positions.find(p=>p.id===id);
    if (!pos) return;
    // auto-fill exit/sell from current MTM
    const m = mtmMap[id];
    if (pos.type==="physical") {
      const sellPrice = m?.mtmSell;
      savePositions(positions.map(p=>p.id===id ? {...p, status:"CLOSED", sellFixed:true, sellPrice:sellPrice||p.sellPrice, sellDate:today()} : p));
    } else {
      const exitPrice = m?.currentPrice;
      savePositions(positions.map(p=>p.id===id ? {...p, status:"CLOSED", exitFixed:true, exitPrice:exitPrice||p.exitPrice, exitDate:today()} : p));
    }
  }, [positions, mtmMap, savePositions]);

  const reviewPos = useCallback(id => {
    const pos = positions.find(p=>p.id===id);
    if (!pos) return;
    // toggle between OPEN ↔ REVIEW
    const next = pos.status === "REVIEW" ? "OPEN" : "REVIEW";
    savePositions(positions.map(p=>p.id===id ? {...p, status:next, reviewedAt: next==="REVIEW" ? new Date().toISOString() : null} : p));
  }, [positions, savePositions]);

  const handleEdit = useCallback(pos => {
    setEditPos(pos);
    setShowForm(true);
    setTab("add");
  }, []);

  // ── FILTERED POSITIONS ──────────────────────────────────────────────────
  const physical   = positions.filter(p => p.type==="physical" && (filter==="ALL"||p.status===filter));
  const paper      = positions.filter(p => p.type==="paper"    && (filter==="ALL"||p.status===filter));
  const openCount  = positions.filter(p=>p.status==="OPEN").length;
  const reviewCount = positions.filter(p=>p.status==="REVIEW").length;

  // ── STYLES ───────────────────────────────────────────────────────────────
  const TABS_DEF = [
    { id:"blotter", label:"📋  BLOTTER", count:positions.length },
    { id:"risk",    label:"⚖  RISK BOOK" },
    { id:"pnl",     label:"💰  P&L SUMMARY" },
    { id:"add",     label:"＋  ADD TRADE" },
  ];

  return (
    <div style={{background:T.bg,minHeight:"100vh",color:T.text,fontFamily:T.syne}}>
      <FontStyle/>

      {/* ── HEADER ── */}
      <div style={{background:"#09091a",borderBottom:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",alignItems:"center",gap:16,position:"sticky",top:0,zIndex:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:prices&&Object.keys(prices).length>0?T.amber:T.muted,boxShadow:prices&&Object.keys(prices).length>0?`0 0 8px ${T.amber}`:""}}/>
          <span style={{color:T.text,fontWeight:800,fontSize:14,letterSpacing:2,fontFamily:T.syne}}>TRADING BOOK</span>
          <span style={{color:T.dim,fontSize:12}}>|</span>
          <span style={{color:T.muted,fontSize:9,letterSpacing:2}}>P&amp;L · MTM · RISK</span>
        </div>

        {/* Total P&L pill */}
        {positions.length>0&&(
          <div style={{background:pnlSummary.total>=0?"#10b98120":"#ef444420",border:`1px solid ${pnlSummary.total>=0?T.green:T.red}44`,borderRadius:8,padding:"5px 14px",marginLeft:8}}>
            <span style={{color:T.muted,fontSize:8,letterSpacing:1,marginRight:6}}>BOOK P&L</span>
            <span style={{color:pnlC(pnlSummary.total),fontFamily:T.font,fontSize:13,fontWeight:700}}>{pnlSign(pnlSummary.total)}</span>
          </div>
        )}
        {/* Review pending badge */}
        {reviewCount>0&&(
          <button onClick={()=>{setTab("blotter");setFilter("REVIEW");}}
            style={{background:"#3a2800",border:`1px solid ${T.amber}66`,borderRadius:8,padding:"5px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:10}}>⚑</span>
            <span style={{color:T.amber,fontSize:8,letterSpacing:1,fontFamily:T.syne,fontWeight:700}}>{reviewCount} PENDING REVIEW</span>
          </button>
        )}

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {priceDate&&<span style={{color:T.muted,fontSize:9,fontFamily:T.font}}>MTM: {priceDate}</span>}
          {syncError&&<span style={{color:T.orange,fontSize:8,fontFamily:T.font,maxWidth:220,cursor:"pointer"}} title={syncError} onClick={()=>setSyncError(null)}>⚠ {syncError.slice(0,50)}</span>}
          {/* Live API sync */}
          <button onClick={handleLiveSync} disabled={loading}
            style={{background:"#0a1a0a",border:`1px solid ${T.green}44`,borderRadius:7,padding:"6px 14px",cursor:loading?"wait":"pointer",fontSize:9,color:T.green,letterSpacing:1.5,fontFamily:T.syne,fontWeight:700,opacity:loading?.6:1}}>
            {loading?"SYNCING…":"⚡ SYNC LIVE"}
          </button>
          {/* CSV fallback */}
          <label style={{background:"#12122a",border:`1px solid ${T.border2}`,borderRadius:7,padding:"6px 14px",cursor:"pointer",fontSize:9,color:T.amber,letterSpacing:1.5,fontFamily:T.syne,fontWeight:700}}>
            {loading?"…":"↑ CSV"}
            <input type="file" accept=".csv,.CSV" style={{display:"none"}} onChange={e=>{handleFile(e.target.files[0]);e.target.value="";} }/>
          </label>
        </div>
      </div>

      <div style={{padding:"16px 24px"}}>

        {/* ── CSV warning banner ── */}
        {csvWarn&&(
          <div style={{background:"#2a1000",border:`1px solid ${T.orange}44`,borderRadius:8,padding:"10px 16px",marginBottom:12,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{color:T.orange,fontSize:13,lineHeight:1}}>⚠</span>
            <div>
              <div style={{color:T.orange,fontSize:9,fontFamily:T.syne,letterSpacing:1,fontWeight:700,marginBottom:3}}>CSV PARSE WARNING — {csvFileName}</div>
              <div style={{color:T.muted,fontSize:9,fontFamily:T.font,lineHeight:1.6}}>{csvWarn}</div>
            </div>
            <button onClick={()=>setCsvWarn(null)} style={{marginLeft:"auto",background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:12}}>✕</button>
          </div>
        )}

        {/* ── UPLOAD DROP ZONE ── */}
        {!prices||!Object.keys(prices).length?(
          <div onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0])}}
            onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)}
            style={{border:`1px dashed ${dragging?T.amber:T.border2}`,borderRadius:12,padding:"20px 32px",marginBottom:16,background:dragging?T.amber+"08":"#09091a",transition:"all .2s",textAlign:"center"}}>
            <div style={{color:T.muted,fontSize:9,letterSpacing:2,fontFamily:T.syne,marginBottom:6}}>↑ DRAG & DROP OR CLICK "LOAD CSV" ABOVE TO ENABLE MTM PRICING</div>
            <div style={{color:T.dim,fontSize:8,fontFamily:T.font}}>Supports Platts exports · auto-detects comma, semicolon, tab delimiters</div>
          </div>
        ):(
          <>
            <div style={{background:"#0a1a0a",border:`1px solid ${T.green}22`,borderRadius:8,padding:"8px 16px",marginBottom:6,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
              {[
                ["Naph AG",      prices["PAAAA00"]],
                ["MOPJ M1",      prices["AAXFE00"]],
                ["MOPJ BM",      prices["RAXFM00"]],
                ["FO180 SP BM",  prices["AAPML00"]],
                ["FO380 SP BM",  prices["AAPKB00"]],
                ["Gas92 M1",     prices["AAXEL00"]],
                ["GMed Spot",    prices["AAWZA00"]],
                ["Eurobob BM",   prices["ABWFB00"]],
                ["Eurobob M1",   prices["ABWFC00"]],
                ["Eurobob M2",   prices["ABWFD00"]],
              ].map(([l,v])=>(
                <div key={l} style={{display:"flex",gap:5,alignItems:"baseline"}}>
                  <span style={{color:T.muted,fontSize:8,letterSpacing:.5}}>{l}</span>
                  <span style={{color:v!=null?T.green:T.dim,fontFamily:T.font,fontSize:10,fontWeight:700}}>{v!=null?fmt(v,2):"—"}</span>
                </div>
              ))}
              <span style={{color:T.muted,fontSize:8,letterSpacing:1,marginLeft:"auto"}}>
                {csvFileName&&<span style={{marginRight:8,color:T.dim}}>{csvFileName}</span>}
                {Object.keys(prices).length} SYMBOLS LOADED
              </span>
            </div>
            {/* show which route symbols are missing from the loaded CSV */}
            {(() => {
              const needed = [
                ...Object.values(ROUTES).flatMap(r=>[r.buySymbol,...Object.values(r.sellSymbols||{})]),
              ];
              const missing = [...new Set(needed)].filter(s=>s&&prices[s]==null);
              return missing.length>0?(
                <div style={{background:"#1a1000",border:`1px solid ${T.amber}22`,borderRadius:6,padding:"5px 14px",marginBottom:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{color:T.amber,fontSize:8,fontFamily:T.syne,letterSpacing:1}}>MISSING FROM CSV:</span>
                  {missing.map(s=><span key={s} style={{color:T.muted,fontFamily:T.font,fontSize:8,background:"#2a2000",padding:"1px 6px",borderRadius:3}}>{s}</span>)}
                </div>
              ):null;
            })()}
          </>
        )}

        {/* ── TABS ── */}
        <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:`1px solid ${T.border}`}}>
          {TABS_DEF.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);if(t.id!=="add"){setShowForm(false);setEditPos(null);}else{setShowForm(true);}}}
              style={{padding:"9px 18px",background:tab===t.id?"#12122a":"transparent",border:"none",borderBottom:tab===t.id?`2px solid ${T.amber}`:"2px solid transparent",
                color:tab===t.id?T.amber:T.muted,fontFamily:T.syne,fontSize:9,letterSpacing:2,cursor:"pointer",fontWeight:tab===t.id?700:400,transition:"all .15s"}}>
              {t.label}{t.count!=null?` (${t.count})`:""}
            </button>
          ))}
          {positions.length>0&&(
            <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center"}}>
              {["ALL","OPEN","REVIEW","CLOSED"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{
                    padding:"4px 10px",
                    background:filter===f?(f==="REVIEW"?"#2a2000":"#1a1a30"):"transparent",
                    border:`1px solid ${filter===f?(f==="REVIEW"?T.amber+"66":T.border2):T.border}`,
                    borderRadius:5,
                    color:filter===f?(f==="REVIEW"?T.amber:T.text):T.muted,
                    fontSize:8,cursor:"pointer",fontFamily:T.font,letterSpacing:1,
                  }}>
                  {f}{f==="REVIEW"&&reviewCount>0?` (${reviewCount})`:""}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ════ TAB: BLOTTER ════ */}
        {tab==="blotter"&&(
          <div className="fade-in">
            {positions.length===0?(
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{fontSize:36,marginBottom:12}}>📋</div>
                <div style={{color:T.muted,fontSize:11,marginBottom:4,fontFamily:T.syne}}>YOUR BOOK IS EMPTY</div>
                <div style={{color:T.dim,fontSize:10}}>Add physical cargoes or paper hedges using the + ADD TRADE tab</div>
              </div>
            ):(
              <>
                {/* Physical Cargoes */}
                {physical.length>0&&(
                  <div style={{marginBottom:24}}>
                    <SectionLabel icon="📦" text="PHYSICAL CARGOES"/>
                    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse"}}>
                        <thead style={{background:"#0a0a18"}}>
                          <tr><TH>ROUTE</TH><TH>STATUS</TH><TH right>BUY $/mt</TH><TH right>SELL / MTM</TH><TH right>FRT/MISC</TH><TH right>VOLUME</TH><TH right>P&amp;L (USD)</TH><TH right>ACTIONS</TH></tr>
                        </thead>
                        <tbody>
                          {physical.map(pos=><PhysicalRow key={pos.id} pos={pos} mtm={mtmMap[pos.id]||{}} onEdit={handleEdit} onClose={closePos} onDelete={deletePos} onReview={reviewPos}/>)}
                        </tbody>
                        <tfoot>
                          <tr style={{background:"#0a0a18",borderTop:`1px solid ${T.border2}`}}>
                            <td colSpan={5} style={{padding:"8px 10px",color:T.muted,fontSize:9,fontFamily:T.syne,letterSpacing:1}}>PHYSICAL SUBTOTALS</td>
                            <td style={{padding:"8px 8px",textAlign:"right",color:T.text,fontFamily:T.font,fontSize:10}}>
                              {fmtMT(physical.reduce((a,p)=>a+(parseFloat(p.volume)||0),0))}
                            </td>
                            <td style={{padding:"8px 8px",textAlign:"right"}}>
                              <PnLCell v={physical.reduce((a,p)=>a+(mtmMap[p.id]?.pnl||0),0)}/>
                            </td>
                            <td/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Paper Hedges */}
                {paper.length>0&&(
                  <div style={{marginBottom:24}}>
                    <SectionLabel icon="📄" text="PAPER HEDGES"/>
                    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse"}}>
                        <thead style={{background:"#0a0a18"}}>
                          <tr><TH>INSTRUMENT</TH><TH>STATUS</TH><TH right>ENTRY $/mt</TH><TH right>EXIT / MTM</TH><TH right>PRICE MOVE</TH><TH right>VOLUME</TH><TH right>P&amp;L (USD)</TH><TH right>ACTIONS</TH></tr>
                        </thead>
                        <tbody>
                          {paper.map(pos=><PaperRow key={pos.id} pos={pos} mtm={mtmMap[pos.id]||{}} onEdit={handleEdit} onClose={closePos} onDelete={deletePos} onReview={reviewPos}/>)}
                        </tbody>
                        <tfoot>
                          <tr style={{background:"#0a0a18",borderTop:`1px solid ${T.border2}`}}>
                            <td colSpan={5} style={{padding:"8px 10px",color:T.muted,fontSize:9,fontFamily:T.syne,letterSpacing:1}}>PAPER SUBTOTALS</td>
                            <td style={{padding:"8px 8px",textAlign:"right",color:T.text,fontFamily:T.font,fontSize:10}}>
                              {fmtMT(paper.reduce((a,p)=>a+(parseFloat(p.volume)||0),0))}
                            </td>
                            <td style={{padding:"8px 8px",textAlign:"right"}}>
                              <PnLCell v={paper.reduce((a,p)=>a+(mtmMap[p.id]?.pnl||0),0)}/>
                            </td>
                            <td/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Book Total */}
                <div style={{background:T.card2,border:`1px solid ${pnlSummary.total>=0?T.green+"44":T.red+"44"}`,borderRadius:10,padding:"16px 20px",display:"flex",gap:32,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{color:T.muted,fontSize:9,letterSpacing:2,fontFamily:T.syne}}>TOTAL BOOK</span>
                  {[
                    ["UNREALIZED",pnlSummary.totalUnrealized,T.teal],
                    ["REALIZED",  pnlSummary.totalRealized,  T.purple],
                    ["TOTAL P&L", pnlSummary.total,           pnlC(pnlSummary.total)],
                  ].map(([l,v,c])=>(
                    <div key={l}>
                      <div style={{color:T.muted,fontSize:8,letterSpacing:1,marginBottom:3}}>{l}</div>
                      <div style={{color:c,fontFamily:T.font,fontSize:18,fontWeight:700}}>{pnlSign(v)}</div>
                    </div>
                  ))}
                  <div style={{marginLeft:"auto"}}>
                    <div style={{color:T.muted,fontSize:8,letterSpacing:1,marginBottom:3}}>OPEN POSITIONS</div>
                    <div style={{color:T.text,fontFamily:T.font,fontSize:18,fontWeight:700}}>{openCount}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════ TAB: RISK BOOK ════ */}
        {tab==="risk"&&(
          <div className="fade-in">
            <SectionLabel icon="⚖" text="NET EXPOSURE — OPEN POSITIONS ONLY"/>
            <div style={{background:"#09091a",border:`1px solid ${T.border2}`,borderRadius:8,padding:"10px 16px",marginBottom:20,fontSize:9,color:T.muted,lineHeight:1.9,fontFamily:T.syne}}>
              Physical long cargo = <span style={{color:T.teal}}>LONG buy commodity</span> + <span style={{color:T.orange}}>SHORT sell commodity (until price fixed)</span> ·
              Paper long = <span style={{color:T.teal}}>LONG instrument</span> · Paper short = <span style={{color:T.orange}}>SHORT instrument</span> ·
              Positive = net long, Negative = net short
            </div>

            {/* Risk bars */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10,marginBottom:28}}>
              {RISK_CATS.map(cat=>(
                <RiskBar key={cat} cat={cat} value={riskBook[cat]||0}/>
              ))}
            </div>

            {/* Risk chart */}
            <SectionLabel icon="📊" text="EXPOSURE CHART"/>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px"}}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={RISK_CATS.map(c=>({name:c,value:riskBook[c]||0}))} margin={{top:8,right:16,left:16,bottom:0}}>
                  <XAxis dataKey="name" tick={{fill:T.muted,fontSize:8,fontFamily:T.syne}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fill:T.muted,fontSize:8,fontFamily:T.font}} tickLine={false} axisLine={false} tickFormatter={v=>(v/1000).toFixed(0)+"k"}/>
                  <Tooltip contentStyle={{background:"#0e0e1c",border:`1px solid ${T.border2}`,borderRadius:6,fontFamily:T.font,fontSize:10}} formatter={v=>[fmtMT(v),"Net Exposure"]} labelStyle={{color:T.muted}}/>
                  <ReferenceLine y={0} stroke={T.border2}/>
                  <Bar dataKey="value" radius={[3,3,0,0]}>
                    {RISK_CATS.map(cat=>(
                      <Cell key={cat} fill={(riskBook[cat]||0)>=0?T.teal:T.orange}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Position detail */}
            {positions.filter(p=>p.status==="OPEN").length>0&&(
              <>
                <div style={{marginTop:24}}><SectionLabel icon="📋" text="OPEN POSITION DETAIL"/></div>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead style={{background:"#0a0a18"}}>
                      <tr><TH>POSITION</TH><TH>TYPE</TH><TH right>VOLUME</TH><TH right>BUY RISK</TH><TH right>SELL RISK</TH><TH right>MTM P&L</TH></tr>
                    </thead>
                    <tbody>
                      {positions.filter(p=>p.status==="OPEN").map(pos=>{
                        const m = mtmMap[pos.id]||{};
                        const vol = parseFloat(pos.volume)||0;
                        const isPhys = pos.type==="physical";
                        const route = ROUTES[pos.route];
                        const instr = INSTRUMENTS.find(i=>i.id===pos.instrument);
                        const buyRisk = isPhys ? route?.buyRisk : (pos.direction===1?instr?.risk:null);
                        const sellRisk= isPhys ? (pos.sellFixed?null:route?.sellRisk) : (pos.direction===-1?instr?.risk:null);
                        return (
                          <tr key={pos.id} className="pos-row" style={{borderBottom:`1px solid ${T.border}`}}>
                            <td style={{padding:"9px 10px",color:T.text,fontSize:10,fontFamily:T.syne}}>{isPhys?`${route?.icon} ${route?.label}`:(instr?.label||pos.instrument)}</td>
                            <td style={{padding:"9px 8px"}}><Tag text={isPhys?"PHYSICAL":"PAPER"} color={isPhys?T.teal:T.blue}/></td>
                            <td style={{padding:"9px 8px",textAlign:"right",fontFamily:T.font,fontSize:10,color:T.text}}>{fmtMT(vol)}</td>
                            <td style={{padding:"9px 8px",textAlign:"right"}}>{buyRisk?<Tag text={`▲ ${buyRisk}`} color={T.teal}/>:"—"}</td>
                            <td style={{padding:"9px 8px",textAlign:"right"}}>{sellRisk?<Tag text={`▼ ${sellRisk}`} color={T.orange}/>:"—"}</td>
                            <td style={{padding:"9px 10px",textAlign:"right"}}><PnLCell v={m.pnl}/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════ TAB: P&L SUMMARY ════ */}
        {tab==="pnl"&&(
          <div className="fade-in">
            {/* Top summary cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
              {[
                { label:"TOTAL P&L",    value:pnlSummary.total,           sub:"realized + unrealized", c:pnlC(pnlSummary.total) },
                { label:"UNREALIZED",   value:pnlSummary.totalUnrealized, sub:"open positions MTM",    c:T.teal },
                { label:"REALIZED",     value:pnlSummary.totalRealized,   sub:"closed positions",      c:T.purple },
              ].map(({label,value,sub,c})=>(
                <div key={label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"20px 20px"}}>
                  <div style={{color:T.muted,fontSize:9,letterSpacing:2,marginBottom:10,fontFamily:T.syne}}>{label}</div>
                  <div style={{color:c,fontFamily:T.font,fontSize:24,fontWeight:700,marginBottom:4}}>{pnlSign(value)}</div>
                  <div style={{color:T.dim,fontSize:9,fontFamily:T.syne}}>{sub}</div>
                </div>
              ))}
            </div>

            {/* By product breakdown */}
            {pnlSummary.byProduct.length>0&&(
              <>
                <SectionLabel icon="📊" text="P&L BY PRODUCT/ROUTE"/>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",marginBottom:20}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead style={{background:"#0a0a18"}}>
                      <tr><TH>PRODUCT / ROUTE</TH><TH right>UNREALIZED</TH><TH right>REALIZED</TH><TH right>TOTAL</TH></tr>
                    </thead>
                    <tbody>
                      {pnlSummary.byProduct.map(({label,unrealized,realized})=>(
                        <tr key={label} className="pos-row" style={{borderBottom:`1px solid ${T.border}`}}>
                          <td style={{padding:"10px 12px",color:T.text,fontSize:10,fontFamily:T.syne}}>{label}</td>
                          <td style={{padding:"10px 12px",textAlign:"right"}}><PnLCell v={unrealized}/></td>
                          <td style={{padding:"10px 12px",textAlign:"right"}}><PnLCell v={realized}/></td>
                          <td style={{padding:"10px 12px",textAlign:"right"}}><PnLCell v={unrealized+realized}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* P&L chart per position */}
                <SectionLabel icon="📈" text="P&L PER POSITION"/>
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px"}}>
                  <ResponsiveContainer width="100%" height={Math.max(160, positions.length*40)}>
                    <BarChart layout="vertical"
                      data={positions.map(pos=>{
                        const m = mtmMap[pos.id]||{};
                        const route = ROUTES[pos.route];
                        const instr = INSTRUMENTS.find(i=>i.id===pos.instrument);
                        const label = pos.type==="physical" ? (route?.label||pos.route) : (instr?.label||pos.instrument);
                        return { name: label.slice(0,20), pnl: m.pnl||0, status:pos.status };
                      })}
                      margin={{top:4,right:60,left:8,bottom:0}}>
                      <XAxis type="number" tick={{fill:T.muted,fontSize:8,fontFamily:T.font}} tickLine={false} axisLine={false} tickFormatter={v=>(v/1000).toFixed(0)+"k"}/>
                      <YAxis type="category" dataKey="name" tick={{fill:T.muted,fontSize:8,fontFamily:T.syne}} tickLine={false} axisLine={false} width={140}/>
                      <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border2}`,borderRadius:6,fontFamily:T.font,fontSize:10}} formatter={v=>[pnlSign(v),"P&L"]} labelStyle={{color:T.muted}}/>
                      <ReferenceLine x={0} stroke={T.border2}/>
                      <Bar dataKey="pnl" radius={[0,3,3,0]}>
                        {positions.map(pos=>(
                          <Cell key={pos.id} fill={(mtmMap[pos.id]?.pnl||0)>=0?T.green:T.red}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {positions.length===0&&(
              <div style={{textAlign:"center",padding:"60px 0",color:T.muted,fontSize:11,fontFamily:T.syne}}>No positions yet. Add trades to see P&L analysis.</div>
            )}
          </div>
        )}

        {/* ════ TAB: ADD TRADE ════ */}
        {tab==="add"&&(
          <div className="fade-in">
            <SectionLabel icon="＋" text={editPos?"EDIT POSITION":"ADD NEW POSITION"}/>
            <PositionForm
              initial={editPos||null}
              prices={prices}
              onSave={pos=>{addOrUpdate(pos);setTab("blotter");}}
              onCancel={()=>{setTab("blotter");setEditPos(null);}}
            />

            {/* Quick ref: current MTM prices */}
            {Object.keys(prices).length>0&&(
              <div style={{marginTop:24}}>
                <SectionLabel icon="📡" text="CURRENT MTM PRICES — FOR REFERENCE"/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
                  {[
                    ["MOPJ BalMo","RAXFM00"],["MOPJ Mo01","AAXFE00"],["MOPJ Mo02","AAXFF00"],
                    ["AG Naph BM","NAGFM00"],["AG Naph M1","NAGFM01"],["AG Naph M2","NAGFM02"],
                    ["Naph AG Spot","PAAAA00"],["Japan Spot","PAAAD00"],
                    ["Spore Naph BM","AAPLD00"],["Spore Naph M1","PAAAQ00"],
                    ["FO180 Sp BM","AAPML00"],["FO180 Sp M1","PUAXZ00"],
                    ["FO380 Sp BM","AAPKB00"],["FO380 Sp M1","AAPKC00"],
                    ["FO180 AG","PUABE00"],["FO380 AG","AAIDC00"],
                    ["Gas92 BM","AAXEK00"],["Gas92 M1","AAXEL00"],
                  ].map(([l,sym])=>(
                    <div key={sym} style={{background:"#0a0a18",borderRadius:6,padding:"8px 10px",border:`1px solid ${T.border}`}}>
                      <div style={{color:T.muted,fontSize:8,letterSpacing:.5,marginBottom:3,fontFamily:T.syne}}>{l}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                        <span style={{color:prices[sym]!=null?T.amber:T.dim,fontFamily:T.font,fontSize:12,fontWeight:700}}>{prices[sym]!=null?fmt(prices[sym],2):"—"}</span>
                        <span style={{color:T.dim,fontSize:7,fontFamily:T.font}}>{sym}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}