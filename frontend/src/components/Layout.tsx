import { Link, Outlet, useLocation } from 'react-router-dom';
import { FileText, Upload, BarChart3, Settings, Building2, ChevronRight } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--slate-50)' }}>
      <header 
        className="h-[57px] flex items-center justify-between px-6 border-b"
        style={{ backgroundColor: 'white', borderColor: 'var(--slate-200)' }}
      >
        <div className="flex items-center">
          <Building2 className="h-7 w-7" style={{ color: 'var(--accelerant-blue)' }} />
          <span 
            className="ml-2 text-lg font-semibold tracking-tight"
            style={{ color: 'var(--slate-900)' }}
          >
            Product Intelligence
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className="text-sm font-medium transition-colors"
                style={{ 
                  color: isActive ? 'var(--accelerant-blue)' : 'var(--slate-600)',
                }}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <button 
            className="p-2 rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: 'var(--slate-500)' }}
          >
            <Settings className="h-5 w-5" />
          </button>
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accelerant-blue)' }}
          >
            PI
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside 
          className="w-64 border-r hidden lg:block"
          style={{ backgroundColor: 'white', borderColor: 'var(--slate-200)' }}
        >
          <nav className="p-4 space-y-1">
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

            <div className="pt-8">
              <p 
                className="px-3 text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--slate-400)' }}
              >
                Settings
              </p>
              <div className="mt-2">
                <Link
                  to="#"
                  className="sidebar-item"
                  style={{ color: 'var(--slate-600)' }}
                >
                  <Settings className="h-5 w-5 mr-3" />
                  Configuration
                </Link>
              </div>
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
