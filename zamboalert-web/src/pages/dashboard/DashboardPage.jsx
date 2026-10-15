import "leaflet/dist/leaflet.css";
import { Activity } from "lucide-react";
import { DashboardSidebar } from "./DashboardSidebar";
import DashboardContent from "./DashboardContent";
import { useDashboardData } from "./useDashboardData";

export default function DashboardPage() {
  const dashboard = useDashboardData();

  if (!dashboard.isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-red-500 font-mono text-xs">
        <Activity className="animate-spin mb-3" size={24} />
        INITIALIZING COMMAND NODE...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-100 flex overflow-hidden text-slate-800 antialiased font-sans">
      {dashboard.isMobileSidebarOpen && (
        <div
          onClick={() => dashboard.setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <DashboardSidebar
        navGroups={dashboard.navGroups}
        activeTab={dashboard.activeTab}
        isSidebarCollapsed={dashboard.isSidebarCollapsed}
        isMobileSidebarOpen={dashboard.isMobileSidebarOpen}
        setIsSidebarCollapsed={dashboard.setIsSidebarCollapsed}
        setIsMobileSidebarOpen={dashboard.setIsMobileSidebarOpen}
        setActiveTab={dashboard.setActiveTab}
      />

      <DashboardContent
        now={dashboard.now}
        alerts={dashboard.alerts}
        rescuers={dashboard.rescuers}
        casualtyLogs={dashboard.casualtyLogs}
        households={dashboard.households}
        incidents={dashboard.incidents}
        pods={dashboard.pods}
        selectedAlert={dashboard.selectedAlert}
        setSelectedAlert={dashboard.setSelectedAlert}
        selectedCasualtyId={dashboard.selectedCasualtyId}
        setSelectedCasualtyId={dashboard.setSelectedCasualtyId}
        dispatchTarget={dashboard.dispatchTarget}
        setDispatchTarget={dashboard.setDispatchTarget}
        showBroadcast={dashboard.showBroadcast}
        setShowBroadcast={dashboard.setShowBroadcast}
        showCallRescuerModal={dashboard.showCallRescuerModal}
        setShowCallRescuerModal={dashboard.setShowCallRescuerModal}
        activeTab={dashboard.activeTab}
        setActiveTab={dashboard.setActiveTab}
        isSidebarCollapsed={dashboard.isSidebarCollapsed}
        setIsSidebarCollapsed={dashboard.setIsSidebarCollapsed}
        isMobileSidebarOpen={dashboard.isMobileSidebarOpen}
        setIsMobileSidebarOpen={dashboard.setIsMobileSidebarOpen}
        isFetchingCasualties={dashboard.isFetchingCasualties}
        isFetchingHouseholds={dashboard.isFetchingHouseholds}
        isFetchingIncidents={dashboard.isFetchingIncidents}
        isFetchingRescuers={dashboard.isFetchingRescuers}
        handleDispatch={dashboard.handleDispatch}
        handleResolve={dashboard.handleResolve}
        fetchCasualtyLogs={dashboard.fetchCasualtyLogs}
        fetchHouseholds={dashboard.fetchHouseholds}
        fetchRescuers={dashboard.fetchRescuers}
        fetchIncidents={dashboard.fetchIncidents}
        navGroups={dashboard.navGroups}
        pendingApprovals={dashboard.pendingApprovals}
        unassignedAlerts={dashboard.unassignedAlerts}
      />
    </div>
  );
}
