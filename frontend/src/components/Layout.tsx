import { Link, Outlet, useLocation } from 'react-router-dom';
import { FileText, Upload, BarChart3, Settings, ChevronRight, Bell, Users } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Contracts', href: '/contracts', icon: FileText },
  { name: 'Upload', href: '/upload', icon: Upload },
];

const AccelerantLogo = () => (
  <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 28C8 28 12 24 18 22C24 20 32 20 32 20" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round"/>
    <path d="M12 22C12 22 16 18 22 16C28 14 36 14 36 14" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round"/>
    <path d="M4 34C4 34 8 30 14 28C20 26 28 26 28 26" stroke="#10B981" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export default function Layout() {
  const location = useLocation();

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/') return [{ name: 'Dashboard', href: '/' }];
    if (path === '/upload') return [{ name: 'Dashboard', href: '/' }, { name: 'Upload', href: '/upload' }];
    if (path === '/contracts') return [{ name: 'Dashboard', href: '/' }, { name: 'Contracts', href: '/contracts' }];
    if (path.startsWith('/contracts/')) return [
      { name: 'Dashboard', href: '/' },
      { name: 'Contracts', href: '/contracts' },
      { name: 'Contract Details', href: path }
    ];
    if (path.startsWith('/extractions/')) return [
      { name: 'Dashboard', href: '/' },
      { name: 'Contracts', href: '/contracts' },
      { name: 'Extraction Results', href: path }
    ];
    return [{ name: 'Dashboard', href: '/' }];
  };

  const breadcrumb = getBreadcrumb();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--slate-50)' }}>
      <header 
        className="h-[57px] flex items-center justify-between px-6 border-b"
        style={{ backgroundColor: 'white', borderColor: 'var(--slate-200)' }}
      >
        <div className="flex items-center lg:invisible">
          <AccelerantLogo />
          <span 
            className="ml-2 text-lg font-bold tracking-wide"
            style={{ color: 'var(--slate-800)' }}
          >
            ACCELERANT
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            className="p-2 rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: 'var(--slate-500)' }}
          >
            <Bell className="h-5 w-5" />
          </button>
          <div 
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white"
            style={{ backgroundColor: '#10B981' }}
          >
            PI
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside 
          className="w-64 border-r hidden lg:flex lg:flex-col"
          style={{ backgroundColor: 'white', borderColor: 'var(--slate-200)' }}
        >
          <div className="p-5 flex items-center">
            <AccelerantLogo />
            <span 
              className="ml-2 text-lg font-bold tracking-wide"
              style={{ color: 'var(--slate-800)' }}
            >
              ACCELERANT
            </span>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                  <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                </Link>
              );
            })}

            <div className="pt-6">
              <p 
                className="px-3 py-2 text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--slate-400)' }}
              >
                Admin
              </p>
              <Link
                to="#"
                className="sidebar-item"
                style={{ color: 'var(--slate-600)' }}
              >
                <Users className="h-5 w-5 mr-3" />
                Users
              </Link>
              <Link
                to="#"
                className="sidebar-item"
                style={{ color: 'var(--slate-600)' }}
              >
                <Settings className="h-5 w-5 mr-3" />
                Settings
              </Link>
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <nav className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--slate-500)' }}>
            {breadcrumb.map((item, index) => (
              <div key={item.href} className="flex items-center gap-2">
                {index > 0 && <ChevronRight className="h-4 w-4" style={{ color: 'var(--slate-400)' }} />}
                <Link 
                  to={item.href}
                  className="hover:underline"
                  style={{ 
                    color: index === breadcrumb.length - 1 ? 'var(--slate-900)' : 'var(--slate-500)',
                    fontWeight: index === breadcrumb.length - 1 ? 500 : 400
                  }}
                >
                  {item.name}
                </Link>
              </div>
            ))}
          </nav>
          
          <Outlet />
        </main>
      </div>
    </div>
  );
}
