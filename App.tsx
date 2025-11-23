
import React, { useState, useEffect } from 'react';
import { UserRole, User } from './types';
import { storageService } from './services/storageService';
import { SuperAdminDashboard } from './views/SuperAdminDashboard';
import { FleetManagerDashboard } from './views/FleetManagerDashboard';
import { FuelStationDashboard } from './views/FuelStationDashboard';
import { Login } from './views/Login';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LogOut, Fuel, Car, LayoutDashboard } from 'lucide-react';

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
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {user && (
          <header className="bg-primary text-white shadow-lg sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="bg-secondary p-1.5 rounded-lg">
                  <Fuel size={24} className="text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight">FrotaGov<span className="text-secondary">SaaS</span></span>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-slate-400">{user.role === UserRole.SUPER_ADMIN ? 'Super Admin' : user.role === UserRole.FLEET_MANAGER ? 'Gestor Público' : 'Gerente Posto'}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                  aria-label="Sair"
                  title="Sair do sistema"
                >
                  <LogOut size={20} />
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

        <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
           <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
             © 2024 FrotaGov SaaS - Tecnologia para Gestão Pública Eficiente
           </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
