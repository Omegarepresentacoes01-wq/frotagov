
import React, { useState, useEffect } from 'react';
import { UserRole, User } from './types';
import { storageService } from './services/storageService';
import { SuperAdminDashboard } from './views/SuperAdminDashboard';
import { FleetManagerDashboard } from './views/FleetManagerDashboard';
import { FuelStationDashboard } from './views/FuelStationDashboard';
import { Login } from './views/Login';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LogOut, Fuel, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    storageService.init();
    const session = storageService.getSession();
    if (session) {
      setUser(session);
    }
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        {user && (
          <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-xl shadow-lg shadow-blue-500/20 text-white">
                  <Fuel size={20} strokeWidth={3} />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-slate-800 leading-tight">FrotaGov</h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">SaaS</span>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-semibold text-slate-700">{user.name}</span>
                  <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full w-fit ml-auto">
                    {user.role === UserRole.SUPER_ADMIN ? 'Super Admin' : user.role === UserRole.FLEET_MANAGER ? 'Gestor Público' : 'Posto Credenciado'}
                  </span>
                </div>
                <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors text-sm font-medium group"
                >
                  <span className="hidden md:inline group-hover:underline decoration-red-200 underline-offset-4">Sair</span>
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </header>
        )}

        <main className="flex-grow">
          <Routes>
            <Route 
              path="/" 
              element={
                !user ? <Login onLogin={handleLogin} /> : 
                user.role === UserRole.SUPER_ADMIN ? <Navigate to="/admin" /> :
                user.role === UserRole.FLEET_MANAGER ? <Navigate to="/manager" /> :
                <Navigate to="/station" />
              } 
            />
            
            <Route 
              path="/admin" 
              element={user?.role === UserRole.SUPER_ADMIN ? <SuperAdminDashboard /> : <Navigate to="/" />} 
            />
            <Route 
              path="/manager" 
              element={user?.role === UserRole.FLEET_MANAGER ? <FleetManagerDashboard user={user} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/station" 
              element={user?.role === UserRole.FUEL_STATION ? <FuelStationDashboard user={user} /> : <Navigate to="/" />} 
            />
          </Routes>
        </main>

        <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
           <div className="max-w-7xl mx-auto px-4 text-center">
             <p className="text-sm text-slate-500 font-medium">© 2025 FrotaGov SaaS</p>
             <p className="text-xs text-slate-400 mt-1">Tecnologia para Gestão Pública Eficiente</p>
           </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
