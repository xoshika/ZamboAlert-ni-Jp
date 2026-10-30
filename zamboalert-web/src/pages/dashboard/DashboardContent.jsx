import { useState } from "react";
import {
  BarChart2,
  CheckCircle,
  Compass,
  Download,
  Eye,
  Home,
  MessageSquare,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import RescuerReviewModal from "../../components/RescuerReviewModal";
import PersonnelPage from "../personnel-alert/PersonnelAlertPage";
import SettingsPage from "../settings/SettingsPage";
import { fmtTime } from "./dashboardData";
import { TacticalMap, PingDot, StatusBadge, RescuerBadge } from "./DashboardMap";
import {
  BroadcastModal,
  MessageRescuerModal,
  DispatchModal,
} from "./DashboardModals";
import { apiFetch, ADMIN_API_PORTS, API_BASE_URL } from "./dashboardApi";

export default function DashboardContent({
  now,
  alerts,
  rescuers,
  casualtyLogs,
  households,
  incidents,
  pods = [],
  selectedAlert,
  setSelectedAlert,
  selectedCasualtyId,
  setSelectedCasualtyId,
  dispatchTarget,
  setDispatchTarget,
  showBroadcast,
  setShowBroadcast,
  showCallRescuerModal,
  setShowCallRescuerModal,
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  isFetchingCasualties,
  isFetchingHouseholds,
  isFetchingIncidents,
  isFetchingRescuers,
  handleDispatch,
  handleResolve,
  fetchCasualtyLogs,
  fetchHouseholds,
  fetchRescuers,
  fetchIncidents,
  navGroups,
  pendingApprovals,
  unassignedAlerts,
}) {
  const currentTitle = {
    map: "Tactical Command Map",
    alerts: "SOS Emergency Stream",
    residents: "Resident Registry & SMS Broadcast",
    units: "Units & Barangay Tanods",
    reports: "ZCDRRMO Incident Reports & Analytics",
    victims: "Victims Database & Casualty Logs",
    approvals: "Rescuer Verification Approvals",
    personnel: "Personnel Alert & Manpower Defense",
    settings: "System Settings & Configuration",
  }[activeTab] || "Operations Dashboard";

  const activeTabMeta = navGroups.flatMap((group) => group.items).find((tab) => tab.id === activeTab);
  const ActiveTabIcon = activeTabMeta?.icon;
  const [reviewRescuer, setReviewRescuer] = useState(null);

  const handleApproveRescuer = async (dbId) => {
    await apiFetch(`/api/rescuers/verify/${dbId}`, { method: "POST" });
    setReviewRescuer(null);
    fetchRescuers();
  };

  const handleRejectRescuer = async (dbId) => {
    if (!window.confirm("Reject this rescuer registration?")) return;
    await apiFetch(`/api/rescuers/${dbId}`, { method: "DELETE" });
    setReviewRescuer(null);
    fetchRescuers();
  };

  const renderMapTab = () => (
    <>
      <aside className="w-80 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">SOS Alerts Queue</h3>
            <p className="text-[10px] text-slate-500">Live incoming emergency signals</p>
          </div>
          <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-mono font-bold rounded-full">
            {alerts.filter((alert) => alert.status !== "resolved").length} Active
          </span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 gap-2">
              <CheckCircle size={32} className="text-emerald-500" />
              <span className="text-xs font-medium">All SOS requests are clear and resolved</span>
            </div>
          ) : (
            alerts.map((alert) => {
              const isSelected = selectedAlert === alert.id;
              const isUnassigned = alert.status === "unassigned";

              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(isSelected ? null : alert.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-red-50/40 border-red-300 shadow-sm"
                      : isUnassigned
                      ? "bg-red-50/15 border-red-200 animate-pulse-border-red"
                      : "bg-white border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-red-700">{alert.id}</span>
                    <span className="text-[10px] font-mono text-slate-400">{alert.time}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1">{alert.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{alert.zone}</div>
                  {alert.message && (
                    <div className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2 truncate">
                      “{alert.message}”
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                    <StatusBadge status={alert.status} />
                    <span className="text-[10px] font-mono text-slate-500">BAT {alert.battery}%</span>
                  </div>
                  {isUnassigned && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setDispatchTarget(alert);
                      }}
                      className="mt-3 w-full py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Dispatch Unit
                    </button>
                  )}
                  {alert.status === "assigned" && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleResolve(alert.id);
                      }}
                      className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      <main className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
            <MapPinIcon />
            <span>Field view</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <PingDot active={pods.length > 0} />
              {(() => {
                const activeSos = alerts.filter((a) => a.status !== "resolved").length;
                const parts = [];
                if (activeSos > 0) parts.push(`${activeSos} phone SOS`);
                if (pods.length > 0) parts.push(`${pods.length} live pod${pods.length === 1 ? "" : "s"}`);
                return parts.length > 0 ? parts.join(" · ") : "Waiting for live telemetry";
              })()}
            </span>
          </div>
        </div>

        <div className="flex-1">
          {/* Map rendering is kept in the extracted map module. */}
          <TacticalMap
            alerts={alerts}
            rescuers={rescuers}
            casualties={casualtyLogs}
            pods={pods}
            selected={selectedAlert}
            onSelect={(id) => {
              setSelectedAlert((previous) => (previous === id ? null : id));
              setSelectedCasualtyId(null);
            }}
            selectedCasualtyId={selectedCasualtyId}
            onSelectCasualty={(id) => {
              setSelectedCasualtyId((previous) => (previous === id ? null : id));
              setSelectedAlert(null);
            }}
            onDispatchToTarget={handleDispatch}
          />
        </div>
      </main>

      <aside className="w-72 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">Quick Operations</h3>
          <p className="text-[10px] text-slate-500">Fast action emergency dispatches</p>
        </div>

        <div className="p-4 flex flex-col gap-2.5">
          <button onClick={() => setShowBroadcast(true)} className="w-full py-3 px-4 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2.5 cursor-pointer">
            <Volume2 size={16} />
            <span>LoRa Mesh Broadcast</span>
          </button>

          <button onClick={() => setShowCallRescuerModal(true)} className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2.5 cursor-pointer">
            <MessageSquare size={16} />
            <span>Message Rescuer</span>
          </button>

          <button onClick={() => setActiveTab("residents")} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2.5 cursor-pointer">
            <Home size={15} />
            <span>Resident SMS Broadcast</span>
          </button>

          <button onClick={() => setActiveTab("reports")} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2.5 cursor-pointer">
            <BarChart2 size={15} />
            <span>ZCDRRMO Incident Logs</span>
          </button>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono">Mesh Network Relays</h4>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          <p className="p-3 text-xs text-slate-400 italic">No live mesh relays detected.</p>
        </div>
      </aside>
    </>
  );

  const renderAlertsTab = () => (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">SOS Emergency Stream</h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time distress signals from mobile apps & emergency radio beacons</p>
        </div>
        <button onClick={() => setActiveTab("map")} className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2">
          <Compass size={14} />
          <span>View on Map</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-red-700">{alert.id}</span>
                <StatusBadge status={alert.status} />
              </div>
              <div className="text-base font-bold text-slate-900">{alert.name}</div>
              <div className="text-xs text-slate-500">{alert.zone} · {alert.lat}, {alert.lng}</div>
              {alert.message && (
                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">“{alert.message}”</div>
              )}
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">Battery: {alert.battery}%</span>
              {alert.status === "unassigned" ? (
                <button onClick={() => setDispatchTarget(alert)} className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer">Dispatch</button>
              ) : (
                <button onClick={() => handleResolve(alert.id)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer">Resolve</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderResidentsTab = () => (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Resident Registry & SMS Broadcast</h2>
          <p className="text-xs text-slate-500 mt-0.5">Barangay Tumaga household directory and targeted SMS alerts</p>
        </div>
        <button onClick={fetchHouseholds} disabled={isFetchingHouseholds} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2">
          <RefreshCw size={13} className={isFetchingHouseholds ? "animate-spin" : ""} />
          <span>Sync Directory</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Households" value={households.length} tone="slate" />
        <StatCard label="SMS Subscribed" value={households.filter((household) => household.status === "Active").length} tone="emerald" />
        <StatCard label="Covered Residents" value={households.reduce((sum, household) => sum + (household.occupants_count || 1), 0)} tone="sky" />
        <StatCard label="Seniors / PWD" value={households.reduce((sum, household) => sum + (household.vulnerable_count || 0), 0)} tone="amber" />
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono font-bold text-[10px]">
            <tr>
              <th className="p-3.5 pl-4">Resident Name</th>
              <th className="p-3.5">Mobile Number</th>
              <th className="p-3.5">Purok / Zone</th>
              <th className="p-3.5">Occupants</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {households.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">No registered households found.</td></tr>
            ) : (
              households.map((household) => (
                <tr key={household.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 pl-4 font-bold text-slate-900">{household.resident_name}</td>
                  <td className="p-3.5 font-mono text-slate-700">{household.phone_number}</td>
                  <td className="p-3.5 font-semibold text-slate-600">{household.purok_zone}</td>
                  <td className="p-3.5 font-mono">{household.occupants_count} resident(s)</td>
                  <td className="p-3.5"><span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">{household.status || "Active"}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUnitsTab = () => (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Units & Barangay Tanods Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Field volunteer units, zone assignments, and real-time statuses</p>
        </div>
        <button onClick={fetchRescuers} disabled={isFetchingRescuers} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2">
          <RefreshCw size={13} className={isFetchingRescuers ? "animate-spin" : ""} />
          <span>Sync Units</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rescuers.map((rescuer) => (
          <div key={rescuer.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-red-700">{rescuer.id}</span>
                <RescuerBadge status={rescuer.status} />
              </div>
              <div className="text-base font-bold text-slate-900 mt-1">{rescuer.name}</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">{rescuer.unit}</div>
              <div className="text-xs text-slate-600 mt-2"><strong>Assigned Zone:</strong> {rescuer.assignedZone}</div>
              <div className="text-xs text-slate-600 font-mono mt-1">📍 {rescuer.lat}, {rescuer.lng}</div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
              <span>Ping: {rescuer.lastPing}</span>
              <span>BAT: {rescuer.battery}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderReportsTab = () => (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">ZCDRRMO Incident Reports & Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">Historical disaster events, response times, and evacuation records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open(`${API_BASE_URL || `http://localhost:${ADMIN_API_PORTS[0]}`}/api/incidents/export`, "_blank")} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2">
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2">
            <Printer size={13} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Recorded Events" value={incidents.length} tone="slate" />
        <StatCard
          label="Avg Response"
          value={
            incidents.length
              ? `${(
                  incidents.reduce((total, item) => total + (Number(item.avg_response_time_mins) || 0), 0) /
                  incidents.length
                ).toFixed(1)}m`
              : "--"
          }
          tone="emerald"
        />
        <StatCard label="Total Rescued" value={incidents.reduce((sum, item) => sum + (item.total_rescued || 0), 0)} tone="sky" />
        <StatCard label="Casualties" value={incidents.reduce((sum, item) => sum + (item.casualties_count || 0), 0)} tone="purple" />
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono font-bold text-[10px]">
            <tr>
              <th className="p-3.5 pl-4">Event Title</th>
              <th className="p-3.5">Disaster Type</th>
              <th className="p-3.5">Date Occurred</th>
              <th className="p-3.5">Water Level</th>
              <th className="p-3.5">Rescued</th>
              <th className="p-3.5">Response Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {incidents.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">No disaster records logged yet.</td></tr>
            ) : (
              incidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 pl-4 font-bold text-slate-900">{incident.title}</td>
                  <td className="p-3.5 font-semibold text-red-700">{incident.disaster_type}</td>
                  <td className="p-3.5 font-mono text-slate-500">{incident.date_occurred}</td>
                  <td className="p-3.5 font-mono">{incident.water_level_m}m</td>
                  <td className="p-3.5 font-mono text-emerald-700 font-bold">{incident.total_rescued}</td>
                  <td className="p-3.5 font-mono">{incident.avg_response_time_mins} mins</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderVictimsTab = () => (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Victims Database & Casualties Log</h2>
          <p className="text-xs text-slate-500 mt-0.5">Field rescuer reports and casualty tracking</p>
        </div>
        <button onClick={fetchCasualtyLogs} disabled={isFetchingCasualties} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2">
          <RefreshCw size={13} className={isFetchingCasualties ? "animate-spin" : ""} />
          <span>Sync Victims</span>
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono font-bold text-[10px]">
            <tr>
              <th className="p-3.5 pl-4">Victim Name</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Disaster Type</th>
              <th className="p-3.5">Age / Gender</th>
              <th className="p-3.5">Location</th>
              <th className="p-3.5">Injuries / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {casualtyLogs.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">No victim logs recorded yet.</td></tr>
            ) : (
              casualtyLogs.map((casualty) => (
                <tr key={casualty.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 pl-4 font-bold text-slate-900">{casualty.victim_name}</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      casualty.status === "Injured"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : casualty.status === "Rescued"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      {casualty.status}
                    </span>
                  </td>
                  <td className="p-3.5 font-semibold text-slate-700">{casualty.disaster_type}</td>
                  <td className="p-3.5 font-mono">{casualty.age || "--"} / {casualty.gender || "--"}</td>
                  <td className="p-3.5 font-mono">{casualty.location}</td>
                  <td className="p-3.5 text-slate-600 italic">{casualty.injury_details || "No comments"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderApprovalsTab = () => (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Official Rescuer Verification</h2>
          <p className="text-xs text-slate-500 mt-0.5">Review credentials submitted via mobile registration</p>
        </div>
        <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-mono font-bold rounded-full">{pendingApprovals.length} Pending</span>
      </div>

      {pendingApprovals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 gap-3">
          <ShieldCheck size={40} className="text-emerald-500" />
          <span className="text-sm font-bold text-slate-800">All Rescuers Verified</span>
          <p className="text-xs text-slate-400 max-w-sm">No unverified rescuer accounts waiting for administrator review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingApprovals.map((rescuer) => (
            <div key={rescuer.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500">{rescuer.idType} ({rescuer.idNumber})</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">{rescuer.name}</div>
                <div className="text-xs text-slate-500 font-mono">{rescuer.email}</div>
                <div className="text-xs text-slate-600 mt-1">Phone: {rescuer.unit}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewRescuer(rescuer)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Eye size={13} />
                  Review ID & Details
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectRescuer(rescuer.dbId)}
                  className="py-2.5 px-4 border border-slate-200 hover:bg-red-50 hover:text-red-700 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (activeTab === "map") return renderMapTab();
    if (activeTab === "alerts") return renderAlertsTab();
    if (activeTab === "residents") return renderResidentsTab();
    if (activeTab === "units") return renderUnitsTab();
    if (activeTab === "reports") return renderReportsTab();
    if (activeTab === "victims") return renderVictimsTab();
    if (activeTab === "approvals") return renderApprovalsTab();
    if (activeTab === "personnel" || activeTab === "manpower") return <PersonnelPage />;
    if (activeTab === "settings") return <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto custom-scrollbar flex flex-col"><SettingsPage /></div>;
    return renderMapTab();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100">
      {reviewRescuer && (
        <RescuerReviewModal
          rescuer={reviewRescuer}
          onClose={() => setReviewRescuer(null)}
          onApprove={handleApproveRescuer}
          onReject={handleRejectRescuer}
        />
      )}
      <header className="h-16 px-4 md:px-6 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0 z-40 shadow-xs">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg md:hidden transition-colors cursor-pointer" title="Open Navigation Menu">
            <Home size={22} />
          </button>

          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              {ActiveTabIcon ? <ActiveTabIcon size={18} className="text-red-600" /> : null}
              <span>{currentTitle}</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Barangay Tumaga Operations Portal · Zamboanga City</p>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-[11px] font-mono font-bold text-emerald-800">
            <span>COMMAND ONLINE</span>
          </div>
        </div>

        <div className="flex items-center gap-3">


          <div className="text-right hidden sm:block">
            <div className="text-xs font-mono font-bold text-slate-900">{fmtTime(now)}</div>
            <div className="text-[10px] text-slate-400 font-medium">{now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {renderContent()}
      </div>

      {showBroadcast && <BroadcastModal onClose={() => setShowBroadcast(false)} />}
      {dispatchTarget && (
        <DispatchModal
          alert={dispatchTarget}
          rescuers={rescuers}
          onDispatch={handleDispatch}
          onClose={() => setDispatchTarget(null)}
        />
      )}
      {showCallRescuerModal && (
        <MessageRescuerModal
          rescuers={rescuers}
          casualties={casualtyLogs}
          alerts={alerts}
          onClose={() => setShowCallRescuerModal(false)}
          onDispatch={(rescuerId, targetType, targetId, targetName) => {
            handleDispatch(rescuerId, targetType, targetId, targetName);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tone = "slate" }) {
  const colors = {
    slate: "bg-slate-50 border-slate-200 text-slate-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    sky: "bg-sky-50 border-sky-200 text-sky-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
  };

  return (
    <div className={`border p-4 rounded-xl ${colors[tone]}`}>
      <span className="text-xs font-bold uppercase block opacity-80">{label}</span>
      <span className="text-2xl font-black font-mono mt-1 block">{value}</span>
    </div>
  );
}

function MapPinIcon() {
  return <span className="inline-flex h-3.5 w-3.5 rounded-full bg-red-600 ring-4 ring-red-100" />;
}
