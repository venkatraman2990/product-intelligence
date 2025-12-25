import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { FileText, Upload, BarChart3, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import accelerantLogo from '../assets/accelerant-logo-transparent.png';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Upload', href: '/upload', icon: Upload },
  { name: 'Contracts', href: '/contracts', icon: FileText },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--slate-50)' }}>
      <aside 
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'} flex flex-col border-r transition-all duration-300`}
        style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--slate-200)' }}
      >
        <div className={`${sidebarCollapsed ? 'p-3' : 'p-6 pb-8'} flex items-center justify-between`}>
          {!sidebarCollapsed && (
            <img 
              src={accelerantLogo} 
              alt="Accelerant" 
              className="h-10 w-auto"
            />
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg transition-colors hover:bg-slate-200"
            style={{ color: 'var(--slate-500)' }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        
        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`sidebar-item ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center' : ''}`}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <item.icon className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                  {!sidebarCollapsed && item.name}
                </Link>
              );
            })}
          </div>

          {!sidebarCollapsed && (
            <div className="mt-10">
              <p 
                className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--slate-400)' }}
              >
                Admin
              </p>
              <Link
                to="#"
                className="sidebar-item"
              >
                <Settings className="h-5 w-5 mr-3" />
                Settings
              </Link>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="mt-10">
              <Link
                to="#"
                className="sidebar-item justify-center"
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </Link>
            </div>
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header 
          className="h-14 flex items-center justify-between px-8 border-b"
          style={{ backgroundColor: 'transparent', borderColor: 'var(--slate-200)' }}
        >
          <h1 
            className="text-xl font-semibold"
            style={{ color: 'var(--accelerant-navy)' }}
          >
            Product Intelligence
          </h1>

          <div className="flex items-center gap-4">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accelerant-navy)' }}
            >
              PI
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
