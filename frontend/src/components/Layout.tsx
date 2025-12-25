import { Link, Outlet, useLocation } from 'react-router-dom';
import { FileText, Upload, BarChart3, Settings, ChevronRight } from 'lucide-react';
import accelerantLogo from '../assets/accelerant-logo-transparent.png';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Upload', href: '/upload', icon: Upload },
  { name: 'Contracts', href: '/contracts', icon: FileText },
];

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
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--slate-50)' }}>
      <aside 
        className="w-64 flex flex-col border-r"
        style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--slate-200)' }}
      >
        <div className="p-6 pb-8">
          <img 
            src={accelerantLogo} 
            alt="Accelerant" 
            className="h-10 w-auto"
          />
        </div>
        
        <nav className="flex-1 px-3">
          <div className="space-y-1">
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
                </Link>
              );
            })}
          </div>

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
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header 
          className="h-14 flex items-center justify-between px-8 border-b"
          style={{ backgroundColor: 'white', borderColor: 'var(--slate-200)' }}
        >
          <nav className="flex items-center gap-2 text-sm" style={{ color: 'var(--slate-500)' }}>
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
