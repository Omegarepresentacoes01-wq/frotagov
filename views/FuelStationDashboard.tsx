
import React, { useEffect, useState } from 'react';
import { User, Transaction, FuelStation, TransactionStatus, FuelType } from '../types';
import { storageService } from '../services/storageService';
import { CheckCircle, Clock, DollarSign, Wallet, Zap, CalendarCheck, Edit3, Search, Ticket } from 'lucide-react';

interface Props {
  user: User;
}

export const FuelStationDashboard: React.FC<Props> = ({ user }) => {
  const [station, setStation] = useState<FuelStation | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Validation State
  const [validatingTx, setValidatingTx] = useState<string | null>(null);
  const [fillData, setFillData] = useState({ liters: 0, price: 0, odometer: 0 });

  useEffect(() => {
    // Poll for updates (e.g., new requests coming in)
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [user.stationId]);

  const refreshData = () => {
    const s = storageService.getStations().find(s => s.id === user.stationId);
    setStation(s || null);
    const txs = storageService.getTransactions().filter(t => t.stationId === user.stationId);
    setTransactions(txs);
  };

  const handleStartValidation = (tx: Transaction) => {
    const product = station?.products.find(p => p.type === tx.fuelType);
    setValidatingTx(tx.id);
    setFillData({
      liters: tx.requestedLiters,
      price: product?.price || 0,
      odometer: 0
    });
  };

  const submitValidation = () => {
    if (!validatingTx || !station) return;
    if (fillData.liters <= 0 || fillData.price <= 0 || fillData.odometer <= 0) {
      alert("Todos os dados do abastecimento são obrigatórios.");
      return;
    }
    
    const total = fillData.liters * fillData.price;
    const allTxs = storageService.getTransactions();
    
    // Optimistic update
    const updatedTxs = allTxs.map(t => {
      if (t.id === validatingTx) {
        return {
          ...t,
          status: TransactionStatus.VALIDATED,
          validationDate: new Date().toISOString(),
          filledLiters: fillData.liters,
          pricePerLiter: fillData.price,
          totalValue: total,
          odometer: fillData.odometer,
        };
      }
      return t;
    });

    storageService.updateTransactions(updatedTxs);
    
    // Calculate pending balance
    const sTxs = updatedTxs.filter(t => t.stationId === station.id && t.status === TransactionStatus.VALIDATED);
    const newPending = sTxs.reduce((acc, t) => acc + (t.totalValue || 0), 0);
    
    const updatedStations = storageService.getStations().map(s => {
      if (s.id === station.id) {
        return { ...s, balancePending: newPending };
      }
      return s;
    });
    storageService.updateStations(updatedStations);

    setValidatingTx(null);
    refreshData();
    alert("Abastecimento validado com sucesso!");
  };

  const handleBilling = (advance: boolean) => {
    if(!station) return;

    // Filter validated txs
    const pendingTxs = transactions.filter(t => t.status === TransactionStatus.VALIDATED);
    
    if (pendingTxs.length === 0) {
      alert("Não há transações validadas disponíveis para faturamento/adiantamento.");
      return;
    }

    if(advance) {
        if(!confirm(`Deseja antecipar R$ ${station.balancePending.toFixed(2)}? \nUma taxa adicional de ${station.advanceFeePercentage}% será aplicada.`)) return;
    } else {
        if(!confirm(`Fechar fatura mensal de R$ ${station.balancePending.toFixed(2)}? \nO pagamento será processado em até 30 dias.`)) return;
    }

    const allTxs = storageService.getTransactions();
    let totalInvoicedNet = 0;

    const updatedTxs = allTxs.map(t => {
      if (t.stationId === station.id && t.status === TransactionStatus.VALIDATED) {
        const txWithFees = storageService.applyFees(t, station, advance);
        totalInvoicedNet += (txWithFees.netValue || 0);
        return { 
          ...txWithFees, 
          status: advance ? TransactionStatus.ADVANCE_REQUESTED : TransactionStatus.INVOICED 
        };
      }
      return t;
    });

    storageService.updateTransactions(updatedTxs);
    
    // Update Station Balances
    const updatedStations = storageService.getStations().map(s => {
        if (s.id === station.id) {
            return {
                ...s,
                balancePending: 0,
                balanceInvoiced: s.balanceInvoiced + totalInvoicedNet
            }
        }
        return s;
    });
    storageService.updateStations(updatedStations);

    refreshData();
    alert(advance ? "Solicitação de adiantamento enviada!" : "Fatura fechada e enviada para o administrador.");
  };

  const updatePrice = (type: FuelType, newPrice: number) => {
    if(!station) return;
    const newProducts = [...station.products];
    const idx = newProducts.findIndex(p => p.type === type);
    
    if(idx >= 0) {
      newProducts[idx] = { ...newProducts[idx], price: newPrice, lastUpdated: new Date().toISOString() };
    } else {
      newProducts.push({ type, price: newPrice, lastUpdated: new Date().toISOString() });
    }
    
    const updatedStations = storageService.getStations().map(s => s.id === station.id ? {...s, products: newProducts} : s);
    storageService.updateStations(updatedStations);
    refreshData();
  };

  if (!station) return <div className="p-8 text-center text-slate-500">Carregando dados do posto...</div>;

  // Logic to filter transactions for the Queue
  const pendingValidations = transactions
    .filter(t => t.status === TransactionStatus.REQUESTED)
    .filter(t => {
      if(!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const plate = storageService.getVehicles().find(v => v.id === t.vehicleId)?.plate?.toLowerCase() || '';
      const voucher = t.voucherCode ? t.voucherCode.toLowerCase() : '';
      return plate.includes(term) || voucher.includes(term);
    });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">{station.name}</h1>
           <p className="text-slate-500 text-sm flex items-center gap-2">
             <CheckCircle size={14} className="text-emerald-500" /> Posto Credenciado - CNPJ: {station.cnpj}
           </p>
        </div>
        
        {/* Billing Actions */}
        <div className="flex gap-3 w-full md:w-auto">
           <button 
             onClick={() => handleBilling(false)}
             disabled={station.balancePending === 0}
             className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-5 py-2.5 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
           >
             <CalendarCheck size={18} /> Fechar Mês
           </button>
           <button 
             onClick={() => handleBilling(true)}
             disabled={station.balancePending === 0}
             className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
           >
             <Zap size={18} className="text-amber-400" /> Antecipar Recebíveis
           </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-start">
             <div>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Disponível para Antecipar</p>
                <p className="text-3xl font-extrabold text-slate-800">R$ {station.balancePending.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-2">Valores validados (Bruto)</p>
             </div>
             <div className="bg-blue-50 p-3 rounded-xl"><Clock size={24} className="text-blue-600"/></div>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-start">
             <div>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">A Receber (Faturado)</p>
                <p className="text-3xl font-extrabold text-amber-500">R$ {station.balanceInvoiced.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-2">Aguardando pagamento Admin</p>
             </div>
             <div className="bg-amber-50 p-3 rounded-xl"><Wallet size={24} className="text-amber-600"/></div>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-start">
             <div>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Total Recebido</p>
                <p className="text-3xl font-extrabold text-emerald-600">R$ {station.balancePaid.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-2">Acumulado</p>
             </div>
             <div className="bg-emerald-50 p-3 rounded-xl"><DollarSign size={24} className="text-emerald-600"/></div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Validation Workflow (Main Area) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-700">Fila de Abastecimento</h2>
            <div className="relative">
               <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
               <input 
                  type="text" 
                  placeholder="Buscar Placa ou Voucher..." 
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
          </div>

          {pendingValidations.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border-2 border-dashed border-slate-200">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Clock className="text-slate-300" size={32} />
              </div>
              <h3 className="text-slate-500 font-medium">
                 {searchTerm ? "Nenhuma requisição encontrada para esta busca." : "Nenhum veículo aguardando no momento."}
              </h3>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingValidations.map(tx => {
                 const vehicle = storageService.getVehicles().find(v => v.id === tx.vehicleId);
                 return (
                  <div key={tx.id} className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all ${validatingTx === tx.id ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
                    
                    {validatingTx === tx.id ? (
                      // Active Validation Form
                      <div className="p-6 bg-blue-50/30">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-blue-100">
                          <h3 className="font-bold text-blue-900">Validar Abastecimento</h3>
                          <div className="flex flex-col items-end">
                             <span className="text-sm font-bold text-slate-800">{vehicle?.plate}</span>
                             <span className="text-xs font-mono text-slate-500">#{tx.voucherCode || '---'}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                           <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Litros (Bomba)</label>
                             <input 
                               type="number" 
                               className="w-full border border-slate-300 rounded-lg p-3 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                               value={fillData.liters}
                               onChange={e => setFillData({...fillData, liters: Number(e.target.value)})}
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Preço / Litro</label>
                             <input 
                               type="number" 
                               step="0.01"
                               className="w-full border border-slate-300 rounded-lg p-3 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                               value={fillData.price}
                               onChange={e => setFillData({...fillData, price: Number(e.target.value)})}
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1">KM Atual</label>
                             <input 
                               type="number" 
                               className="w-full border border-slate-300 rounded-lg p-3 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                               value={fillData.odometer}
                               onChange={e => setFillData({...fillData, odometer: Number(e.target.value)})}
                             />
                           </div>
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                           <div className="text-center md:text-left">
                             <span className="text-sm text-slate-500 font-medium">Valor Total da Transação</span>
                             <p className="text-3xl font-extrabold text-slate-900">R$ {(fillData.liters * fillData.price).toFixed(2)}</p>
                           </div>
                           <div className="flex gap-3 w-full md:w-auto">
                             <button onClick={() => setValidatingTx(null)} className="flex-1 md:flex-none px-6 py-3 text-slate-600 hover:bg-slate-50 rounded-lg font-medium transition-colors">Cancelar</button>
                             <button onClick={submitValidation} className="flex-1 md:flex-none px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors">Confirmar</button>
                           </div>
                        </div>
                      </div>
                    ) : (
                      // List Item
                      <div className="p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
                            {tx.requestedLiters}L
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                               <p className="font-bold text-slate-800 text-lg">{tx.fuelType}</p>
                               {tx.voucherCode && <span className="text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono text-slate-600 flex items-center gap-1"><Ticket size={10}/> {tx.voucherCode}</span>}
                            </div>
                            <p className="text-sm text-slate-500">Placa: <span className="text-slate-800 font-bold">{vehicle?.plate || '???'}</span></p>
                            <p className="text-xs text-slate-400 mt-0.5">Solicitante: {tx.driverName}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleStartValidation(tx)}
                          className="w-full md:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 font-medium shadow transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit3 size={16} /> Validar
                        </button>
                      </div>
                    )}
                  </div>
                 )
              })}
            </div>
          )}
        </div>

        {/* Product Price Management */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-fit overflow-hidden">
          <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center gap-2">
            <DollarSign className="text-emerald-600" /> 
            <h2 className="font-bold text-emerald-900">Gerenciar Preços</h2>
          </div>
          
          <div className="p-2">
            {Object.values(FuelType).map((type, idx) => {
              const prod = station.products.find(p => p.type === type);
              return (
                <div key={type} className={`p-4 ${idx !== Object.values(FuelType).length -1 ? 'border-b border-slate-50' : ''}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-700">{type}</span>
                    <span className="text-[10px] text-slate-400">
                      {prod?.lastUpdated ? `Atualizado: ${new Date(prod.lastUpdated).toLocaleDateString()}` : 'Nunca'}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-medium">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full border border-slate-200 bg-slate-50 rounded-lg py-2 pl-8 pr-4 font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                      value={prod?.price || ''}
                      onChange={(e) => updatePrice(type, Number(e.target.value))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="bg-slate-50 p-3 text-center text-xs text-slate-500 border-t border-slate-100">
             Os preços são atualizados em tempo real para os gestores.
          </div>
        </div>

      </div>
    </div>
  );
};
