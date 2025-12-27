import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import ContractsPage from './pages/ContractsPage';
import ContractDetailPage from './pages/ContractDetailPage';
import ExtractionDetailPage from './pages/ExtractionDetailPage';
import MembersPage from './pages/MembersPage';
import MemberDetailPage from './pages/MemberDetailPage';
import SettingsPage from './pages/SettingsPage';
import { SettingsProvider } from './contexts/SettingsContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="upload" element={<UploadPage />} />
              <Route path="contracts" element={<ContractsPage />} />
              <Route path="contracts/:id" element={<ContractDetailPage />} />
              <Route path="extractions/:id" element={<ExtractionDetailPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/:id" element={<MemberDetailPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
