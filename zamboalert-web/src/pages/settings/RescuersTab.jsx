import {
  AlertTriangle,
  Battery,
  CheckCircle,
  Eye,
  RefreshCw,
  Search,
  Signal,
  Trash2,
  User,
  Wifi,
} from "lucide-react";
import RescuerReviewModal from "../../components/RescuerReviewModal";
import { API_BASE_URL } from "../dashboard/dashboardApi";

export default function RescuersTab({
  dbRescuers,
  isFetchingRescuers,
  fetchRescuers,
  showToast,
  rescuerSubTab,
  setRescuerSubTab,
  accountsSearch,
  setAccountsSearch,
  accountsFilter,
  setAccountsFilter,
  rescuerSearch,
  setRescuerSearch,
  rescuerFilter,
  setRescuerFilter,
  handleVerifyRescuer,
  handleRejectRescuer,
  filteredRescuers,
  selectedRescuerForReview,
  setSelectedRescuerForReview,
  showReviewModal,
  setShowReviewModal,
}) {
  return (
    <div className="space-y-5 animate-in fade-in-30 duration-200 flex-grow flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
            Rescuer Account & Log Management
          </h2>
          <p className="text-[11px] text-slate-500 mt-1">
            Verify registered rescuer identity submissions, approve mobile access requests, and review telemetry/signals.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchRescuers()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-[10px] font-bold tracking-wider uppercase rounded transition-colors shadow-xs cursor-pointer font-mono"
          >
            <RefreshCw size={10} className={isFetchingRescuers ? "animate-spin" : ""} />
            Refresh Data
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setRescuerSubTab("accounts")}
          className={`pb-2.5 px-4 text-[10.5px] font-mono font-bold uppercase border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            rescuerSubTab === "accounts"
              ? "border-red-750 text-red-800 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <User size={13} />
          Rescuer Accounts
          {dbRescuers.some((r) => !r.is_verified) && (
            <span className="ml-1 bg-amber-500 text-white text-[8px] font-sans font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              {dbRescuers.filter((r) => !r.is_verified).length} PENDING
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setRescuerSubTab("telemetry")}
          className={`pb-2.5 px-4 text-[10.5px] font-mono font-bold uppercase border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            rescuerSubTab === "telemetry"
              ? "border-red-750 text-red-800 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Wifi size={13} />
          Telemetry & Connectivity Logs
        </button>
      </div>

      {rescuerSubTab === "accounts" && (
        <div className="space-y-4 flex-grow flex flex-col">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/85 p-3.5 rounded-xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Total Registered</span>
                <span className="text-xl font-bold text-slate-800 font-mono mt-0.5 block">{dbRescuers.length}</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                <User size={18} />
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border flex items-center justify-between shadow-xs transition-colors ${
              dbRescuers.some((r) => !r.is_verified)
                ? "bg-amber-50/40 border-amber-205 text-amber-805"
                : "bg-white border-slate-200/85 text-slate-800"
            }`}>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Pending Verification</span>
                <span className="text-xl font-bold font-mono mt-0.5 block">
                  {dbRescuers.filter((r) => !r.is_verified).length}
                </span>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                dbRescuers.some((r) => !r.is_verified)
                  ? "bg-amber-100/60 text-amber-600 animate-pulse"
                  : "bg-slate-100 text-slate-500"
              }`}>
                <AlertTriangle size={18} />
              </div>
            </div>

            <div className="bg-emerald-50/20 border border-emerald-100/80 p-3.5 rounded-xl flex items-center justify-between shadow-xs text-emerald-800">
              <div>
                <span className="text-[9px] font-bold text-emerald-600/70 uppercase font-mono block">Verified Rescuers</span>
                <span className="text-xl font-bold text-emerald-700 font-mono mt-0.5 block">
                  {dbRescuers.filter((r) => r.is_verified).length}
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600">
                <CheckCircle size={18} />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Search accounts by name, email, phone or ID..."
                value={accountsSearch}
                onChange={(e) => setAccountsSearch(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-205 rounded pl-8.5 pr-3 py-1.8 text-xs focus:outline-none focus:ring-1 focus:ring-red-500/30 focus:border-red-500 placeholder-slate-400"
              />
            </div>
            <div className="flex gap-2">
              {["all", "pending", "verified"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setAccountsFilter(status)}
                  className={`px-3 py-1.8 border rounded text-[9.5px] font-bold font-mono tracking-wider uppercase transition-all cursor-pointer ${
                    accountsFilter === status
                      ? "bg-red-700 text-white border-red-700 shadow-xs"
                      : "bg-white text-slate-650 hover:text-slate-900 border-slate-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200/70 rounded-xl overflow-hidden flex-grow bg-white min-h-[300px]">
            <div className="overflow-x-auto">
              <table className="w-full text-[10.5px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-250 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    <th className="p-3 pl-4">ID</th>
                    <th className="p-3">Rescuer Details</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Document Info</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {isFetchingRescuers ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400 italic">
                        Fetching registered rescuer accounts from SQLite database...
                      </td>
                    </tr>
                  ) : dbRescuers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400 italic">
                        No registered rescuer accounts found.
                      </td>
                    </tr>
                  ) : dbRescuers.filter((rescuer) => {
                    const fullName = `${rescuer.first_name || ""} ${rescuer.last_name || ""}`.toLowerCase();
                    const email = (rescuer.email || "").toLowerCase();
                    const idNumber = (rescuer.id_number || "").toLowerCase();
                    const idType = (rescuer.id_type || "").toLowerCase();
                    const phone = (rescuer.phone_number || "").toLowerCase();
                    const matchesSearch = fullName.includes(accountsSearch.toLowerCase()) ||
                      email.includes(accountsSearch.toLowerCase()) ||
                      idNumber.includes(accountsSearch.toLowerCase()) ||
                      idType.includes(accountsSearch.toLowerCase()) ||
                      phone.includes(accountsSearch.toLowerCase());
                    const matchesFilter = accountsFilter === "all" ||
                      (accountsFilter === "pending" && !rescuer.is_verified) ||
                      (accountsFilter === "verified" && rescuer.is_verified);
                    return matchesSearch && matchesFilter;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400 italic">
                        No rescuer accounts match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    dbRescuers
                      .filter((rescuer) => {
                        const fullName = `${rescuer.first_name || ""} ${rescuer.last_name || ""}`.toLowerCase();
                        const email = (rescuer.email || "").toLowerCase();
                        const idNumber = (rescuer.id_number || "").toLowerCase();
                        const idType = (rescuer.id_type || "").toLowerCase();
                        const phone = (rescuer.phone_number || "").toLowerCase();
                        const matchesSearch = fullName.includes(accountsSearch.toLowerCase()) ||
                          email.includes(accountsSearch.toLowerCase()) ||
                          idNumber.includes(accountsSearch.toLowerCase()) ||
                          idType.includes(accountsSearch.toLowerCase()) ||
                          phone.includes(accountsSearch.toLowerCase());
                        const matchesFilter = accountsFilter === "all" ||
                          (accountsFilter === "pending" && !rescuer.is_verified) ||
                          (accountsFilter === "verified" && rescuer.is_verified);
                        return matchesSearch && matchesFilter;
                      })
                      .map((rescuer) => (
                        <tr key={rescuer.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 pl-4 font-bold text-slate-600">R-{rescuer.id}</td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800 text-[11px] font-sans">
                              {rescuer.first_name} {rescuer.last_name}
                            </div>
                            <div className="text-slate-500 font-mono text-[9.5px] mt-0.5 select-all">{rescuer.email}</div>
                          </td>
                          <td className="p-3 font-semibold text-slate-705 select-all">{rescuer.phone_number || "--"}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-600">{rescuer.id_type}</span>
                            <div className="text-slate-450 font-mono text-[9px] mt-0.5">{rescuer.id_number}</div>
                          </td>
                          <td className="p-3">
                            {rescuer.is_verified === 1 ? (
                              <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase flex items-center gap-1 w-fit border bg-emerald-50 text-emerald-700 border-emerald-100">
                                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                Verified
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase flex items-center gap-1 w-fit border bg-amber-50 text-amber-700 border-amber-100 animate-pulse">
                                <span className="w-1 h-1 rounded-full bg-amber-500" />
                                Pending Approval
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right pr-4">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRescuerForReview(rescuer);
                                  setShowReviewModal(true);
                                }}
                                title="Review Documents"
                                className="p-1 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-all cursor-pointer flex items-center justify-center gap-1 text-[9px] font-bold font-sans uppercase px-1.5 py-1"
                              >
                                <Eye size={10} />
                                Review
                              </button>

                              {rescuer.is_verified !== 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRescuerForReview(rescuer);
                                    setShowReviewModal(true);
                                  }}
                                  title="Review ID & Approve"
                                  className="p-1 text-emerald-750 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 rounded transition-all cursor-pointer flex items-center justify-center gap-1 text-[9px] font-bold font-sans uppercase px-1.5 py-1"
                                >
                                  <CheckCircle size={10} />
                                  Approve
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRejectRescuer(rescuer.id)}
                                title="Reject & Delete Account"
                                className="p-1.5 text-red-650 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded transition-all cursor-pointer flex items-center justify-center"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono px-1">
            <span>Database Server: {API_BASE_URL || "http://localhost:5000"}/api/rescuers</span>
            <span>Auto-sync: Active (Live DB state)</span>
          </div>
        </div>
      )}

      {rescuerSubTab === "telemetry" && (
        <div className="space-y-4 flex-grow flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[10px] text-slate-500 font-mono">
              LIVE TELEMETRY FROM ESP32 LORA NODES & BLUETOOTH MOBILE GPS
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRescuerSearch("");
                  setRescuerFilter("all");
                }}
                className="px-2.5 py-1.5 bg-white border border-slate-205 hover:border-slate-300 text-slate-650 text-[10px] font-bold uppercase rounded transition-colors shadow-xs cursor-pointer font-mono"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Search logs by rescuer, type, or event..."
                value={rescuerSearch}
                onChange={(e) => setRescuerSearch(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-205 rounded pl-8.5 pr-3 py-1.8 text-xs focus:outline-none focus:ring-1 focus:ring-red-500/30 focus:border-red-500 placeholder-slate-400"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              {['all', 'online', 'busy', 'warning', 'offline'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setRescuerFilter(status)}
                  className={`px-3 py-1.8 border rounded text-[9.5px] font-bold font-mono tracking-wider uppercase transition-all cursor-pointer ${
                    rescuerFilter === status
                      ? "bg-red-700 text-white border-red-700 shadow-xs"
                      : "bg-white text-slate-650 hover:text-slate-900 border-slate-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200/70 rounded-xl overflow-hidden flex-grow bg-white min-h-[300px]">
            <div className="overflow-x-auto">
              <table className="w-full text-[10.5px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-250 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    <th className="p-3 pl-4">Log ID</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Rescuer Unit</th>
                    <th className="p-3">Event Type</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Battery</th>
                    <th className="p-3">Signal</th>
                    <th className="p-3">Log Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredRescuers.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400 italic">
                        No rescuer logs match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRescuers.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 pl-4 font-bold text-slate-700">{log.id}</td>
                        <td className="p-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-3 font-semibold text-slate-800">{log.unit}</td>
                        <td className="p-3"><span className="font-semibold text-slate-600">{log.type}</span></td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase flex items-center gap-1 w-fit border ${
                            log.status === "online" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            log.status === "busy" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            log.status === "warning" ? "bg-red-50 text-red-700 border-red-100" :
                            "bg-slate-100 text-slate-650 border-slate-200"
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${
                              log.status === "online" ? "bg-emerald-500" :
                              log.status === "busy" ? "bg-amber-500 animate-pulse" :
                              log.status === "warning" ? "bg-red-600 animate-bounce" :
                              "bg-slate-400"
                            }`} />
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">
                          <div className="flex items-center gap-1 text-slate-700">
                            <Battery size={12} className={log.battery <= 20 ? "text-red-600" : "text-emerald-600"} />
                            <span className={log.battery <= 20 ? "text-red-700 font-bold" : ""}>{log.battery}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-slate-700">
                            <Signal size={12} className={log.signal <= -80 ? "text-red-600" : "text-slate-500"} />
                            <span className="text-[10px]">{log.signal} dBm</span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 whitespace-nowrap truncate max-w-[200px]" title={log.notes}>{log.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[9px] text-slate-400 font-mono px-1">
            Live rescuer telemetry will appear here when connected.
          </div>
        </div>
      )}

      {showReviewModal && selectedRescuerForReview && (
        <RescuerReviewModal
          rescuer={selectedRescuerForReview}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedRescuerForReview(null);
          }}
          onApprove={handleVerifyRescuer}
          onReject={handleRejectRescuer}
        />
      )}
    </div>
  );
}
