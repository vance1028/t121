import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  FlaskConical,
  Building2,
  Users,
  EyeOff,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard },
  { to: '/trials', label: '试验管理', icon: FlaskConical },
  { to: '/sites', label: '研究中心', icon: Building2 },
  { to: '/subjects', label: '受试者', icon: Users },
  { to: '/blinding', label: '盲态管理', icon: EyeOff },
];

export default function Layout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-[#1e3a5f] text-white flex flex-col flex-shrink-0 z-30 relative">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-sky-400" />
            <div>
              <h1 className="text-lg font-bold tracking-wide">ClinRand</h1>
              <p className="text-xs text-sky-300/70">随机化与盲态管理</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-300 font-medium'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
