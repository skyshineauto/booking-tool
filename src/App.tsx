// src/App.tsx
import { supabase } from "./lib/supabaseClient";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Tab = "Quote" | "Job Log" | "Dashboard" | "Settings";

type Service = "Full" | "Interior" | "Exterior" | "Wash" | "Ceramic" | "AddOnsOnly";
type Tier = "Ignite" | "Momentum" | "Pinnacle";
type CeramicPkg = "Recharge" | "Ignite1Y" | "Momentum3Y" | "Pinnacle5Y";
type Condition = "Standard" | "Dirty" | "Heavy";
type Payment = "TapChip" | "Cash" | "Online";

type BookStatus = "Pending" | "Booked" | "NotBooked";
type NotBookedReason = "Price" | "Schedule" | "NoResponse" | "Competitor" | "Other";

type VehicleUI =
  | "Car"
  | "Large Car"
  | "Truck"
  | "SUV"
  | "Large SUV"
  | "Large Truck"
  | "Minivan";

type VehicleKey =
  | "car"
  | "large_car"
  | "truck"
  | "suv"
  | "large_suv"
  | "large_truck"
  | "minivan";

const VEHICLES_UI: VehicleUI[] = [
  "Car",
  "Large Car",
  "Truck",
  "SUV",
  "Large SUV",
  "Large Truck",
  "Minivan",
];

const VEHICLE_KEY: Record<VehicleUI, VehicleKey> = {
  Car: "car",
  "Large Car": "large_car",
  Truck: "truck",
  SUV: "suv",
  "Large SUV": "large_suv",
  "Large Truck": "large_truck",
  Minivan: "minivan",
};

const VEH_COLS: { key: VehicleKey; label: string }[] = [
  { key: "car", label: "Car" },
  { key: "large_car", label: "Large Car" },
  { key: "truck", label: "Truck" },
  { key: "suv", label: "SUV" },
  { key: "large_suv", label: "Large SUV" },
  { key: "large_truck", label: "Large Truck" },
  { key: "minivan", label: "Minivan" },
];

type MoneyTables = Record<VehicleKey, number>;

type AddOn = {
  id: string;
  name: string;
  price: number; // ex-tax
  ownerHours: number;
  elapsedHours: number;
  cogs: number; // per job
};

type HelperModelParams = {
  ownerOnlySharePct: number; // 0..1 (share of owner time that cannot be delegated)
  helperCoveragePct: number; // 0..1 (share of delegate work helper can take on)
  parallelEfficiencyPct: number; // 0..1 (how much delegate work can run in parallel)
};

type HelperOverrides = {
  wash: HelperModelParams;
  full: Record<Tier, HelperModelParams>;
  interior: Record<Tier, HelperModelParams>;
  exterior: Record<Tier, HelperModelParams>;
  ceramic: Record<CeramicPkg, HelperModelParams>;
};

type CustomerVehicle = {
  customerName: string;
  phone: string;
  email: string;
  year: string;
  make: string;
  model: string;
  color: string;
  notes: string;
};

type Settings = {
  brandName: string;

  targetProfitPerOwnerHr: number;

  helperRate: number;
  helperCoveragePct: number;
  ownerOnlySharePct: number;
  parallelEfficiencyPct: number;
  helperOverrides: HelperOverrides;

  annualOverhead: number;
  annualHours: number;

  taxRate: number;
  feeOnTaxToo: boolean;
  tapPct: number;
  tapFixed: number;
  onlinePct: number;
  onlineFixed: number;

  condMult: Record<Condition, number>;

  pricing: {
    wash: MoneyTables;
    full: Record<Tier, MoneyTables>;
    interior: Record<Tier, MoneyTables>;
    exterior: Record<Tier, MoneyTables>;
    ceramic: Record<CeramicPkg, MoneyTables>;
  };

  soloHours: {
    wash: { owner: MoneyTables; elapsed: MoneyTables };
    full: Record<Tier, { owner: MoneyTables; elapsed: MoneyTables }>;
    interior: Record<Tier, { owner: MoneyTables; elapsed: MoneyTables }>;
    exterior: Record<Tier, { owner: MoneyTables; elapsed: MoneyTables }>;
    ceramic: Record<CeramicPkg, { owner: MoneyTables; elapsed: MoneyTables }>;
  };

  cogs: {
    wash: MoneyTables;
    full: Record<Tier, MoneyTables>;
    interior: Record<Tier, MoneyTables>;
    exterior: Record<Tier, MoneyTables>;
    ceramic: Record<CeramicPkg, MoneyTables>;
  };

  addons: AddOn[];

  storeCustomerContact: boolean;
  clearCustomerAfterSave: boolean;
};

type Scenario = {
  mode: "Solo" | "Helper";
  priceExTax: number;
  tax: number;
  fees: number;
  cogs: number;
  overhead: number;
  helperHours: number;
  helperCost: number;
  ownerHours: number;
  elapsedHours: number;
  profit: number;
  profitPerOwnerHr: number;
  pass: boolean;
  chargeToBook: number;
  maxOwnerHoursToPass: number;
  ownerDeltaToPass: number; // + = over target time, - = under
};

type JobLogEntry = {
  id: string;
  createdAt: number;
  input: {
    service: Service;
    tier: Tier;
    ceramicPkg: CeramicPkg;
    vehicle: VehicleUI;
    condition: Condition;
    payment: Payment;
    priceMode: "table" | "override";
    priceOverride: number;
    addons: string[];
    chosenMode: "Solo" | "Helper";
    customer: CustomerVehicle;
  };
  solo: Scenario;
  helper: Scenario;
  recommendation: {
    recommended: "Solo" | "Helper" | "DontBook";
    reason: string;
  };
  actual: {
    status: BookStatus;
    notBookedReason?: NotBookedReason;
  };
};

const LS_SETTINGS = "skyshine_booking_settings_v6";
const LS_JOBLOG = "skyshine_booking_joblog_v6";

// Storage can be blocked in some embedded / credentialless contexts.
// Try localStorage first, then fall back to sessionStorage.
function getSafeStorage(): Storage | null {
  const testKey = "__skyshine_storage_test__";
  try {
    const s = window.localStorage;
    s.setItem(testKey, "1");
    s.removeItem(testKey);
    return s;
  } catch {
    // ignore
  }
  try {
    const s = window.sessionStorage;
    s.setItem(testKey, "1");
    s.removeItem(testKey);
    return s;
  } catch {
    return null;
  }
}

const SAFE_STORAGE: Storage | null = typeof window !== "undefined" ? getSafeStorage() : null;

function safeGetItem(key: string): string | null {
  try {
    return SAFE_STORAGE ? SAFE_STORAGE.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    if (!SAFE_STORAGE) return false;
    SAFE_STORAGE.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}


function resolveHelperModel(settings: Settings, svc: Service, tier: Tier, ceramic: CeramicPkg): HelperModelParams {
  const o = settings.helperOverrides;
  if (!o) {
    return {
      ownerOnlySharePct: settings.ownerOnlySharePct,
      helperCoveragePct: settings.helperCoveragePct,
      parallelEfficiencyPct: settings.parallelEfficiencyPct,
    };
  }
  if (svc === "Wash") return o.wash;
  if (svc === "Ceramic") return o.ceramic[ceramic];
  if (svc === "Full") return o.full[tier];
  if (svc === "Interior") return o.interior[tier];
  if (svc === "Exterior") return o.exterior[tier];
  return {
    ownerOnlySharePct: settings.ownerOnlySharePct,
    helperCoveragePct: settings.helperCoveragePct,
    parallelEfficiencyPct: settings.parallelEfficiencyPct,
  };
}

function money(n: number) {
  if (!isFinite(n)) return "$0.00";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function hrs(n: number) {
  if (!isFinite(n)) return "0.00h";
  return `${n.toFixed(2)}h`;
}
function deltaH(n: number) {
  const v = Math.abs(n);
  const s = n >= 0 ? "+" : "−";
  return `${s}${v.toFixed(2)}h`;
}

function fmtPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  if (d.length <= 3) return a;
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

function blankTable(v: number): MoneyTables {
  return {
    car: v,
    large_car: v,
    truck: v,
    suv: v,
    large_suv: v,
    large_truck: v,
    minivan: v,
  };
}

const DEFAULT_SETTINGS: Settings = {
  brandName: "SkyShine Auto Detailing • Booking Tool",

  targetProfitPerOwnerHr: 65,

  helperRate: 20,
  helperCoveragePct: 0.7,
  ownerOnlySharePct: 0.4,
  parallelEfficiencyPct: 0.7,


  helperOverrides: {
    wash: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
    full: {
      Ignite: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Momentum: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Pinnacle: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
    },
    interior: {
      Ignite: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Momentum: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Pinnacle: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
    },
    exterior: {
      Ignite: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Momentum: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Pinnacle: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
    },
    ceramic: {
      Recharge: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Ignite1Y: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Momentum3Y: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
      Pinnacle5Y: { ownerOnlySharePct: 0.4, helperCoveragePct: 0.7, parallelEfficiencyPct: 0.7 },
    },
  },


  annualOverhead: 6274.16,
  annualHours: 830,

  taxRate: 0.0635,
  feeOnTaxToo: true,
  tapPct: 0.027,
  tapFixed: 0.1,
  onlinePct: 0.029,
  onlineFixed: 0.3,

  condMult: { Standard: 1.0, Dirty: 1.2, Heavy: 1.4 },

  // Defaults are safe placeholders; you will set ceramic tables to your screenshots in Settings.
  pricing: {
    wash: {
      car: 49.99,
      large_car: 49.99,
      truck: 49.99,
      suv: 59.99,
      large_suv: 69.99,
      large_truck: 69.99,
      minivan: 59.99,
    },
    full: {
      Ignite: { car: 249.99, large_car: 249.99, truck: 249.99, suv: 299.99, large_suv: 369.99, large_truck: 369.99, minivan: 299.99 },
      Momentum: { car: 349.99, large_car: 349.99, truck: 349.99, suv: 449.99, large_suv: 529.99, large_truck: 529.99, minivan: 449.99 },
      Pinnacle: { car: 499.99, large_car: 499.99, truck: 499.99, suv: 599.99, large_suv: 629.99, large_truck: 629.99, minivan: 599.99 },
    },
    interior: {
      Ignite: { car: 153.99, large_car: 153.99, truck: 153.99, suv: 179.99, large_suv: 229.99, large_truck: 229.99, minivan: 179.99 },
      Momentum: { car: 279.99, large_car: 279.99, truck: 279.99, suv: 329.99, large_suv: 399.99, large_truck: 399.99, minivan: 329.99 },
      Pinnacle: { car: 399.99, large_car: 399.99, truck: 399.99, suv: 499.99, large_suv: 599.99, large_truck: 599.99, minivan: 499.99 },
    },
    exterior: {
      Ignite: { car: 149.99, large_car: 149.99, truck: 149.99, suv: 219.99, large_suv: 259.99, large_truck: 259.99, minivan: 219.99 },
      Momentum: { car: 299.99, large_car: 299.99, truck: 299.99, suv: 329.99, large_suv: 389.99, large_truck: 389.99, minivan: 329.99 },
      Pinnacle: { car: 399.99, large_car: 399.99, truck: 399.99, suv: 549.99, large_suv: 619.99, large_truck: 619.99, minivan: 549.99 },
    },
    ceramic: {
      Recharge: { car: 249.99, large_car: 249.99, truck: 249.99, suv: 279.99, large_suv: 299.99, large_truck: 299.99, minivan: 279.99 },
      Ignite1Y: { car: 699.99, large_car: 699.99, truck: 699.99, suv: 799.99, large_suv: 899.99, large_truck: 899.99, minivan: 799.99 },
      Momentum3Y: { car: 1099.99, large_car: 1099.99, truck: 1099.99, suv: 1199.99, large_suv: 1299.99, large_truck: 1299.99, minivan: 1199.99 },
      Pinnacle5Y: { car: 1399.99, large_car: 1399.99, truck: 1399.99, suv: 1499.99, large_suv: 1599.99, large_truck: 1599.99, minivan: 1499.99 },
    },
  },

  soloHours: {
    wash: { owner: { ...blankTable(0.7) }, elapsed: { ...blankTable(0.7) } },
    full: {
      Ignite: { owner: { ...blankTable(5.0) }, elapsed: { ...blankTable(5.0) } },
      Momentum: { owner: { ...blankTable(6.5) }, elapsed: { ...blankTable(6.5) } },
      Pinnacle: { owner: { ...blankTable(7.6) }, elapsed: { ...blankTable(7.6) } },
    },
    interior: {
      Ignite: { owner: { ...blankTable(2.75) }, elapsed: { ...blankTable(2.75) } },
      Momentum: { owner: { ...blankTable(3.75) }, elapsed: { ...blankTable(3.75) } },
      Pinnacle: { owner: { ...blankTable(5.0) }, elapsed: { ...blankTable(5.0) } },
    },
    exterior: {
      Ignite: { owner: { ...blankTable(2.25) }, elapsed: { ...blankTable(2.25) } },
      Momentum: { owner: { ...blankTable(3.0) }, elapsed: { ...blankTable(3.0) } },
      Pinnacle: { owner: { ...blankTable(5.0) }, elapsed: { ...blankTable(5.0) } },
    },
    ceramic: {
      Recharge: { owner: { ...blankTable(2.5) }, elapsed: { ...blankTable(2.5) } },
      Ignite1Y: { owner: { ...blankTable(6.0) }, elapsed: { ...blankTable(6.0) } },
      Momentum3Y: { owner: { ...blankTable(9.0) }, elapsed: { ...blankTable(9.0) } },
      Pinnacle5Y: { owner: { ...blankTable(12.0) }, elapsed: { ...blankTable(12.0) } },
    },
  },

  cogs: {
    wash: { ...blankTable(1.25) },
    full: { Ignite: { ...blankTable(5) }, Momentum: { ...blankTable(5) }, Pinnacle: { ...blankTable(5) } },
    interior: { Ignite: { ...blankTable(5) }, Momentum: { ...blankTable(5) }, Pinnacle: { ...blankTable(5) } },
    exterior: { Ignite: { ...blankTable(5) }, Momentum: { ...blankTable(5) }, Pinnacle: { ...blankTable(5) } },
    ceramic: {
      Recharge: { ...blankTable(8) },
      Ignite1Y: { ...blankTable(25) },
      Momentum3Y: { ...blankTable(90) },
      Pinnacle5Y: { ...blankTable(90) },
    },
  },

  addons: [
    { id: "pet_hair", name: "Pet Hair (hourly)", price: 120, ownerHours: 1.0, elapsedHours: 1.0, cogs: 2 },
    { id: "carpet_shampoo", name: "Carpet + Seat Shampoo", price: 169.99, ownerHours: 0.9, elapsedHours: 1.25, cogs: 3 },
    { id: "mech_decon", name: "Mechanical Decon", price: 89.99, ownerHours: 0.5, elapsedHours: 0.75, cogs: 2 },
    { id: "chem_decon", name: "Chemical Decon", price: 59.99, ownerHours: 0.25, elapsedHours: 0.35, cogs: 2 },
    { id: "ozone", name: "Ozone Treatment", price: 129.99, ownerHours: 0.35, elapsedHours: 0.5, cogs: 1 },
    { id: "headlights", name: "Headlight Restoration", price: 159.99, ownerHours: 0.5, elapsedHours: 0.75, cogs: 5 },
    { id: "engine_bay", name: "Engine Bay", price: 99.99, ownerHours: 0.4, elapsedHours: 0.6, cogs: 2 },
    { id: "trim_restore", name: "Trim Restoration (hourly)", price: 120, ownerHours: 1.0, elapsedHours: 1.0, cogs: 2 },
    { id: "enhancement_polish", name: "Enhancement Polish", price: 199.99, ownerHours: 0.9, elapsedHours: 1.25, cogs: 2 },
    { id: "extra_time", name: "Extra Time (hourly)", price: 120, ownerHours: 1.0, elapsedHours: 1.0, cogs: 0 },
  ],

  storeCustomerContact: true,
  clearCustomerAfterSave: false,
};

function mergeMoneyTables(def: MoneyTables, inc?: Partial<MoneyTables>): MoneyTables {
  return { ...def, ...(inc || {}) } as MoneyTables;
}
function mergeTierMoneyTables(def: Record<Tier, MoneyTables>, inc?: Partial<Record<Tier, MoneyTables>>): Record<Tier, MoneyTables> {
  return {
    Ignite: mergeMoneyTables(def.Ignite, inc?.Ignite as any),
    Momentum: mergeMoneyTables(def.Momentum, inc?.Momentum as any),
    Pinnacle: mergeMoneyTables(def.Pinnacle, inc?.Pinnacle as any),
  };
}
function mergeCeramicMoneyTables(def: Record<CeramicPkg, MoneyTables>, inc?: Partial<Record<CeramicPkg, MoneyTables>>): Record<CeramicPkg, MoneyTables> {
  return {
    Recharge: mergeMoneyTables(def.Recharge, (inc as any)?.Recharge),
    Ignite1Y: mergeMoneyTables(def.Ignite1Y, (inc as any)?.Ignite1Y),
    Momentum3Y: mergeMoneyTables(def.Momentum3Y, (inc as any)?.Momentum3Y),
    Pinnacle5Y: mergeMoneyTables(def.Pinnacle5Y, (inc as any)?.Pinnacle5Y),
  };
}


function mergeHelperParams(def: HelperModelParams, inc?: Partial<HelperModelParams>): HelperModelParams {
  return {
    ownerOnlySharePct: typeof inc?.ownerOnlySharePct === "number" ? inc!.ownerOnlySharePct : def.ownerOnlySharePct,
    helperCoveragePct: typeof inc?.helperCoveragePct === "number" ? inc!.helperCoveragePct : def.helperCoveragePct,
    parallelEfficiencyPct: typeof inc?.parallelEfficiencyPct === "number" ? inc!.parallelEfficiencyPct : def.parallelEfficiencyPct,
  };
}

function mergeHelperOverrides(def: HelperOverrides, inc?: Partial<HelperOverrides>): HelperOverrides {
  return {
    wash: mergeHelperParams(def.wash, (inc as any)?.wash),
    full: {
      Ignite: mergeHelperParams(def.full.Ignite, (inc as any)?.full?.Ignite),
      Momentum: mergeHelperParams(def.full.Momentum, (inc as any)?.full?.Momentum),
      Pinnacle: mergeHelperParams(def.full.Pinnacle, (inc as any)?.full?.Pinnacle),
    },
    interior: {
      Ignite: mergeHelperParams(def.interior.Ignite, (inc as any)?.interior?.Ignite),
      Momentum: mergeHelperParams(def.interior.Momentum, (inc as any)?.interior?.Momentum),
      Pinnacle: mergeHelperParams(def.interior.Pinnacle, (inc as any)?.interior?.Pinnacle),
    },
    exterior: {
      Ignite: mergeHelperParams(def.exterior.Ignite, (inc as any)?.exterior?.Ignite),
      Momentum: mergeHelperParams(def.exterior.Momentum, (inc as any)?.exterior?.Momentum),
      Pinnacle: mergeHelperParams(def.exterior.Pinnacle, (inc as any)?.exterior?.Pinnacle),
    },
    ceramic: {
      Recharge: mergeHelperParams(def.ceramic.Recharge, (inc as any)?.ceramic?.Recharge),
      Ignite1Y: mergeHelperParams(def.ceramic.Ignite1Y, (inc as any)?.ceramic?.Ignite1Y),
      Momentum3Y: mergeHelperParams(def.ceramic.Momentum3Y, (inc as any)?.ceramic?.Momentum3Y),
      Pinnacle5Y: mergeHelperParams(def.ceramic.Pinnacle5Y, (inc as any)?.ceramic?.Pinnacle5Y),
    },
  };
}

function mergeHoursPair(def: { owner: MoneyTables; elapsed: MoneyTables }, inc?: any): { owner: MoneyTables; elapsed: MoneyTables } {
  return {
    owner: mergeMoneyTables(def.owner, inc?.owner),
    elapsed: mergeMoneyTables(def.elapsed, inc?.elapsed),
  };
}
function mergeTierHours(def: Record<Tier, { owner: MoneyTables; elapsed: MoneyTables }>, inc?: any) {
  return {
    Ignite: mergeHoursPair(def.Ignite, inc?.Ignite),
    Momentum: mergeHoursPair(def.Momentum, inc?.Momentum),
    Pinnacle: mergeHoursPair(def.Pinnacle, inc?.Pinnacle),
  };
}
function mergeCeramicHours(def: Record<CeramicPkg, { owner: MoneyTables; elapsed: MoneyTables }>, inc?: any) {
  return {
    Recharge: mergeHoursPair(def.Recharge, inc?.Recharge),
    Ignite1Y: mergeHoursPair(def.Ignite1Y, inc?.Ignite1Y),
    Momentum3Y: mergeHoursPair(def.Momentum3Y, inc?.Momentum3Y),
    Pinnacle5Y: mergeHoursPair(def.Pinnacle5Y, inc?.Pinnacle5Y),
  };
}
function deepMergeSettings(parsed: any): Settings {
  const p = parsed || {};
  const out: Settings = {
    ...DEFAULT_SETTINGS,
    ...p,
    condMult: { ...DEFAULT_SETTINGS.condMult, ...(p.condMult || {}) },
    pricing: {
      wash: mergeMoneyTables(DEFAULT_SETTINGS.pricing.wash, p.pricing?.wash),
      full: mergeTierMoneyTables(DEFAULT_SETTINGS.pricing.full, p.pricing?.full),
      interior: mergeTierMoneyTables(DEFAULT_SETTINGS.pricing.interior, p.pricing?.interior),
      exterior: mergeTierMoneyTables(DEFAULT_SETTINGS.pricing.exterior, p.pricing?.exterior),
      ceramic: mergeCeramicMoneyTables(DEFAULT_SETTINGS.pricing.ceramic, p.pricing?.ceramic),
    },
    soloHours: {
      wash: mergeHoursPair(DEFAULT_SETTINGS.soloHours.wash, p.soloHours?.wash),
      full: mergeTierHours(DEFAULT_SETTINGS.soloHours.full, p.soloHours?.full),
      interior: mergeTierHours(DEFAULT_SETTINGS.soloHours.interior, p.soloHours?.interior),
      exterior: mergeTierHours(DEFAULT_SETTINGS.soloHours.exterior, p.soloHours?.exterior),
      ceramic: mergeCeramicHours(DEFAULT_SETTINGS.soloHours.ceramic, p.soloHours?.ceramic),
    },
    cogs: {
      wash: mergeMoneyTables(DEFAULT_SETTINGS.cogs.wash, p.cogs?.wash),
      full: mergeTierMoneyTables(DEFAULT_SETTINGS.cogs.full, p.cogs?.full),
      interior: mergeTierMoneyTables(DEFAULT_SETTINGS.cogs.interior, p.cogs?.interior),
      exterior: mergeTierMoneyTables(DEFAULT_SETTINGS.cogs.exterior, p.cogs?.exterior),
      ceramic: mergeCeramicMoneyTables(DEFAULT_SETTINGS.cogs.ceramic, p.cogs?.ceramic),
    },
    addons: Array.isArray(p.addons) ? p.addons : DEFAULT_SETTINGS.addons,
    storeCustomerContact: p.storeCustomerContact ?? DEFAULT_SETTINGS.storeCustomerContact,
    clearCustomerAfterSave: p.clearCustomerAfterSave ?? DEFAULT_SETTINGS.clearCustomerAfterSave,
  };
  return out;
}


function loadSettings(): Settings {
  try {
    const raw = safeGetItem(LS_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return deepMergeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettingsLocal(s: Settings): boolean {
  return safeSetItem(LS_SETTINGS, JSON.stringify(s));
}

function loadLog(): JobLogEntry[] {
  try {
    const raw = safeGetItem(LS_JOBLOG);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((j: any) => {
      const actual = j.actual || {};
      return {
        ...j,
        actual: {
          status: (actual.status as BookStatus) || "Pending",
          notBookedReason: actual.notBookedReason as NotBookedReason | undefined,
        },
      } as JobLogEntry;
    });
  } catch {
    return [];
  }
}

function saveLogLocal(log: JobLogEntry[]) {
  safeSetItem(LS_JOBLOG, JSON.stringify(log));
}

function replaceSettingsFromRemote(
  next: any,
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
  skipRef: React.MutableRefObject<boolean>
) {
  skipRef.current = true;
  setSettings(deepMergeSettings(next));
}

function sortJobLogDesc(rows: JobLogEntry[]) {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt);
}

async function getWorkspaceIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.workspace_id ?? null;
}

function paymentFee(settings: Settings, payment: Payment, priceExTax: number): number {
  if (payment === "Cash") return 0;
  const tax = priceExTax * settings.taxRate;
  const base = settings.feeOnTaxToo ? (priceExTax + tax) : priceExTax;
  const pct = payment === "TapChip" ? settings.tapPct : settings.onlinePct;
  const fix = payment === "TapChip" ? settings.tapFixed : settings.onlineFixed;
  return base * pct + fix;
}
function priceToPass(
  settings: Settings,
  payment: Payment,
  ownerHours: number,
  cogs: number,
  helperCost: number,
  overhead: number
): number {
  const target = settings.targetProfitPerOwnerHr;
  const pct = payment === "Cash" ? 0 : (payment === "TapChip" ? settings.tapPct : settings.onlinePct);
  const fix = payment === "Cash" ? 0 : (payment === "TapChip" ? settings.tapFixed : settings.onlineFixed);
  const baseMult = settings.feeOnTaxToo ? (1 + settings.taxRate) : 1;

  // Profit = price - (price*baseMult*pct + fix) - cogs - helperCost - overhead
  // Want Profit = target*ownerHours
  const denom = 1 - baseMult * pct;
  const rhs = target * ownerHours + fix + cogs + helperCost + overhead;
  if (denom <= 0.01) return rhs;
  return rhs / denom;
}

function formatNow12h(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function tableEditorRow(
  label: string,
  row: MoneyTables,
  onChange: (next: MoneyTables) => void
) {
  return (
    <tr>
      <td style={{ whiteSpace: "nowrap" }}>{label}</td>
      {VEH_COLS.map((c) => (
        <td key={c.key}>
          <input
            type="number"
            step="0.01"
            value={row[c.key] ?? 0}
            onChange={(e) => onChange({ ...row, [c.key]: Number(e.target.value) })}
          />
        </td>
      ))}
    </tr>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("Quote");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [jobLog, setJobLog] = useState<JobLogEntry[]>([]);
  const [toast, setToast] = useState<string>("");
  const [saveAnim, setSaveAnim] = useState(false);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [syncError, setSyncError] = useState<string>("");

  const skipNextSettingsAutosaveRef = useRef(true);
  const settingsSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function hydrate() {
      setIsHydrating(true);
      setSyncError("");

      try {
        const fallbackSettings = loadSettings();
        const fallbackJobLog = loadLog();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!alive) return;

        if (!user) {
          replaceSettingsFromRemote(fallbackSettings, setSettings, skipNextSettingsAutosaveRef);
          setJobLog(sortJobLogDesc(fallbackJobLog));
          setWorkspaceId(null);
          setAuthUserId(null);
          return;
        }

        setAuthUserId(user.id);

        const wsId = await getWorkspaceIdForUser(user.id);
        if (!alive) return;

        if (!wsId) {
          replaceSettingsFromRemote(fallbackSettings, setSettings, skipNextSettingsAutosaveRef);
          setJobLog(sortJobLogDesc(fallbackJobLog));
          setSyncError("No workspace found for this user.");
          return;
        }

        setWorkspaceId(wsId);

        const [settingsRow, remoteJobLog] = await Promise.all([
          fetchWorkspaceSettings(wsId),
          fetchWorkspaceJobLog(wsId),
        ]);

        if (!alive) return;

        const nextSettings = settingsRow?.data
          ? deepMergeSettings(settingsRow.data)
          : fallbackSettings;

        replaceSettingsFromRemote(nextSettings, setSettings, skipNextSettingsAutosaveRef);
        saveSettingsLocal(nextSettings);

        const nextLog = remoteJobLog.length ? remoteJobLog : fallbackJobLog;
        setJobLog(sortJobLogDesc(nextLog));
        saveLogLocal(nextLog);

        if (!settingsRow) {
          try {
            await upsertWorkspaceSettings(wsId, user.id, nextSettings);
          } catch {
            //
          }
        }
      } catch (err: any) {
        const fallbackSettings = loadSettings();
        const fallbackJobLog = loadLog();
        replaceSettingsFromRemote(fallbackSettings, setSettings, skipNextSettingsAutosaveRef);
        setJobLog(sortJobLogDesc(fallbackJobLog));
        setSyncError(err?.message || "Sync hydrate failed.");
      } finally {
        if (alive) setIsHydrating(false);
      }
    }

    hydrate();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (skipNextSettingsAutosaveRef.current) {
      skipNextSettingsAutosaveRef.current = false;
      return;
    }

    saveSettingsLocal(settings);

    if (settingsSaveTimerRef.current) {
      window.clearTimeout(settingsSaveTimerRef.current);
    }

    settingsSaveTimerRef.current = window.setTimeout(async () => {
      if (!workspaceId || !authUserId) {
        if (tab === "Settings") {
          setToast("Saved locally only");
          window.setTimeout(() => setToast(""), 1400);
        }
        return;
      }

      try {
        setSaveAnim(true);
        await upsertWorkspaceSettings(workspaceId, authUserId, settings);
        if (tab === "Settings") {
          setToast("Synced ✓");
          window.setTimeout(() => setToast(""), 1400);
        }
      } catch (err: any) {
        setSyncError(err?.message || "Settings sync failed.");
        if (tab === "Settings") {
          setToast("Sync failed — local backup kept");
          window.setTimeout(() => setToast(""), 1800);
        }
      } finally {
        setSaveAnim(false);
      }
    }, 600);

    return () => {
      if (settingsSaveTimerRef.current) {
        window.clearTimeout(settingsSaveTimerRef.current);
      }
    };
  }, [settings, workspaceId, authUserId, tab]);

useEffect(() => {
  if (!workspaceId) return;

  const channel = supabase
    .channel(`workspace-sync-${workspaceId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "app_settings",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        const row = payload.new as AppSettingsRow | undefined;
        if (!row?.data) return;

        const next = deepMergeSettings(row.data);
        replaceSettingsFromRemote(next, setSettings, skipNextSettingsAutosaveRef);
        saveSettingsLocal(next);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "job_log_entries",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as { id?: string } | undefined;
          if (!oldRow?.id) return;

          setJobLog((prev) => {
            const next = prev.filter((x) => x.id !== oldRow.id);
            saveLogLocal(next);
            return next;
          });
          return;
        }

        const row = payload.new as JobLogEntryRow | undefined;
        if (!row?.id) return;

        const mapped = dbRowToJobLogEntry(row);
        setJobLog((prev) => {
          const next = upsertJobLogLocal(prev, mapped);
          saveLogLocal(next);
          return next;
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [workspaceId]);

const [now, setNow] = useState<Date>(() => new Date());
useEffect(() => {
  const t = setInterval(() => setNow(new Date()), 1000 * 30);
  return () => clearInterval(t);
}, []);

// Quote selections
const [service, setService] = useState<Service>("Full");
const [tier, setTier] = useState<Tier>("Ignite");
const [ceramicPkg, setCeramicPkg] = useState<CeramicPkg>("Recharge");
const [vehicle, setVehicle] = useState<VehicleUI>("Car");
const [condition, setCondition] = useState<Condition>("Standard");
const [payment, setPayment] = useState<Payment>("TapChip");
const [chosenMode, setChosenMode] = useState<"Solo" | "Helper">("Solo");

const [priceMode, setPriceMode] = useState<"table" | "override">("table");
const [priceOverride, setPriceOverride] = useState<number>(0);

const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
const [hudOpen, setHudOpen] = useState(false);

const [custOpen, setCustOpen] = useState(false);
const [cust, setCust] = useState<CustomerVehicle>({
  customerName: "",
  phone: "",
  email: "",
  year: "",
  make: "",
  model: "",
  color: "",
  notes: "",
});

  const [savePulse, setSavePulse] = useState(false);


  // Settings admin nav
  const [settingsSection, setSettingsSection] = useState<
    "Targets" | "Pricing" | "Solo Hours" | "Helper Model" | "Overhead" | "Tax & Fees" | "COGS" | "Add-ons" | "Import/Export"
  >("Targets");

  const vehicleKey = useMemo(() => VEHICLE_KEY[vehicle], [vehicle]);

  const addOnTotals = useMemo(() => {
    let price = 0;
    let ownerH = 0;
    let elH = 0;
    let cogs = 0;
    const picked: AddOn[] = [];
    for (const a of settings.addons) {
      if (selectedAddons[a.id]) {
        price += a.price;
        ownerH += a.ownerHours;
        elH += a.elapsedHours;
        cogs += a.cogs;
        picked.push(a);
      }
    }
    return { price, ownerH, elH, cogs, picked };
  }, [settings.addons, selectedAddons]);

  const basePrice = useMemo(() => {
    const v = vehicleKey;
    if (service === "Wash") return settings.pricing.wash?.[v] ?? DEFAULT_SETTINGS.pricing.wash[v];
    if (service === "Full") return settings.pricing.full?.[tier]?.[v] ?? DEFAULT_SETTINGS.pricing.full[tier][v];
    if (service === "Interior") return settings.pricing.interior?.[tier]?.[v] ?? DEFAULT_SETTINGS.pricing.interior[tier][v];
    if (service === "Exterior") return settings.pricing.exterior?.[tier]?.[v] ?? DEFAULT_SETTINGS.pricing.exterior[tier][v];
    if (service === "Ceramic") return settings.pricing.ceramic?.[ceramicPkg]?.[v] ?? DEFAULT_SETTINGS.pricing.ceramic[ceramicPkg][v];
    return 0;
  }, [service, tier, ceramicPkg, vehicleKey, settings.pricing]);

  const priceExTax = useMemo(() => {
    const tableTotal = basePrice + addOnTotals.price;
    return priceMode === "override" ? (priceOverride || 0) : tableTotal;
  }, [basePrice, addOnTotals.price, priceMode, priceOverride]);

  const soloBaseHours = useMemo(() => {
    const mult = settings.condMult[condition] ?? 1.0;
    const v = vehicleKey;

    let owner = 0;
    let elapsed = 0;

    if (service === "Wash") {
      owner = settings.soloHours.wash?.owner?.[v] ?? DEFAULT_SETTINGS.soloHours.wash.owner[v];
      elapsed = settings.soloHours.wash?.elapsed?.[v] ?? DEFAULT_SETTINGS.soloHours.wash.elapsed[v];
    } else if (service === "Full") {
      owner = settings.soloHours.full?.[tier]?.owner?.[v] ?? DEFAULT_SETTINGS.soloHours.full[tier].owner[v];
      elapsed = settings.soloHours.full?.[tier]?.elapsed?.[v] ?? DEFAULT_SETTINGS.soloHours.full[tier].elapsed[v];
    } else if (service === "Interior") {
      owner = settings.soloHours.interior?.[tier]?.owner?.[v] ?? DEFAULT_SETTINGS.soloHours.interior[tier].owner[v];
      elapsed = settings.soloHours.interior?.[tier]?.elapsed?.[v] ?? DEFAULT_SETTINGS.soloHours.interior[tier].elapsed[v];
    } else if (service === "Exterior") {
      owner = settings.soloHours.exterior?.[tier]?.owner?.[v] ?? DEFAULT_SETTINGS.soloHours.exterior[tier].owner[v];
      elapsed = settings.soloHours.exterior?.[tier]?.elapsed?.[v] ?? DEFAULT_SETTINGS.soloHours.exterior[tier].elapsed[v];
    } else if (service === "Ceramic") {
      owner = settings.soloHours.ceramic?.[ceramicPkg]?.owner?.[v] ?? DEFAULT_SETTINGS.soloHours.ceramic[ceramicPkg].owner[v];
      elapsed = settings.soloHours.ceramic?.[ceramicPkg]?.elapsed?.[v] ?? DEFAULT_SETTINGS.soloHours.ceramic[ceramicPkg].elapsed[v];
    } else {
      owner = 0;
      elapsed = 0;
    }

    return { owner: owner * mult, elapsed: elapsed * mult };
  }, [settings, service, tier, ceramicPkg, vehicleKey, condition]);

  const soloHours = useMemo(() => {
    return {
      owner: soloBaseHours.owner + addOnTotals.ownerH,
      elapsed: soloBaseHours.elapsed + addOnTotals.elH,
    };
  }, [soloBaseHours, addOnTotals]);

  const overheadRate = useMemo(() => {
    const hrs = Math.max(1, settings.annualHours);
    return settings.annualOverhead / hrs; // overhead per elapsed hour
  }, [settings.annualOverhead, settings.annualHours]);

  const baseCogs = useMemo(() => {
    const v = vehicleKey;
    if (service === "Wash") return settings.cogs.wash?.[v] ?? DEFAULT_SETTINGS.cogs.wash[v];
    if (service === "Full") return settings.cogs.full?.[tier]?.[v] ?? DEFAULT_SETTINGS.cogs.full[tier][v];
    if (service === "Interior") return settings.cogs.interior?.[tier]?.[v] ?? DEFAULT_SETTINGS.cogs.interior[tier][v];
    if (service === "Exterior") return settings.cogs.exterior?.[tier]?.[v] ?? DEFAULT_SETTINGS.cogs.exterior[tier][v];
    if (service === "Ceramic") return settings.cogs.ceramic?.[ceramicPkg]?.[v] ?? DEFAULT_SETTINGS.cogs.ceramic[ceramicPkg][v];
    return 0;
  }, [service, tier, ceramicPkg, vehicleKey, settings.cogs]);

  const cogs = baseCogs + addOnTotals.cogs;

  // Helper model (can be overridden per package/service)
  const helperModel = useMemo(
    () => resolveHelperModel(settings, service, tier, ceramicPkg),
    [settings, service, tier, ceramicPkg]
  );

// Helper scenario model
  const helperScenarioHours = useMemo(() => {
    // Split solo owner hours into owner-only and delegate
    const ownerOnly = clamp(helperModel.ownerOnlySharePct, 0.05, 0.95) * soloHours.owner;
    const delegate = Math.max(0, soloHours.owner - ownerOnly);

    const coverage = clamp(helperModel.helperCoveragePct, 0, 1);
    const helperHours = delegate * coverage;

    // Owner hours with helper: owner-only + remaining delegate you keep
    const ownerWithHelper = Math.max(0.25, ownerOnly + delegate * (1 - coverage));

    // Elapsed with helper: approximate parallelism effectiveness
    const eff = clamp(helperModel.parallelEfficiencyPct, 0, 1);
    const soloElapsed = Math.max(0.25, soloHours.elapsed);
    const idealElapsed = Math.max(ownerWithHelper, soloElapsed - helperHours); // naive lower bound
    const elapsedWithHelper = Math.max(
      ownerWithHelper,
      soloElapsed - helperHours * eff
    );

    return {
      helperHours,
      ownerWithHelper,
      elapsedWithHelper: Math.max(0.25, Math.min(soloElapsed, elapsedWithHelper)),
    };
  }, [settings.ownerOnlySharePct, settings.helperCoveragePct, settings.parallelEfficiencyPct, soloHours.owner, soloHours.elapsed]);

  function scenarioCompute(mode: "Solo" | "Helper"): Scenario {
    const ownerHours = mode === "Solo" ? soloHours.owner : helperScenarioHours.ownerWithHelper;
    const elapsedHours = mode === "Solo" ? soloHours.elapsed : helperScenarioHours.elapsedWithHelper;
    const helperHours = mode === "Solo" ? 0 : helperScenarioHours.helperHours;
    const helperCost = helperHours * settings.helperRate;

    const tax = priceExTax * settings.taxRate;
    const fees = paymentFee(settings, payment, priceExTax);
    const overhead = elapsedHours * overheadRate;

    const profit = priceExTax - fees - cogs - helperCost - overhead;
    const profitPerOwnerHr = profit / Math.max(0.01, ownerHours);
    const pass = profitPerOwnerHr >= settings.targetProfitPerOwnerHr;

    const chargeToBook = priceToPass(settings, payment, ownerHours, cogs, helperCost, overhead);

    const maxOwnerHoursToPass = Math.max(0, profit / Math.max(0.01, settings.targetProfitPerOwnerHr));
    const ownerDeltaToPass = ownerHours - maxOwnerHoursToPass;

    return {
      mode,
      priceExTax,
      tax,
      fees,
      cogs,
      overhead,
      helperHours,
      helperCost,
      ownerHours,
      elapsedHours,
      profit,
      profitPerOwnerHr,
      pass,
      chargeToBook,
      maxOwnerHoursToPass,
      ownerDeltaToPass,
    };
  }

  const solo = useMemo(() => scenarioCompute("Solo"), [
    priceExTax, payment, cogs, overheadRate, soloHours, settings, helperScenarioHours,
  ]);
  const helper = useMemo(() => scenarioCompute("Helper"), [
    priceExTax, payment, cogs, overheadRate, soloHours, settings, helperScenarioHours,
  ]);

  const recommendation = useMemo(() => {
    const soloPass = solo.pass;
    const helperPass = helper.pass;

    if (soloPass && !helperPass) {
      return { recommended: "Solo" as const, reason: `Solo passes target. Helper fails target.` };
    }
    if (!soloPass && helperPass) {
      return {
        recommended: "Helper" as const,
        reason: `Solo fails (${money(solo.profitPerOwnerHr)}/owner-hr). Helper passes (${money(helper.profitPerOwnerHr)}/owner-hr) and saves ${hrs(solo.elapsedHours - helper.elapsedHours)} elapsed.`,
      };
    }
    if (soloPass && helperPass) {
      const best = helper.profitPerOwnerHr > solo.profitPerOwnerHr ? "Helper" : "Solo";
      const saved = solo.elapsedHours - helper.elapsedHours;
      return {
        recommended: best as const,
        reason: `Both pass. ${best} wins on $/owner-hr (${money(best === "Helper" ? helper.profitPerOwnerHr : solo.profitPerOwnerHr)}/hr). Time saved: ${hrs(saved)}.`,
      };
    }
    // neither pass
    const best = helper.profitPerOwnerHr > solo.profitPerOwnerHr ? "Helper" : "Solo";
    return {
      recommended: "DontBook" as const,
      reason: `Neither mode hits target. Raise price to Charge-to-Book.`,
      bestMode: best as "Solo" | "Helper",
    };
  }, [solo, helper]);

  const summaryStrip = useMemo(() => {
    const svc = service === "AddOnsOnly" ? "Add-ons Only" : service;
    const pkg =
      service === "Ceramic"
        ? ceramicPkg === "Recharge"
          ? "Recharge"
          : ceramicPkg === "Ignite1Y"
          ? "Ignite (1Y)"
          : ceramicPkg === "Momentum3Y"
          ? "Momentum (3Y)"
          : "Pinnacle (5Y)"
        : (service === "Wash" || service === "AddOnsOnly")
        ? "—"
        : tier;
    return { svc, pkg };
  }, [service, tier, ceramicPkg]);

  function resetAll() {
    setService("Full");
    setTier("Ignite");
    setCeramicPkg("Recharge");
    setVehicle("Car");
    setCondition("Standard");
    setPayment("TapChip");
    setChosenMode("Solo");
    setPriceMode("table");
    setPriceOverride(0);
    setSelectedAddons({});
    setCust({ customerName: "", phone: "", email: "", year: "", make: "", model: "", color: "" });
  }

  function copyText(text: string) {
    navigator.clipboard?.writeText(text);
    setToast("Copied ✅");
    setTimeout(() => setToast(""), 1300);
  }

  function copyQuick() {
    const veh = `${cust.year ? cust.year + " " : ""}${cust.make ? cust.make + " " : ""}${cust.model ? cust.model : ""}`.trim();
    const who = cust.customerName ? `${cust.customerName} • ` : "";
    const line1 = `${who}${veh ? veh + " • " : ""}${cust.color ? cust.color + " • " : ""}${summaryStrip.svc} • ${summaryStrip.pkg} • ${vehicle} • ${condition}`;
    const line2 = `Total (ex-tax): ${money(priceExTax)} | Solo: ${hrs(solo.elapsedHours)} | Helper: ${hrs(helper.elapsedHours)} (helper ${hrs(helper.helperHours)})`;
    const line3 = `Recommend: ${
      recommendation.recommended === "DontBook"
        ? `DON'T BOOK (Charge-to-book Solo ${money(solo.chargeToBook)} / Helper ${money(helper.chargeToBook)})`
        : recommendation.recommended.toUpperCase()
    }`;
    copyText([line1, line2, line3].join("\n"));
  }

  function copyDetailed() {
    const lines: string[] = [];
    if (cust.customerName) lines.push(`Customer: ${cust.customerName}`);
    if (cust.phone) lines.push(`Phone: ${cust.phone}`);
    if (cust.email) lines.push(`Email: ${cust.email}`);
    const veh = [cust.year, cust.make, cust.model, cust.color].filter(Boolean).join(" ");
    if (veh) lines.push(`Vehicle: ${veh}`);
    lines.push(`Job: ${summaryStrip.svc} • ${summaryStrip.pkg} • ${vehicle} • ${condition} • ${payment === "TapChip" ? "Tap/Chip" : payment}`);
    lines.push(`Price (ex-tax): ${money(priceExTax)} (Base ${money(basePrice)} + Add-ons ${money(addOnTotals.price)})`);
    lines.push(`Solo: elapsed ${hrs(solo.elapsedHours)} | owner ${hrs(solo.ownerHours)} | profit ${money(solo.profit)} | ${money(solo.profitPerOwnerHr)}/owner-hr | charge-to-book ${money(solo.chargeToBook)}`);
    lines.push(`Helper: elapsed ${hrs(helper.elapsedHours)} | owner ${hrs(helper.ownerHours)} | helper ${hrs(helper.helperHours)} (${money(helper.helperCost)}) | profit ${money(helper.profit)} | ${money(helper.profitPerOwnerHr)}/owner-hr | charge-to-book ${money(helper.chargeToBook)}`);
    lines.push(`Costs: fees ${money(solo.fees)} | cogs ${money(cogs)} | overhead(solo) ${money(solo.overhead)} | overhead(helper) ${money(helper.overhead)}`);
    lines.push(
      `Recommendation: ${
        recommendation.recommended === "DontBook" ? "DON'T BOOK" : recommendation.recommended.toUpperCase()
      } — ${recommendation.reason}`
    );
    copyText(lines.join("\n"));
  }

  function copyHelperText() {
    const veh = `${cust.year ? cust.year + " " : ""}${cust.make ? cust.make + " " : ""}${cust.model ? cust.model : ""}`.trim();
    const h = helper.helperHours;
    const block = Math.ceil(h * 2) / 2; // round up to 0.5h
    const text = `Helper needed: ~${block} hours for ${summaryStrip.svc} ${summaryStrip.pkg} • ${vehicle}${veh ? " • " + veh : ""}.`;
    copyText(text);
  }

   async function saveToJobLog() {
    const phoneDigits = (cust.phone || "").replace(/\D/g, "");
    if (!cust.customerName.trim() || phoneDigits.length < 10) {
      setToast("Add Name + Phone to save");
      setTimeout(() => setToast(""), 1600);
      return;
    }

    const entry: JobLogEntry = {
      id: uid(),
      createdAt: Date.now(),
      input: {
        service,
        tier,
        ceramicPkg,
        vehicle,
        condition,
        payment,
        priceMode,
        priceOverride,
        addons: Object.keys(selectedAddons).filter((k) => selectedAddons[k]),
        chosenMode,
        customer: settings.storeCustomerContact
          ? cust
          : {
              customerName: "",
              phone: "",
              email: "",
              year: "",
              make: "",
              model: "",
              color: "",
              notes: "",
            },
      },
      solo,
      helper,
      recommendation: {
        recommended: recommendation.recommended,
        reason: recommendation.reason,
      },
      actual: { status: "Pending" },
    };

    setSavePulse(true);
    window.setTimeout(() => setSavePulse(false), 650);

    try {
      if (workspaceId && authUserId) {
        const payload = {
          workspace_id: workspaceId,
          user_id: authUserId,
          data: sanitizeJobLogEntryForDb(entry),
        };

        const { data, error } = await supabase
          .from("job_log_entries")
          .insert(payload)
          .select("id,user_id,workspace_id,created_at,data")
          .single();

        if (error) throw error;

        const saved = dbRowToJobLogEntry(data as JobLogEntryRow);
        setJobLog((prev) => {
          const next = upsertJobLogLocal(prev, saved);
          saveLogLocal(next);
          return next;
        });

        setToast("Saved + synced ✅");
      } else {
        setJobLog((prev) => {
          const next = sortJobLogDesc([entry, ...prev]);
          saveLogLocal(next);
          return next;
        });
        setToast("Saved locally only");
      }

      if (settings.clearCustomerAfterSave) {
        setCust({
          customerName: "",
          phone: "",
          email: "",
          year: "",
          make: "",
          model: "",
          color: "",
          notes: "",
        });
      }
    } catch (err: any) {
      const localEntry = { ...entry, id: entry.id || uid() };
      setJobLog((prev) => {
        const next = sortJobLogDesc([localEntry, ...prev]);
        saveLogLocal(next);
        return next;
      });
      setSyncError(err?.message || "Job log save failed.");
      setToast("Sync failed — saved locally");
    }

    setTimeout(() => setToast(""), 1600);
  }

  function loadFromJob(j: JobLogEntry) {
    setService(j.input.service);
    setTier(j.input.tier);
    setCeramicPkg(j.input.ceramicPkg);
    setVehicle(j.input.vehicle);
    setCondition(j.input.condition);
    setPayment(j.input.payment);
    setPriceMode(j.input.priceMode);
    setPriceOverride(j.input.priceOverride);
    setChosenMode(j.input.chosenMode);
    const map: Record<string, boolean> = {};
    for (const id of j.input.addons) map[id] = true;
    setSelectedAddons(map);
    setCust(j.input.customer || { customerName: "", phone: "", email: "", year: "", make: "", model: "", color: "", notes: "" });
    setTab("Quote");
  }

  function toggleAddon(id: string) {
    setSelectedAddons((p) => ({ ...p, [id]: !p[id] }));
  }

  // Dashboard computed stats from Job Log
  const dash = useMemo(() => {
    const periodDays = 30; // will be filterable later; default 30 for now
    const cutoff = Date.now() - periodDays * 86400000;
    const data = jobLog.filter((j) => j.createdAt >= cutoff && j.actual.status === "Booked");

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);

    const profitUsed = data.map((j) => (j.input.chosenMode === "Helper" ? j.helper.profit : j.solo.profit));
    const ownerUsed = data.map((j) => (j.input.chosenMode === "Helper" ? j.helper.ownerHours : j.solo.ownerHours));
    const elapsedUsed = data.map((j) => (j.input.chosenMode === "Helper" ? j.helper.elapsedHours : j.solo.elapsedHours));

    const ownerSaved = data
      .filter((j) => j.input.chosenMode === "Helper")
      .map((j) => Math.max(0, j.solo.ownerHours - j.helper.ownerHours));
    const elapsedSaved = data
      .filter((j) => j.input.chosenMode === "Helper")
      .map((j) => Math.max(0, j.solo.elapsedHours - j.helper.elapsedHours));

    const totalProfit = sum(profitUsed);
    const avgProfitPerJob = avg(profitUsed);
    const avgOwnerHr = avg(ownerUsed);
    const avgElapsedHr = avg(elapsedUsed);
    const avgProfitPerOwnerHr = avgOwnerHr ? (sum(profitUsed) / Math.max(0.01, sum(ownerUsed))) : 0;

    // Top earners by package key
    const keyOf = (j: JobLogEntry) => {
      if (j.input.service === "Ceramic") return `Ceramic • ${j.input.ceramicPkg}`;
      if (j.input.service === "Wash") return `Wash`;
      if (j.input.service === "AddOnsOnly") return `Add-ons Only`;
      return `${j.input.service} • ${j.input.tier}`;
    };

    const group: Record<
      string,
      { n: number; profit: number; owner: number; elapsed: number; pass: number; gap: number }
    > = {};

    for (const j of data) {
      const k = keyOf(j);
      const used = j.input.chosenMode === "Helper" ? j.helper : j.solo;
      if (!group[k]) group[k] = { n: 0, profit: 0, owner: 0, elapsed: 0, pass: 0, gap: 0 };
      group[k].n += 1;
      group[k].profit += used.profit;
      group[k].owner += used.ownerHours;
      group[k].elapsed += used.elapsedHours;
      group[k].pass += used.pass ? 1 : 0;

      // pricing pressure: charge-to-book minus actual price
      const gap = Math.max(0, used.chargeToBook - used.priceExTax);
      group[k].gap += gap;
    }

    const rows = Object.entries(group).map(([k, g]) => ({
      key: k,
      n: g.n,
      avgProfit: g.profit / g.n,
      avgOwner: g.owner / g.n,
      avgElapsed: g.elapsed / g.n,
      avgProfitPerOwnerHr: g.profit / Math.max(0.01, g.owner),
      passRate: g.pass / g.n,
      avgGap: g.gap / g.n,
    }));

    rows.sort((a, b) => b.avgProfitPerOwnerHr - a.avgProfitPerOwnerHr);
    const topEarners = rows.slice(0, 8);

    const pressure = [...rows].sort((a, b) => b.avgGap - a.avgGap).slice(0, 8);

    // What should I book next? simple pick: highest $/ownerhr with decent pass rate and lower elapsed
    const next = [...rows]
      .filter((r) => r.passRate >= 0.6)
      .sort((a, b) => (b.avgProfitPerOwnerHr - a.avgProfitPerOwnerHr) || (a.avgElapsed - b.avgElapsed))
      .slice(0, 5);

    return {
      totalProfit,
      avgProfitPerJob,
      avgProfitPerOwnerHr,
      totalOwner: sum(ownerUsed),
      totalElapsed: sum(elapsedUsed),
      ownerSaved: sum(ownerSaved),
      elapsedSaved: sum(elapsedSaved),
      topEarners,
      pressure,
      next,
    };
  }, [jobLog]);

  // Price raise simulator
  const [simKey, setSimKey] = useState<string>("(none)");
  const [simDelta, setSimDelta] = useState<number>(50);

  const sim = useMemo(() => {
    if (!jobLog.length || simKey === "(none)") return null;

    // use last 90 days
    const cutoff = Date.now() - 90 * 86400000;
    const data = jobLog.filter((j) => j.createdAt >= cutoff && j.actual.status === "Booked");

    const keyOf = (j: JobLogEntry) => {
      if (j.input.service === "Ceramic") return `Ceramic • ${j.input.ceramicPkg}`;
      if (j.input.service === "Wash") return `Wash`;
      if (j.input.service === "AddOnsOnly") return `Add-ons Only`;
      return `${j.input.service} • ${j.input.tier}`;
    };

    const pool = data.filter((j) => keyOf(j) === simKey);
    if (!pool.length) return { n: 0, estPassGain: 0, note: "No data in last 90 days for this package." };

    // Estimate: if we add simDelta to price, assume fees scale slightly and profit rises roughly by delta*(1 - feePctApprox).
    // For pass rate estimate, count how many FAILs had gap <= simDelta.
    let fails = 0;
    let fixable = 0;
    for (const j of pool) {
      const used = j.input.chosenMode === "Helper" ? j.helper : j.solo;
      const gap = Math.max(0, used.chargeToBook - used.priceExTax);
      if (!used.pass) {
        fails += 1;
        if (gap <= simDelta) fixable += 1;
      }
    }
    const estPassGain = fails ? fixable / fails : 0;
    return { n: pool.length, fails, fixable, estPassGain };
  }, [jobLog, simKey, simDelta]);

  // Customer strip summary
  const custSummary = useMemo(() => {
    const veh = [cust.year, cust.make, cust.model].filter(Boolean).join(" ");
    const parts = [
      cust.customerName || "",
      veh || "",
      cust.color || "",
      cust.phone || "",
    ].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Add customer/vehicle details (optional)";
  }, [cust]);

  // Ceramic label line (exact-ish wording displayed as subtitle)
  const ceramicLabel = useMemo(() => {
    if (ceramicPkg === "Recharge") return "Recharge Ceramic Care Plan (Maintenance)";
    if (ceramicPkg === "Ignite1Y") return "Ignite Shield — 1-Year True Ceramic (Entry)";
    if (ceramicPkg === "Momentum3Y") return "Momentum Shield — 3-Year True Ceramic Coating";
    return "Pinnacle Shield — 5-Year True Ceramic Coating (Elite)";
  }, [ceramicPkg]);

  // Summary strip chips
  const stripChips = useMemo(() => {
    const pkg =
      service === "Ceramic"
        ? ceramicPkg === "Recharge"
          ? "Recharge"
          : ceramicPkg === "Ignite1Y"
          ? "Ignite 1Y"
          : ceramicPkg === "Momentum3Y"
          ? "Momentum 3Y"
          : "Pinnacle 5Y"
        : service === "Wash" || service === "AddOnsOnly"
        ? "—"
        : tier;

    return {
      service: service === "AddOnsOnly" ? "Add-ons Only" : service,
      pkg,
    };
  }, [service, tier, ceramicPkg]);

  // HUD numbers
  const timeSavedElapsed = Math.max(0, solo.elapsedHours - helper.elapsedHours);
  const timeSavedOwner = Math.max(0, solo.ownerHours - helper.ownerHours);

  const recommendBadge = useMemo(() => {
    if (recommendation.recommended === "DontBook") return { t: "DON’T BOOK", cls: "bad" as const };
    return recommendation.recommended === "Helper"
      ? { t: "RECOMMEND: HELPER", cls: "orange" as const }
      : { t: "RECOMMEND: SOLO", cls: "cyan" as const };
  }, [recommendation]);

  const bestMode = recommendation.recommended === "DontBook"
    ? (helper.profitPerOwnerHr >= solo.profitPerOwnerHr ? "Helper" : "Solo")
    : recommendation.recommended;
  const rec = bestMode === "Helper" ? helper : solo;

   // Settings save button toast
  async function saveSettingsManual() {
    saveSettingsLocal(settings);

    if (!workspaceId || !authUserId) {
      setToast("Saved locally only");
      setTimeout(() => setToast(""), 1400);
      return;
    }

    try {
      setSaveAnim(true);
      await upsertWorkspaceSettings(workspaceId, authUserId, settings);
      setToast("Synced ✅");
      setTimeout(() => setToast(""), 1400);
    } catch (err: any) {
      setSyncError(err?.message || "Manual settings sync failed.");
      setToast("Sync failed — local backup kept");
      setTimeout(() => setToast(""), 1800);
    } finally {
      setSaveAnim(false);
    }
  }

  // Export/Import
  function exportJSON() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skyshine-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }
   async function importJSON(file: File) {
    const text = await file.text();
    const parsed = JSON.parse(text) as Settings;
    const merged = deepMergeSettings(parsed);
    setSettings(merged);
    saveSettingsLocal(merged);
    setToast("Imported ✅");
    setTimeout(() => setToast(""), 1400);
  }

   async function setLogStatus(id: string, status: BookStatus) {
    let updatedEntry: JobLogEntry | null = null;

    setJobLog((prev) => {
      const next = prev.map((j) => {
        if (j.id !== id) return j;
        const updated = {
          ...j,
          actual: {
            ...j.actual,
            status,
            notBookedReason:
              status === "NotBooked" ? (j.actual.notBookedReason || "Price") : undefined,
          },
        };
        updatedEntry = updated;
        return updated;
      });
      saveLogLocal(next);
      return next;
    });

    if (!workspaceId || !updatedEntry) return;

    try {
      const { error } = await supabase
        .from("job_log_entries")
        .update({ data: sanitizeJobLogEntryForDb(updatedEntry) })
        .eq("id", id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;
    } catch (err: any) {
      setSyncError(err?.message || "Status update sync failed.");
      setToast("Status sync failed");
      setTimeout(() => setToast(""), 1600);
    }
  }

    async function setLogNotBookedReason(id: string, reason: NotBookedReason) {
    let updatedEntry: JobLogEntry | null = null;

    setJobLog((prev) => {
      const next = prev.map((j) => {
        if (j.id !== id) return j;
        const updated = {
          ...j,
          actual: { ...j.actual, notBookedReason: reason },
        };
        updatedEntry = updated;
        return updated;
      });
      saveLogLocal(next);
      return next;
    });

    if (!workspaceId || !updatedEntry) return;

    try {
      const { error } = await supabase
        .from("job_log_entries")
        .update({ data: sanitizeJobLogEntryForDb(updatedEntry) })
        .eq("id", id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;
    } catch (err: any) {
      setSyncError(err?.message || "Not-booked reason sync failed.");
      setToast("Reason sync failed");
      setTimeout(() => setToast(""), 1600);
    }
  }

  async function deleteJobLogEntry(id: string) {
    const prevSnapshot = jobLog;

    setJobLog((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveLogLocal(next);
      return next;
    });

    if (!workspaceId) return;

    try {
      const { error } = await supabase
        .from("job_log_entries")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;
    } catch (err: any) {
      setJobLog(prevSnapshot);
      saveLogLocal(prevSnapshot);
      setSyncError(err?.message || "Delete sync failed.");
      setToast("Delete sync failed");
      setTimeout(() => setToast(""), 1600);
    }
  }

  async function clearAllJobLog() {
    const prevSnapshot = jobLog;

    setJobLog([]);
    saveLogLocal([]);

    if (!workspaceId) return;

    try {
      const { error } = await supabase
        .from("job_log_entries")
        .delete()
        .eq("workspace_id", workspaceId);

      if (error) throw error;
    } catch (err: any) {
      setJobLog(prevSnapshot);
      saveLogLocal(prevSnapshot);
      setSyncError(err?.message || "Clear-all sync failed.");
      setToast("Clear-all sync failed");
      setTimeout(() => setToast(""), 1600);
    }
  }

  // Job log filtering basic
  const [logQuery, setLogQuery] = useState("");
  const filteredLog = useMemo(() => {
    if (!logQuery.trim()) return jobLog;
    const q = logQuery.toLowerCase();
    return jobLog.filter((j) => {
      const s =
        `${j.input.customer?.customerName || ""} ${j.input.customer?.phone || ""} ${j.input.customer?.email || ""} ` +
        `${j.input.customer?.year || ""} ${j.input.customer?.make || ""} ${j.input.customer?.model || ""} ${j.input.customer?.color || ""} ${j.input.customer?.notes || ""} ` +
        `${j.input.service} ${j.input.tier} ${j.input.ceramicPkg} ${j.input.vehicle} ${j.input.condition} ${j.input.payment}`;
      return s.toLowerCase().includes(q);
    });
  }, [jobLog, logQuery]);

  // Decision banner values
  const decisionStatus =
    recommendation.recommended === "DontBook"
      ? { badge: "FAIL", cls: "bad" as const }
      : (recommendation.recommended === "Helper" ? helper.pass : solo.pass)
      ? { badge: "PASS", cls: "good" as const }
      : { badge: "FAIL", cls: "bad" as const };

  // UI helpers
  function Pill(props: { on: boolean; label: string; onClick: () => void; title?: string }) {
    return (
      <button className={`pill ${props.on ? "on" : ""}`} onClick={props.onClick} title={props.title}>
        {props.label}
        <span className="check">✓</span>
      </button>
    );
  }

   if (isHydrating) {
    return (
      <div className="app">
        <div className="bg" />
        <div className="vignette" />
        <div className="bokeh" />
        <div className="wrap" style={{ paddingTop: 24 }}>
          <section className="card">
            <div className="cardTitle">
              <h2>Loading workspace…</h2>
              <div className="muted">Syncing shared settings and job log</div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="bg" />
      <div className="vignette" />
      <div className="bokeh" />

      <header className="topbar" aria-label="SkyShine header">
        {/* LEFT: Metrics */}
        <div className="topbarLeft" aria-label="Targets">
          <div className="topbarMetric">
            <div className="mLabel">TARGET OWNER $/HR</div>
            <div className="mValue">{money(settings.targetProfitPerOwnerHr)}/hr</div>
          </div>
          <div className="topbarMetric">
            <div className="mLabel">OVERHEAD /HR</div>
            <div className="mValue">{money(overheadRate)}</div>
          </div>
        </div>

        {/* CENTER: Brand */}
        <div className="topbarCenter" aria-label="Brand">
          <img
            className="logo logoTop"
            src="/logo.png"
            alt="SkyShine"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className="topbarBrand">{settings.brandName}</div>
          <div className="topbarTitle">BOOKING TOOL</div>
        </div>

        {/* RIGHT: Tabs + Live + Time */}
        <div className="topbarRight" aria-label="Navigation">
          <div className="tabs">
            {(["Quote", "Job Log", "Dashboard", "Settings"] as Tab[]).map((t) => (
              <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="liveBadge" aria-label="Live status">
            <span className="liveDot" aria-hidden="true" />LIVE
          </div>
          <div className="timeNow" aria-label="Current time">{formatNow12h(now)}</div>
        </div>
      </header>

           <div className={`wrap ${tab === "Quote" ? "hasHud" : ""}`}>
        {syncError && (
          <div
            style={{
              margin: "0 0 12px",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,77,109,.35)",
              background: "rgba(255,77,109,.10)",
              color: "rgba(255,235,240,.96)",
              fontWeight: 900,
            }}
          >
            Sync issue: {syncError}
          </div>
        )}

        {/* Summary strip */}
        <div className="summaryStrip">
          <div className="sChip"><span>Service</span> <b>{stripChips.service}</b></div>
          <div className="sChip"><span>Package</span> <b>{stripChips.pkg}</b></div>
          <div className="sChip"><span>Vehicle</span> <b>{vehicle}</b></div>
          <div className="sChip"><span>Condition</span> <b>{condition}</b></div>
          <div className="sChip"><span>Payment</span> <b>{payment === "TapChip" ? "Tap/Chip" : payment}</b></div>
          <div className="sChip"><span>Mode</span> <b>{chosenMode}</b></div>
        </div>

        {tab === "Quote" && (
          <div className="grid2">
            {/* LEFT: Quote */}
            <section className="card">
              <div className="cardTitle">
                <h2>Quote</h2>
                <div className="muted">Use table pricing + solo hours from Settings</div>
              </div>

              {/* Service */}
              <div className="section">
                <div className="sectionHead">
                  <div className="label">SERVICE</div>
                  <div className="hint">Pick the job type</div>
                </div>
                <div className="pillGrid cols3">
                  {(["Full", "Interior", "Exterior", "Wash", "Ceramic", "AddOnsOnly"] as Service[]).map((s) => (
                    <Pill
                      key={s}
                      on={service === s}
                      label={s === "AddOnsOnly" ? "Add-ons Only" : s}
                      onClick={() => setService(s)}
                    />
                  ))}
                </div>
              </div>

              {/* Ceramic package / Tier */}
              {service === "Ceramic" && (
                <div className="section">
                  <div className="sectionHead">
                    <div className="label">CERAMIC PACKAGE</div>
                    <div className="hint">{ceramicLabel}</div>
                  </div>
                  <div className="pillGrid cols2">
                    <Pill on={ceramicPkg === "Recharge"} label="Recharge" onClick={() => setCeramicPkg("Recharge")} />
                    <Pill on={ceramicPkg === "Ignite1Y"} label="Ignite (1Y)" onClick={() => setCeramicPkg("Ignite1Y")} />
                    <Pill on={ceramicPkg === "Momentum3Y"} label="Momentum (3Y)" onClick={() => setCeramicPkg("Momentum3Y")} />
                    <Pill on={ceramicPkg === "Pinnacle5Y"} label="Pinnacle (5Y)" onClick={() => setCeramicPkg("Pinnacle5Y")} />
                  </div>
                </div>
              )}

              {service !== "Wash" && service !== "Ceramic" && service !== "AddOnsOnly" && (
                <div className="section">
                  <div className="sectionHead">
                    <div className="label">TIER</div>
                    <div className="hint">Ignite / Momentum / Pinnacle</div>
                  </div>
                  <div className="pillGrid cols3">
                    {(["Ignite", "Momentum", "Pinnacle"] as Tier[]).map((t) => (
                      <Pill key={t} on={tier === t} label={t} onClick={() => setTier(t)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicle */}
              <div className="section">
                <div className="sectionHead">
                  <div className="label">VEHICLE</div>
                  <div className="hint">Truck sits before SUV</div>
                </div>
                <div className="pillGrid cols4">
                  {VEHICLES_UI.map((v) => (
                    <Pill key={v} on={vehicle === v} label={v} onClick={() => setVehicle(v)} />
                  ))}
                </div>
              </div>

              {/* Condition */}
              <div className="section">
                <div className="sectionHead">
                  <div className="label">CONDITION</div>
                  <div className="hint">Standard / Dirty / Heavy</div>
                </div>
                <div className="pillGrid cols3">
                  {(["Standard", "Dirty", "Heavy"] as Condition[]).map((c) => (
                    <Pill key={c} on={condition === c} label={c} onClick={() => setCondition(c)} />
                  ))}
                </div>
              </div>

              {/* Payment */}
              <div className="section">
                <div className="sectionHead">
                  <div className="label">PAYMENT</div>
                  <div className="hint">Fees apply (cash is $0)</div>
                </div>
                <div className="pillGrid cols3">
                  <Pill on={payment === "TapChip"} label="Tap/Chip" onClick={() => setPayment("TapChip")} />
                  <Pill on={payment === "Cash"} label="Cash" onClick={() => setPayment("Cash")} />
                  <Pill on={payment === "Online"} label="Online" onClick={() => setPayment("Online")} />
                </div>
              </div>

              {/* Mode */}
              <div className="section">
                <div className="sectionHead">
                  <div className="label">MODE (FOR HUD + JOB LOG)</div>
                  <div className="hint">Decision still compares both</div>
                </div>
                <div className="pillGrid cols2">
                  <Pill on={chosenMode === "Solo"} label="Solo" onClick={() => setChosenMode("Solo")} />
                  <Pill on={chosenMode === "Helper"} label="With Helper" onClick={() => setChosenMode("Helper")} />
                </div>
              </div>

              {/* Price */}
              <div className="section">
                <div className="sectionHead">
                  <div className="label">PRICE</div>
                  <div className="hint">Table vs Override</div>
                </div>
                <div className="priceRow">
                  <Pill on={priceMode === "table"} label="Use Table Price" onClick={() => setPriceMode("table")} />
                  <Pill on={priceMode === "override"} label="Override" onClick={() => setPriceMode("override")} />
                </div>

                {priceMode === "override" && (
                  <div className="priceInline">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={priceOverride}
                      onChange={(e) => setPriceOverride(Number(e.target.value))}
                      placeholder="Override price (ex-tax)"
                    />
                  </div>
                )}

                <div className="smallNote">
                  Current (ex-tax): <b className="bigNum">{money(priceExTax)}</b>{" "}
                  <span style={{ color: "rgba(255,255,255,.65)", fontWeight: 900 }}>
                    (Base {money(basePrice)} + Add-ons {money(addOnTotals.price)})
                  </span>
                </div>
              </div>

              {/* Add-ons */}
              <div className="section">
                <div className="sectionHead">
                  <div className="label">ADD-ONS</div>
                  <div className="hint">Select extras (adds price/time/COGS)</div>
                </div>

                {addOnTotals.picked.length > 0 && (
                  <div className="addonSummary">
                    <b>Selected:</b> {addOnTotals.picked.length} • {money(addOnTotals.price)} • {hrs(addOnTotals.elH)} elapsed
                  </div>
                )}

                <div className="addonsRows">
                  {settings.addons.map((a) => {
                    const on = !!selectedAddons[a.id];
                    return (
                      <button key={a.id} className={`addonRow ${on ? "on" : ""}`} onClick={() => toggleAddon(a.id)}>
                        <div className="addonLeft"><span className={`chk ${on ? "on" : ""}`}>{on ? "✓" : ""}</span></div>
                        <div className="addonMid">{a.name}</div>
                        <div className="addonRight">+{hrs(a.elapsedHours)} • +{money(a.price)}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="actionsRow">
                  <button className="btn" onClick={copyQuick}>Copy Quick</button>
                  <button className="btn" onClick={resetAll}>Reset</button>
                </div>
              </div>
            </section>

            {/* RIGHT: Decision */}
            <section className="card cardRight">
              <div className="cardTitle">
                <h2 className="uTitle">Decision</h2>
                <div className="muted">Compare Solo vs Helper</div>
              </div>

              <div className="decisionBanner">
                <div className="bannerTop">
                  <div className="reco">
                    <span className={`badge ${recommendBadge.cls}`}>{recommendBadge.t}</span>
                    <span className={`badge ${decisionStatus.cls}`}>{decisionStatus.badge}</span>
                  </div>
                  <div className="bigNum">{money(priceExTax)} <span style={{ fontSize: 12, color: "rgba(255,255,255,.65)", fontWeight: 900 }}>(ex-tax)</span></div>
                </div>
                <div className="bannerWhy">{recommendation.reason}</div>
              </div>

              <div className="scenarios">
                {/* Solo */}
                <div className="specCard">
                  <div className="specHead">
                    <div className="title">SOLO</div>
                    <span className={`badge ${solo.pass ? "good" : "bad"}`}>{solo.pass ? "PASS" : "FAIL"}</span>
                  </div>

                  <div className="specGroup">
                    <div className="specRow"><span>Total Time (Elapsed)</span><b>{hrs(solo.elapsedHours)}</b></div>
                    <div className="specRow"><span>Owner Time</span><b>{hrs(solo.ownerHours)}</b></div>
                  </div>

                  <div className="specDivider" />

                  <div className="specGroup">
                    <div className="specRow"><span>Net Profit (Bottom Line)</span><b>{money(solo.profit)}</b></div>
                    <div className="specRow"><span>Owner $/Hr Pay</span><b>{money(solo.profitPerOwnerHr)}/hr</b></div>
                  </div>

                  <div className="specDivider" />

                  <div className="specGroup">
                    <div className="specRow"><span>Max Owner Time to Hit Target</span><b>{hrs(solo.maxOwnerHoursToPass)}</b></div>
                    <div className="specRow">
                      <span>Owner Over/Under Target (Hours)</span>
                      <b className={solo.ownerDeltaToPass > 0 ? "badText" : "goodText"}>
                        {deltaH(solo.ownerDeltaToPass)} {solo.ownerDeltaToPass > 0 ? "over" : "under"}
                      </b>
                    </div>
                  </div>

                  <div className="specDivider" />

                  <div className="specGroup">
                    <div className="specRow"><span>Charge to Book (to Hit Target Pay)</span><b>{money(solo.chargeToBook)}</b></div>
                  </div>

                  <div className="specMini">Fees {money(solo.fees)} • COGS {money(cogs)} • Overhead {money(solo.overhead)}</div>
                </div>

                {/* Helper */}
                <div className="specCard">
                  <div className="specHead">
                    <div className="title">WITH HELPER</div>
                    <span className={`badge ${helper.pass ? "good" : "bad"}`}>{helper.pass ? "PASS" : "FAIL"}</span>
                  </div>

                  <div className="specGroup">
                    <div className="specRow"><span>Total Time (Elapsed)</span><b>{hrs(helper.elapsedHours)}</b></div>
                    <div className="specRow"><span>Owner Time</span><b>{hrs(helper.ownerHours)}</b></div>
                    <div className="specRow"><span>Helper Hours</span><b>{hrs(helper.helperHours)}</b></div>
                    <div className="specRow"><span>Helper Cost</span><b>{money(helper.helperCost)}</b></div>
                    <div className="specNote">Saves {hrs(timeSavedElapsed)} elapsed • Saves {hrs(timeSavedOwner)} owner</div>
                  </div>

                  <div className="specDivider" />

                  <div className="specGroup">
                    <div className="specRow"><span>Net Profit (Bottom Line)</span><b>{money(helper.profit)}</b></div>
                    <div className="specRow"><span>Owner $/Hr Pay</span><b>{money(helper.profitPerOwnerHr)}/hr</b></div>
                  </div>

                  <div className="specDivider" />

                  <div className="specGroup">
                    <div className="specRow"><span>Max Owner Time to Hit Target</span><b>{hrs(helper.maxOwnerHoursToPass)}</b></div>
                    <div className="specRow">
                      <span>Owner Over/Under Target (Hours)</span>
                      <b className={helper.ownerDeltaToPass > 0 ? "badText" : "goodText"}>
                        {deltaH(helper.ownerDeltaToPass)} {helper.ownerDeltaToPass > 0 ? "over" : "under"}
                      </b>
                    </div>
                  </div>

                  <div className="specDivider" />

                  <div className="specGroup">
                    <div className="specRow"><span>Charge to Book (to Hit Target Pay)</span><b>{money(helper.chargeToBook)}</b></div>
                  </div>

                  <div className="specMini">
                    <button className="btn" onClick={copyHelperText}>Copy helper text</button>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="customerBlock">
                <div className="subHead">
                  <h3 className="uTitle">Customer Information</h3>
                  <div className="muted">Required: Name + Phone</div>
                </div>

                <div className="custGrid2">
                  <input className="input" value={cust.customerName} onChange={(e) => setCust((c) => ({ ...c, customerName: e.target.value }))} placeholder="Name" />
                  <input className="input" value={cust.phone} onChange={(e) => setCust((c) => ({ ...c, phone: fmtPhone(e.target.value) }))} placeholder="Phone" />
                </div>
                <input className="input" value={cust.email} onChange={(e) => setCust((c) => ({ ...c, email: e.target.value }))} placeholder="Email (optional)" />
                <div className="custGrid4">
                  <input className="input" value={cust.year} onChange={(e) => setCust((c) => ({ ...c, year: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="Year" />
                  <input className="input" value={cust.make} onChange={(e) => setCust((c) => ({ ...c, make: e.target.value }))} placeholder="Make" />
                  <input className="input" value={cust.model} onChange={(e) => setCust((c) => ({ ...c, model: e.target.value }))} placeholder="Model" />
                  <input className="input" value={cust.color} onChange={(e) => setCust((c) => ({ ...c, color: e.target.value }))} placeholder="Color" />
                </div>
                <textarea className="input" value={cust.notes} onChange={(e) => setCust((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes" rows={3} />

                <div className="actionsRow" style={{ justifyContent: "flex-end", marginTop: 10 }}>
                  <button className={`btn primary ${savePulse ? "pulse" : ""}`} onClick={saveToJobLog}>{savePulse ? "Saved ✓" : "Save to Job Log"}</button>
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === "Job Log" && (
          <section className="card">
            <div className="cardTitle">
              <h2>Job Log</h2>
              <div className="muted">{jobLog.length} saved</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <input className="input" value={logQuery} onChange={(e) => setLogQuery(e.target.value)} placeholder="Search customer / vehicle / package / notes..." />
              <button className="btn danger" onClick={clearAllJobLog}>Clear All</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredLog.length === 0 && <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900 }}>No jobs found.</div>}
              {filteredLog.map((j) => {
                const used = j.input.chosenMode === "Helper" ? j.helper : j.solo;
                const dt = new Date(j.createdAt).toLocaleString();
                const pkg =
                  j.input.service === "Ceramic"
                    ? `Ceramic • ${j.input.ceramicPkg}`
                    : j.input.service === "Wash"
                    ? "Wash"
                    : j.input.service === "AddOnsOnly"
                    ? "Add-ons Only"
                    : `${j.input.service} • ${j.input.tier}`;
                return (
                  <div key={j.id} className="logCard">
                    <div className="logTop">
                      <div className="logTitle">
                        <div className="logTitleRow">
                          <div className="logTitleMain">
                            {dt} • {pkg} • {j.input.vehicle} • {j.input.condition} • {j.input.payment === "TapChip" ? "Tap/Chip" : j.input.payment}
                          </div>
                          <div className="logTitlePrice">{money(used.priceExTax)}</div>
                        </div>
                        {(j.input.customer?.customerName || j.input.customer?.phone || j.input.customer?.year || j.input.customer?.make || j.input.customer?.model || j.input.customer?.color) && (
                          <div className="logSub">
                            <span className="logSubStrong">{j.input.customer?.customerName || "Customer"}</span>
                            {j.input.customer?.phone ? <span className="logSubDim"> • {j.input.customer.phone}</span> : null}
                            {j.input.customer?.year || j.input.customer?.make || j.input.customer?.model || j.input.customer?.color ? (
                              <span className="logSubDim">
                                {" • "}
                                {[j.input.customer?.year, j.input.customer?.make, j.input.customer?.model, j.input.customer?.color].filter(Boolean).join(" ")}
                              </span>
                            ) : null}
                            {j.input.customer?.notes ? <span className="logSubDim"> • {j.input.customer.notes}</span> : null}
                          </div>
                        )}
                      </div>
                      <div className="logBadges">
                        <span className={`badge ${used.pass ? "good" : "bad"}`}>{used.pass ? "PASS" : "FAIL"}</span>
                        <span className="badge">{j.input.chosenMode === "Helper" ? "HELPER" : "SOLO"}</span>
                      </div>
                    </div>

                    <div className="logMetricGrid">
                      <div className="logMetric"><div className="k">Net Profit (Bottom Line)</div><div className="v">{money(used.profit)}</div></div>
                      <div className="logMetric"><div className="k">Owner $/Hr Pay</div><div className="v">{money(used.profitPerOwnerHr)}/hr</div></div>
                      <div className="logMetric"><div className="k">Total Time (Elapsed)</div><div className="v">{hrs(used.elapsedHours)}</div></div>
                      <div className="logMetric"><div className="k">Owner Time</div><div className="v">{hrs(used.ownerHours)}</div></div>
                      <div className="logMetric"><div className="k">Helper Cost</div><div className="v">{money(used.helperCost)}</div></div>
                      <div className="logMetric"><div className="k">Charge to Book</div><div className="v">{money(used.chargeToBook)}</div></div>
                    </div>

                    {j.actual.status === "NotBooked" && (
                      <div className="notBookedRow">
                        <span className="muted" style={{ fontWeight: 900 }}>Reason</span>
                        <select className="input inputSm" value={j.actual.notBookedReason || "Price"} onChange={(e) => setLogNotBookedReason(j.id, e.target.value as NotBookedReason)}>
                          <option value="Price">Price too high</option>
                          <option value="Schedule">Schedule conflict</option>
                          <option value="NoResponse">No response</option>
                          <option value="Competitor">Went elsewhere</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}

                    <div className="logBottom">
                      <div className="logBottomRight">
                        <button className="btn btnSm" onClick={() => loadFromJob(j)}>Load</button>
                        <button className="btn btnSm" onClick={() => copyText(JSON.stringify(j, null, 2))}>Copy</button>
                        <button className="btn btnSm danger" onClick={() => deleteJobLogEntry(j.id)}>Delete</button>

                        <button className={`btn btnSm ${j.actual.status === "Pending" ? "on" : ""}`} onClick={() => setLogStatus(j.id, "Pending")}>Estimated</button>
                        <button className={`btn btnSm ${j.actual.status === "Booked" ? "on good" : ""}`} onClick={() => setLogStatus(j.id, "Booked")}>Booked</button>
                        <button className={`btn btnSm ${j.actual.status === "NotBooked" ? "on bad" : ""}`} onClick={() => setLogStatus(j.id, "NotBooked")}>Not Booked</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "Dashboard" && (
          <section className="card">
            <div className="cardTitle">
              <h2>Dashboard</h2>
              <div className="muted">Last 30 days (from Job Log)</div>
            </div>

            <div className="kpiGrid">
              <div className="kpi">
                <div className="k">Total Profit</div>
                <div className="v">{money(dash.totalProfit)}</div>
                <div className="s">Using chosen mode per job</div>
              </div>
              <div className="kpi">
                <div className="k">Avg $/OwnerHr</div>
                <div className="v">{money(dash.avgProfitPerOwnerHr)}/hr</div>
                <div className="s">Profit divided by owner hours</div>
              </div>
              <div className="kpi">
                <div className="k">Avg Profit / Job</div>
                <div className="v">{money(dash.avgProfitPerJob)}</div>
                <div className="s">Mean bottom-line profit</div>
              </div>
              <div className="kpi">
                <div className="k">Total Owner Hours</div>
                <div className="v">{dash.totalOwner.toFixed(1)}h</div>
                <div className="s">Workload baseline</div>
              </div>
              <div className="kpi">
                <div className="k">Total Elapsed Hours</div>
                <div className="v">{dash.totalElapsed.toFixed(1)}h</div>
                <div className="s">Capacity usage</div>
              </div>
              <div className="kpi">
                <div className="k">Helper Impact</div>
                <div className="v">{dash.elapsedSaved.toFixed(1)}h</div>
                <div className="s">Saved elapsed • Owner saved {dash.ownerSaved.toFixed(1)}h</div>
              </div>
            </div>

            <div className="board">
              <div className="scCard">
                <div className="scHead">
                  <div className="title">Top Earners</div>
                  <span className="badge cyan">$/OwnerHr</span>
                </div>
                {dash.topEarners.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900 }}>No data yet.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Package</th><th>Jobs</th><th>Avg $/OwnerHr</th><th>Avg Profit</th><th>Pass %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dash.topEarners.map((r) => (
                        <tr key={r.key}>
                          <td>{r.key}</td>
                          <td>{r.n}</td>
                          <td>{money(r.avgProfitPerOwnerHr)}/hr</td>
                          <td>{money(r.avgProfit)}</td>
                          <td>{Math.round(r.passRate * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="scCard">
                <div className="scHead">
                  <div className="title">Pricing Pressure</div>
                  <span className="badge bad">Gap</span>
                </div>
                {dash.pressure.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900 }}>No data yet.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Package</th><th>Jobs</th><th>Avg Gap</th><th>Avg Profit</th><th>Pass %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dash.pressure.map((r) => (
                        <tr key={r.key}>
                          <td>{r.key}</td>
                          <td>{r.n}</td>
                          <td>{money(r.avgGap)}</td>
                          <td>{money(r.avgProfit)}</td>
                          <td>{Math.round(r.passRate * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* What should I book next */}
              <div className="scCard">
                <div className="scHead">
                  <div className="title">What should I book next?</div>
                  <span className="badge good">Recommended</span>
                </div>
                {dash.next.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900 }}>Not enough history yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {dash.next.map((r) => (
                      <div key={r.key} className="hBlock">
                        <div className="hTitle">{r.key}</div>
                        <div className="hVal">
                          {money(r.avgProfitPerOwnerHr)}/owner-hr • {money(r.avgProfit)} avg profit • {r.avgElapsed.toFixed(1)}h avg elapsed • {Math.round(r.passRate * 100)}% pass
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Price raise simulator */}
              <div className="scCard">
                <div className="scHead">
                  <div className="title">Price-raise simulator</div>
                  <span className="badge orange">Estimator</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, marginBottom: 10 }}>
                  <select className="input" value={simKey} onChange={(e) => setSimKey(e.target.value)}>
                    <option value="(none)">(none)</option>
                    {Array.from(new Set(jobLog.map((j) => {
                      if (j.input.service === "Ceramic") return `Ceramic • ${j.input.ceramicPkg}`;
                      if (j.input.service === "Wash") return "Wash";
                      if (j.input.service === "AddOnsOnly") return "Add-ons Only";
                      return `${j.input.service} • ${j.input.tier}`;
                    }))).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>

                  <input className="input" type="number" step="5" value={simDelta} onChange={(e) => setSimDelta(Number(e.target.value))} />
                </div>

                {!sim ? (
                  <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900 }}>Select a package to simulate.</div>
                ) : sim.n === 0 ? (
                  <div style={{ color: "rgba(255,255,255,.65)", fontWeight: 900 }}>{sim.note}</div>
                ) : (
                  <div className="drawerCard">
                    <div className="drawerLine"><span>Jobs (90d)</span><b>{sim.n}</b></div>
                    <div className="drawerLine"><span>Fails</span><b>{sim.fails}</b></div>
                    <div className="drawerLine"><span>Fails fixable by +{money(simDelta)}</span><b>{sim.fixable}</b></div>
                    <div className="drawerLine"><span>Estimated pass-rate improvement (fails)</span><b>{Math.round(sim.estPassGain * 100)}%</b></div>
                  </div>
                )}

                <div style={{ marginTop: 10, color: "rgba(255,255,255,.60)", fontWeight: 900, fontSize: 12 }}>
                  This uses historical charge-to-book gaps to estimate how many FAILS become PASS with a price increase.
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "Settings" && (
          <section className="card">
            <div className="cardTitle">
              <h2>Settings</h2>
              <div className="muted">Admin mode • Save button + toast</div>
            </div>

            <div className="admin">
              {/* left nav */}
              <div className="navBox">
                {(["Targets", "Pricing", "Solo Hours", "Helper Model", "Overhead", "Tax & Fees", "COGS", "Add-ons", "Import/Export"] as const).map((s) => (
                  <button key={s} className={`navBtn ${settingsSection === s ? "active" : ""}`} onClick={() => setSettingsSection(s)}>
                    {s}
                  </button>
                ))}
              </div>

              {/* right panel */}
              <div>
                {settingsSection === "Targets" && (
                  <div className="scCard">
                    <div className="scHead">
                      <div className="title">Targets</div>
                      <span className="badge cyan">Primary</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="hBlock">
                        <div className="hTitle">Target $/OwnerHr</div>
                        <div className="hVal">
                          <input className="input" type="number" step="1" value={settings.targetProfitPerOwnerHr}
                            onChange={(e) => setSettings((x) => ({ ...x, targetProfitPerOwnerHr: Number(e.target.value) }))} />
                        </div>
                      </div>

                      <div className="hBlock">
                        <div className="hTitle">Overhead per elapsed hour</div>
                        <div className="hVal">{money(overheadRate)}/hr</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, color: "rgba(255,255,255,.65)", fontWeight: 900, fontSize: 12 }}>
                      PASS/FAIL is based on Profit ÷ Owner Hours ≥ Target.
                    </div>
                  </div>
                )}

                {settingsSection === "Helper Model" && (
                  <div className="scCard">
                    <div className="scHead">
                      <div className="title">Helper Model</div>
                      <span className="badge orange">Capacity</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                      <div className="hBlock">
                        <div className="hTitle">Helper $/hr</div>
                        <div className="hVal">
                          <input className="input" type="number" step="1" value={settings.helperRate}
                            onChange={(e) => setSettings((x) => ({ ...x, helperRate: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="hBlock">
                        <div className="hTitle">Owner-only share %</div>
                        <div className="hVal">
                          <input className="input" type="number" step="0.01" value={Math.round(settings.ownerOnlySharePct * 10000) / 100}
                            onChange={(e) => setSettings((x) => ({ ...x, ownerOnlySharePct: Number(e.target.value) / 100 }))} />
                        </div>
                      </div>
                      <div className="hBlock">
                        <div className="hTitle">Helper coverage %</div>
                        <div className="hVal">
                          <input className="input" type="number" step="0.01" value={Math.round(settings.helperCoveragePct * 10000) / 100}
                            onChange={(e) => setSettings((x) => ({ ...x, helperCoveragePct: Number(e.target.value) / 100 }))} />
                        </div>
                      </div>
                      <div className="hBlock">
                        <div className="hTitle">Parallel efficiency %</div>
                        <div className="hVal">
                          <input className="input" type="number" step="0.01" value={Math.round(settings.parallelEfficiencyPct * 10000) / 100}
                            onChange={(e) => setSettings((x) => ({ ...x, parallelEfficiencyPct: Number(e.target.value) / 100 }))} />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, color: "rgba(255,255,255,.65)", fontWeight: 900, fontSize: 12 }}>
                      Helper hours are computed from delegate work. Elapsed time drops based on parallel efficiency.
                    </div>
                  </div>
                )}

                {settingsSection === "Overhead" && (
                  <div className="scCard">
                    <div className="scHead">
                      <div className="title">Overhead</div>
                      <span className="badge">Time-based</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                      <div className="hBlock">
                        <div className="hTitle">Annual Overhead</div>
                        <div className="hVal">
                          <input className="input" type="number" step="1" value={settings.annualOverhead}
                            onChange={(e) => setSettings((x) => ({ ...x, annualOverhead: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="hBlock">
                        <div className="hTitle">Annual Hours</div>
                        <div className="hVal">
                          <input className="input" type="number" step="1" value={settings.annualHours}
                            onChange={(e) => setSettings((x) => ({ ...x, annualHours: Number(e.target.value) }))} />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, color: "rgba(255,255,255,.65)", fontWeight: 900 }}>
                      Overhead/hr = {money(overheadRate)} (applied to elapsed hours per job)
                    </div>
                  </div>
                )}

                {settingsSection === "Tax & Fees" && (
                  <div className="scCard">
                    <div className="scHead">
                      <div className="title">Tax & Fees</div>
                      <span className="badge">Processing</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                      <div className="hBlock">
                        <div className="hTitle">Tax rate</div>
                        <div className="hVal">
                          <input className="input" type="number" step="0.0001" value={settings.taxRate}
                            onChange={(e) => setSettings((x) => ({ ...x, taxRate: Number(e.target.value) }))} />
                        </div>
                      </div>

                      <div className="hBlock">
                        <div className="hTitle">Fee applies on price+tax</div>
                        <div className="hVal">
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                            <input type="checkbox" checked={settings.feeOnTaxToo}
                              onChange={(e) => setSettings((x) => ({ ...x, feeOnTaxToo: e.target.checked }))} />
                            Enabled
                          </label>
                        </div>
                      </div>

                      <div className="hBlock">
                        <div className="hTitle">Tap %</div>
                        <div className="hVal">
                          <input className="input" type="number" step="0.0001" value={settings.tapPct}
                            onChange={(e) => setSettings((x) => ({ ...x, tapPct: Number(e.target.value) }))} />
                        </div>
                      </div>

                      <div className="hBlock">
                        <div className="hTitle">Tap fixed</div>
                        <div className="hVal">
                          <input className="input" type="number" step="0.01" value={settings.tapFixed}
                            onChange={(e) => setSettings((x) => ({ ...x, tapFixed: Number(e.target.value) }))} />
                        </div>
                      </div>

                      <div className="hBlock">
                        <div className="hTitle">Online %</div>
                        <div className="hVal">
                          <input className="input" type="number" step="0.0001" value={settings.onlinePct}
                            onChange={(e) => setSettings((x) => ({ ...x, onlinePct: Number(e.target.value) }))} />
                        </div>
                      </div>

                      <div className="hBlock">
                        <div className="hTitle">Online fixed</div>
                        <div className="hVal">
                          <input className="input" type="number" step="0.01" value={settings.onlineFixed}
                            onChange={(e) => setSettings((x) => ({ ...x, onlineFixed: Number(e.target.value) }))} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsSection === "Pricing" && (
                  <div className="scCard">
                    <div className="scHead">
                      <div className="title">Pricing Tables</div>
                      <span className="badge cyan">All services</span>
                    </div>

                    <div style={{ marginBottom: 10, color: "rgba(255,255,255,.65)", fontWeight: 900, fontSize: 12 }}>
                      Edit every package by vehicle type (including Truck + Minivan).
                    </div>

                    {/* Wash */}
                    <div className="drawerCard" style={{ marginBottom: 10 }}>
                      <div className="t">Wash</div>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Package</th>
                            {VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {tableEditorRow("Wash", settings.pricing.wash, (next) => setSettings((s) => ({ ...s, pricing: { ...s.pricing, wash: next } })))}
                        </tbody>
                      </table>
                    </div>

                    {/* Full / Interior / Exterior */}
                    {(["Full", "Interior", "Exterior"] as const).map((svc) => (
                      <div key={svc} className="drawerCard" style={{ marginBottom: 10 }}>
                        <div className="t">{svc}</div>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Tier</th>
                              {VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {(["Ignite","Momentum","Pinnacle"] as Tier[]).map((t) =>
                              tableEditorRow(
                                t,
                                svc === "Full" ? settings.pricing.full[t] : svc === "Interior" ? settings.pricing.interior[t] : settings.pricing.exterior[t],
                                (next) => setSettings((s) => ({
                                  ...s,
                                  pricing: {
                                    ...s.pricing,
                                    ...(svc === "Full" ? { full: { ...s.pricing.full, [t]: next } } : {}),
                                    ...(svc === "Interior" ? { interior: { ...s.pricing.interior, [t]: next } } : {}),
                                    ...(svc === "Exterior" ? { exterior: { ...s.pricing.exterior, [t]: next } } : {}),
                                  },
                                }))
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {/* Ceramic */}
                    <div className="drawerCard">
                      <div className="t">Ceramic (Recharge / 1Y / 3Y / 5Y)</div>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Package</th>
                            {VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {tableEditorRow("Recharge", settings.pricing.ceramic.Recharge, (next) => setSettings((s) => ({ ...s, pricing: { ...s.pricing, ceramic: { ...s.pricing.ceramic, Recharge: next } } })))}
                          {tableEditorRow("Ignite (1Y)", settings.pricing.ceramic.Ignite1Y, (next) => setSettings((s) => ({ ...s, pricing: { ...s.pricing, ceramic: { ...s.pricing.ceramic, Ignite1Y: next } } })))}
                          {tableEditorRow("Momentum (3Y)", settings.pricing.ceramic.Momentum3Y, (next) => setSettings((s) => ({ ...s, pricing: { ...s.pricing, ceramic: { ...s.pricing.ceramic, Momentum3Y: next } } })))}
                          {tableEditorRow("Pinnacle (5Y)", settings.pricing.ceramic.Pinnacle5Y, (next) => setSettings((s) => ({ ...s, pricing: { ...s.pricing, ceramic: { ...s.pricing.ceramic, Pinnacle5Y: next } } })))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {settingsSection === "Solo Hours" && (
				  <div className="scCard">
                    <div className="scHead">
                      <div className="title">Solo Hours Tables</div>
                      <span className="badge">Owner + Elapsed</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginBottom: 10 }}>
                      {(["Standard","Dirty","Heavy"] as Condition[]).map((c) => (
                        <div key={c} className="hBlock">
                          <div className="hTitle">{c} multiplier</div>
                          <div className="hVal">
                            <input className="input" type="number" step="0.01" value={settings.condMult[c]}
                              onChange={(e) => setSettings((s) => ({ ...s, condMult: { ...s.condMult, [c]: Number(e.target.value) } }))} />
                          </div>
                        </div>
                      ))}
                    </div>

				    <div className="drawerCard" style={{ marginBottom: 10 }}>
				      <div className="t">Helper Model Overrides</div>
				      <div className="smallNote">Per package/service. Enter percents (0–100). These override the global Helper Model settings.</div>
				      <table className="table">
				        <thead>
				          <tr>
				            <th>Package</th>
				            <th>Owner-only %</th>
				            <th>Coverage %</th>
				            <th>Efficiency %</th>
				          </tr>
				        </thead>
				        <tbody>
				          <tr>
				            <td>Wash</td>
				            {(() => {
				              const v = settings.helperOverrides.wash;
				              const patch = (p: Partial<HelperModelParams>) =>
				                setSettings((s) => ({ ...s, helperOverrides: { ...s.helperOverrides, wash: { ...s.helperOverrides.wash, ...p } } }));
				              return (
				                <>
				                  <td><input type="number" step="1" value={Math.round(v.ownerOnlySharePct * 10000) / 100}
				                    onChange={(e) => patch({ ownerOnlySharePct: Number(e.target.value) / 100 })} /></td>
				                  <td><input type="number" step="1" value={Math.round(v.helperCoveragePct * 10000) / 100}
				                    onChange={(e) => patch({ helperCoveragePct: Number(e.target.value) / 100 })} /></td>
				                  <td><input type="number" step="1" value={Math.round(v.parallelEfficiencyPct * 10000) / 100}
				                    onChange={(e) => patch({ parallelEfficiencyPct: Number(e.target.value) / 100 })} /></td>
				                </>
				              );
				            })()}
				          </tr>

				          {(["Full","Interior","Exterior"] as const).flatMap((svc) =>
				            (["Ignite","Momentum","Pinnacle"] as Tier[]).map((t) => {
				              const key = `${svc} • ${t}`;
				              const v =
				                svc === "Full" ? settings.helperOverrides.full[t] :
				                svc === "Interior" ? settings.helperOverrides.interior[t] :
				                settings.helperOverrides.exterior[t];
				              const patch = (p: Partial<HelperModelParams>) => {
				                setSettings((s) => ({
				                  ...s,
				                  helperOverrides: {
				                    ...s.helperOverrides,
				                    ...(svc === "Full"
				                      ? { full: { ...s.helperOverrides.full, [t]: { ...s.helperOverrides.full[t], ...p } } }
				                      : svc === "Interior"
				                      ? { interior: { ...s.helperOverrides.interior, [t]: { ...s.helperOverrides.interior[t], ...p } } }
				                      : { exterior: { ...s.helperOverrides.exterior, [t]: { ...s.helperOverrides.exterior[t], ...p } } }),
				                  },
				                }));
				              };
				              return (
				                <tr key={key}>
				                  <td>{key}</td>
				                  <td><input type="number" step="1" value={Math.round(v.ownerOnlySharePct * 10000) / 100}
				                    onChange={(e) => patch({ ownerOnlySharePct: Number(e.target.value) / 100 })} /></td>
				                  <td><input type="number" step="1" value={Math.round(v.helperCoveragePct * 10000) / 100}
				                    onChange={(e) => patch({ helperCoveragePct: Number(e.target.value) / 100 })} /></td>
				                  <td><input type="number" step="1" value={Math.round(v.parallelEfficiencyPct * 10000) / 100}
				                    onChange={(e) => patch({ parallelEfficiencyPct: Number(e.target.value) / 100 })} /></td>
				                </tr>
				              );
				            })
				          )}

				          {(["Recharge","Ignite1Y","Momentum3Y","Pinnacle5Y"] as CeramicPkg[]).map((p) => {
				            const v = settings.helperOverrides.ceramic[p];
				            const patch = (pp: Partial<HelperModelParams>) =>
				              setSettings((s) => ({ ...s, helperOverrides: { ...s.helperOverrides, ceramic: { ...s.helperOverrides.ceramic, [p]: { ...s.helperOverrides.ceramic[p], ...pp } } } }));
				            return (
				              <tr key={`cer-${p}`}>
				                <td>{`Ceramic • ${p}`}</td>
				                <td><input type="number" step="1" value={Math.round(v.ownerOnlySharePct * 10000) / 100}
				                  onChange={(e) => patch({ ownerOnlySharePct: Number(e.target.value) / 100 })} /></td>
				                <td><input type="number" step="1" value={Math.round(v.helperCoveragePct * 10000) / 100}
				                  onChange={(e) => patch({ helperCoveragePct: Number(e.target.value) / 100 })} /></td>
				                <td><input type="number" step="1" value={Math.round(v.parallelEfficiencyPct * 10000) / 100}
				                  onChange={(e) => patch({ parallelEfficiencyPct: Number(e.target.value) / 100 })} /></td>
				              </tr>
				            );
				          })}
				        </tbody>
				      </table>
				    </div>

                    <div className="drawerCard" style={{ marginBottom: 10 }}>
                      <div className="t">Wash</div>
                      <div className="smallNote">Edit OWNER and ELAPSED hours per vehicle.</div>
                      <table className="table">
                        <thead>
                          <tr><th>Type</th>{VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                        </thead>
                        <tbody>
                          {tableEditorRow("Owner", settings.soloHours.wash.owner, (next) => setSettings((s) => ({ ...s, soloHours: { ...s.soloHours, wash: { ...s.soloHours.wash, owner: next } } })))}
                          {tableEditorRow("Elapsed", settings.soloHours.wash.elapsed, (next) => setSettings((s) => ({ ...s, soloHours: { ...s.soloHours, wash: { ...s.soloHours.wash, elapsed: next } } })))}
                        </tbody>
                      </table>
                    </div>

                    {(["Full","Interior","Exterior"] as const).map((svc) => (
                      <div key={svc} className="drawerCard" style={{ marginBottom: 10 }}>
                        <div className="t">{svc}</div>
                        <table className="table">
                          <thead>
                            <tr><th>Row</th>{VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                          </thead>
                          <tbody>
                            {(["Ignite","Momentum","Pinnacle"] as Tier[]).flatMap((t) => ([
                              tableEditorRow(`${t} Owner`,
                                svc==="Full" ? settings.soloHours.full[t].owner : svc==="Interior" ? settings.soloHours.interior[t].owner : settings.soloHours.exterior[t].owner,
                                (next) => setSettings((s) => ({
                                  ...s,
                                  soloHours: {
                                    ...s.soloHours,
                                    ...(svc==="Full" ? { full: { ...s.soloHours.full, [t]: { ...s.soloHours.full[t], owner: next } } } : {}),
                                    ...(svc==="Interior" ? { interior: { ...s.soloHours.interior, [t]: { ...s.soloHours.interior[t], owner: next } } } : {}),
                                    ...(svc==="Exterior" ? { exterior: { ...s.soloHours.exterior, [t]: { ...s.soloHours.exterior[t], owner: next } } } : {}),
                                  }
                                }))
                              ),
                              tableEditorRow(`${t} Elapsed`,
                                svc==="Full" ? settings.soloHours.full[t].elapsed : svc==="Interior" ? settings.soloHours.interior[t].elapsed : settings.soloHours.exterior[t].elapsed,
                                (next) => setSettings((s) => ({
                                  ...s,
                                  soloHours: {
                                    ...s.soloHours,
                                    ...(svc==="Full" ? { full: { ...s.soloHours.full, [t]: { ...s.soloHours.full[t], elapsed: next } } } : {}),
                                    ...(svc==="Interior" ? { interior: { ...s.soloHours.interior, [t]: { ...s.soloHours.interior[t], elapsed: next } } } : {}),
                                    ...(svc==="Exterior" ? { exterior: { ...s.soloHours.exterior, [t]: { ...s.soloHours.exterior[t], elapsed: next } } } : {}),
                                  }
                                }))
                              )
                            ]))}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    <div className="drawerCard">
                      <div className="t">Ceramic</div>
                      <table className="table">
                        <thead>
                          <tr><th>Row</th>{VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                        </thead>
                        <tbody>
                          {(["Recharge","Ignite1Y","Momentum3Y","Pinnacle5Y"] as CeramicPkg[]).flatMap((p) => ([
                            tableEditorRow(`${p} Owner`, settings.soloHours.ceramic[p].owner, (next) =>
                              setSettings((s) => ({ ...s, soloHours: { ...s.soloHours, ceramic: { ...s.soloHours.ceramic, [p]: { ...s.soloHours.ceramic[p], owner: next } } } }))
                            ),
                            tableEditorRow(`${p} Elapsed`, settings.soloHours.ceramic[p].elapsed, (next) =>
                              setSettings((s) => ({ ...s, soloHours: { ...s.soloHours, ceramic: { ...s.soloHours.ceramic, [p]: { ...s.soloHours.ceramic[p], elapsed: next } } } }))
                            )
                          ]))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {settingsSection === "COGS" && (
                  <div className="scCard">
                    <div className="scHead">
                      <div className="title">COGS Tables (Per Job)</div>
                      <span className="badge">Materials</span>
                    </div>

                    <div className="drawerCard" style={{ marginBottom: 10 }}>
                      <div className="t">Wash</div>
                      <table className="table">
                        <thead>
                          <tr><th>Type</th>{VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                        </thead>
                        <tbody>
                          {tableEditorRow("COGS", settings.cogs.wash, (next) => setSettings((s) => ({ ...s, cogs: { ...s.cogs, wash: next } })))}
                        </tbody>
                      </table>
                    </div>

                    {(["Full","Interior","Exterior"] as const).map((svc) => (
                      <div key={svc} className="drawerCard" style={{ marginBottom: 10 }}>
                        <div className="t">{svc}</div>
                        <table className="table">
                          <thead>
                            <tr><th>Tier</th>{VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                          </thead>
                          <tbody>
                            {(["Ignite","Momentum","Pinnacle"] as Tier[]).map((t) =>
                              tableEditorRow(
                                t,
                                svc==="Full" ? settings.cogs.full[t] : svc==="Interior" ? settings.cogs.interior[t] : settings.cogs.exterior[t],
                                (next) => setSettings((s) => ({
                                  ...s,
                                  cogs: {
                                    ...s.cogs,
                                    ...(svc==="Full" ? { full: { ...s.cogs.full, [t]: next } } : {}),
                                    ...(svc==="Interior" ? { interior: { ...s.cogs.interior, [t]: next } } : {}),
                                    ...(svc==="Exterior" ? { exterior: { ...s.cogs.exterior, [t]: next } } : {}),
                                  },
                                }))
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    <div className="drawerCard">
                      <div className="t">Ceramic (Recharge included)</div>
                      <table className="table">
                        <thead>
                          <tr><th>Package</th>{VEH_COLS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                        </thead>
                        <tbody>
                          {tableEditorRow("Recharge", settings.cogs.ceramic.Recharge, (next) => setSettings((s) => ({ ...s, cogs: { ...s.cogs, ceramic: { ...s.cogs.ceramic, Recharge: next } } })))}
                          {tableEditorRow("Ignite (1Y)", settings.cogs.ceramic.Ignite1Y, (next) => setSettings((s) => ({ ...s, cogs: { ...s.cogs, ceramic: { ...s.cogs.ceramic, Ignite1Y: next } } })))}
                          {tableEditorRow("Momentum (3Y)", settings.cogs.ceramic.Momentum3Y, (next) => setSettings((s) => ({ ...s, cogs: { ...s.cogs, ceramic: { ...s.cogs.ceramic, Momentum3Y: next } } })))}
                          {tableEditorRow("Pinnacle (5Y)", settings.cogs.ceramic.Pinnacle5Y, (next) => setSettings((s) => ({ ...s, cogs: { ...s.cogs, ceramic: { ...s.cogs.ceramic, Pinnacle5Y: next } } })))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {settingsSection === "Add-ons" && (
                  <div className="scCard">
                    <div className="scHead">
                      <div className="title">Add-ons</div>
                      <span className="badge">Editor</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {settings.addons.map((a, idx) => (
                        <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1.4fr .5fr .5fr .5fr .5fr auto", gap: 8, alignItems: "center" }}>
                          <input className="input" value={a.name} onChange={(e) => {
                            const name = e.target.value;
                            setSettings((s) => {
                              const next = [...s.addons];
                              next[idx] = { ...next[idx], name };
                              return { ...s, addons: next };
                            });
                          }} />
                          <input className="input" type="number" step="0.01" value={a.price} onChange={(e) => {
                            const price = Number(e.target.value);
                            setSettings((s) => {
                              const next = [...s.addons];
                              next[idx] = { ...next[idx], price };
                              return { ...s, addons: next };
                            });
                          }} />
                          <input className="input" type="number" step="0.05" value={a.ownerHours} onChange={(e) => {
                            const ownerHours = Number(e.target.value);
                            setSettings((s) => {
                              const next = [...s.addons];
                              next[idx] = { ...next[idx], ownerHours };
                              return { ...s, addons: next };
                            });
                          }} />
                          <input className="input" type="number" step="0.05" value={a.elapsedHours} onChange={(e) => {
                            const elapsedHours = Number(e.target.value);
                            setSettings((s) => {
                              const next = [...s.addons];
                              next[idx] = { ...next[idx], elapsedHours };
                              return { ...s, addons: next };
                            });
                          }} />
                          <input className="input" type="number" step="0.5" value={a.cogs} onChange={(e) => {
                            const cogsV = Number(e.target.value);
                            setSettings((s) => {
                              const next = [...s.addons];
                              next[idx] = { ...next[idx], cogs: cogsV };
                              return { ...s, addons: next };
                            });
                          }} />
                          <button className="btn danger" onClick={() => setSettings((s) => ({ ...s, addons: s.addons.filter((x) => x.id !== a.id) }))}>Remove</button>
                        </div>
                      ))}
                    </div>

                    <div className="actionsRow">
                      <button className="btn" onClick={() => setSettings((s) => ({
                        ...s,
                        addons: [...s.addons, { id: uid(), name: "New add-on", price: 0, ownerHours: 0, elapsedHours: 0, cogs: 0 }],
                      }))}>
                        + Add Add-on
                      </button>
                    </div>
                  </div>
                )}

                {settingsSection === "Import/Export" && (
                  <div className="scCard">
                    <div className="scHead">
                      <div className="title">Import / Export</div>
                      <span className="badge">JSON</span>
                    </div>

                    <div className="actionsRow">
                      <button className="btn" onClick={exportJSON}>Export Settings</button>
                      <label className="btn">
                        Import Settings
                        <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) importJSON(f);
                        }} />
                      </label>
                      <button className="btn danger" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset Defaults</button>
                    </div>

                    <div className="drawerCard" style={{ marginTop: 10 }}>
                      <div className="t">Privacy</div>
                      <div className="drawerLine">
                        <span>Store customer contact in Job Log</span>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                          <input
                            type="checkbox"
                            checked={settings.storeCustomerContact}
                            onChange={(e) => setSettings((s) => ({ ...s, storeCustomerContact: e.target.checked }))}
                          />
                          Enabled
                        </label>
                      </div>
                      <div className="drawerLine">
                        <span>Clear customer contact after saving job</span>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                          <input
                            type="checkbox"
                            checked={settings.clearCustomerAfterSave}
                            onChange={(e) => setSettings((s) => ({ ...s, clearCustomerAfterSave: e.target.checked }))}
                          />
                          Enabled
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Dock */}
                <div className="saveDock">
                  <div className="saveWrap">
                    {toast && <div className="saveToast" role="status" aria-live="polite">{toast}</div>}
                    <button className={`btn primary ${saveAnim ? "isSaving" : ""}`} onClick={saveSettingsManual}>Save</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Bottom HUD (Quote tab only) */}
      {tab === "Quote" && (
        <div className="hud2" role="status" aria-label="Quote summary">
          <div className="hud2Inner">
            <div className="hud2Left">
              {stripChips.service} • {stripChips.pkg} • {vehicle} • {condition}
            </div>

            <div className="hud2Center">
              <div className="hud2Price">{money(priceExTax)}</div>
              <div className={`hud2Reco ${recommendBadge.cls}`}>{recommendBadge.t}</div>
              <div className="hud2Meta">{hrs(rec.elapsedHours)} • {money(rec.profitPerOwnerHr)}/hr</div>
            </div>

            <div className="hud2Right">
              <button className="btn" onClick={() => setHudOpen(true)}>Details</button>
              <button className="btn" onClick={copyQuick}>Copy</button>
              <button className="btn primary" onClick={saveToJobLog}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {tab === "Quote" && hudOpen && (
        <div className="modalBackdrop" onMouseDown={() => setHudOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div className="modalTitle">Details</div>
              <button className="btn" onClick={() => setHudOpen(false)}>Close</button>
            </div>

            <div className="modalGrid">
              <div className="drawerCard">
                <div className="t">Solo</div>
                <div className="drawerLine"><span>Total Time (Elapsed)</span><b>{hrs(solo.elapsedHours)}</b></div>
                <div className="drawerLine"><span>Owner Time</span><b>{hrs(solo.ownerHours)}</b></div>
                <div className="drawerLine"><span>Net Profit (Bottom Line)</span><b>{money(solo.profit)}</b></div>
                <div className="drawerLine"><span>Owner $/Hr Pay</span><b>{money(solo.profitPerOwnerHr)}/hr</b></div>
                <div className="drawerLine"><span>Max Owner Time to Hit Target</span><b>{hrs(solo.maxOwnerHoursToPass)}</b></div>
                <div className="drawerLine">
                  <span>Owner Over/Under Target (Hours)</span>
                  <b className={solo.ownerDeltaToPass > 0 ? "badText" : "goodText"}>{deltaH(solo.ownerDeltaToPass)} {solo.ownerDeltaToPass > 0 ? "over" : "under"}</b>
                </div>
                <div className="drawerLine"><span>Charge to Book (to Hit Target Pay)</span><b>{money(solo.chargeToBook)}</b></div>
                <div className="drawerMini">Fees {money(solo.fees)} • COGS {money(cogs)} • Overhead {money(solo.overhead)}</div>
              </div>

              <div className="drawerCard">
                <div className="t">With Helper</div>
                <div className="drawerLine"><span>Total Time (Elapsed)</span><b>{hrs(helper.elapsedHours)}</b></div>
                <div className="drawerLine"><span>Owner Time</span><b>{hrs(helper.ownerHours)}</b></div>
                <div className="drawerLine"><span>Helper Hours</span><b>{hrs(helper.helperHours)}</b></div>
                <div className="drawerLine"><span>Helper Cost</span><b>{money(helper.helperCost)}</b></div>
                <div className="drawerLine"><span>Net Profit (Bottom Line)</span><b>{money(helper.profit)}</b></div>
                <div className="drawerLine"><span>Owner $/Hr Pay</span><b>{money(helper.profitPerOwnerHr)}/hr</b></div>
                <div className="drawerLine"><span>Max Owner Time to Hit Target</span><b>{hrs(helper.maxOwnerHoursToPass)}</b></div>
                <div className="drawerLine">
                  <span>Owner Over/Under Target (Hours)</span>
                  <b className={helper.ownerDeltaToPass > 0 ? "badText" : "goodText"}>{deltaH(helper.ownerDeltaToPass)} {helper.ownerDeltaToPass > 0 ? "over" : "under"}</b>
                </div>
                <div className="drawerLine"><span>Charge to Book (to Hit Target Pay)</span><b>{money(helper.chargeToBook)}</b></div>
                <div className="drawerMini">Saves {hrs(timeSavedElapsed)} elapsed • Saves {hrs(timeSavedOwner)} owner</div>
                <div className="drawerMini">Fees {money(helper.fees)} • COGS {money(cogs)} • Overhead {money(helper.overhead)} • Helper {money(helper.helperCost)}</div>
              </div>
            </div>

            <div className="actionsRow" style={{ justifyContent: "flex-end", marginTop: 10 }}>
              <button className="btn" onClick={copyDetailed}>Copy Detailed</button>
              <button className="btn" onClick={copyHelperText}>Copy Helper</button>
              <button className="btn danger" onClick={resetAll}>Reset</button>
            </div>
          </div>
        </div>
      )}

      {toast && tab !== "Settings" && <div className="toast">{toast}</div>}
    </div>
  );
}
