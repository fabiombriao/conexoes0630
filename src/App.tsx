import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import Dashboard from "@/pages/Dashboard";
import ContributionsPage from "@/pages/ContributionsPage";
import ReportsPage from "@/pages/ReportsPage";
import MembersPage from "@/pages/MembersPage";
import EventsPage from "@/pages/EventsPage";
import InvitePage from "@/pages/InvitePage";
import RankingPage from "@/pages/RankingPage";
import AttendancePage from "@/pages/AttendancePage";
import AdminPendingPage from "@/pages/AdminPendingPage";
import ManageAdminsPage from "@/pages/ManageAdminsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import ProfilePage from "@/pages/ProfilePage";
import RSVPPage from "@/pages/RSVPPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pending" element={<PendingApprovalPage />} />
            <Route path="/rsvp/:token" element={<RSVPPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/contributions" element={<ContributionsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/admin/pending" element={<AdminPendingPage />} />
              <Route path="/admin/manage" element={<ManageAdminsPage />} />
              <Route path="/admin/invitations" element={<InvitePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
