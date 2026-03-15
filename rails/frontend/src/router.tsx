import { createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./components/auth/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { PipelinesPage } from "./pages/PipelinesPage";
import { PipelineEditPage } from "./pages/PipelineEditPage";
import { TriggersPage } from "./pages/TriggersPage";
import { RunHistoryPage } from "./pages/RunHistoryPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import SetupPage from "./pages/SetupPage";
import LoginPage from "./pages/LoginPage";

export const router = createBrowserRouter([
  { path: "/setup", element: <SetupPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "pipelines", element: <PipelinesPage /> },
      { path: "pipelines/new", element: <PipelineEditPage /> },
      { path: "pipelines/:id/edit", element: <PipelineEditPage /> },
      { path: "triggers", element: <TriggersPage /> },
      { path: "runs", element: <RunHistoryPage /> },
      { path: "integrations", element: <IntegrationsPage /> },
    ],
  },
]);
