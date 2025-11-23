import React, { useEffect, useState, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Organization, FuelStation, Transaction, TransactionStatus, User, UserRole, Invoice, InvoiceStatus } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PlusCircle, DollarSign, Building2, Settings, AlertTriangle, Users, Trash2, Store, LayoutDashboard, Database, Download, Upload, RefreshCw, FileText } from 'lucide-react';

type AdminTab = 'DASHBOARD' | 'ORGS' | 'STATIONS' | 'USERS' | 'SYSTEM';

export const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [showAddStation, setShowAddStation] = useState(false);
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  const [newStation, setNewStation] = useState<Partial<FuelStation>>({ name: '', cnpj: '', baseFeePercentage: 5, advanceFeePercentage: 2.5 });
  const [newOrg, setNewOrg] = useState<Partial<Organization>>({ name: '', cnpj: '', contactName: '' });
  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', password: '', role: UserRole.FLEET_MANAGER });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); 
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    setStations(storageService.getStations());
    setTransactions(storageService.getTransactions());
    setInvoices(storageService.getInvoices());
    setOrgs(storageService.getOrgs());
    setUsers(storageService.getUsers());
  };

  // --- ACTIONS ---

  const handlePayInvoice = (inv: Invoice) => {
      if(!confirm(`Confirma o pagamento da Fatura #${inv.nfeNumber} no valor líquido de R$ ${inv.netValue.toFixed(2)} ao posto?`)) return;

      const updatedInvoices = storageService.getInvoices().map(i => {
          if (i.id === inv.id) return { ...i, status: InvoiceStatus.PAID };
          return i;
      });

      // Update related transactions to PAID
      const updatedTxs = storageService.getTransactions().map(t => {
          if (inv.transactionIds.includes(t.id)) {
              return { ...t, status: TransactionStatus.PAID, paymentDate: new Date().toISOString() };
          }
          return t;
      });

      // Update Station Balance
      const updatedStations = storageService.getStations().map(s => {
          if (s.id === inv.stationId) {
              return { 
                  ...s, 
                  balanceInvoiced: s.balanceInvoiced - inv.netValue,
                  balancePaid: s.balancePaid + inv.netValue
              };
          }
          return s;
      });

      storageService.updateInvoices(updatedInvoices);
      storageService.updateTransactions(updatedTxs);
      storageService.updateStations(updatedStations);
      refreshData();
  };

  const handleDownloadBackup = () => { 
    const json = storageService.exportDatabase(); 
    const blob = new Blob([json], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = 'frotagov_backup.json'; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
  };

  const handleUploadBackup = (e: any) => { 
    const file = e.target.files?.[0]; 
    if(!file) return; 
    const r = new FileReader(); 
    r.onload = (ev) => { 
      if(storageService.importDatabase(ev.target?.result as string)) {
        alert("Backup restaurado com sucesso!");
        window.location.reload();
      }
    }; 
    r.readAsText(file); 
  };

  const handleResetSystem = () => { 
    if(confirm("ATENÇÃO: Isso apagará TODOS os dados do sistema. Deseja continuar?")) {
      storageService.clearDatabase(); 
    }
  };
  
  const handleAddOrg = () => {
      if (!newOrg.name) return;
      storageService.createOrg({ ...newOrg, id: `org${Date.now()}`, balanceDue: 0, status: 'ACTIVE' } as any);
      setShowAddOrg(false); refreshData();
  };
  const handleAddStation = () => {
      if (!newStation.name) return;
      storageService.addStation({ ...newStation, id: `st${Date.now()}`, balancePending: 0, balanceInvoiced: 0, balancePaid: 0, products: [], status: 'ACTIVE' } as any);
      setShowAddStation(false); refreshData();
  };
  const handleAddUser = () => {
      if (!newUser.username) return;
      storageService.createUser({ ...newUser, id: `u${Date.now()}`, createdAt: new Date().toISOString() } as any);
      setShowAddUser(false); refreshData();
  };
  const handleDeleteUser = (id: string) => { 
    if(confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        storageService.deleteUser(id); 
        refreshData();
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  // KPI
  const totalRevenueFees = transactions.reduce((acc, t) => acc + (t.feeAmount || 0), 0);
  const totalVolume = transactions.reduce((acc, t) => acc + (t.totalValue || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === InvoiceStatus.PENDING_ADMIN);
  
  const revenueData = transactions.filter(t => t.status === TransactionStatus.PAID).reduce((acc: any[], t) => {
      const date = new Date(t.paymentDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const existing = acc.find(d => d.date === date);
      if(existing) existing.fees += t.feeAmount || 0; else acc.push({ date, fees: t.feeAmount || 0 });
      return acc;
  }, []);

  const getRoleLabel = (role: UserRole) => {
    switch(role) {
      case UserRole.SUPER_ADMIN: return 'Super Admin';
      case UserRole.FLEET_MANAGER: return 'Gestor de Frota';
      case UserRole.FUEL_STATION: return 'Posto de Combustível';
      default: return role;
    }
  };

  const tabs = [
    { id: 'DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'ORGS', label: 'Órgãos', icon: Building2 },
    { id: 'STATIONS', label: 'Postos', icon: Store },
    { id: 'USERS', label: 'Usuários', icon: Users },
    { id: 'SYSTEM', label: 'Sistema', icon: Settings }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div><h1 className="text-3xl font-bold text-slate-800">Painel Master (SaaS)</h1><p className="text-slate-500">Administração Geral do Sistema</p></div>
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex overflow-x-auto">
          {tabs.map((tab) => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as AdminTab)} className={`px-4 py-2 rounded-lg flex gap-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><tab.icon size={16} /> {tab.label}</button>
          ))}
        </div>
      </div>

      {activeTab === 'DASHBOARD' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden"><div className="absolute right-0 top-0 p-4 opacity-5"><DollarSign size={80} /></div><p className="text-sm text-slate-500 font-medium mb-1">Receita Líquida (SaaS)</p><p className="text-3xl font-bold text-emerald-600">R$ {totalRevenueFees.toFixed(2)}</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-sm text-slate-500 font-medium mb-1">Transacionado (Bruto)</p><p className="text-3xl font-bold text-slate-800">R$ {totalVolume.toFixed(2)}</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-sm text-slate-500 font-medium mb-1">Órgãos Cadastrados</p><p className="text-3xl font-bold text-blue-600">{orgs.length}</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-sm text-slate-500 font-medium mb-1">Postos Credenciados</p><p className="text-3xl font-bold text-slate-800">{stations.length}</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm"><h3 className="text-lg font-bold mb-6">Evolução da Receita (Taxas)</h3><div className="h-64"><ResponsiveContainer><AreaChart data={revenueData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis/><Tooltip/><Area type="monotone" dataKey="fees" stroke="#10b981" fill="#10b981" fillOpacity={0.2}/></AreaChart></ResponsiveContainer></div></div>

            {/* Pending Payments Widget */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="text-lg font-bold flex gap-2"><AlertTriangle className="text-amber-500"/> Faturas a Pagar</h3><span className="bg-amber-100 text-amber-700 px-2 rounded-full font-bold">{pendingInvoices.length}</span></div>
               <div className="overflow-y-auto flex-1 max-h-[300px]">
                 {pendingInvoices.length === 0 ? <p className="text-center py-8 text-slate-400">Nenhuma fatura pendente.</p> : 
                   <table className="w-full text-left text-xs">
                     <thead className="bg-slate-50 text-slate-400 uppercase"><tr><th className="px-4 py-2">Posto / NFe</th><th className="px-4 py-2 text-right">Valor Líquido</th><th className="px-4 py-2"></th></tr></thead>
                     <tbody>
                       {pendingInvoices.map(inv => (
                            <tr key={inv.id} className="border-b border-slate-50">
                              <td className="px-4 py-3">
                                  <div className="font-bold">{stations.find(s=>s.id===inv.stationId)?.name}</div>
                                  <div className="text-slate-500">NF: {inv.nfeNumber}</div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-700">R$ {inv.netValue.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right"><button onClick={() => handlePayInvoice(inv)} className="text-emerald-600 font-bold hover:underline">Pagar</button></td>
                            </tr>
                       ))}
                     </tbody>
                   </table>
                 }
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ORGS' && (
        <div>
           <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">Órgãos Públicos</h2><button onClick={()=>setShowAddOrg(true)} className="bg-blue-600 text-white px-4 py-2 rounded flex gap-2"><PlusCircle/> Adicionar</button></div>
           <div className="bg-white rounded-2xl p-4 shadow-sm">
               {orgs.length === 0 ? <p className="p-4 text-center text-slate-400">Nenhum órgão cadastrado.</p> :
                 orgs.map(o => <div key={o.id} className="border-b p-4 flex justify-between"><div><div className="font-bold">{o.name}</div><div className="text-sm">CNPJ: {o.cnpj}</div></div><div className="text-sm font-bold text-slate-500">Saldo Devedor: R$ {o.balanceDue.toFixed(2)}</div></div>)
               }
           </div>
        </div>
      )}
      
      {activeTab === 'STATIONS' && (
        <div>
           <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">Postos de Combustível</h2><button onClick={()=>setShowAddStation(true)} className="bg-emerald-600 text-white px-4 py-2 rounded flex gap-2"><PlusCircle/> Adicionar</button></div>
           <div className="grid grid-cols-2 gap-4">
              {stations.length === 0 ? <p className="col-span-2 p-4 text-center text-slate-400">Nenhum posto cadastrado.</p> :
                stations.map(s => <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="font-bold">{s.name}</div><div className="text-sm text-slate-500">Taxa Base: {s.baseFeePercentage}%</div></div>)
              }
           </div>
        </div>
      )}

      {activeTab === 'USERS' && (
        <div>
           <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">Usuários do Sistema</h2><button onClick={()=>setShowAddUser(true)} className="bg-slate-800 text-white px-4 py-2 rounded flex gap-2"><PlusCircle/> Adicionar</button></div>
           <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
             <table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr><th className="p-4">Nome</th><th className="p-4">Perfil (Role)</th><th className="p-4">Ação</th></tr></thead><tbody>
               {users.map(u => <tr key={u.id} className="border-b"><td className="p-4">{u.name}</td><td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{getRoleLabel(u.role)}</span></td><td className="p-4"><button onClick={()=>handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button></td></tr>)}
             </tbody></table>
           </div>
        </div>
      )}

      {activeTab === 'SYSTEM' && (
         <div className="space-y-6">
            <h2 className="text-xl font-bold">Configurações do Sistema</h2>
            <div className="grid grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100"><h3 className="font-bold mb-2 flex gap-2"><Download size={18}/> Backup de Dados</h3><p className="text-sm text-slate-400 mb-4">Baixe uma cópia completa do banco de dados.</p><button onClick={handleDownloadBackup} className="bg-blue-50 text-blue-700 hover:bg-blue-100 w-full py-2 rounded font-bold">Baixar JSON</button></div>
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100"><h3 className="font-bold mb-2 flex gap-2"><Upload size={18}/> Restaurar Dados</h3><p className="text-sm text-slate-400 mb-4">Carregue um arquivo de backup (.json).</p><input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadBackup} accept=".json"/><button onClick={()=>fileInputRef.current?.click()} className="bg-slate-800 text-white hover:bg-slate-900 w-full py-2 rounded font-bold">Enviar JSON</button></div>
            </div>
            <div className="bg-red-50 p-6 rounded-xl border border-red-100"><h3 className="font-bold text-red-800 mb-2">Zona de Perigo</h3><p className="text-sm text-red-600 mb-4">Resetar o banco de dados apagará todas as informações.</p><button onClick={handleResetSystem} className="text-red-600 bg-white border border-red-200 px-4 py-2 rounded hover:bg-red-50 font-bold flex gap-2 items-center"><RefreshCw size={16}/> Resetar Tudo</button></div>
         </div>
      )}

      {/* Modals */}
      {showAddOrg && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-xl w-96 shadow-2xl"><h3 className="font-bold mb-4 text-lg">Novo Órgão</h3><input className="border w-full p-2 mb-2 rounded" placeholder="Nome do Órgão" value={newOrg.name} onChange={e=>setNewOrg({...newOrg, name: e.target.value})}/><input className="border w-full p-2 mb-2 rounded" placeholder="CNPJ" value={newOrg.cnpj} onChange={e=>setNewOrg({...newOrg, cnpj: e.target.value})}/><button onClick={handleAddOrg} className="bg-blue-600 text-white px-4 py-2 rounded w-full font-bold mt-2">Salvar</button><button onClick={()=>setShowAddOrg(false)} className="mt-2 text-sm w-full text-slate-500">Cancelar</button></div></div>}
      
      {showAddStation && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-xl w-96 shadow-2xl"><h3 className="font-bold mb-4 text-lg">Novo Posto</h3><input className="border w-full p-2 mb-2 rounded" placeholder="Nome Fantasia" value={newStation.name} onChange={e=>setNewStation({...newStation, name: e.target.value})}/><input className="border w-full p-2 mb-2 rounded" placeholder="CNPJ" value={newStation.cnpj} onChange={e=>setNewStation({...newStation, cnpj: e.target.value})}/><label className="text-xs font-bold text-slate-500">Taxa Administrativa (%)</label><input className="border w-full p-2 mb-2 rounded" placeholder="Taxa %" type="number" value={newStation.baseFeePercentage} onChange={e=>setNewStation({...newStation, baseFeePercentage: Number(e.target.value)})}/><button onClick={handleAddStation} className="bg-emerald-600 text-white px-4 py-2 rounded w-full font-bold mt-2">Salvar</button><button onClick={()=>setShowAddStation(false)} className="mt-2 text-sm w-full text-slate-500">Cancelar</button></div></div>}

      {showAddUser && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-xl w-96 shadow-2xl"><h3 className="font-bold mb-4 text-lg">Novo Usuário</h3><input className="border w-full p-2 mb-2 rounded" placeholder="Nome Completo" value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})}/><input className="border w-full p-2 mb-2 rounded" placeholder="Login (Usuário)" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})}/><input className="border w-full p-2 mb-2 rounded" placeholder="Senha" type="password" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})}/><label className="text-xs font-bold text-slate-500">Perfil de Acesso</label><select className="border w-full p-2 mb-2 rounded bg-white" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value as any})}><option value="FLEET_MANAGER">Gestor de Frota</option><option value="FUEL_STATION">Posto de Combustível</option><option value="SUPER_ADMIN">Administrador Master</option></select>
          {(newUser.role === 'FLEET_MANAGER') && <select className="border w-full p-2 mb-2 rounded bg-white" onChange={e=>setNewUser({...newUser, orgId: e.target.value})}><option value="">Selecione o Órgão...</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>}
          {(newUser.role === 'FUEL_STATION') && <select className="border w-full p-2 mb-2 rounded bg-white" onChange={e=>setNewUser({...newUser, stationId: e.target.value})}><option value="">Selecione o Posto...</option>{stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      <button onClick={handleAddUser} className="bg-blue-600 text-white px-4 py-2 rounded w-full font-bold mt-2">Salvar</button><button onClick={()=>setShowAddUser(false)} className="mt-2 text-sm w-full text-slate-500">Cancelar</button></div></div>}

    </div>
  );
};