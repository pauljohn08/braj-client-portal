import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import AdminLayout from "./components/layout/AdminLayout";
import ClientLayout from "./components/layout/ClientLayout";
import PartTimerLayout from "./components/layout/PartTimerLayout";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import OrderForm from "./pages/OrderForm";
import PendingPartTimer from "./pages/PendingPartTimer";
import NotFound from "./pages/NotFound";

import ClientOverview from "./pages/client/Overview";
import ClientProjects from "./pages/client/Projects";
import ClientProjectDetail from "./pages/client/ProjectDetail";
import ClientRequests from "./pages/client/Requests";
import ClientDocuments from "./pages/client/Documents";
import ClientNotifications from "./pages/client/Notifications";
import ClientProfile from "./pages/client/Profile";

import AdminOverview from "./pages/admin/Overview";
import AdminRequests from "./pages/admin/Requests";
import AdminProjects from "./pages/admin/Projects";
import AdminClients from "./pages/admin/Clients";
import AdminDocuments from "./pages/admin/Documents";
import AdminTransactions from "./pages/admin/Transactions";
import AdminPartTimers from "./pages/admin/PartTimers";
import AdminActivity from "./pages/admin/Activity";
import AdminAccount from "./pages/admin/Account";

import PartTimerWorkBoard from "./pages/parttimer/WorkBoard";
import PartTimerAccount from "./pages/parttimer/Account";

const queryClient = new QueryClient();

/**
 * Each portal swaps its own page inside a persistent shell, so a new page
 * should start at the top rather than wherever the last one was scrolled to.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/order" element={<OrderForm />} />
            <Route path="/pending-parttimer" element={<PendingPartTimer />} />

            <Route path="/dashboard" element={<ClientLayout />}>
              <Route index element={<ClientOverview />} />
              <Route path="projects" element={<ClientProjects />} />
              <Route path="projects/:orderId" element={<ClientProjectDetail />} />
              <Route path="requests" element={<ClientRequests />} />
              <Route path="documents" element={<ClientDocuments />} />
              <Route path="notifications" element={<ClientNotifications />} />
              <Route path="profile" element={<ClientProfile />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="documents" element={<AdminDocuments />} />
              <Route path="transactions" element={<AdminTransactions />} />
              <Route path="parttimers" element={<AdminPartTimers />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="account" element={<AdminAccount />} />
            </Route>

            <Route path="/parttimer" element={<PartTimerLayout />}>
              <Route index element={<PartTimerWorkBoard />} />
              <Route path="account" element={<PartTimerAccount />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
