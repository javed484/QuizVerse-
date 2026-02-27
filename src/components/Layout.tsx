import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  HelpCircle, 
  FileText, 
  LogOut,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  role: 'admin' | 'student';
}

const Layout: React.FC<LayoutProps> = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const adminNav = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Courses', path: '/admin/courses', icon: BookOpen },
    { name: 'Students', path: '/admin/students', icon: Users },
    { name: 'Questions', path: '/admin/questions', icon: HelpCircle },
    { name: 'Quizzes', path: '/admin/quizzes', icon: FileText },
  ];

  const studentNav = [
    { name: 'Courses', path: '/student', icon: BookOpen },
    { name: 'Results', path: '/student/results', icon: FileText },
  ];

  const navItems = role === 'admin' ? adminNav : studentNav;

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-primary/10 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tighter font-display text-primary">QuizVerse</h1>
          <div className="h-4 w-[1px] bg-primary/10 hidden sm:block" />
          <div className="flex items-center gap-2 text-xs text-primary/40 hidden sm:flex">
            <span className="text-primary font-bold capitalize">
              {location.pathname.split('/').pop() || 'Dashboard'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-primary/40 hover:text-red-500 transition-colors text-xs font-bold uppercase tracking-wider"
          >
            <LogOut size={14} />
            <span className="hidden xs:inline">Logout</span>
          </button>
          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary text-xs font-bold border border-primary/10">
            {role[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-primary/10 z-40 safe-area-bottom">
        <nav className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all duration-200",
                  isActive 
                    ? "text-accent" 
                    : "text-primary/40 hover:text-primary"
                )}
              >
                <item.icon size={20} className={cn(isActive && "animate-in zoom-in-75 duration-300")} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{item.name}</span>
                {isActive && (
                  <div className="w-1 h-1 bg-accent rounded-full mt-0.5" />
                )}
              </Link>
            );
          })}
        </nav>
      </footer>
    </div>
  );
};

export default Layout;
