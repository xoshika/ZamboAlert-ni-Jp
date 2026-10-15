import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle,
  MessageSquare,
  PhoneCall,
  Send,
  UserCheck,
  Volume2,
  X,
  Navigation,
} from "lucide-react";

export function BroadcastModal({ onClose }) {
  const [msg, setMsg] = useState("");
  const [priority, setPriority] = useState("emergency");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!msg.trim()) return;
    setSent(true);
    setTimeout(() => onClose(), 1600);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <Volume2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide font-mono">
                Emergency LoRa Broadcast
              </h3>
              <p className="text-[11px] text-slate-500">Transmits to all offline mesh nodes & rescuer radios</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {sent ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle size={28} />
              </div>
              <span className="text-sm font-bold font-mono text-emerald-700">BROADCAST TRANSMITTED</span>
              <span className="text-xs text-slate-500">Successfully relayed across 3 mesh repeaters</span>
            </div>
          ) : (
            <>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                {["emergency", "advisory", "info"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      priority === p ? "bg-white text-red-700 shadow-sm font-black" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={4}
                maxLength={280}
                placeholder="Enter emergency announcement to broadcast across all active Barangay LoRa nodes..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 resize-none p-4 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all font-sans"
              />

              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>TARGET: ALL ONLINE NODES</span>
                <span>{msg.length} / 280</span>
              </div>

              <button
                onClick={handleSend}
                disabled={!msg.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-700 hover:bg-red-800 active:bg-red-900 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Send size={14} />
                TRANSMIT LORA BROADCAST
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DispatchModal({ alert, rescuers, onDispatch, onClose }) {
  const [chosen, setChosen] = useState(null);
  const available = rescuers.filter((r) => r.status === "available" && r.isVerified !== false);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <UserCheck size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide font-mono">
                Dispatch Rescuer
              </h3>
              <p className="text-[11px] text-slate-500">Assign tactical unit to emergency SOS</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="bg-red-50/60 border border-red-100 rounded-xl p-4 text-xs space-y-1.5">
            <div className="text-red-900 font-bold flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono font-bold text-[10px]">{alert.id}</span>
              <span className="text-sm">{alert.name}</span>
            </div>
            <div className="text-slate-600">{alert.zone} · {alert.lat}, {alert.lng}</div>
            {alert.message && (
              <div className="text-red-800 italic border-t border-red-100/60 pt-2 mt-2">“{alert.message}”</div>
            )}
          </div>

          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Available Rescue Units ({available.length})
          </div>

          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
            {available.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6 italic">No rescue units available online right now.</div>
            ) : (
              available.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setChosen(r.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    chosen === r.id ? "border-red-500 bg-red-50/40 shadow-xs" : "border-slate-200/80 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{r.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{r.unit} · {r.id}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">BAT {r.battery}%</span>
                    {chosen === r.id ? (
                      <CheckCircle size={16} className="text-red-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 bg-white" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <button
            onClick={() => chosen && onDispatch(chosen, "alert", alert.id, alert.name)}
            disabled={!chosen}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Navigation size={14} />
            CONFIRM DISPATCH
          </button>
        </div>
      </div>
    </div>
  );
}

export function MessageRescuerModal({ rescuers, casualties, alerts, onClose, onDispatch }) {
  const [selectedRescuerId, setSelectedRescuerId] = useState("");
  const [targetType, setTargetType] = useState("victim");
  const [targetId, setTargetId] = useState("");
  const [sent, setSent] = useState(false);

  const availableRescuers = rescuers.filter((r) => r.isVerified !== false && r.status === "available");

  useEffect(() => {
    if (availableRescuers.length > 0 && !selectedRescuerId) {
      setSelectedRescuerId(availableRescuers[0].id);
    }
  }, [availableRescuers, selectedRescuerId]);

  const selectedRescuer = availableRescuers.find((r) => String(r.id) === String(selectedRescuerId));

  const getTarget = () => {
    if (targetType === "victim") {
      const v = casualties.find((c) => String(c.id) === String(targetId));
      return v ? { name: v.victim_name, detail: `${v.status} — ${v.location}` } : null;
    } else {
      const a = alerts.find((a) => String(a.id) === String(targetId));
      return a ? { name: a.name, detail: a.zone } : null;
    }
  };

  const target = getTarget();

  const smsPreview = selectedRescuer && target
    ? `[ZamboAlert DISPATCH] ${selectedRescuer.name}, you are assigned to ${targetType === "victim" ? "victim" : "SOS alert"}: ${target.name} (${target.detail}). Respond immediately. — ZCDRRMO Admin`
    : "";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedRescuerId || !targetType || !targetId) return;

    const targetName = target ? target.name : (targetType === "victim" ? `Victim #${targetId}` : `SOS Alert #${targetId}`);
    onDispatch(selectedRescuerId, targetType, targetId, targetName);
    setSent(true);

    setTimeout(() => {
      onClose();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <MessageSquare size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide font-mono">
                Message Rescuer
              </h3>
              <p className="text-[11px] text-slate-500">Text a rescuer directly to dispatch them to a victim</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Check size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wide">Message Sent!</h4>
            <p className="text-xs text-slate-500">Dispatch SMS delivered to {selectedRescuer?.name}'s phone.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">1. Select Rescuer Unit</label>
              {availableRescuers.length === 0 ? (
                <div className="text-red-700 text-xs p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                  No active rescuers are currently available.
                </div>
              ) : (
                <select
                  value={selectedRescuerId}
                  onChange={(e) => setSelectedRescuerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 cursor-pointer"
                >
                  {availableRescuers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.id}) — {r.unit}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">2. Dispatch Target Type</label>
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setTargetType("victim"); setTargetId(""); }}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    targetType === "victim" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Victim
                </button>
                <button
                  type="button"
                  onClick={() => { setTargetType("alert"); setTargetId(""); }}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    targetType === "alert" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  SOS Alert
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">3. Choose Target</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500 cursor-pointer"
                required
              >
                <option value="" disabled>-- Select Destination --</option>
                {targetType === "victim" &&
                  casualties.filter((c) => c.status !== "Rescued").map((c) => (
                    <option key={c.id} value={c.id}>
                      VIC-{c.id}: {c.victim_name} ({c.status} — {c.location})
                    </option>
                  ))}
                {targetType === "alert" &&
                  alerts.filter((a) => a.status === "unassigned").map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id}: {a.name} ({a.zone})
                    </option>
                  ))}
              </select>
            </div>

            {smsPreview && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">SMS Preview</label>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 leading-relaxed font-mono">
                  {smsPreview}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={availableRescuers.length === 0 || !targetId}
              className="w-full py-3 mt-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <MessageSquare size={14} />
              SEND DISPATCH MESSAGE
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
