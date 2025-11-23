import React, { useEffect, useState } from 'react';
import { User, Vehicle, FuelStation, Transaction, TransactionStatus, FuelType, Invoice, InvoiceStatus } from '../types';
import { storageService } from '../services/storageService';
import { generateFleetInsights } from '../services/geminiService';
import { Truck, Fuel, BarChart3, TrendingUp, Search, BrainCircuit, Building2, MapPin, PlusCircle, Trash2, Car, LayoutDashboard, Ticket, Check, X, FileText, CheckCheck } from 'lucide-react';
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
  }, [user.orgId]);

  const refreshData = () => {
    // Only show vehicles belonging to this Org
    const allVehicles = storageService.getVehicles().filter(v => v.orgId === user.orgId);
    setVehicles(allVehicles);
    setStations(storageService.getStations());
    
    // Transactions
    const allTxs = storageService.getTransactions().filter(t => t.orgId === user.orgId);
    setTransactions(allTxs);

    // Invoices sent to this Org
    const allInvs = storageService.getInvoices().filter(i => i.orgId === user.orgId);
    setInvoices(allInvs);
  };

  const handleApproveInvoice = (inv: Invoice) => {
      if(!confirm(`Confirma o recebimento dos serviços e valida a NF #${inv.nfeNumber}? O admin será notificado para pagamento.`)) return;

      const updatedInvs = storageService.getInvoices().map(i => {
          if(i.id === inv.id) return { ...i, status: InvoiceStatus.PENDING_ADMIN };
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

  // Helper for UI translation
  const getVehicleTypeLabel = (type: string) => {
      if(type === 'Light') return 'Leve';
      if(type === 'Heavy') return 'Pesado';
      if(type === 'Machine') return 'Máquina';
      return type;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-20">
      
      {/* Header & Nav */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Gestão de Frota</h1>
           <p className="text-slate-500 flex items-center gap-2">
             <Building2 size={16} /> {user.orgId === 'org1' ? 'Prefeitura Municipal' : 'Órgão Público'}
           </p>
        </div>

        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex overflow-x-auto">
          {[
              { id: 'DASHBOARD', label: 'Visão Geral', icon: LayoutDashboard },
              { id: 'FLEET', label: 'Minha Frota', icon: Car },
              { id: 'FINANCE', label: 'Financeiro', icon: FileText }
          ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form & Prices (Same as before) */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="bg-blue-600 p-4 text-white flex items-center gap-2"><Ticket size={20} /> <span className="font-bold">Nova Requisição</span></div>
               <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                       <div>
                           <label className="text-sm font-medium">Selecione o Veículo</label>
                           <select className="w-full border p-3 rounded-lg bg-white" value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}>
                               <option value="">Selecione...</option>
                               {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                           </select>
                       </div>
                       <div>
                           <label className="text-sm font-medium">Posto Preferencial</label>
                           <select className="w-full border p-3 rounded-lg bg-white" value={selectedStation} onChange={e => setSelectedStation(e.target.value)}>
                               <option value="">Selecione...</option>
                               {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                       </div>
                   </div>
                   <div className="space-y-4">
                       <div><label className="text-sm font-medium">Tipo de Combustível</label><select className="w-full border p-3 rounded-lg bg-white" value={fuelType} onChange={e => setFuelType(e.target.value as FuelType)}>{Object.values(FuelType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                       <div><label className="text-sm font-medium">Litros (Estimado)</label><input type="number" className="w-full border p-3 rounded-lg" value={amount} onChange={e => setAmount(e.target.value)}/></div>
                   </div>
                   <button onClick={handleRequestFuel} disabled={vehicles.length === 0} className="md:col-span-2 w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200">Gerar Voucher (Autorização)</button>
               </div>
            </div>

            <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl shadow-lg text-white p-6 relative overflow-hidden">
                <div className="space-y-4 relative z-10">
                    <h3 className="font-bold mb-4">Melhores Preços na Região</h3>
                    {bestPrices.map((item, idx) => item && (
                        <div key={idx} className="bg-white/10 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-white/20 transition-colors" onClick={() => {setSelectedStation(item.stationId); setFuelType(item.type)}}>
                            <div><p className="text-xs text-slate-300">{item.type}</p><p className="font-medium text-sm">{item.stationName}</p></div>
                            <span className="font-bold text-emerald-400">R$ {item.price.toFixed(2)}</span>
                        </div>
                    ))}
                    {bestPrices.length === 0 && <p className="text-sm text-slate-400">Sem dados de preço disponíveis.</p>}
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white rounded-2xl shadow-sm p-6 h-[400px]">
                <h3 className="font-bold mb-6 flex gap-2"><BarChart3 className="text-blue-500" /> Gastos por Centro de Custo</h3>
                <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={spendingByDepartment}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} /></BarChart>
                </ResponsiveContainer>
             </div>
             <div className="bg-white rounded-2xl shadow-sm flex flex-col p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-indigo-900 flex gap-2"><BrainCircuit /> IA Consultor de Frota</h3>
                    <button onClick={generateReport} disabled={loadingAi} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full">{loadingAi ? 'Analisando...' : 'Gerar Análise'}</button>
                </div>
                <div className="bg-indigo-50 p-4 rounded-xl flex-1 text-sm text-slate-700 whitespace-pre-wrap font-sans overflow-auto max-h-[300px]">{aiInsight || 'Clique em "Gerar Análise" para obter insights inteligentes sobre consumo e economia.'}</div>
             </div>
          </div>
        </div>
      )}

      {/* --- FLEET TAB --- */}
      {activeTab === 'FLEET' && (
        <div className="space-y-6">
           <div className="flex justify-between"><h2 className="text-xl font-bold">Veículos da Frota</h2><button onClick={() => setShowAddVehicle(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex gap-2"><PlusCircle /> Cadastrar Veículo</button></div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {vehicles.map(v => (
                <div key={v.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative group">
                   <button onClick={() => handleDeleteVehicle(v.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                   <div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><Truck /></div><div><h3 className="font-bold">{v.plate}</h3><p className="text-sm text-slate-500">{v.model}</p></div></div>
                   <div className="space-y-2 text-sm border-t pt-4">
                      <div className="flex justify-between text-slate-500"><span>Departamento</span><span className="font-medium text-slate-800">{v.department}</span></div>
                      <div className="flex justify-between text-slate-500"><span>Tipo</span><span className="font-medium text-slate-800">{getVehicleTypeLabel(v.type)}</span></div>
                      <div className="flex justify-between text-slate-500"><span>Odômetro</span><span className="font-medium text-slate-800">{v.currentOdometer} km</span></div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* --- FINANCE TAB --- */}
      {activeTab === 'FINANCE' && (
          <div className="space-y-6">
             <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2"><FileText /> Notas Fiscais Recebidas</h2>
             <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                 <table className="w-full text-left text-sm text-slate-600">
                     <thead className="bg-slate-50 font-bold uppercase text-xs">
                         <tr>
                             <th className="px-6 py-4">Posto</th>
                             <th className="px-6 py-4">NFe</th>
                             <th className="px-6 py-4">Emissão</th>
                             <th className="px-6 py-4">Valor Total</th>
                             <th className="px-6 py-4">Status</th>
                             <th className="px-6 py-4 text-right">Ação</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {invoices.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhuma fatura pendente.</td></tr> :
                           invoices.map(inv => {
                               const stationName = stations.find(s => s.id === inv.stationId)?.name;
                               return (
                                   <tr key={inv.id} className="hover:bg-slate-50">
                                       <td className="px-6 py-4 font-bold text-slate-800">{stationName}</td>
                                       <td className="px-6 py-4 flex items-center gap-2"><FileText size={14} className="text-blue-500"/> {inv.nfeNumber}</td>
                                       <td className="px-6 py-4">{new Date(inv.issueDate).toLocaleDateString()}</td>
                                       <td className="px-6 py-4 font-bold">R$ {inv.totalValue.toFixed(2)}</td>
                                       <td className="px-6 py-4">
                                           <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                               inv.status === InvoiceStatus.PENDING_MANAGER ? 'bg-yellow-100 text-yellow-700' :
                                               inv.status === InvoiceStatus.PENDING_ADMIN ? 'bg-blue-100 text-blue-700' :
                                               'bg-emerald-100 text-emerald-700'
                                           }`}>
                                               {inv.status === InvoiceStatus.PENDING_MANAGER ? 'AG. SUA APROVAÇÃO' :
                                                inv.status === InvoiceStatus.PENDING_ADMIN ? 'ENVIADO P/ PAGTO' : 'PAGO'}
                                           </span>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                           {inv.status === InvoiceStatus.PENDING_MANAGER && (
                                               <button 
                                                   onClick={() => handleApproveInvoice(inv)}
                                                   className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ml-auto"
                                               >
                                                   <CheckCheck size={14}/> Atestar
                                               </button>
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
      )}

      {/* ... Modals (Voucher/Add Vehicle) ... */}
      {createdVoucher && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center">
               <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="text-emerald-600" size={32}/></div>
               <h3 className="text-2xl font-bold mb-2">Autorizado!</h3>
               <p className="text-slate-500 mb-4">Entregue este código ao frentista:</p>
               <div className="bg-slate-100 p-4 rounded-xl font-mono text-2xl font-bold tracking-widest mb-6 border-dashed border-2 border-slate-300">{createdVoucher.voucherCode}</div>
               <button onClick={() => setCreatedVoucher(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Fechar</button>
           </div>
        </div>
      )}
      
      {showAddVehicle && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                  <h3 className="font-bold mb-4 text-lg">Novo Veículo</h3>
                  <div className="space-y-4">
                      <input placeholder="Placa" className="w-full border p-2 rounded" value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})} />
                      <input placeholder="Modelo" className="w-full border p-2 rounded" value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} />
                      <input placeholder="Departamento" className="w-full border p-2 rounded" value={newVehicle.department} onChange={e => setNewVehicle({...newVehicle, department: e.target.value})} />
                      <div>
                          <label className="text-xs font-bold text-slate-500">Tipo de Veículo</label>
                          <select className="w-full border p-2 rounded bg-white" value={newVehicle.type} onChange={e => setNewVehicle({...newVehicle, type: e.target.value as any})}>
                              <option value="Light">Leve</option>
                              <option value="Heavy">Pesado</option>
                              <option value="Machine">Máquina</option>
                          </select>
                      </div>
                      <div className="flex gap-2 mt-4"><button onClick={() => setShowAddVehicle(false)} className="flex-1 bg-slate-100 py-2 rounded text-slate-600">Cancelar</button><button onClick={handleAddVehicle} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Salvar</button></div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};