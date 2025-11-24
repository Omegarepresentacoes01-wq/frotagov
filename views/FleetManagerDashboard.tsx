
import React, { useEffect, useState } from 'react';
import { User, Vehicle, FuelStation, Transaction, TransactionStatus, FuelType, Invoice, InvoiceStatus } from '../types';
import { storageService } from '../services/storageService';
import { generateFleetInsights } from '../services/geminiService';
import { Truck, BarChart3, Building2, PlusCircle, Trash2, Car, LayoutDashboard, Ticket, Check, FileText, CheckCheck, Eye, XCircle, RefreshCw, Loader2, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Props {
  user: User;
}

type Tab = 'DASHBOARD' | 'FLEET' | 'FINANCE';

export const FleetManagerDashboard: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Request Form
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>(FuelType.GASOLINE);
  const [amount, setAmount] = useState<string>(''); 
  const [createdVoucher, setCreatedVoucher] = useState<Transaction | null>(null);

  // Vehicle Management Form
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    plate: '', model: '', department: 'Operacional', type: 'Light', currentOdometer: 0, avgConsumption: 10
  });

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); 
    return () => clearInterval(interval);
  }, [user.orgId]);

  const refreshData = () => {
    const allVehicles = storageService.getVehicles().filter(v => v.orgId === user.orgId);
    setVehicles(allVehicles);
    setStations(storageService.getStations());
    
    const allTxs = storageService.getTransactions().filter(t => t.orgId === user.orgId);
    setTransactions(allTxs);

    const allInvs = storageService.getInvoices().filter(i => i.orgId === user.orgId);
    setInvoices(allInvs);
  };

  // --- CORREÇÃO DO BOTAO ATESTAR ---
  const handleApproveInvoice = async (e: React.MouseEvent, inv: Invoice) => {
      e.stopPropagation(); // Previne eventos de clique na linha
      
      if (!confirm(`Confirma o recebimento e validação da NF ${inv.nfeNumber}? \n\nIsso liberará a fatura para pagamento do Admin.`)) {
        return;
      }

      setProcessingId(inv.id);

      try {
        // Simular delay de rede para feedback visual
        await new Promise(resolve => setTimeout(resolve, 800));

        const allInvoices = storageService.getInvoices();
        const updatedInvoices = allInvoices.map(i => {
            if (i.id === inv.id) {
                return { ...i, status: InvoiceStatus.PENDING_ADMIN };
            }
            return i;
        });
        
        storageService.updateInvoices(updatedInvoices);
        refreshData();
        
        // Pequeno timeout para mostrar sucesso antes de limpar
        setTimeout(() => setProcessingId(null), 500);

      } catch (err) {
        console.error(err);
        alert("Erro ao processar. Tente novamente.");
        setProcessingId(null);
      }
  };
  
  const handleRejectInvoice = (e: React.MouseEvent, inv: Invoice) => {
    e.stopPropagation();
    const reason = prompt(`Motivo da recusa da NF #${inv.nfeNumber}:`);
    if(reason === null) return; 

    const allInvoices = storageService.getInvoices();
    const updatedInvs = allInvoices.map(i => {
        if(i.id === inv.id) {
          return { ...i, status: InvoiceStatus.REJECTED };
        }
        return i;
    });
    storageService.updateInvoices(updatedInvs);
    refreshData();
  };

  const generateVoucherCode = () => 'REQ-' + Math.random().toString(36).substring(2, 7).toUpperCase();

  const handleRequestFuel = () => {
    if(!selectedVehicle || !selectedStation || !amount) { alert("Preencha todos os campos."); return; }
    const v = vehicles.find(v => v.id === selectedVehicle);
    const newTx: Transaction = {
      id: `tx${Date.now()}`,
      voucherCode: generateVoucherCode(),
      orgId: user.orgId!,
      stationId: selectedStation,
      vehicleId: selectedVehicle,
      driverName: user.name, 
      status: TransactionStatus.REQUESTED,
      requestDate: new Date().toISOString(),
      fuelType,
      requestedLiters: Number(amount)
    };
    storageService.updateTransactions([...storageService.getTransactions(), newTx]);
    refreshData();
    setAmount(''); setSelectedVehicle(''); setCreatedVoucher(newTx);
  };

  const handleAddVehicle = () => {
     if (!newVehicle.plate) return;
     const vehicle: Vehicle = {
       id: `veh${Date.now()}`,
       orgId: user.orgId!,
       plate: newVehicle.plate!.toUpperCase(),
       model: newVehicle.model!,
       department: newVehicle.department!,
       type: newVehicle.type as any,
       currentOdometer: Number(newVehicle.currentOdometer),
       avgConsumption: Number(newVehicle.avgConsumption)
     };
     storageService.addVehicle(vehicle);
     refreshData();
     setShowAddVehicle(false);
     setNewVehicle({ plate: '', model: '', department: 'Operacional', type: 'Light', currentOdometer: 0, avgConsumption: 10 });
  };
  
  const handleDeleteVehicle = (id: string) => {
      if(confirm('Tem certeza que deseja excluir este veículo?')) { storageService.deleteVehicle(id); refreshData(); }
  };

  const generateReport = async () => {
    setLoadingAi(true);
    const insight = await generateFleetInsights(transactions, vehicles);
    setAiInsight(insight);
    setLoadingAi(false);
  };

  const allPrices = stations.flatMap(s => s.products.map(p => ({ stationName: s.name, stationId: s.id, type: p.type, price: p.price })));
  const bestPrices = Object.values(FuelType).map(type => {
    const pricesForType = allPrices.filter(p => p.type === type);
    if (pricesForType.length === 0) return null;
    return pricesForType.reduce((min, p) => p.price < min.price ? p : min, pricesForType[0]);
  }).filter(Boolean);

  const spendingByDepartment = transactions.reduce((acc: any[], t) => {
    const v = vehicles.find(v => v.id === t.vehicleId);
    const dept = v?.department || 'Geral';
    const val = t.totalValue || 0;
    const existing = acc.find(d => d.name === dept);
    if(existing) existing.value += val; else acc.push({ name: dept, value: val });
    return acc;
  }, []);

  const getVehicleTypeLabel = (type: string) => {
      if(type === 'Light') return 'Leve';
      if(type === 'Heavy') return 'Pesado';
      if(type === 'Machine') return 'Máquina';
      return type;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Painel do Gestor</h1>
           <p className="text-slate-500 mt-1 flex items-center gap-2">
             <Building2 size={18} className="text-blue-500" /> 
             {user.orgId === 'org1' ? 'Prefeitura Municipal' : 'Órgão Público'}
           </p>
        </div>

        <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 flex overflow-x-auto">
          {[
              { id: 'DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
              { id: 'FLEET', label: 'Frota', icon: Car },
              { id: 'FINANCE', label: 'Financeiro', icon: FileText }
          ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
                <tab.icon size={18} strokeWidth={2.5} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Request Widget */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
               <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white flex items-center gap-3">
                 <div className="bg-white/20 p-2 rounded-lg"><Ticket size={24} className="text-white" /></div>
                 <div>
                   <h3 className="font-bold text-lg">Emitir Autorização</h3>
                   <p className="text-blue-100 text-sm">Gerar voucher para abastecimento imediato</p>
                 </div>
               </div>
               
               <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-4">
                         <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Veículo</label>
                             <div className="relative">
                               <Car className="absolute left-3 top-3 text-slate-400" size={18}/>
                               <select className="w-full border border-slate-200 p-3 pl-10 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none" value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}>
                                   <option value="">Selecione o veículo...</option>
                                   {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                               </select>
                             </div>
                         </div>
                         <div>
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Posto</label>
                             <div className="relative">
                                <Building2 className="absolute left-3 top-3 text-slate-400" size={18}/>
                                <select className="w-full border border-slate-200 p-3 pl-10 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none" value={selectedStation} onChange={e => setSelectedStation(e.target.value)}>
                                    <option value="">Selecione o posto...</option>
                                    {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                             </div>
                         </div>
                     </div>
                     <div className="space-y-4">
                         <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Combustível</label>
                            <select className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none" value={fuelType} onChange={e => setFuelType(e.target.value as FuelType)}>{Object.values(FuelType).map(t => <option key={t} value={t}>{t}</option>)}</select>
                         </div>
                         <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Litros (Estimativa)</label>
                            <input type="number" className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" placeholder="Ex: 50" value={amount} onChange={e => setAmount(e.target.value)}/>
                         </div>
                     </div>
                  </div>
                  <button onClick={handleRequestFuel} disabled={vehicles.length === 0} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all transform active:scale-[0.99] flex justify-center items-center gap-2">
                    <Ticket size={20} />
                    Gerar Voucher
                  </button>
               </div>
            </div>

            {/* Price Insights Widget */}
            <div className="bg-slate-900 rounded-2xl shadow-soft text-white p-6 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 p-32 bg-blue-600 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                <h3 className="font-bold mb-6 text-lg flex items-center gap-2 z-10"><BarChart3 className="text-emerald-400"/> Melhores Preços</h3>
                <div className="space-y-3 flex-1 overflow-y-auto pr-2 z-10">
                    {bestPrices.map((item, idx) => item && (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors group" onClick={() => {setSelectedStation(item.stationId); setFuelType(item.type)}}>
                            <div>
                              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">{item.type}</p>
                              <p className="font-medium text-sm text-slate-100 group-hover:text-white">{item.stationName}</p>
                            </div>
                            <span className="font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-sm">R$ {item.price.toFixed(2)}</span>
                        </div>
                    ))}
                    {bestPrices.length === 0 && <p className="text-sm text-slate-500 text-center py-10">Sem dados de preço disponíveis.</p>}
                </div>
            </div>
          </div>

          {/* Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white rounded-2xl shadow-soft p-8 h-[450px] border border-slate-100">
                <h3 className="font-bold mb-8 text-slate-800 flex items-center gap-2 text-lg"><BarChart3 className="text-blue-500" /> Gastos por Departamento</h3>
                <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={spendingByDepartment}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[6,6,0,0]} barSize={50} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
             
             {/* AI Widget */}
             <div className="bg-white rounded-2xl shadow-soft flex flex-col p-8 border border-slate-100 h-[450px]">
                <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-indigo-900 text-lg flex items-center gap-2"><Truck className="text-indigo-500"/> Consultor IA</h3>
                      <p className="text-slate-500 text-sm mt-1">Análise inteligente da sua frota</p>
                    </div>
                    <button onClick={generateReport} disabled={loadingAi} className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 px-4 py-2 rounded-full font-bold transition-colors flex items-center gap-2">
                       {loadingAi ? <Loader2 className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                       {loadingAi ? 'Analisando...' : 'Gerar Nova Análise'}
                    </button>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-xl flex-1 text-sm text-slate-700 leading-relaxed overflow-auto scrollbar-thin scrollbar-thumb-indigo-200">
                  {aiInsight ? (
                    <div className="prose prose-sm prose-indigo">
                       <p className="whitespace-pre-wrap">{aiInsight}</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                      <Truck size={40} className="opacity-20"/>
                      <p>Clique em "Gerar Nova Análise" para obter insights.</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- FLEET TAB --- */}
      {activeTab === 'FLEET' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-soft border border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 pl-2">Veículos da Frota</h2>
              <button onClick={() => setShowAddVehicle(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all">
                <PlusCircle size={18} /> Cadastrar Veículo
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {vehicles.map(v => (
                <div key={v.id} className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 relative group hover:shadow-lg transition-shadow">
                   <div className="absolute top-4 right-4 flex gap-2">
                      <button onClick={() => handleDeleteVehicle(v.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                   </div>
                   
                   <div className="flex items-center gap-4 mb-6">
                     <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100">
                       <Truck size={24} />
                     </div>
                     <div>
                       <h3 className="font-bold text-slate-800 text-lg">{v.plate}</h3>
                       <p className="text-sm text-slate-500 font-medium">{v.model}</p>
                     </div>
                   </div>
                   
                   <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <span className="text-xs font-bold text-slate-400 uppercase">Departamento</span>
                        <span className="text-sm font-bold text-slate-700">{v.department}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="p-3 bg-slate-50 rounded-xl">
                           <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Tipo</span>
                           <span className="text-sm font-bold text-slate-700">{getVehicleTypeLabel(v.type)}</span>
                         </div>
                         <div className="p-3 bg-slate-50 rounded-xl">
                           <span className="text-xs font-bold text-slate-400 uppercase block mb-1">KM Atual</span>
                           <span className="text-sm font-bold text-slate-700">{v.currentOdometer}</span>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* --- FINANCE TAB --- */}
      {activeTab === 'FINANCE' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Notas Fiscais Recebidas</h2>
                  <p className="text-slate-500 text-sm">Valide as faturas para liberar o pagamento</p>
                </div>
                <div className="flex gap-3">
                  <div className="relative hidden md:block">
                     <Search className="absolute left-3 top-3 text-slate-400" size={16}/>
                     <input type="text" placeholder="Buscar NFe ou Posto..." className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button onClick={refreshData} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-xl transition-colors"><RefreshCw size={20}/></button>
                </div>
             </div>
             
             <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm text-slate-600">
                       <thead className="bg-slate-50 border-b border-slate-100">
                           <tr>
                               <th className="px-6 py-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Posto Emitente</th>
                               <th className="px-6 py-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Documento (NFe)</th>
                               <th className="px-6 py-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Data Emissão</th>
                               <th className="px-6 py-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Valor Total</th>
                               <th className="px-6 py-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Status Atual</th>
                               <th className="px-6 py-5 font-bold text-slate-500 uppercase text-xs tracking-wider text-right">Ação Requerida</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {invoices.length === 0 ? 
                             <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-medium">Nenhuma fatura pendente ou histórico recente.</td></tr> :
                             invoices.map(inv => {
                                 const stationName = stations.find(s => s.id === inv.stationId)?.name;
                                 const isProcessing = processingId === inv.id;
                                 
                                 return (
                                     <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors group">
                                         <td className="px-6 py-5 font-bold text-slate-800">{stationName}</td>
                                         <td className="px-6 py-5">
                                              <div className="flex flex-col gap-1.5">
                                                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-fit text-xs">{inv.nfeNumber}</span>
                                                  {inv.nfeFileUrl && (
                                                      <a href="#" onClick={(e) => { e.preventDefault(); alert(`Visualizando arquivo: ${inv.nfeFileUrl}`); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
                                                          <FileText size={12}/> {inv.nfeFileUrl}
                                                      </a>
                                                  )}
                                              </div>
                                         </td>
                                         <td className="px-6 py-5 text-slate-500">{new Date(inv.issueDate).toLocaleDateString()}</td>
                                         <td className="px-6 py-5 font-bold text-slate-800 text-base">R$ {inv.totalValue.toFixed(2)}</td>
                                         <td className="px-6 py-5">
                                             <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                                 inv.status === InvoiceStatus.PENDING_MANAGER ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                 inv.status === InvoiceStatus.PENDING_ADMIN ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                 inv.status === InvoiceStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' :
                                                 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                             }`}>
                                                 <span className={`w-1.5 h-1.5 rounded-full ${
                                                   inv.status === InvoiceStatus.PENDING_MANAGER ? 'bg-amber-500' :
                                                   inv.status === InvoiceStatus.PENDING_ADMIN ? 'bg-blue-500' :
                                                   inv.status === InvoiceStatus.REJECTED ? 'bg-red-500' : 'bg-emerald-500'
                                                 }`}></span>
                                                 {inv.status === InvoiceStatus.PENDING_MANAGER ? 'AGUARDANDO ATESTE' :
                                                  inv.status === InvoiceStatus.PENDING_ADMIN ? 'EM PAGAMENTO' : 
                                                  inv.status === InvoiceStatus.REJECTED ? 'RECUSADO' : 'PAGO'}
                                             </span>
                                         </td>
                                         <td className="px-6 py-5 text-right">
                                             {inv.status === InvoiceStatus.PENDING_MANAGER ? (
                                                <div className="flex items-center justify-end gap-2">
                                                   <button 
                                                       disabled={isProcessing}
                                                       onClick={(e) => handleRejectInvoice(e, inv)}
                                                       className="bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 w-9 h-9 flex items-center justify-center rounded-lg transition-all"
                                                       title="Recusar NFe"
                                                   >
                                                       <XCircle size={18}/>
                                                   </button>
                                                   <button 
                                                       disabled={isProcessing}
                                                       onClick={(e) => handleApproveInvoice(e, inv)}
                                                       className={`bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all transform active:scale-95 ${isProcessing ? 'opacity-80 cursor-wait' : ''}`}
                                                   >
                                                       {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16}/>}
                                                       {isProcessing ? 'Processando...' : 'Atestar NFe'}
                                                   </button>
                                                </div>
                                             ) : (
                                                 <span className="text-xs text-slate-400 flex items-center justify-end gap-1.5 font-medium px-2 py-1 bg-slate-50 rounded-lg w-fit ml-auto">
                                                   <Check size={14} className="text-emerald-500"/> Processo Concluído
                                                 </span>
                                             )}
                                         </td>
                                     </tr>
                                 )
                             })
                           }
                       </tbody>
                   </table>
                 </div>
             </div>
          </div>
      )}

      {/* ... Modals ... */}
      {createdVoucher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center animate-in zoom-in duration-300 shadow-2xl">
               <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-glow">
                 <Check className="text-emerald-600" size={40} strokeWidth={3}/>
               </div>
               <h3 className="text-2xl font-bold mb-2 text-slate-800">Autorizado!</h3>
               <p className="text-slate-500 mb-6">Apresente este código ao frentista do posto.</p>
               
               <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-300 mb-8 relative group cursor-pointer hover:bg-slate-100 transition-colors">
                  <span className="text-xs font-bold text-slate-400 absolute top-2 right-3 uppercase">Voucher</span>
                  <div className="font-mono text-3xl font-bold tracking-widest text-slate-800">{createdVoucher.voucherCode}</div>
               </div>
               
               <button onClick={() => setCreatedVoucher(null)} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors">Fechar</button>
           </div>
        </div>
      )}
      
      {showAddVehicle && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-8 w-full max-w-md animate-in slide-in-from-bottom-10 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl text-slate-800">Novo Veículo</h3>
                    <button onClick={() => setShowAddVehicle(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24}/></button>
                  </div>
                  <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Placa</label>
                        <input placeholder="ABC-1234" className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold" value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Modelo</label>
                        <input placeholder="Ex: Fiat Uno 1.0" className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Departamento</label>
                        <input placeholder="Ex: Saúde" className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={newVehicle.department} onChange={e => setNewVehicle({...newVehicle, department: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Categoria</label>
                          <select className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={newVehicle.type} onChange={e => setNewVehicle({...newVehicle, type: e.target.value as any})}>
                              <option value="Light">Leve</option>
                              <option value="Heavy">Pesado</option>
                              <option value="Machine">Máquina</option>
                          </select>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button onClick={() => setShowAddVehicle(false)} className="flex-1 bg-white border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                        <button onClick={handleAddVehicle} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors">Salvar Veículo</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
