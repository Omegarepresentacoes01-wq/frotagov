
import React, { useEffect, useState, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Organization, FuelStation, Transaction, TransactionStatus, User, UserRole, Invoice, InvoiceStatus } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PlusCircle, DollarSign, Building2, Settings, AlertTriangle, Users, Trash2, Store, LayoutDashboard, Database, Download, Upload, RefreshCw, FileText, ExternalLink, ShieldCheck } from 'lucide-react';

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
    const interval = setInterval(refreshData, 2000); // Poll faster to catch manager approvals
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
          if (inv.transactionIds && inv.transactionIds.includes(t.id)) {
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
      alert("Fatura Paga! O saldo foi transferido para o Posto.");
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
        <div><h1 className="text-3xl font-bold text-slate-800 tracking-tight">Painel Master</h1><p className="text-slate-500 mt-1 flex items-center gap-2"><ShieldCheck size={16} className="text-blue-500"/> Administração Geral do SaaS</p></div>
        <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 flex overflow-x-auto">
          {tabs.map((tab) => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as AdminTab)} className={`px-5 py-2.5 rounded-lg flex gap-2 text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}><tab.icon size={18} /> {tab.label}</button>
          ))}
        </div>
      </div>

      {activeTab === 'DASHBOARD' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 relative overflow-hidden"><div className="absolute right-0 top-0 p-8 opacity-5"><DollarSign size={100} /></div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Receita Líquida (SaaS)</p><p className="text-3xl font-black text-emerald-600">R$ {totalRevenueFees.toFixed(2)}</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transacionado (Bruto)</p><p className="text-3xl font-black text-slate-800">R$ {totalVolume.toFixed(2)}</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Órgãos Cadastrados</p><p className="text-3xl font-black text-blue-600">{orgs.length}</p></div>
            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Postos Credenciados</p><p className="text-3xl font-black text-slate-800">{stations.length}</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-soft border border-slate-100"><h3 className="text-lg font-bold mb-8 text-slate-800">Evolução da Receita (Taxas)</h3><div className="h-64"><ResponsiveContainer><AreaChart data={revenueData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} /><Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} /><Area type="monotone" dataKey="fees" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={3} /></AreaChart></ResponsiveContainer></div></div>

            {/* Pending Payments Widget */}
            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 flex flex-col">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="text-lg font-bold flex gap-2 items-center text-slate-800"><AlertTriangle className="text-amber-500" size={20}/> Faturas a Pagar</h3><span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-bold text-xs">{pendingInvoices.length}</span></div>
               <div className="overflow-y-auto flex-1 max-h-[300px] p-2">
                 {pendingInvoices.length === 0 ? <p className="text-center py-12 text-slate-400 font-medium">Nenhuma fatura pendente de pagamento.</p> : 
                   <table className="w-full text-left text-xs">
                     <thead className="bg-slate-50 text-slate-400 uppercase font-bold"><tr><th className="px-4 py-3 rounded-l-lg">Posto / NFe</th><th className="px-4 py-3 text-right">Valor Líquido</th><th className="px-4 py-3 rounded-r-lg"></th></tr></thead>
                     <tbody>
                       {pendingInvoices.map(inv => (
                            <tr key={inv.id} className="border-b border-slate-50 last:border-0 group hover:bg-slate-50">
                              <td className="px-4 py-4">
                                  <div className="font-bold text-slate-800 text-sm">{stations.find(s=>s.id===inv.stationId)?.name}</div>
                                  <div className="text-slate-500 flex gap-2 items-center mt-1">
                                     <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">NF: {inv.nfeNumber}</span>
                                     {inv.nfeFileUrl && <button onClick={() => alert('Visualizando arquivo: ' + inv.nfeFileUrl)} className="text-blue-500 hover:text-blue-700" title="Ver Arquivo"><ExternalLink size={12}/></button>}
                                  </div>
                              </td>
                              <td className="px-4 py-4 text-right font-black text-slate-700 text-sm">R$ {inv.netValue.toFixed(2)}</td>
                              <td className="px-4 py-4 text-right"><button onClick={() => handlePayInvoice(inv)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 transform active:scale-95 text-xs">Pagar</button></td>
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
        <div className="animate-in fade-in duration-500">
           <div className="flex justify-between mb-6"><h2 className="text-xl font-bold text-slate-800">Órgãos Públicos</h2><button onClick={()=>setShowAddOrg(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex gap-2 font-bold shadow-lg shadow-blue-200 transition-all"><PlusCircle size={20}/> Adicionar Órgão</button></div>
           <div className="bg-white rounded-2xl p-6 shadow-soft border border-slate-100">
               {orgs.length === 0 ? <p className="p-8 text-center text-slate-400">Nenhum órgão cadastrado.</p> :
                 orgs.map(o => <div key={o.id} className="border-b border-slate-100 last:border-0 p-5 flex justify-between items-center hover:bg-slate-50 transition-colors -mx-6 px-6"><div><div className="font-bold text-lg text-slate-800">{o.name}</div><div className="text-sm text-slate-500 mt-1">CNPJ: {o.cnpj}</div></div><div className="text-sm font-bold bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600">Saldo Devedor: R$ {o.balanceDue.toFixed(2)}</div></div>)
               }
           </div>
        </div>
      )}
      
      {activeTab === 'STATIONS' && (
        <div className="animate-in fade-in duration-500">
           <div className="flex justify-between mb-6"><h2 className="text-xl font-bold text-slate-800">Postos de Combustível</h2><button onClick={()=>setShowAddStation(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex gap-2 font-bold shadow-lg shadow-emerald-200 transition-all"><PlusCircle size={20}/> Adicionar Posto</button></div>
           <div className="grid grid-cols-2 gap-6">
              {stations.length === 0 ? <p className="col-span-2 p-8 text-center text-slate-400">Nenhum posto cadastrado.</p> :
                stations.map(s => <div key={s.id} className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 hover:shadow-md transition-shadow"><div className="font-bold text-lg text-slate-800 mb-2">{s.name}</div><div className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg inline-block font-medium">Taxa Adm: <span className="text-slate-800 font-bold">{s.baseFeePercentage}%</span></div></div>)
              }
           </div>
        </div>
      )}

      {activeTab === 'USERS' && (
        <div className="animate-in fade-in duration-500">
           <div className="flex justify-between mb-6"><h2 className="text-xl font-bold text-slate-800">Usuários do Sistema</h2><button onClick={()=>setShowAddUser(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex gap-2 font-bold shadow-lg shadow-slate-300 transition-all"><PlusCircle size={20}/> Adicionar Usuário</button></div>
           <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
             <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b border-slate-100"><tr><th className="p-5 font-bold text-slate-500 uppercase text-xs">Nome</th><th className="p-5 font-bold text-slate-500 uppercase text-xs">Perfil (Role)</th><th className="p-5 font-bold text-slate-500 uppercase text-xs text-right">Ação</th></tr></thead><tbody>
               {users.map(u => <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"><td className="p-5 font-bold text-slate-800">{u.name}</td><td className="p-5"><span className="bg-slate-100 px-2.5 py-1 rounded text-xs font-bold text-slate-600 uppercase tracking-wide">{getRoleLabel(u.role)}</span></td><td className="p-5 text-right"><button onClick={()=>handleDeleteUser(u.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button></td></tr>)}
             </tbody></table>
           </div>
        </div>
      )}

      {activeTab === 'SYSTEM' && (
         <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold text-slate-800">Configurações Avançadas</h2>
            <div className="grid grid-cols-2 gap-6">
               <div className="bg-white p-8 rounded-2xl shadow-soft border border-slate-100"><h3 className="font-bold mb-3 flex gap-2 text-lg text-slate-800"><Download size={20} className="text-blue-500"/> Backup de Dados</h3><p className="text-sm text-slate-400 mb-6">Baixe uma cópia JSON completa do banco de dados para segurança.</p><button onClick={handleDownloadBackup} className="bg-blue-50 text-blue-700 hover:bg-blue-100 w-full py-3 rounded-xl font-bold transition-colors">Baixar JSON</button></div>
               <div className="bg-white p-8 rounded-2xl shadow-soft border border-slate-100"><h3 className="font-bold mb-3 flex gap-2 text-lg text-slate-800"><Upload size={20} className="text-emerald-500"/> Restaurar Dados</h3><p className="text-sm text-slate-400 mb-6">Carregue um arquivo de backup (.json) para restaurar o sistema.</p><input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadBackup} accept=".json"/><button onClick={()=>fileInputRef.current?.click()} className="bg-slate-900 text-white hover:bg-slate-800 w-full py-3 rounded-xl font-bold transition-colors">Selecionar Arquivo</button></div>
            </div>
            <div className="bg-red-50 p-8 rounded-2xl border border-red-100"><h3 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle size={20}/> Zona de Perigo</h3><p className="text-sm text-red-600 mb-6">Resetar o banco de dados apagará todas as informações de usuários, transações e faturas.</p><button onClick={handleResetSystem} className="text-red-600 bg-white border border-red-200 px-6 py-3 rounded-xl hover:bg-red-600 hover:text-white font-bold flex gap-2 items-center transition-all"><RefreshCw size={18}/> Resetar Tudo (Factory Reset)</button></div>
         </div>
      )}

      {/* Modals */}
      {showAddOrg && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in"><h3 className="font-bold mb-6 text-xl text-slate-800">Novo Órgão</h3><div className="space-y-4"><input className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nome do Órgão" value={newOrg.name} onChange={e=>setNewOrg({...newOrg, name: e.target.value})}/><input className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="CNPJ" value={newOrg.cnpj} onChange={e=>setNewOrg({...newOrg, cnpj: e.target.value})}/></div><div className="flex gap-3 mt-8"><button onClick={()=>setShowAddOrg(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button><button onClick={handleAddOrg} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors">Salvar</button></div></div></div>}
      
      {showAddStation && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in"><h3 className="font-bold mb-6 text-xl text-slate-800">Novo Posto</h3><div className="space-y-4"><input className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nome Fantasia" value={newStation.name} onChange={e=>setNewStation({...newStation, name: e.target.value})}/><input className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="CNPJ" value={newStation.cnpj} onChange={e=>setNewStation({...newStation, cnpj: e.target.value})}/><div><label className="text-xs font-bold text-slate-500 uppercase mb-1 ml-1 block">Taxa Administrativa (%)</label><input className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Taxa %" type="number" value={newStation.baseFeePercentage} onChange={e=>setNewStation({...newStation, baseFeePercentage: Number(e.target.value)})}/></div></div><div className="flex gap-3 mt-8"><button onClick={()=>setShowAddStation(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button><button onClick={handleAddStation} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-colors">Salvar</button></div></div></div>}

      {showAddUser && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in"><h3 className="font-bold mb-6 text-xl text-slate-800">Novo Usuário</h3><div className="space-y-4"><input className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nome Completo" value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})}/><input className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Login (Usuário)" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})}/><input className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Senha" type="password" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})}/><div><label className="text-xs font-bold text-slate-500 uppercase mb-1 ml-1 block">Perfil de Acesso</label><select className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value as any})}><option value="FLEET_MANAGER">Gestor de Frota</option><option value="FUEL_STATION">Posto de Combustível</option><option value="SUPER_ADMIN">Administrador Master</option></select></div>
          {(newUser.role === 'FLEET_MANAGER') && <select className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" onChange={e=>setNewUser({...newUser, orgId: e.target.value})}><option value="">Selecione o Órgão...</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>}
          {(newUser.role === 'FUEL_STATION') && <select className="border border-slate-200 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" onChange={e=>setNewUser({...newUser, stationId: e.target.value})}><option value="">Selecione o Posto...</option>{stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}</div>
      <div className="flex gap-3 mt-8"><button onClick={()=>setShowAddUser(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button><button onClick={handleAddUser} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors">Salvar</button></div></div></div>}

    </div>
  );
};
