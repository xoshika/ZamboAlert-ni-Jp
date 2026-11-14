import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle,
  Edit3,
  Heart,
  Package,
  Radio,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "../dashboard/dashboardApi";

export function TriggerAlertModal({ barangay, onClose, onTriggered }) {
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const defaultMsg = "ALL OFF-DUTY TANODS, SAR OPERATIVES, AND MEDICAL RESERVISTS REPORT TO BARANGAY COMMAND HQ IMMEDIATELY.";

  const handleTrigger = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/manpower/trigger-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barangay_name: barangay, custom_message: customMessage || defaultMsg, priority: "CRITICAL_DEFICIT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Alert trigger failed");
      setSuccess(true);
      onTriggered?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Radio size={15} className="text-red-600" />
              Emergency Red Alert Broadcast
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Brgy. {barangay} — LoRa + SMS mobilization signal</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {success ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Radio size={28} className="text-red-600 animate-pulse" />
              </div>
              <div className="font-bold text-slate-900">Alert Broadcasted!</div>
              <p className="text-xs text-slate-500">Emergency mobilization signal transmitted to Barangay {barangay}.</p>
              <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                This will escalate the alert level to CRITICAL RED and trigger mobilization for all off-duty personnel in Barangay {barangay}.
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Custom Broadcast Message <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                <textarea
                  rows={3}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={defaultMsg}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
              </div>

              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">{error}</div>}

              <div className="flex gap-2">
                <button
                  onClick={handleTrigger}
                  disabled={loading}
                  className="flex-1 py-3 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {loading ? "Broadcasting..." : "Trigger Alert"}
                </button>
                <button onClick={onClose} className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function MutualAidModal({ barangays, defaultTo = "", onClose, onTransferred }) {
  const [fromBarangay, setFromBarangay] = useState("");
  const [toBarangay, setToBarangay] = useState(defaultTo);
  const [disasterType, setDisasterType] = useState("Flash Flood");
  const [sarCount, setSarCount] = useState(0);
  const [tanodCount, setTanodCount] = useState(0);
  const [medicCount, setMedicCount] = useState(0);
  const [logisticsCount, setLogisticsCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");

  const total = sarCount + tanodCount + medicCount + logisticsCount;
  const barangayNames = barangays.map((b) => b.name);

  const handleSubmit = async () => {
    if (!fromBarangay || !toBarangay) { setError("Source and destination barangay are required."); return; }
    if (fromBarangay === toBarangay) { setError("Source and destination cannot be the same barangay."); return; }
    if (total <= 0) { setError("At least 1 personnel must be selected."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/manpower/mutual-aid-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_barangay: fromBarangay,
          to_barangay: toBarangay,
          disaster_type: disasterType,
          sar_count: sarCount,
          tanod_count: tanodCount,
          medic_count: medicCount,
          logistics_count: logisticsCount,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Transfer failed");
      setSuccess(data);
      onTransferred?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const NumInput = ({ label, icon: Icon, value, onChange }) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
        <Icon size={12} /> {label}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center cursor-pointer">−</button>
        <span className="w-10 text-center font-black font-mono text-slate-900 text-sm">{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center cursor-pointer">+</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft size={15} className="text-sky-600" />
              Mutual Aid Transfer
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Deploy personnel from surplus to deficit barangay</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-sky-100 rounded-full flex items-center justify-center mx-auto">
              <ArrowRightLeft size={26} className="text-sky-600" />
            </div>
            <div className="font-bold text-slate-900">Transfer Dispatched!</div>
            <p className="text-xs text-slate-500">{success.message}</p>
            <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer">Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">From (Surplus)</label>
                <select value={fromBarangay} onChange={(e) => setFromBarangay(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300">
                  <option value="">Select Barangay...</option>
                  {barangayNames.filter((n) => n !== toBarangay).map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">To (Deficit)</label>
                <select value={toBarangay} onChange={(e) => setToBarangay(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300">
                  <option value="">Select Barangay...</option>
                  {barangayNames.filter((n) => n !== fromBarangay).map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Disaster Type</label>
              <select value={disasterType} onChange={(e) => setDisasterType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300">
                {["Flash Flood", "Super Typhoon", "Earthquake", "Storm Surge", "Landslide"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-3">Personnel Breakdown</div>
              <div className="grid grid-cols-2 gap-4">
                <NumInput label="SAR Operatives" icon={Shield} value={sarCount} onChange={setSarCount} />
                <NumInput label="Barangay Tanods" icon={Users} value={tanodCount} onChange={setTanodCount} />
                <NumInput label="Medic Personnel" icon={Heart} value={medicCount} onChange={setMedicCount} />
                <NumInput label="Logistics Team" icon={Package} value={logisticsCount} onChange={setLogisticsCount} />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">Total Personnel</span>
                <span className="text-2xl font-black font-mono text-slate-900">{total}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Notes <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Deployment notes, special instructions..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none" />
            </div>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">{error}</div>}

            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {loading ? "Dispatching..." : "Deploy Transfer"}
              </button>
              <button onClick={onClose} className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EscalateAgencyModal({ barangays, defaultTargets = [], onClose, onEscalated }) {
  const [selectedBarangays, setSelectedBarangays] = useState(defaultTargets);
  const [disasterType, setDisasterType] = useState("Flash Flood");
  const [scenarioLevel, setScenarioLevel] = useState("Level 4 - Worst-Case Catastrophe");
  const [requestedAgency, setRequestedAgency] = useState("Philippine Coast Guard (PCG)");
  const [requestedUnits, setRequestedUnits] = useState("");
  const [totalReinforcements, setTotalReinforcements] = useState(10);
  const [priority, setPriority] = useState("Critical Priority");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");

  const agencies = [
    "Philippine Coast Guard (PCG)",
    "AFP Joint Task Force Zamboanga",
    "Bureau of Fire Protection (BFP)",
    "Philippine Red Cross",
    "ZCDRRMO Central Command",
    "Department of Social Welfare (DSWD)",
    "National Disaster Risk Reduction (NDRRMC)",
  ];

  const toggleBarangay = (name) => {
    setSelectedBarangays((prev) => (prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]));
  };

  const handleSubmit = async () => {
    if (!selectedBarangays.length) { setError("Select at least one target barangay."); return; }
    if (!requestedAgency || !requestedUnits) { setError("Agency and requested units are required."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/manpower/escalate-agency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_barangays: selectedBarangays,
          disaster_type: disasterType,
          scenario_level: scenarioLevel,
          requested_agency: requestedAgency,
          requested_units: requestedUnits,
          total_reinforcements: totalReinforcements,
          priority,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Escalation failed");
      setSuccess(data);
      onEscalated?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldAlert size={15} className="text-purple-600" />
              External Agency Escalation
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Request reinforcements from PCG, AFP, BFP, Red Cross or ZCDRRMO</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck size={26} className="text-purple-600" />
            </div>
            <div className="font-bold text-slate-900">Escalation Transmitted!</div>
            <p className="text-xs text-slate-500">{success.message}</p>
            <div className="inline-block bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded-lg text-sm font-mono font-bold">
              Ref: {success.reference_no}
            </div>
            <br />
            <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer">Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Target Barangays <span className="text-slate-400 normal-case font-normal">(select all affected)</span></label>
              <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                {barangays.map((b) => (
                  <button key={b.name}
                    onClick={() => toggleBarangay(b.name)}
                    className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all cursor-pointer text-left ${
                      selectedBarangays.includes(b.name)
                        ? "bg-purple-600 text-white border-purple-700"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}>
                    {b.name}
                  </button>
                ))}
              </div>
              {selectedBarangays.length > 0 && (
                <div className="text-[10px] text-purple-600 font-bold mt-1">{selectedBarangays.length} barangay(s) selected</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Disaster Type</label>
                <select value={disasterType} onChange={(e) => setDisasterType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300">
                  {["Flash Flood", "Super Typhoon", "Earthquake", "Storm Surge", "Landslide"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300">
                  {["Critical Priority", "High Priority", "Moderate Priority"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Requesting Agency</label>
              <select value={requestedAgency} onChange={(e) => setRequestedAgency(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300">
                {agencies.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Units / Assets Requested</label>
                <input type="text" value={requestedUnits} onChange={(e) => setRequestedUnits(e.target.value)}
                  placeholder="e.g., 4 Rubber Boats + 16 SAR Ops"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Total Reinforcements</label>
                <input type="number" min={1} value={totalReinforcements} onChange={(e) => setTotalReinforcements(parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Mission Notes</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe the emergency situation and special requirements..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
            </div>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">{error}</div>}

            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {loading ? "Escalating..." : "Send Escalation Request"}
              </button>
              <button onClick={onClose} className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EditBarangayModal({ barangay, onClose, onSaved }) {
  const [form, setForm] = useState({
    active_sar: barangay.active_sar || 0,
    active_tanods: barangay.active_tanods || 0,
    active_medics: barangay.active_medics || 0,
    active_logistics: barangay.active_logistics || 0,
    active_boat_crews: barangay.active_boat_crews || 0,
    rescue_boats: barangay.rescue_boats || 0,
    ambulances: barangay.ambulances || 0,
    contact_person: barangay.contact_person || "",
    contact_number: barangay.contact_number || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/manpower/barangays/${barangay.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, field, min = 0 }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{label}</label>
      <input type="number" min={min} value={form[field]}
        onChange={(e) => setForm((p) => ({ ...p, [field]: parseInt(e.target.value) || 0 }))}
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-300" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Edit3 size={14} className="text-slate-600" />
              Edit Manpower Inventory
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Barangay {barangay.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SAR Operatives" field="active_sar" />
            <Field label="Barangay Tanods" field="active_tanods" />
            <Field label="Medic Personnel" field="active_medics" />
            <Field label="Logistics Team" field="active_logistics" />
            <Field label="Boat Crew Members" field="active_boat_crews" />
            <Field label="Rescue Boats" field="rescue_boats" />
            <Field label="Ambulances" field="ambulances" />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Contact Person</label>
              <input type="text" value={form.contact_person} onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Contact Number</label>
              <input type="text" value={form.contact_number} onChange={(e) => setForm((p) => ({ ...p, contact_number: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={loading}
              className="flex-1 py-3 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2">
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={onClose} className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
