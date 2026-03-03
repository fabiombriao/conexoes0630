import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import ContributionsPage from "@/pages/ContributionsPage";
import ReportsPage from "@/pages/ReportsPage";
import GroupPage from "@/pages/GroupPage";
import EventsPage from "@/pages/EventsPage";
import InvitePage from "@/pages/InvitePage";
import ForumPage from "@/pages/ForumPage";
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
              <Route path="/group" element={<GroupPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/forum" element={<ForumPage />} />
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
