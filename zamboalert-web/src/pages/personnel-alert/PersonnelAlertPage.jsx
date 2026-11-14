import React, { useState, useEffect, useCallback } from "react";
import { ArrowRightLeft, Building, Send, ShieldAlert } from "lucide-react";
import PageHeader from "./PageHeader";
import AlertMatrixTab from "./AlertMatrixTab";
import BarangayInventoryTab from "./BarangayInventoryTab";
import MutualAidTransfersTab from "./MutualAidTransfersTab";
import AgencyEscalationsTab from "./AgencyEscalationsTab";
import {
  TriggerAlertModal,
  MutualAidModal,
  EscalateAgencyModal,
  EditBarangayModal,
} from "./AlertModals";
import { apiFetch, downloadFile } from "../dashboard/dashboardApi";

export default function PersonnelAlertPage() {
  const [subTab, setSubTab] = useState("alerts");

  const [alerts, setAlerts] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [escalations, setEscalations] = useState([]);

  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [loadingEscalations, setLoadingEscalations] = useState(false);

  const [alertSearch, setAlertSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("ALL");
  const [barangaySearch, setBarangaySearch] = useState("");

  const [expandedAlerts, setExpandedAlerts] = useState({});

  const [triggerAlert, setTriggerAlert] = useState(null);
  const [showMutualAid, setShowMutualAid] = useState(false);
  const [mutualAidDefaultTo, setMutualAidDefaultTo] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateDefaultTargets, setEscalateDefaultTargets] = useState([]);
  const [editBarangay, setEditBarangay] = useState(null);

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const res = await apiFetch(`/api/manpower/alerts`);
      if (res.ok) setAlerts(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  const fetchBarangays = useCallback(async () => {
    setLoadingBarangays(true);
    try {
      const res = await apiFetch(`/api/manpower/barangays`);
      if (res.ok) setBarangays(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBarangays(false);
    }
  }, []);

  const fetchTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    try {
      const res = await apiFetch(`/api/manpower/transfers`);
      if (res.ok) setTransfers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTransfers(false);
    }
  }, []);

  const fetchEscalations = useCallback(async () => {
    setLoadingEscalations(true);
    try {
      const res = await apiFetch(`/api/manpower/escalations`);
      if (res.ok) setEscalations(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEscalations(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchBarangays();
    fetchTransfers();
    fetchEscalations();
  }, [fetchAlerts, fetchBarangays, fetchTransfers, fetchEscalations]);

  const criticalCount = alerts.filter((a) => a.alert_level?.includes("CRITICAL")).length;
  const severeCount = alerts.filter((a) => a.alert_level?.includes("SEVERE")).length;
  const moderateCount = alerts.filter((a) => a.alert_level?.includes("MODERATE")).length;
  const sufficientCount = alerts.filter((a) => a.alert_level?.includes("SUFFICIENT")).length;
  const totalDeficit = alerts.reduce((sum, a) => sum + (a.deficit_count || 0), 0);

  const subTabs = [
    { id: "alerts", label: "Alert Matrix", icon: ShieldAlert, badge: criticalCount },
    { id: "barangays", label: "Barangay Inventory", icon: Building },
    { id: "transfers", label: "Mutual Aid Log", icon: ArrowRightLeft, count: transfers.length },
    { id: "escalations", label: "Agency Escalations", icon: Send, count: escalations.length },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm">
      <PageHeader
        criticalCount={criticalCount}
        severeCount={severeCount}
        moderateCount={moderateCount}
        sufficientCount={sufficientCount}
        totalDeficit={totalDeficit}
        subTab={subTab}
        subTabs={subTabs}
        setSubTab={setSubTab}
        onMutualAid={() => {
          setMutualAidDefaultTo("");
          setShowMutualAid(true);
        }}
        onEscalate={() => {
          setEscalateDefaultTargets([]);
          setShowEscalate(true);
        }}
        onExport={() => downloadFile("/api/manpower/export", "manpower-alerts.csv").catch((e) => console.error(e))}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {subTab === "alerts" && (
          <AlertMatrixTab
            alerts={alerts}
            loadingAlerts={loadingAlerts}
            alertSearch={alertSearch}
            setAlertSearch={setAlertSearch}
            alertFilter={alertFilter}
            setAlertFilter={setAlertFilter}
            fetchAlerts={fetchAlerts}
            expandedAlerts={expandedAlerts}
            setExpandedAlerts={setExpandedAlerts}
            setTriggerAlert={setTriggerAlert}
            setMutualAidDefaultTo={setMutualAidDefaultTo}
            setShowMutualAid={setShowMutualAid}
            setEscalateDefaultTargets={setEscalateDefaultTargets}
            setShowEscalate={setShowEscalate}
          />
        )}

        {subTab === "barangays" && (
          <BarangayInventoryTab
            barangays={barangays}
            loadingBarangays={loadingBarangays}
            barangaySearch={barangaySearch}
            setBarangaySearch={setBarangaySearch}
            fetchBarangays={fetchBarangays}
            setEditBarangay={setEditBarangay}
          />
        )}

        {subTab === "transfers" && (
          <MutualAidTransfersTab
            transfers={transfers}
            loadingTransfers={loadingTransfers}
            fetchTransfers={fetchTransfers}
            setMutualAidDefaultTo={setMutualAidDefaultTo}
            setShowMutualAid={setShowMutualAid}
          />
        )}

        {subTab === "escalations" && (
          <AgencyEscalationsTab
            escalations={escalations}
            loadingEscalations={loadingEscalations}
            fetchEscalations={fetchEscalations}
            setEscalateDefaultTargets={setEscalateDefaultTargets}
            setShowEscalate={setShowEscalate}
          />
        )}
      </div>

      {triggerAlert && (
        <TriggerAlertModal
          barangay={triggerAlert}
          onClose={() => setTriggerAlert(null)}
          onTriggered={() => fetchAlerts()}
        />
      )}
      {showMutualAid && (
        <MutualAidModal
          barangays={barangays}
          defaultTo={mutualAidDefaultTo}
          onClose={() => {
            setShowMutualAid(false);
            setMutualAidDefaultTo("");
          }}
          onTransferred={() => fetchTransfers()}
        />
      )}
      {showEscalate && (
        <EscalateAgencyModal
          barangays={barangays}
          defaultTargets={escalateDefaultTargets}
          onClose={() => {
            setShowEscalate(false);
            setEscalateDefaultTargets([]);
          }}
          onEscalated={() => fetchEscalations()}
        />
      )}
      {editBarangay && (
        <EditBarangayModal
          barangay={editBarangay}
          onClose={() => setEditBarangay(null)}
          onSaved={() => fetchBarangays()}
        />
      )}
    </div>
  );
}
