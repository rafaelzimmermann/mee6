# Task 010 — React Foundation

## Goal

Set up the React SPA skeleton: router, app shell with sidebar navigation,
design system primitives, a typed API client layer, React Query configuration,
a toast notification system, and a Dashboard page showing high-level counts.
Everything built here is consumed by Tasks 011–013.

---

## Prerequisites

- Task 001 complete: `rails/frontend/` Vite + TypeScript project bootstrapped,
  `react-router-dom`, `@tanstack/react-query`, and `react-hook-form` installed.
- Task 005 or later complete: Rails API endpoints for pipelines, triggers, and
  run records exist so the Dashboard can fetch real counts.

---

## Implementation steps

### 1. Install additional dependencies

```bash
cd rails/frontend
npm install @tanstack/react-query-devtools
npm install react-hot-toast          # toast notifications
```

No additional UI library. All components are hand-rolled in `src/components/ui/`.

---

### 2. Router setup

**`src/router.tsx`**

```tsx
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { PipelinesPage } from "./pages/PipelinesPage";
import { PipelineEditPage } from "./pages/PipelineEditPage";
import { TriggersPage } from "./pages/TriggersPage";
import { RunHistoryPage } from "./pages/RunHistoryPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
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
```

---

### 3. Entry point

**`src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import { router } from "./router";
import { queryClient } from "./lib/queryClient";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

### 4. React Query client

**`src/lib/queryClient.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

---

### 5. API client layer

All files live in `src/api/`. Every function throws a typed `ApiError` on
non-2xx. Auth header is injected by the base client; in v3 the Rails session
cookie is used (no explicit token needed from the frontend in production), but
the header slot is available for development/testing.

#### `src/api/client.ts`

```ts
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};
```

#### `src/api/types.ts`

Shared TypeScript interfaces for all API response shapes.

```ts
export interface Pipeline {
  id: string;
  name: string;
  pipeline_steps: PipelineStep[];
  created_at: string;
  updated_at: string;
}

export interface PipelineStep {
  id: number;
  pipeline_id: string;
  step_index: number;
  agent_type: string;
  config: Record<string, unknown>;
}

export interface Trigger {
  id: string;
  pipeline_id: string;
  pipeline_name?: string;
  trigger_type: "cron" | "whatsapp" | "wa_group";
  cron_expr: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface RunRecord {
  id: number;
  pipeline_id: string;
  pipeline_name: string;
  timestamp: string;
  status: "success" | "error" | "running";
  summary: string | null;
}

export interface Memory {
  id: string;
  label: string;
  max_memories: number;
  ttl_hours: number;
  max_value_size: number;
  created_at: string;
}

export interface MemoryEntry {
  id: number;
  memory_id: string;
  value: string;
  created_at: string;
}

export interface Calendar {
  id: string;
  label: string;
  calendar_id: string;
  credentials_file: string;
}

export interface WhatsAppGroup {
  jid: string;
  name: string;
  label: string;
}

export interface FieldSchema {
  name: string;
  label: string;
  field_type: "textarea" | "text" | "tel" | "combobox" | "select" | "group_select" | "calendar_select";
  placeholder: string;
  options: string[];
  required: boolean;
}

export interface AgentSchema {
  label: string;
  fields: FieldSchema[];
}

export type SchemaResponse = Record<string, AgentSchema>;
```

#### `src/api/pipelines.ts`

```ts
import { api } from "./client";
import type { Pipeline } from "./types";

export const pipelinesApi = {
  list: () => api.get<Pipeline[]>("/pipelines"),
  get: (id: string) => api.get<Pipeline>(`/pipelines/${id}`),
  create: (data: { name: string; pipeline_steps_attributes?: unknown[] }) =>
    api.post<Pipeline>("/pipelines", { pipeline: data }),
  update: (id: string, data: Partial<Pipeline>) =>
    api.put<Pipeline>(`/pipelines/${id}`, { pipeline: data }),
  delete: (id: string) => api.delete(`/pipelines/${id}`),
  runNow: (id: string) => api.post<{ ok: boolean }>(`/pipelines/${id}/run_now`),
};
```

#### `src/api/triggers.ts`

```ts
import { api } from "./client";
import type { Trigger } from "./types";

export const triggersApi = {
  list: () => api.get<Trigger[]>("/triggers"),
  create: (data: Partial<Trigger>) => api.post<Trigger>("/triggers", { trigger: data }),
  update: (id: string, data: Partial<Trigger>) =>
    api.put<Trigger>(`/triggers/${id}`, { trigger: data }),
  delete: (id: string) => api.delete(`/triggers/${id}`),
  toggle: (id: string, enabled: boolean) =>
    api.patch<Trigger>(`/triggers/${id}`, { trigger: { enabled } }),
  runNow: (id: string) => api.post<{ ok: boolean }>(`/triggers/${id}/run_now`),
};
```

#### `src/api/runRecords.ts`

```ts
import { api } from "./client";
import type { RunRecord } from "./types";

export const runRecordsApi = {
  list: (params?: { status?: string; limit?: number }) => {
    const qs = params
      ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString()
      : "";
    return api.get<RunRecord[]>(`/run_records${qs}`);
  },
};
```

#### `src/api/integrations/memories.ts`

```ts
import { api } from "../client";
import type { Memory, MemoryEntry } from "../types";

export const memoriesApi = {
  list: () => api.get<Memory[]>("/integrations/memories"),
  get: (label: string) => api.get<Memory>(`/integrations/memories/${label}`),
  create: (data: Omit<Memory, "id" | "created_at">) =>
    api.post<Memory>("/integrations/memories", { memory: data }),
  delete: (label: string) => api.delete(`/integrations/memories/${label}`),
  entries: (label: string, n?: number) =>
    api.get<MemoryEntry[]>(`/integrations/memories/${label}/entries${n ? `?n=${n}` : ""}`),
};
```

#### `src/api/integrations/calendars.ts`

```ts
import { api } from "../client";
import type { Calendar } from "../types";

export const calendarsApi = {
  list: () => api.get<Calendar[]>("/integrations/calendars"),
  create: (data: Omit<Calendar, "id">) =>
    api.post<Calendar>("/integrations/calendars", { calendar: data }),
  delete: (id: string) => api.delete(`/integrations/calendars/${id}`),
};
```

#### `src/api/integrations/whatsapp.ts`

```ts
import { api } from "../client";
import type { WhatsAppGroup } from "../types";

export interface WhatsAppStatus {
  status: "connected" | "disconnected" | "pending_qr" | "connecting" | "error";
  qr_svg: string | null;
  phone_number: string;
}

export const whatsappApi = {
  status: () => api.get<WhatsAppStatus>("/integrations/whatsapp/status"),
  connect: () => api.post<{ ok: boolean }>("/integrations/whatsapp/connect"),
  disconnect: () => api.post<{ ok: boolean }>("/integrations/whatsapp/disconnect"),
  updateSettings: (data: { phone_number: string }) =>
    api.patch<{ ok: boolean }>("/integrations/whatsapp/settings", data),
  groups: () => api.get<WhatsAppGroup[]>("/integrations/whatsapp_groups"),
  updateGroupLabel: (jid: string, label: string) =>
    api.put<WhatsAppGroup>(`/integrations/whatsapp_groups/${encodeURIComponent(jid)}`, {
      whatsapp_group: { label },
    }),
  syncGroups: () => api.post<{ ok: boolean }>("/integrations/whatsapp_groups/sync"),
};
```

#### `src/api/agents.ts`

```ts
import { api } from "./client";
import type { SchemaResponse } from "./types";

export const agentsApi = {
  getSchema: () => api.get<SchemaResponse>("/agents/schema"),
};
```

---

### 6. Design system components

All components live in `src/components/ui/`. Each file exports a single named
component (or a small family of related components). Use TypeScript prop
interfaces for every component. No external CSS framework — use plain CSS
modules or a `styles.css` co-located with the component.

#### `Button`

```tsx
// src/components/ui/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, children, disabled, ...props }: ButtonProps)
```

Renders a `<button>` with appropriate CSS classes. When `loading` is true,
shows `LoadingSpinner` inline and disables interaction.

#### `Card`, `CardHeader`, `CardBody`

```tsx
// src/components/ui/Card.tsx
export function Card({ children, className }: { children: React.ReactNode; className?: string })
export function CardHeader({ children }: { children: React.ReactNode })
export function CardBody({ children }: { children: React.ReactNode })
```

#### `Table`, `Th`, `Td`, `Tr`

```tsx
// src/components/ui/Table.tsx
export function Table({ children }: { children: React.ReactNode })
export function Th({ children, className }: { children: React.ReactNode; className?: string })
export function Td({ children, className }: { children: React.ReactNode; className?: string })
export function Tr({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string })
```

#### `Badge`

```tsx
// src/components/ui/Badge.tsx
interface BadgeProps {
  variant: "success" | "error" | "warning" | "neutral";
  children: React.ReactNode;
}
export function Badge({ variant, children }: BadgeProps)
```

Maps variant to color: success=green, error=red, warning=amber, neutral=gray.

#### `Input`, `Textarea`, `Select`

Each component is a controlled form field with `label` and `error` display.

```tsx
// src/components/ui/Input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
export function Input({ label, error, ...props }: InputProps)

// src/components/ui/Textarea.tsx
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}
export function Textarea({ label, error, ...props }: TextareaProps)

// src/components/ui/Select.tsx
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
}
export function Select({ label, error, options, ...props }: SelectProps)
```

#### `Modal`

Portal-based. Renders via `ReactDOM.createPortal` into `document.body`.
Clicking the overlay calls `onClose`.

```tsx
// src/components/ui/Modal.tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
export function Modal({ open, onClose, title, children }: ModalProps)
```

#### `LoadingSpinner`

```tsx
// src/components/ui/LoadingSpinner.tsx
export function LoadingSpinner({ size?: "sm" | "md" | "lg" })
```

CSS-animated circular spinner, no external dependency.

#### `EmptyState`

```tsx
// src/components/ui/EmptyState.tsx
interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  cta?: { label: string; onClick: () => void };
}
export function EmptyState({ message, icon, cta }: EmptyStateProps)
```

---

### 7. AppShell

**`src/components/layout/AppShell.tsx`**

```tsx
import { Outlet, NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/",            label: "Dashboard" },
  { to: "/pipelines",   label: "Pipelines" },
  { to: "/triggers",    label: "Triggers" },
  { to: "/runs",        label: "Run History" },
  { to: "/integrations", label: "Integrations" },
];

export function AppShell() {
  // Renders:
  // - Left sidebar with NAV_ITEMS using NavLink (active class applied automatically)
  // - Top bar with app title "mee6"
  // - Main content area renders <Outlet />
}
```

Active nav items use the `className` callback form of `NavLink`:
`className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}`.

The Dashboard route uses `end` prop on NavLink to avoid matching all routes.

---

### 8. DashboardPage

**`src/pages/DashboardPage.tsx`**

Fetches pipeline count, trigger count, and the 5 most recent run records. Displays
them in three stat cards plus a mini run history table.

```tsx
export function DashboardPage() {
  const { data: pipelines }   = useQuery({ queryKey: ["pipelines"], queryFn: pipelinesApi.list });
  const { data: triggers }    = useQuery({ queryKey: ["triggers"],  queryFn: triggersApi.list });
  const { data: runRecords }  = useQuery({ queryKey: ["run_records", { limit: 5 }], queryFn: () => runRecordsApi.list({ limit: 5 }) });

  // Renders:
  //   Row of 3 stat cards: "Pipelines: N", "Triggers: N", "Last run: <status badge>"
  //   Table of the 5 most recent run records (pipeline_name, timestamp, status badge)
  //   LoadingSpinner while data is loading
}
```

---

### 9. Stub pages

Create thin stub components for all pages consumed by the router. They just
render a heading and a `<p>Coming soon</p>`. This ensures the router works
immediately. The real implementations come in Tasks 011–013.

- `src/pages/PipelinesPage.tsx`
- `src/pages/PipelineEditPage.tsx`
- `src/pages/TriggersPage.tsx`
- `src/pages/RunHistoryPage.tsx`
- `src/pages/IntegrationsPage.tsx`

---

### 10. Toast helpers

**`src/lib/toast.ts`**

Thin wrappers around `react-hot-toast` so call sites don't import the library
directly.

```ts
import toast from "react-hot-toast";

export const showSuccess = (message: string) => toast.success(message);
export const showError = (message: string) => toast.error(message);
export const showLoading = (message: string) => toast.loading(message);
```

---

## File / class list

| Path | Description |
|---|---|
| `src/main.tsx` | App entry point: QueryClientProvider, RouterProvider, Toaster |
| `src/router.tsx` | `createBrowserRouter` with all route definitions |
| `src/lib/queryClient.ts` | `QueryClient` instance with staleTime=30s, retry=1 |
| `src/lib/toast.ts` | `showSuccess`, `showError`, `showLoading` helpers |
| `src/api/client.ts` | Base fetch wrapper: `ApiError`, `api.get/post/put/patch/delete` |
| `src/api/types.ts` | TypeScript interfaces for all API response shapes |
| `src/api/pipelines.ts` | `pipelinesApi`: list, get, create, update, delete, runNow |
| `src/api/triggers.ts` | `triggersApi`: list, create, update, delete, toggle, runNow |
| `src/api/runRecords.ts` | `runRecordsApi`: list with optional status/limit filter |
| `src/api/integrations/memories.ts` | `memoriesApi`: list, get, create, delete, entries |
| `src/api/integrations/calendars.ts` | `calendarsApi`: list, create, delete |
| `src/api/integrations/whatsapp.ts` | `whatsappApi`: status, connect, disconnect, groups, sync |
| `src/api/agents.ts` | `agentsApi`: getSchema |
| `src/components/layout/AppShell.tsx` | Sidebar + top bar + `<Outlet />` layout wrapper |
| `src/components/ui/Button.tsx` | Button with variant/size/loading props |
| `src/components/ui/Card.tsx` | Card, CardHeader, CardBody |
| `src/components/ui/Table.tsx` | Table, Th, Td, Tr |
| `src/components/ui/Badge.tsx` | Colored badge for status display |
| `src/components/ui/Input.tsx` | Controlled text input with label + error |
| `src/components/ui/Textarea.tsx` | Controlled textarea with label + error |
| `src/components/ui/Select.tsx` | Controlled select with label + error + options |
| `src/components/ui/Modal.tsx` | Portal-based modal with overlay |
| `src/components/ui/LoadingSpinner.tsx` | CSS-animated spinner |
| `src/components/ui/EmptyState.tsx` | Empty state with icon, message, optional CTA |
| `src/pages/DashboardPage.tsx` | Stat cards + recent run records |
| `src/pages/PipelinesPage.tsx` | Stub (implemented in Task 011) |
| `src/pages/PipelineEditPage.tsx` | Stub (implemented in Task 011) |
| `src/pages/TriggersPage.tsx` | Stub (implemented in Task 012) |
| `src/pages/RunHistoryPage.tsx` | Stub (implemented in Task 012) |
| `src/pages/IntegrationsPage.tsx` | Stub (implemented in Task 013) |

---

## Acceptance criteria

- [ ] `npm run dev` starts the Vite dev server without errors
- [ ] Navigating to `http://localhost:5173` shows the AppShell with sidebar
- [ ] All five sidebar links navigate to distinct routes without a full page reload
- [ ] Active sidebar link has a visually distinct style
- [ ] DashboardPage loads and displays pipeline count, trigger count, and recent runs
- [ ] `LoadingSpinner` is visible while Dashboard data is fetching
- [ ] A 404 path (e.g. `/nonexistent`) does not crash the app
- [ ] `api.get` on a non-2xx response throws `ApiError` with the correct status code
- [ ] All TypeScript types in `src/api/types.ts` compile with zero errors (`npm run build`)
- [ ] `react-hot-toast` toaster is mounted and fires on manual `showSuccess()` call from console
- [ ] `npm run build` produces a clean production bundle with no TypeScript errors
