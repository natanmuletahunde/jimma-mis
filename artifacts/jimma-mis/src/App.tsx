import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileLayout } from "@/pages/mobile/MobileLayout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import PropertiesList from "@/pages/properties/index";
import PropertyNew from "@/pages/properties/new";
import PropertyShow from "@/pages/properties/[id]";
import MapView from "@/pages/map";
import Reports from "@/pages/reports";
import Users from "@/pages/users";
import LocationsSetup from "@/pages/setup/locations";
import StreetsSetup from "@/pages/setup/streets";
import BlocksSetup from "@/pages/setup/blocks";
import AuditLogs from "@/pages/audit-logs";

import FieldCollection from "@/pages/mobile/field-collection";
import OfflineDrafts from "@/pages/mobile/offline-drafts";
import SyncedRecords from "@/pages/mobile/synced";
import RejectedRecords from "@/pages/mobile/rejected";

import 'leaflet/dist/leaflet.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoutes() {
  const { user } = useAuth();
  
  if (!user) return null; // AppLayout handles redirect
  
  return (
    <Switch>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/properties" component={PropertiesList} />
      <Route path="/properties/new" component={PropertyNew} />
      <Route path="/properties/:id" component={PropertyShow} />
      <Route path="/map" component={MapView} />
      <Route path="/reports" component={Reports} />
      <Route path="/users" component={Users} />
      <Route path="/setup/locations" component={LocationsSetup} />
      <Route path="/setup/streets" component={StreetsSetup} />
      <Route path="/setup/blocks" component={BlocksSetup} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function MobileRoutes() {
  return (
    <Switch>
      <Route path="/mobile/field-collection" component={FieldCollection} />
      <Route path="/mobile/offline-drafts" component={OfflineDrafts} />
      <Route path="/mobile/synced" component={SyncedRecords} />
      <Route path="/mobile/rejected" component={RejectedRecords} />
      <Route path="/mobile">
        <Redirect to="/mobile/field-collection" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/mobile/:rest*">
        <MobileLayout>
          <MobileRoutes />
        </MobileLayout>
      </Route>
      <Route path="*">
        <AppLayout>
          <ProtectedRoutes />
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
