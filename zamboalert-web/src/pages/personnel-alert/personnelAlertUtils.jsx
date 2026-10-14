const configuredApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_TELEMETRY_URL ||
  ""
).replace(/\/$/, "");

export const API = configuredApiBaseUrl || `http://localhost:${import.meta.env.VITE_API_PORT || 5000}`;

export function alertLevelStyle(level = "") {
  if (level.includes("CRITICAL")) {
    return { badge: "bg-red-600 text-white border-red-700", row: "border-l-4 border-red-500", icon: "text-red-600", glow: "bg-red-50" };
  }
  if (level.includes("SEVERE")) {
    return { badge: "bg-orange-500 text-white border-orange-600", row: "border-l-4 border-orange-400", icon: "text-orange-500", glow: "bg-orange-50" };
  }
  if (level.includes("MODERATE")) {
    return { badge: "bg-amber-500 text-white border-amber-600", row: "border-l-4 border-amber-400", icon: "text-amber-600", glow: "bg-amber-50" };
  }
  return { badge: "bg-emerald-600 text-white border-emerald-700", row: "border-l-4 border-emerald-400", icon: "text-emerald-600", glow: "bg-emerald-50" };
}

export function riskStyle(level = "") {
  if (level === "Extreme") return "bg-red-50 text-red-700 border-red-200";
  if (level === "High") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

export function DeficitBar({ deficit, required }) {
  const pct = required > 0 ? Math.min(100, Math.round((deficit / required) * 100)) : 0;
  const color = pct >= 50 ? "bg-red-500" : pct >= 30 ? "bg-orange-400" : pct >= 15 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({ label, value, sub, color = "slate", icon: Icon }) {
  const colors = {
    red: "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    sky: "bg-sky-50 border-sky-200 text-sky-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  };

  return (
    <div className={`${colors[color]} border p-4 rounded-xl flex items-start gap-3`}>
      {Icon && <Icon size={20} className="mt-0.5 shrink-0" />}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
        <div className="text-2xl font-black font-mono mt-0.5">{value}</div>
        {sub && <div className="text-[10px] font-medium mt-0.5 opacity-60">{sub}</div>}
      </div>
    </div>
  );
}
