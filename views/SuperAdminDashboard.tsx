
import React, { useEffect, useState, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Organization, FuelStation, Transaction, TransactionStatus, User, UserRole } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PlusCircle, DollarSign, Building2, Settings, AlertTriangle, Users, Trash2, Store, LayoutDashboard, Database, Download, Upload, RefreshCw } from 'lucide-react';

type AdminTab = 'DASHBOARD' | 'ORGS' | 'STATIONS' | 'USERS' | 'SYSTEM';

export const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  
  // Data State
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Forms State
  const [showAddStation, setShowAddStation] = useState(false);
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  // New Entity States
  const [newStation, setNewStation] = useState<Partial<FuelStation>>({ name: '', cnpj: '', baseFeePercentage: 5, advanceFeePercentage: 2.5 });
  const [newOrg, setNewOrg] = useState<Partial<Organization>>({ name: '', cnpj: '', contactName: '' });
  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', password: '', role: UserRole.FLEET_MANAGER });

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); // Live updates
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    setStations(storageService.getStations());
    setTransactions(storageService.getTransactions());
    setOrgs(storageService.getOrgs());
    setUsers(storageService.getUsers());
  };

  // --- SYSTEM ACTIONS ---

  const handleDownloadBackup = () => {
    const json = storageService.exportDatabase();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frotagov_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUploadBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (storageService.importDatabase(content)) {
        alert("Backup restaurado com sucesso! A página será recarregada.");
        window.location.reload();
      } else {
        alert("Erro ao restaurar backup. Verifique se o arquivo é válido.");
      }
    };
    reader.readAsText(file);
  };

  const handleResetSystem = () => {
    if(confirm("ATENÇÃO: Isso apagará TODOS os dados (Usuários, Transações, Postos). Deseja continuar?")) {
        if(confirm("Tem certeza absoluta? Essa ação é irreversível.")) {
            storageService.clearDatabase();
        }
    }
  }

  // --- CRUD ACTIONS ---

  const handleAddOrg = () => {
    if (!newOrg.name || !newOrg.cnpj) return alert("Preencha os campos obrigatórios");
    const org: Organization = {
      id: `org${Date.now()}`,
      name: newOrg.name!,
      cnpj: newOrg.cnpj!,
      address: newOrg.address || '',
      contactName: newOrg.contactName || '',
      contactPhone: newOrg.contactPhone || '',
      balanceDue: 0,
      status: 'ACTIVE'
    };
    storageService.createOrg(org);
    setShowAddOrg(false);
    setNewOrg({ name: '', cnpj: '' });
    refreshData();
  };

  const handleAddStation = () => {
    if (!newStation.name || !newStation.cnpj) return alert("Preencha os campos obrigatórios");
    const station: FuelStation = {
      id: `st${Date.now()}`,
      name: newStation.name!,
      cnpj: newStation.cnpj!,
      address: newStation.address || '',
      contactName: newStation.contactName || '',
      baseFeePercentage: Math.max(1.5, Math.min(15, newStation.baseFeePercentage || 5)),
      advanceFeePercentage: newStation.advanceFeePercentage || 2,
      balancePending: 0,
      balanceInvoiced: 0,
      balancePaid: 0,
      products: [],
      status: 'ACTIVE'
    };
    storageService.addStation(station);
    setShowAddStation(false);
    setNewStation({ name: '', cnpj: '', baseFeePercentage: 5 });
    refreshData();
  };

  const handleAddUser = () => {
    if(!newUser.name || !newUser.username || !newUser.password) return alert("Preencha todos os campos");
    
    // Validation: Manager needs Org, Station needs Station
    if (newUser.role === UserRole.FLEET_MANAGER && !newUser.orgId) return alert("Selecione o Órgão para este gestor.");
    if (newUser.role === UserRole.FUEL_STATION && !newUser.stationId) return alert("Selecione o Posto para este usuário.");

    try {
      storageService.createUser({
        id: `u${Date.now()}`,
        name: newUser.name!,
        username: newUser.username!,
        password: newUser.password!,
        role: newUser.role!,
        orgId: newUser.orgId,
        stationId: newUser.stationId,
        createdAt: new Date().toISOString()
      });
      setShowAddUser(false);
      setNewUser({ name: '', username: '', password: '', role: UserRole.FLEET_MANAGER });
      refreshData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteUser = (id: string) => {
    if(confirm('Tem certeza que deseja remover este usuário?')) {
      try {
        storageService.deleteUser(id);
        refreshData();
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const handleApprovePayment = (txIds: string[]) => {
    if(!confirm(`Confirma o pagamento de ${txIds.length} transações?`)) return;

    const allTxs = storageService.getTransactions();
    const updatedTxs = allTxs.map(t => {
      if (txIds.includes(t.id)) {
        return { ...t, status: TransactionStatus.PAID, paymentDate: new Date().toISOString() };
      }
      return t;
    });

    storageService.updateTransactions(updatedTxs);
    
    // Update station paid balances
    const stationUpdates = new Map<string, number>();
    updatedTxs.filter(t => txIds.includes(t.id)).forEach(t => {
        const val = t.netValue || 0;
        stationUpdates.set(t.stationId, (stationUpdates.get(t.stationId) || 0) + val);
    });

    const updatedStations = storageService.getStations().map(s => {
      if (stationUpdates.has(s.id)) {
        const justPaid = stationUpdates.get(s.id) || 0;
        return { 
          ...s, 
          balanceInvoiced: s.balanceInvoiced - justPaid,
          balancePaid: s.balancePaid + justPaid
        };
      }
      return s;
    });

    storageService.updateStations(updatedStations);
    refreshData();
  };

  // --- KPIs Calculations ---
  const totalRevenueFees = transactions.reduce((acc, t) => acc + (t.feeAmount || 0), 0);
  const totalVolume = transactions.reduce((acc, t) => acc + (t.totalValue || 0), 0);
  const pendingApprovals = transactions.filter(t => t.status === TransactionStatus.INVOICED || t.status === TransactionStatus.ADVANCE_REQUESTED);
  
  const revenueData = transactions
    .filter(t => t.status === TransactionStatus.PAID)
    .reduce((acc: any[], t) => {
      const date = new Date(t.paymentDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const existing = acc.find(d => d.date === date);
      if (existing) existing.fees += t.feeAmount || 0;
      else acc.push({ date, fees: t.feeAmount || 0 });
      return acc;
    }, []).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-20">
      
      {/* Header & Nav */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Painel Master (SaaS)</h1>
          <p className="text-slate-500">Administração de Tenants, Usuários e Finanças</p>
        </div>
        
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex overflow-x-auto max-w-full">
          {[
            { id: 'DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
            { id: 'ORGS', label: 'Órgãos', icon: Building2 },
            { id: 'STATIONS', label: 'Postos', icon: Store },
            { id: 'USERS', label: 'Usuários', icon: Users },
            { id: 'SYSTEM', label: 'Sistema', icon: Settings },
          ].map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as AdminTab)}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <tab.icon size={16} /> {tab.label}
             </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
               <div className="absolute right-0 top-0 p-4 opacity-5"><DollarSign size={80} /></div>
               <p className="text-sm text-slate-500 font-medium mb-1">Receita Líquida (SaaS)</p>
               <p className="text-3xl font-bold text-emerald-600">R$ {totalRevenueFees.toFixed(2)}</p>
               <div className="mt-2 text-xs text-emerald-600 bg-emerald-50 inline-block px-2 py-1 rounded">+ Taxas acumuladas</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <p className="text-sm text-slate-500 font-medium mb-1">Transacionado (Bruto)</p>
               <p className="text-3xl font-bold text-slate-800">R$ {totalVolume.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <p className="text-sm text-slate-500 font-medium mb-1">Órgãos Cadastrados</p>
               <p className="text-3xl font-bold text-blue-600">{orgs.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <p className="text-sm text-slate-500 font-medium mb-1">Rede de Postos</p>
               <p className="text-3xl font-bold text-slate-800">{stations.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-700 mb-6">Receita de Taxas (Evolução)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Area type="monotone" dataKey="fees" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorFees)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pending Payments */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" size={20} /> Pagamentos
                 </h3>
                 <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{pendingApprovals.length}</span>
               </div>
               <div className="overflow-y-auto flex-1 p-0 max-h-[300px]">
                 {pendingApprovals.length === 0 ? (
                   <p className="text-center text-slate-400 py-8 text-sm">Nenhum pagamento pendente.</p>
                 ) : (
                   <table className="w-full text-left text-xs">
                     <thead className="bg-slate-50 text-slate-400 uppercase">
                       <tr>
                         <th className="px-4 py-2">Posto</th>
                         <th className="px-4 py-2 text-right">Valor Líquido</th>
                         <th className="px-4 py-2"></th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {pendingApprovals.map(t => {
                          const s = stations.find(st => st.id === t.stationId);
                          return (
                            <tr key={t.id}>
                              <td className="px-4 py-3">{s?.name}</td>
                              <td className="px-4 py-3 text-right font-bold">R$ {t.netValue?.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right">
                                <button onClick={() => handleApprovePayment([t.id])} className="text-emerald-600 hover:text-emerald-800 font-bold">Pagar</button>
                              </td>
                            </tr>
                          );
                       })}
                     </tbody>
                   </table>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ORGS TAB */}
      {activeTab === 'ORGS' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold text-slate-700">Órgãos Públicos (Clientes)</h2>
             <button onClick={() => setShowAddOrg(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"><PlusCircle size={18}/> Novo Órgão</button>
           </div>
           
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <table className="w-full text-left text-sm text-slate-600">
               <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
                 <tr>
                   <th className="px-6 py-4">Nome / CNPJ</th>
                   <th className="px-6 py-4">Contato</th>
                   <th className="px-6 py-4">Faturas em Aberto</th>
                   <th className="px-6 py-4">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {orgs.map(org => (
                   <tr key={org.id} className="hover:bg-slate-50">
                     <td className="px-6 py-4">
                       <div className="font-bold text-slate-800">{org.name}</div>
                       <div className="text-xs text-slate-400">{org.cnpj}</div>
                     </td>
                     <td className="px-6 py-4">{org.contactName}</td>
                     <td className="px-6 py-4 font-mono text-slate-700">R$ {org.balanceDue.toFixed(2)}</td>
                     <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">ATIVO</span></td>
                   </tr>
                 ))}
                 {orgs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-400">Nenhum órgão cadastrado.</td></tr>}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* STATIONS TAB */}
      {activeTab === 'STATIONS' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold text-slate-700">Rede Credenciada (Postos)</h2>
             <button onClick={() => setShowAddStation(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"><PlusCircle size={18}/> Novo Posto</button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stations.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-200 transition-colors">
                   <div className="flex justify-between items-start mb-4">
                      <div className="bg-emerald-50 p-2 rounded-lg"><Store className="text-emerald-600" /></div>
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">{s.baseFeePercentage}% Taxa</span>
                   </div>
                   <h3 className="font-bold text-slate-800">{s.name}</h3>
                   <p className="text-xs text-slate-400 mb-4">{s.cnpj}</p>
                   
                   <div className="space-y-2 text-sm border-t border-slate-50 pt-4">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Saldo Pendente</span>
                        <span className="font-medium">R$ {s.balancePending.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Taxa Adiant.</span>
                        <span className="font-medium text-amber-600">+{s.advanceFeePercentage}%</span>
                      </div>
                   </div>
                </div>
              ))}
              {stations.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400">Nenhum posto cadastrado.</div>}
           </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'USERS' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold text-slate-700">Gestão de Acessos</h2>
             <button onClick={() => setShowAddUser(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"><PlusCircle size={18}/> Novo Usuário</button>
           </div>
           
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <table className="w-full text-left text-sm text-slate-600">
               <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
                 <tr>
                   <th className="px-6 py-4">Usuário</th>
                   <th className="px-6 py-4">Função</th>
                   <th className="px-6 py-4">Vínculo (Órgão/Posto)</th>
                   <th className="px-6 py-4 text-center">Ações</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {users.map(u => {
                   const entityName = u.orgId ? orgs.find(o => o.id === u.orgId)?.name : u.stationId ? stations.find(s => s.id === u.stationId)?.name : '-';
                   return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{u.name}</div>
                        <div className="text-xs text-slate-400">@{u.username}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-700' : u.role === UserRole.FLEET_MANAGER ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {u.role === UserRole.SUPER_ADMIN ? 'ADMIN' : u.role === UserRole.FLEET_MANAGER ? 'GESTOR' : 'POSTO'}
                        </span>
                      </td>
                      <td className="px-6 py-4 truncate max-w-xs" title={entityName}>{entityName || 'Acesso Global'}</td>
                      <td className="px-6 py-4 text-center">
                        {u.role !== UserRole.SUPER_ADMIN && (
                          <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                        )}
                      </td>
                    </tr>
                   )
                 })}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* SYSTEM (BACKUP) TAB */}
      {activeTab === 'SYSTEM' && (
         <div className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2"><Database className="text-slate-400" /> Banco de Dados & Segurança</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                     <Download className="text-blue-500" size={20} /> Backup (Exportar)
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">
                    Baixe uma cópia completa de todos os usuários, postos, veículos e transações. 
                    Recomendamos fazer isso regularmente para garantir que seus dados estejam seguros.
                  </p>
                  <button onClick={handleDownloadBackup} className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl font-bold border border-blue-100 hover:bg-blue-100 transition-colors">
                    Baixar Arquivo JSON
                  </button>
               </div>

               <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                     <Upload className="text-emerald-500" size={20} /> Restaurar (Importar)
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">
                    Carregue um arquivo de backup (`.json`) para restaurar o estado anterior do sistema.
                    <span className="block mt-2 text-amber-600 font-medium text-xs">⚠️ Isso substituirá os dados atuais.</span>
                  </p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json" 
                    onChange={handleUploadBackup}
                  />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors">
                    Selecionar Arquivo de Backup
                  </button>
               </div>
            </div>

            <div className="bg-red-50 p-6 rounded-xl border border-red-100 mt-8">
               <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2"><AlertTriangle size={18} /> Zona de Perigo</h3>
               <p className="text-red-600 text-sm mb-4">Esta ação apagará todo o armazenamento local e reiniciará o sistema do zero (Fábrica).</p>
               <button onClick={handleResetSystem} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 flex items-center gap-2">
                 <RefreshCw size={14} /> Resetar Tudo (Fábrica)
               </button>
            </div>
         </div>
      )}

      {/* --- MODALS --- */}
      
      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4">Criar Novo Usuário</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Nome Completo" className="w-full border p-2 rounded-lg" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Login" className="w-full border p-2 rounded-lg" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                  <input type="password" placeholder="Senha" className="w-full border p-2 rounded-lg" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
                
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Perfil</label>
                   <select className="w-full border p-2 rounded-lg" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole, orgId: undefined, stationId: undefined})}>
                     <option value={UserRole.FLEET_MANAGER}>Gestor de Frota (Órgão)</option>
                     <option value={UserRole.FUEL_STATION}>Gerente de Posto</option>
                     <option value={UserRole.SUPER_ADMIN}>Super Admin (SaaS)</option>
                   </select>
                </div>

                {newUser.role === UserRole.FLEET_MANAGER && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Vincular a Órgão</label>
                    <select className="w-full border p-2 rounded-lg" value={newUser.orgId || ''} onChange={e => setNewUser({...newUser, orgId: e.target.value})}>
                      <option value="">Selecione...</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                )}

                {newUser.role === UserRole.FUEL_STATION && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Vincular a Posto</label>
                    <select className="w-full border p-2 rounded-lg" value={newUser.stationId || ''} onChange={e => setNewUser({...newUser, stationId: e.target.value})}>
                      <option value="">Selecione...</option>
                      {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                   <button onClick={() => setShowAddUser(false)} className="flex-1 bg-slate-100 py-2 rounded-lg">Cancelar</button>
                   <button onClick={handleAddUser} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">Criar Acesso</button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Add Org Modal */}
      {showAddOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4">Cadastrar Órgão Público</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Nome do Órgão / Prefeitura" className="w-full border p-2 rounded-lg" value={newOrg.name} onChange={e => setNewOrg({...newOrg, name: e.target.value})} />
                <input type="text" placeholder="CNPJ" className="w-full border p-2 rounded-lg" value={newOrg.cnpj} onChange={e => setNewOrg({...newOrg, cnpj: e.target.value})} />
                <input type="text" placeholder="Nome do Responsável" className="w-full border p-2 rounded-lg" value={newOrg.contactName} onChange={e => setNewOrg({...newOrg, contactName: e.target.value})} />
                <div className="flex gap-2 pt-4">
                   <button onClick={() => setShowAddOrg(false)} className="flex-1 bg-slate-100 py-2 rounded-lg">Cancelar</button>
                   <button onClick={handleAddOrg} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">Salvar</button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Add Station Modal */}
      {showAddStation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4">Novo Posto Parceiro</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Nome Fantasia" className="w-full border p-2 rounded-lg" value={newStation.name} onChange={e => setNewStation({...newStation, name: e.target.value})} />
                <input type="text" placeholder="CNPJ" className="w-full border p-2 rounded-lg" value={newStation.cnpj} onChange={e => setNewStation({...newStation, cnpj: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-bold">Taxa Base (%)</label>
                    <input type="number" className="w-full border p-2 rounded-lg" value={newStation.baseFeePercentage} onChange={e => setNewStation({...newStation, baseFeePercentage: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold">Taxa Adiant. (%)</label>
                    <input type="number" className="w-full border p-2 rounded-lg" value={newStation.advanceFeePercentage} onChange={e => setNewStation({...newStation, advanceFeePercentage: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                   <button onClick={() => setShowAddStation(false)} className="flex-1 bg-slate-100 py-2 rounded-lg">Cancelar</button>
                   <button onClick={handleAddStation} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold">Salvar</button>
                </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
