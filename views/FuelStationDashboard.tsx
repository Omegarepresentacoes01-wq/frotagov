
import React, { useEffect, useState, useRef } from 'react';
import { User, Transaction, FuelStation, TransactionStatus, FuelType, Organization, Invoice, InvoiceStatus } from '../types';
import { storageService } from '../services/storageService';
import { CheckCircle, Clock, DollarSign, Wallet, Zap, FileText, Upload, Building2, X, Search, Edit3, ChevronRight, File, Loader2 } from 'lucide-react';

interface Props {
  user: User;
}

type StationTab = 'SUPPLY' | 'BILLING';

export const FuelStationDashboard: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<StationTab>('SUPPLY');
  const [station, setStation] = useState<FuelStation | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  // Supply Tab State
  const [searchTerm, setSearchTerm] = useState('');
  const [validatingTx, setValidatingTx] = useState<string | null>(null);
  const [fillData, setFillData] = useState({ liters: 0, price: 0, odometer: 0 });

  // Billing Tab State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedOrgForInvoice, setSelectedOrgForInvoice] = useState<Organization | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ number: '', isAdvance: false });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [user.stationId]);

  const refreshData = () => {
    const s = storageService.getStations().find(s => s.id === user.stationId);
    setStation(s || null);
    
    // Refresh Tx
    const txs = storageService.getTransactions().filter(t => t.stationId === user.stationId);
    setTransactions(txs);
    
    // Refresh Orgs
    setOrgs(storageService.getOrgs());

    // Refresh Invoices
    setInvoices(storageService.getInvoices().filter(i => i.stationId === user.stationId));
  };

  // --- VALIDATION LOGIC ---

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
    
    // Calc balances
    const sTxs = updatedTxs.filter(t => t.stationId === station.id && t.status === TransactionStatus.VALIDATED);
    const newPending = sTxs.reduce((acc, t) => acc + (t.totalValue || 0), 0);
    
    const updatedStations = storageService.getStations().map(s => {
      if (s.id === station.id) return { ...s, balancePending: newPending };
      return s;
    });
    storageService.updateStations(updatedStations);

    setValidatingTx(null);
    refreshData();
  };

  // --- BILLING LOGIC (INVOICES) ---

  const openInvoiceModal = (org: Organization, isAdvance: boolean) => {
    setSelectedOrgForInvoice(org);
    setInvoiceForm({ number: '', isAdvance });
    setSelectedFile(null);
    setShowInvoiceModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleGenerateInvoice = () => {
    if(!selectedOrgForInvoice || !station || !invoiceForm.number) {
        alert("Por favor, preencha o número da Nota Fiscal.");
        return;
    }
    
    if(!selectedFile) {
        alert("É obrigatório anexar o arquivo (PDF ou XML) da Nota Fiscal.");
        return;
    }

    // Get validated transactions for this Org
    const pendingTxs = transactions.filter(t => 
        t.orgId === selectedOrgForInvoice.id && 
        t.status === TransactionStatus.VALIDATED
    );

    const totalValue = pendingTxs.reduce((acc, t) => acc + (t.totalValue || 0), 0);
    const { feeAmount, netValue } = storageService.applyFees(totalValue, station, invoiceForm.isAdvance);

    const newInvoice: Invoice = {
        id: `inv${Date.now()}`,
        stationId: station.id,
        orgId: selectedOrgForInvoice.id,
        nfeNumber: invoiceForm.number,
        nfeFileUrl: selectedFile.name, 
        totalValue,
        netValue,
        feeAmount,
        issueDate: new Date().toISOString(),
        status: InvoiceStatus.PENDING_MANAGER, // Posto emitiu -> Vai para o Gestor
        isAdvance: invoiceForm.isAdvance,
        transactionIds: pendingTxs.map(t => t.id)
    };

    // Update Transactions
    const allTxs = storageService.getTransactions();
    const updatedTxs = allTxs.map(t => {
        if (pendingTxs.find(pt => pt.id === t.id)) {
            return { ...t, status: TransactionStatus.INVOICED, invoiceId: newInvoice.id };
        }
        return t;
    });

    // Update Station Balance
    const updatedStations = storageService.getStations().map(s => {
        if(s.id === station.id) {
            return {
                ...s,
                balancePending: s.balancePending - totalValue,
                balanceInvoiced: s.balanceInvoiced + netValue
            }
        }
        return s;
    });

    storageService.createInvoice(newInvoice);
    storageService.updateTransactions(updatedTxs);
    storageService.updateStations(updatedStations);

    setShowInvoiceModal(false);
    refreshData();
    alert(`Fatura #${newInvoice.nfeNumber} enviada para o Gestor!`);
  };

  // --- PRICING LOGIC ---
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

  if (!station) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-blue-600" size={32}/><span className="text-slate-500 font-medium">Carregando posto...</span></div></div>;

  const pendingSupply = transactions
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
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 tracking-tight">{station.name}</h1>
           <div className="flex items-center gap-3 mt-1">
             <span className="text-slate-500 text-sm font-medium">CNPJ: {station.cnpj}</span>
             <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 flex items-center gap-1"><CheckCircle size={10} /> Credenciado</span>
           </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 flex">
          <button
            onClick={() => setActiveTab('SUPPLY')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'SUPPLY' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            <Zap size={18} strokeWidth={2.5} /> Pista & Abastecimento
          </button>
          <button
            onClick={() => setActiveTab('BILLING')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'BILLING' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            <FileText size={18} strokeWidth={2.5} /> Financeiro
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5"><Clock size={100} /></div>
           <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">A Faturar (Pendente)</p>
           <p className="text-3xl font-bold text-slate-800">R$ {station.balancePending.toFixed(2)}</p>
           <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400">
             <span className="bg-slate-100 px-2 py-1 rounded">Validados</span>
             <span>Aguardando emissão de NFe</span>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5 text-amber-500"><Wallet size={100} /></div>
           <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Em Processamento</p>
           <p className="text-3xl font-bold text-amber-500">R$ {station.balanceInvoiced.toFixed(2)}</p>
           <div className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-700/60">
             <span className="bg-amber-50 px-2 py-1 rounded border border-amber-100">NFe Emitida</span>
             <span>Aguardando Pagamento</span>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5 text-emerald-600"><DollarSign size={100} /></div>
           <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Recebido (Pago)</p>
           <p className="text-3xl font-bold text-emerald-600">R$ {station.balancePaid.toFixed(2)}</p>
           <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700/60">
             <span className="bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Creditado</span>
             <span>Disponível em conta</span>
           </div>
        </div>
      </div>

      {/* === SUPPLY TAB === */}
      {activeTab === 'SUPPLY' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-soft">
            <h2 className="text-lg font-bold text-slate-800 pl-2">Fila de Pista</h2>
            <div className="relative">
               <Search className="absolute left-3 top-3 text-slate-400" size={16} />
               <input 
                  type="text" 
                  placeholder="Buscar Placa ou Voucher..." 
                  className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
          </div>

          {pendingSupply.length === 0 ? (
            <div className="bg-white p-16 rounded-2xl text-center border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                 <Clock className="text-slate-300" size={40} />
              </div>
              <h3 className="text-slate-800 font-bold text-lg">Tudo tranquilo por aqui.</h3>
              <p className="text-slate-400">Nenhum veículo aguardando validação no momento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingSupply.map(tx => {
                 const vehicle = storageService.getVehicles().find(v => v.id === tx.vehicleId);
                 return (
                  <div key={tx.id} className={`bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden transition-all duration-300 ${validatingTx === tx.id ? 'ring-2 ring-blue-500 shadow-xl scale-[1.01]' : 'hover:shadow-md'}`}>
                    {validatingTx === tx.id ? (
                      <div className="p-6 bg-blue-50/50">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-blue-100">
                          <h3 className="font-bold text-blue-900 flex items-center gap-2"><Edit3 size={18}/> Validar Abastecimento</h3>
                          <div className="text-right">
                             <div className="text-lg font-bold text-slate-800">{vehicle?.plate}</div>
                             <div className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-blue-100">Voucher: {tx.voucherCode}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                           <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Litros</label>
                             <input type="number" className="w-full border border-blue-200 focus:border-blue-500 rounded-xl p-3.5 text-xl font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all" value={fillData.liters} onChange={e => setFillData({...fillData, liters: Number(e.target.value)})} />
                           </div>
                           <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Preço (R$)</label>
                             <input type="number" step="0.01" className="w-full border border-blue-200 focus:border-blue-500 rounded-xl p-3.5 text-xl font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all" value={fillData.price} onChange={e => setFillData({...fillData, price: Number(e.target.value)})} />
                           </div>
                           <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">KM Atual</label>
                             <input type="number" className="w-full border border-blue-200 focus:border-blue-500 rounded-xl p-3.5 text-xl font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all" value={fillData.odometer} onChange={e => setFillData({...fillData, odometer: Number(e.target.value)})} />
                           </div>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                           <div className="text-center md:text-left">
                             <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Valor Total</span>
                             <p className="text-3xl font-black text-slate-900 tracking-tight">R$ {(fillData.liters * fillData.price).toFixed(2)}</p>
                           </div>
                           <div className="flex gap-3 w-full md:w-auto">
                             <button onClick={() => setValidatingTx(null)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors flex-1 md:flex-none">Cancelar</button>
                             <button onClick={submitValidation} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all transform active:scale-95 flex-1 md:flex-none">Confirmar Validação</button>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-5 w-full">
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex flex-col items-center justify-center border border-blue-100 shadow-sm shrink-0">
                            <span className="font-bold text-xl leading-none">{tx.requestedLiters}</span>
                            <span className="text-[10px] font-bold uppercase mt-0.5">Litros</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800 text-lg">{tx.fuelType}</span>
                                <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono text-slate-500 font-bold">{tx.voucherCode}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span>Placa:</span>
                                <span className="text-slate-800 font-bold bg-slate-50 px-1.5 rounded">{vehicle?.plate}</span>
                                <span className="text-slate-300">•</span>
                                <span>{vehicle?.model}</span>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => handleStartValidation(tx)} className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-200 transition-all group">
                            Validar 
                            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform"/>
                        </button>
                      </div>
                    )}
                  </div>
                 )
              })}
            </div>
          )}
        </div>

        {/* Pricing Panel */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 h-fit overflow-hidden">
          <div className="bg-emerald-600 p-5 flex items-center gap-2 text-white">
            <DollarSign /> <h2 className="font-bold text-lg">Tabela de Preços</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {Object.values(FuelType).map((type) => {
              const prod = station.products.find(p => p.type === type);
              return (
                <div key={type} className="p-5 hover:bg-slate-50 transition-colors group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-700 text-sm">{type}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">R$</span>
                    <input type="number" step="0.01" className="w-full border border-slate-200 bg-white group-hover:bg-white focus:bg-white rounded-xl py-2.5 pl-10 pr-4 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={prod?.price || ''} onChange={(e) => updatePrice(type, Number(e.target.value))} placeholder="0.00" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      )}

      {/* === BILLING TAB === */}
      {activeTab === 'BILLING' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Section 1: Ready to Invoice */}
                <div>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Building2 size={20} className="text-blue-500"/> Clientes com Saldo (A Faturar)</h2>
                    <div className="space-y-4">
                        {orgs.map(org => {
                            const pendingAmount = transactions
                                .filter(t => t.orgId === org.id && t.stationId === station.id && t.status === TransactionStatus.VALIDATED)
                                .reduce((acc, t) => acc + (t.totalValue || 0), 0);
                            
                            if (pendingAmount <= 0) return null;

                            return (
                                <div key={org.id} className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                              <h3 className="font-bold text-slate-800 text-lg">{org.name}</h3>
                                              <p className="text-slate-400 text-xs mt-1">CNPJ: {org.cnpj}</p>
                                            </div>
                                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">Pendente</span>
                                        </div>
                                        
                                        <div className="mb-6">
                                           <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Validado</p>
                                           <p className="text-slate-900 font-black text-3xl">R$ {pendingAmount.toFixed(2)}</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => openInvoiceModal(org, false)}
                                                className="bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm"
                                            >
                                                Fatura Mensal
                                            </button>
                                            <button 
                                                onClick={() => openInvoiceModal(org, true)}
                                                className="bg-amber-50 border border-amber-100 text-amber-700 py-3 rounded-xl font-bold hover:bg-amber-100 transition-colors text-sm flex items-center justify-center gap-2"
                                            >
                                                <Zap size={16}/> Antecipar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {!orgs.some(o => transactions.some(t => t.orgId === o.id && t.stationId === station.id && t.status === TransactionStatus.VALIDATED)) && (
                             <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                                <p className="text-slate-400 font-medium">Nenhum saldo pendente para faturar.</p>
                             </div>
                        )}
                    </div>
                </div>

                {/* Section 2: Invoices History */}
                <div>
                     <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><FileText size={20} className="text-slate-500"/> Histórico de Faturas</h2>
                     <div className="space-y-3">
                         {invoices.length === 0 ? <p className="text-slate-400 italic">Nenhuma nota fiscal emitida ainda.</p> : 
                           invoices.map(inv => {
                               const orgName = orgs.find(o => o.id === inv.orgId)?.name || 'Cliente';
                               return (
                                   <div key={inv.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:bg-slate-50 transition-colors">
                                       <div>
                                           <div className="flex items-center gap-2 mb-1">
                                             <span className="font-bold text-slate-800">NF #{inv.nfeNumber}</span>
                                             {inv.isAdvance && <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase">Antecipação</span>}
                                           </div>
                                           <p className="text-xs text-slate-500 font-medium">{orgName} • {new Date(inv.issueDate).toLocaleDateString()}</p>
                                           {inv.nfeFileUrl && <p className="text-[10px] text-blue-500 mt-1.5 flex items-center gap-1 font-bold"><FileText size={10}/> {inv.nfeFileUrl}</p>}
                                       </div>
                                       <div className="text-right">
                                           <p className="font-bold text-slate-800 mb-1">R$ {inv.netValue.toFixed(2)}</p>
                                           <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                               inv.status === InvoiceStatus.PENDING_MANAGER ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                               inv.status === InvoiceStatus.PENDING_ADMIN ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                               inv.status === InvoiceStatus.PAID ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                                           }`}>
                                               {inv.status === InvoiceStatus.PENDING_MANAGER ? 'AG. GESTOR' :
                                                inv.status === InvoiceStatus.PENDING_ADMIN ? 'AG. PAGAMENTO' :
                                                inv.status === InvoiceStatus.PAID ? 'PAGO' : 'RECUSADO'}
                                           </span>
                                       </div>
                                   </div>
                               )
                           })
                         }
                     </div>
                </div>
             </div>
          </div>
      )}

      {/* Invoice Generation Modal */}
      {showInvoiceModal && selectedOrgForInvoice && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-300">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-bold text-slate-800">Emitir Nota Fiscal</h3>
                      <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  
                  <div className="bg-slate-50 p-5 rounded-2xl mb-8 border border-slate-100">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs text-slate-500 uppercase font-bold">Cliente</span>
                        <span className="text-xs text-slate-500 uppercase font-bold">Modalidade</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <p className="font-bold text-slate-800 text-sm">{selectedOrgForInvoice.name}</p>
                         <p className={`font-bold text-xs px-2 py-1 rounded ${invoiceForm.isAdvance ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                             {invoiceForm.isAdvance ? 'Antecipação' : 'Mensal'}
                         </p>
                      </div>
                  </div>

                  <div className="space-y-6">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Número da NFe</label>
                          <input 
                              type="text" 
                              className="w-full border border-slate-200 rounded-xl p-3.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-slate-800"
                              placeholder="000.000.000"
                              value={invoiceForm.number}
                              onChange={e => setInvoiceForm({...invoiceForm, number: e.target.value})}
                          />
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Anexar Arquivo (PDF/XML)</label>
                          <label className={`w-full border-2 border-dashed ${selectedFile ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300 bg-slate-50'} rounded-xl p-8 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer group`}>
                              <input 
                                  type="file" 
                                  className="hidden" 
                                  onChange={handleFileChange} 
                                  accept=".pdf,.xml,.jpg,.png"
                              />
                              {selectedFile ? (
                                  <>
                                    <CheckCircle size={32} className="text-emerald-500 mb-3" />
                                    <span className="font-bold text-slate-700 text-sm text-center break-all px-4">{selectedFile.name}</span>
                                    <span className="text-xs text-emerald-600 font-bold mt-1">Arquivo Selecionado</span>
                                  </>
                              ) : (
                                  <>
                                    <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                      <Upload size={24} className="text-blue-500"/>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600">Clique para enviar</span>
                                    <span className="text-xs text-slate-400 mt-1">PDF, XML ou Imagem</span>
                                  </>
                              )}
                          </label>
                      </div>

                      <button 
                          onClick={handleGenerateInvoice}
                          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
                          disabled={!invoiceForm.number || !selectedFile}
                      >
                          Emitir Fatura
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
