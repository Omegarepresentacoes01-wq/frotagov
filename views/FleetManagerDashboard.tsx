
import React, { useEffect, useState } from 'react';
import { User, Vehicle, FuelStation, Transaction, TransactionStatus, FuelType } from '../types';
import { storageService } from '../services/storageService';
import { generateFleetInsights } from '../services/geminiService';
import { Truck, Fuel, BarChart3, TrendingUp, Search, BrainCircuit, Building2, MapPin, PlusCircle, Trash2, Car, LayoutDashboard } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Props {
  user: User;
}

type Tab = 'DASHBOARD' | 'FLEET';

export const FleetManagerDashboard: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Request Form
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>(FuelType.GASOLINE);
  const [amount, setAmount] = useState<string>(''); 

  // Vehicle Management Form
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    plate: '',
    model: '',
    department: 'Operacional',
    type: 'Light',
    currentOdometer: 0,
    avgConsumption: 10
  });

  useEffect(() => {
    refreshData();
  }, [user.orgId]);

  const refreshData = () => {
    // Only show vehicles belonging to this Org
    const allVehicles = storageService.getVehicles().filter(v => v.orgId === user.orgId);
    setVehicles(allVehicles);
    setStations(storageService.getStations());
    const allTxs = storageService.getTransactions().filter(t => t.orgId === user.orgId);
    setTransactions(allTxs);
  };

  // --- ACTIONS ---

  const handleRequestFuel = () => {
    if(!selectedVehicle || !selectedStation || !amount) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    const v = vehicles.find(v => v.id === selectedVehicle);

    const newTx: Transaction = {
      id: `tx${Date.now()}`,
      orgId: user.orgId!,
      stationId: selectedStation,
      vehicleId: selectedVehicle,
      driverName: user.name, 
      status: TransactionStatus.REQUESTED,
      requestDate: new Date().toISOString(),
      fuelType,
      requestedLiters: Number(amount)
    };
    
    const currentTxs = storageService.getTransactions();
    storageService.updateTransactions([...currentTxs, newTx]);
    refreshData();
    
    // Reset form
    setAmount('');
    setSelectedVehicle('');
    alert('Solicitação enviada ao posto! Aguarde a validação no local.');
  };

  const handleAddVehicle = () => {
    if (!newVehicle.plate || !newVehicle.model || !newVehicle.department) {
      alert("Preencha Placa, Modelo e Departamento.");
      return;
    }

    const vehicle: Vehicle = {
      id: `veh${Date.now()}`,
      orgId: user.orgId!,
      plate: newVehicle.plate.toUpperCase(),
      model: newVehicle.model,
      department: newVehicle.department,
      type: newVehicle.type as 'Light' | 'Heavy' | 'Machine',
      currentOdometer: Number(newVehicle.currentOdometer) || 0,
      avgConsumption: Number(newVehicle.avgConsumption) || 10
    };

    storageService.addVehicle(vehicle);
    refreshData();
    setShowAddVehicle(false);
    setNewVehicle({ plate: '', model: '', department: 'Operacional', type: 'Light', currentOdometer: 0, avgConsumption: 10 });
  };

  const handleDeleteVehicle = (id: string) => {
    if(confirm('Tem certeza? O histórico de transações será mantido, mas o veículo não aparecerá para novos abastecimentos.')) {
      storageService.deleteVehicle(id);
      refreshData();
    }
  };

  const generateReport = async () => {
    setLoadingAi(true);
    setAiInsight('');
    const insight = await generateFleetInsights(transactions, vehicles);
    setAiInsight(insight);
    setLoadingAi(false);
  };

  // --- CALCULATIONS ---

  const allPrices = stations.flatMap(s => s.products.map(p => ({
    stationName: s.name,
    stationId: s.id,
    type: p.type,
    price: p.price,
    updated: p.lastUpdated
  })));

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
    if(existing) existing.value += val;
    else acc.push({ name: dept, value: val });
    return acc;
  }, []);

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

        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'DASHBOARD' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={16} /> Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('FLEET')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'FLEET' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Car size={16} /> Minha Frota
          </button>
        </div>
      </div>

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Fuel Request Form */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-blue-600 p-4 text-white flex items-center gap-2">
                <Fuel size={20} /> <span className="font-bold">Solicitar Abastecimento</span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {vehicles.length === 0 && (
                   <div className="md:col-span-2 bg-amber-50 p-4 rounded-lg text-amber-800 text-sm border border-amber-200">
                     ⚠️ Você ainda não possui veículos cadastrados. Vá na aba "Minha Frota" para adicionar.
                   </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Veículo / Centro de Custo</label>
                    <div className="relative">
                      <select 
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={selectedVehicle}
                        onChange={e => setSelectedVehicle(e.target.value)}
                        disabled={vehicles.length === 0}
                      >
                        <option value="">Selecione o veículo...</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.plate} - {v.model} ({v.department})
                          </option>
                        ))}
                      </select>
                      <Truck className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Posto Credenciado</label>
                    <div className="relative">
                      <select 
                        className="w-full border border-slate-300 rounded-lg p-3 bg-white appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={selectedStation}
                        onChange={e => setSelectedStation(e.target.value)}
                      >
                        <option value="">Selecione o posto...</option>
                        {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <MapPin className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Tipo de Combustível</label>
                    <select 
                      className="w-full border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={fuelType}
                      onChange={e => setFuelType(e.target.value as FuelType)}
                    >
                      {Object.values(FuelType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Quantidade (Litros)</label>
                    <input 
                      type="number" 
                      className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Ex: 50"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2 pt-2">
                  <button 
                    onClick={handleRequestFuel}
                    disabled={vehicles.length === 0}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Gerar Autorização de Abastecimento
                  </button>
                </div>
              </div>
            </div>

            {/* Best Prices Card */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl shadow-lg text-white p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <TrendingUp size={120} />
              </div>
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
                <TrendingUp className="text-emerald-400" /> Melhores Preços do Dia
              </h3>
              <div className="space-y-4 relative z-10">
                {bestPrices.map((item, idx) => item && (
                  <div key={idx} className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex justify-between items-center hover:bg-white/15 transition-colors cursor-pointer" onClick={() => {
                    setSelectedStation(item.stationId);
                    setFuelType(item.type);
                  }}>
                    <div>
                      <p className="text-xs text-slate-300 uppercase font-semibold">{item.type}</p>
                      <p className="font-medium text-sm truncate max-w-[150px]">{item.stationName}</p>
                    </div>
                    <div className="text-right">
                      <span className="block text-xl font-bold text-emerald-400">R$ {item.price.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400">por litro</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Analytics & AI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-[400px]">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-700">
                <BarChart3 size={20} className="text-blue-500" /> Gastos por Centro de Custo
              </h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={spendingByDepartment} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-indigo-50/30">
                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                  <BrainCircuit className="text-indigo-600" /> Consultor IA
                </h3>
                <button 
                    onClick={generateReport} 
                    disabled={loadingAi}
                    className="flex items-center gap-2 text-xs bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md shadow-indigo-200"
                >
                  {loadingAi ? <span className="animate-pulse">Processando...</span> : 'Gerar Relatório de Eficiência'}
                </button>
              </div>
              
              <div className="flex-1 p-6 relative">
                {aiInsight ? (
                  <div className="prose prose-sm prose-indigo max-w-none text-slate-600">
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                        <pre className="whitespace-pre-wrap font-sans text-sm bg-transparent border-none p-0">
                            {aiInsight}
                        </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                        <Search size={32} className="text-indigo-300" />
                    </div>
                    <h4 className="text-slate-800 font-medium mb-1">Análise Inteligente</h4>
                    <p className="text-slate-500 text-sm max-w-xs">
                      Utilize nossa IA para identificar veículos com alto consumo e oportunidades de economia.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FLEET TAB --- */}
      {activeTab === 'FLEET' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold text-slate-700">Veículos Cadastrados</h2>
             <button onClick={() => setShowAddVehicle(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"><PlusCircle size={18}/> Novo Veículo</button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map(v => (
                <div key={v.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-colors group relative">
                   <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleDeleteVehicle(v.id)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button>
                   </div>
                   <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                        <Truck size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{v.plate}</h3>
                        <p className="text-sm text-slate-500">{v.model}</p>
                      </div>
                   </div>
                   <div className="space-y-2 text-sm border-t border-slate-50 pt-4">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Centro de Custo</span>
                        <span className="font-medium bg-slate-100 px-2 rounded text-slate-700">{v.department}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-slate-500">Média Alvo</span>
                         <span className="font-medium">{v.avgConsumption} km/l</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-slate-500">Odômetro Atual</span>
                         <span className="font-medium">{v.currentOdometer} km</span>
                      </div>
                   </div>
                </div>
              ))}
              {vehicles.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400">Nenhum veículo cadastrado nesta frota.</div>}
           </div>
        </div>
      )}

      {/* ADD VEHICLE MODAL */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Truck size={20}/> Cadastrar Veículo</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <input type="text" placeholder="Placa (ABC-1234)" className="w-full border p-2 rounded-lg uppercase" value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})} />
                   <input type="text" placeholder="Modelo (Ex: Gol)" className="w-full border p-2 rounded-lg" value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} />
                </div>
                
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Centro de Custo / Departamento</label>
                   <input type="text" placeholder="Ex: Saúde, Obras, Gabinete..." className="w-full border p-2 rounded-lg" value={newVehicle.department} onChange={e => setNewVehicle({...newVehicle, department: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label>
                     <select className="w-full border p-2 rounded-lg" value={newVehicle.type} onChange={e => setNewVehicle({...newVehicle, type: e.target.value as any})}>
                       <option value="Light">Leve / Passeio</option>
                       <option value="Heavy">Pesado / Caminhão</option>
                       <option value="Machine">Máquina</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1">Média (Km/L)</label>
                     <input type="number" className="w-full border p-2 rounded-lg" value={newVehicle.avgConsumption} onChange={e => setNewVehicle({...newVehicle, avgConsumption: Number(e.target.value)})} />
                   </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Odômetro Inicial</label>
                   <input type="number" className="w-full border p-2 rounded-lg" value={newVehicle.currentOdometer} onChange={e => setNewVehicle({...newVehicle, currentOdometer: Number(e.target.value)})} />
                </div>

                <div className="flex gap-2 pt-4">
                   <button onClick={() => setShowAddVehicle(false)} className="flex-1 bg-slate-100 py-2 rounded-lg">Cancelar</button>
                   <button onClick={handleAddVehicle} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">Salvar</button>
                </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
