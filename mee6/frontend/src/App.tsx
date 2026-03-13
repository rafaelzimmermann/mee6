import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PipelineList } from "@/components/pipelines/PipelineList";
import { PipelineForm } from "@/components/pipelines/PipelineForm";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/pipelines" replace />} />
          <Route path="/pipelines" element={<PipelineList />} />
          <Route path="/pipelines/new" element={<PipelineForm />} />
          <Route path="/pipelines/:id" element={<PipelineForm />} />
          <Route path="*" element={<Navigate to="/pipelines" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
