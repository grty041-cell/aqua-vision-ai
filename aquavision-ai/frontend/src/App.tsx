import type { ReactNode } from 'react';
import Dashboard from './pages/Dashboard';
import VideoIntelligence from './pages/VideoIntelligence';
import SpeciesExplorer from './pages/SpeciesExplorer';
import PopulationAnalytics from './pages/PopulationAnalytics';
import ReportsEvaluation from './pages/ReportsEvaluation';

const navigation = [
  { path: '/', label: 'Overview', symbol: 'OV' },
  { path: '/video-intelligence', label: 'Video intelligence', symbol: 'VI' },
  { path: '/species-explorer', label: 'Species explorer', symbol: 'SE' },
  { path: '/population-analytics', label: 'Population analytics', symbol: 'PA' },
  { path: '/reports-evaluation', label: 'Reports & evaluation', symbol: 'RE' },
];

function AppLayout({ children, path }: { children: ReactNode; path: string }) {
  const currentPage = navigation.find((item) => item.path === path);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><span>A</span><i /></span>
          <span><strong>AquaVision</strong><small>AI FIELD LAB</small></span>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              key={item.path}
              href={item.path}
              aria-current={path === item.path ? 'page' : undefined}
              className={`nav-link${path === item.path ? ' active' : ''}`}
            >
              <span className="nav-symbol">{item.symbol}</span>
              <span>{item.label}</span>
              {item.path === '/video-intelligence' && <span className="nav-indicator" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-card">
            <span className="engine-pulse" />
            <div><strong>Vision engine</strong><small>YOLOv8 · ByteTrack</small></div>
            <span className="engine-state">READY</span>
          </div>
          <span className="sidebar-version">AquaVision AI <span>v1.0</span></span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{currentPage?.label || 'AquaVision AI'}</strong></div>
          <div className="topbar-status"><span className="status-dot" /> LOCAL PROCESSING</div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;
  const pages: Record<string, ReactNode> = {
    '/': <Dashboard />,
    '/video-intelligence': <VideoIntelligence />,
    '/species-explorer': <SpeciesExplorer />,
    '/population-analytics': <PopulationAnalytics />,
    '/reports-evaluation': <ReportsEvaluation />,
  };
  return (
    <AppLayout path={path}>{pages[path] || <Dashboard />}</AppLayout>
  );
}
