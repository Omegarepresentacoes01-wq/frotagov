
import React, { useEffect, useState, useRef } from 'react';
import { User, Transaction, FuelStation, TransactionStatus, FuelType, Organization, Invoice, InvoiceStatus } from '../types';
import { storageService } from '../services/storageService';
import { CheckCircle, Clock, DollarSign, Wallet, Zap, FileText, Upload, Building2, X, Search, Edit3 } from 'lucide-react';

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
  
  // No longer needed but kept for safety if we revert
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    alert("Abastecimento validado com sucesso! Disponível para faturamento.");
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
      console.log("Arquivo selecionado:", e.target.files[0].name);
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
        nfeFileUrl: selectedFile.name, // Simulated file URL
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
    alert(`Fatura #${newInvoice.nfeNumber} gerada com sucesso! O Gestor do Órgão foi notificado para atestar.`);
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

  if (!station) return <div className="p-8 text-center text-slate-500">Carregando dados do posto...</div>;

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">{station.name}</h1>
           <p className="text-slate-500 text-sm flex items-center gap-2">
             <CheckCircle size={14} className="text-emerald-500" /> Posto Credenciado - CNPJ: {station.cnpj}
           </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex">
          <button
            onClick={() => setActiveTab('SUPPLY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'SUPPLY' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Zap size={16} /> Abastecimentos
          </button>
          <button
            onClick={() => setActiveTab('BILLING')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'BILLING' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <FileText size={16} /> Financeiro & NFe
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-start">
             <div>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">A Faturar (Pendente)</p>
                <p className="text-3xl font-extrabold text-slate-800">R$ {station.balancePending.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-2">Validados, aguardando NFe</p>
             </div>
             <div className="bg-blue-50 p-3 rounded-xl"><Clock size={24} className="text-blue-600"/></div>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-start">
             <div>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Processando</p>
                <p className="text-3xl font-extrabold text-amber-500">R$ {station.balanceInvoiced.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-2">NFe emitida, aguardando pagto</p>
             </div>
             <div className="bg-amber-50 p-3 rounded-xl"><Wallet size={24} className="text-amber-600"/></div>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-start">
             <div>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Recebido</p>
                <p className="text-3xl font-extrabold text-emerald-600">R$ {station.balancePaid.toFixed(2)}</p>
             </div>
             <div className="bg-emerald-50 p-3 rounded-xl"><DollarSign size={24} className="text-emerald-600"/></div>
           </div>
        </div>
      </div>

      {/* === SUPPLY TAB === */}
      {activeTab === 'SUPPLY' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-700">Fila de Pista (Abastecimentos)</h2>
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

          {pendingSupply.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border-2 border-dashed border-slate-200">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Clock className="text-slate-300" size={32} />
              </div>
              <h3 className="text-slate-500 font-medium">Nenhum veículo aguardando validação.</h3>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingSupply.map(tx => {
                 const vehicle = storageService.getVehicles().find(v => v.id === tx.vehicleId);
                 return (
                  <div key={tx.id} className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all ${validatingTx === tx.id ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
                    {validatingTx === tx.id ? (
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
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Litros</label>
                             <input type="number" className="w-full border border-slate-300 rounded-lg p-3 text-lg font-bold text-slate-800" value={fillData.liters} onChange={e => setFillData({...fillData, liters: Number(e.target.value)})} />
                           </div>
                           <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1">R$ / Litro</label>
                             <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-3 text-lg font-bold text-slate-800" value={fillData.price} onChange={e => setFillData({...fillData, price: Number(e.target.value)})} />
                           </div>
                           <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1">KM Atual</label>
                             <input type="number" className="w-full border border-slate-300 rounded-lg p-3 text-lg font-bold text-slate-800" value={fillData.odometer} onChange={e => setFillData({...fillData, odometer: Number(e.target.value)})} />
                           </div>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                           <div className="text-center md:text-left">
                             <span className="text-sm text-slate-500 font-medium">Total</span>
                             <p className="text-3xl font-extrabold text-slate-900">R$ {(fillData.liters * fillData.price).toFixed(2)}</p>
                           </div>
                           <div className="flex gap-3">
                             <button onClick={() => setValidatingTx(null)} className="px-6 py-3 text-slate-600 font-medium">Cancelar</button>
                             <button onClick={submitValidation} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200">Confirmar</button>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">{tx.requestedLiters}L</div>
                          <div>
                            <div className="flex items-center gap-2"><p className="font-bold text-slate-800 text-lg">{tx.fuelType}</p>{tx.voucherCode && <span className="text-xs bg-slate-100 border px-2 rounded font-mono text-slate-600">{tx.voucherCode}</span>}</div>
                            <p className="text-sm text-slate-500">Placa: <span className="text-slate-800 font-bold">{vehicle?.plate}</span></p>
                          </div>
                        </div>
                        <button onClick={() => handleStartValidation(tx)} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 font-medium flex gap-2"><Edit3 size={16} /> Validar</button>
                      </div>
                    )}
                  </div>
                 )
              })}
            </div>
          )}
        </div>

        {/* Pricing Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-fit overflow-hidden">
          <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center gap-2">
            <DollarSign className="text-emerald-600" /> <h2 className="font-bold text-emerald-900">Preços na Bomba</h2>
          </div>
          <div className="p-2">
            {Object.values(FuelType).map((type) => {
              const prod = station.products.find(p => p.type === type);
              return (
                <div key={type} className="p-4 border-b border-slate-50 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-700">{type}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-medium">R$</span>
                    <input type="number" step="0.01" className="w-full border border-slate-200 bg-slate-50 rounded-lg py-2 pl-8 pr-4 font-bold text-slate-800" value={prod?.price || ''} onChange={(e) => updatePrice(type, Number(e.target.value))} placeholder="0.00" />
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
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Section 1: Ready to Invoice */}
                <div>
                    <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><Building2 size={20}/> Clientes com Saldo (A Faturar)</h2>
                    <div className="space-y-4">
                        {orgs.map(org => {
                            const pendingAmount = transactions
                                .filter(t => t.orgId === org.id && t.stationId === station.id && t.status === TransactionStatus.VALIDATED)
                                .reduce((acc, t) => acc + (t.totalValue || 0), 0);
                            
                            if (pendingAmount <= 0) return null;

                            return (
                                <div key={org.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-slate-800 text-lg">{org.name}</h3>
                                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">PENDENTE</span>
                                    </div>
                                    <p className="text-slate-500 text-sm mb-4">Total Validado: <span className="text-slate-900 font-bold text-xl block">R$ {pendingAmount.toFixed(2)}</span></p>
                                    
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => openInvoiceModal(org, false)}
                                            className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-50"
                                        >
                                            Fatura Mensal
                                        </button>
                                        <button 
                                            onClick={() => openInvoiceModal(org, true)}
                                            className="flex-1 bg-amber-50 border border-amber-200 text-amber-800 py-2 rounded-lg font-medium hover:bg-amber-100 flex items-center justify-center gap-1"
                                        >
                                            <Zap size={14}/> Antecipar
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                        {!orgs.some(o => transactions.some(t => t.orgId === o.id && t.stationId === station.id && t.status === TransactionStatus.VALIDATED)) && (
                            <p className="text-slate-400 italic">Nenhum saldo pendente para faturar.</p>
                        )}
                    </div>
                </div>

                {/* Section 2: Invoices History */}
                <div>
                     <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><FileText size={20}/> Histórico de Faturas</h2>
                     <div className="space-y-4">
                         {invoices.length === 0 ? <p className="text-slate-400 italic">Nenhuma nota fiscal emitida ainda.</p> : 
                           invoices.map(inv => {
                               const orgName = orgs.find(o => o.id === inv.orgId)?.name || 'Cliente';
                               return (
                                   <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                                       <div>
                                           <p className="font-bold text-slate-800">NF #{inv.nfeNumber}</p>
                                           <p className="text-xs text-slate-500">{orgName} • {new Date(inv.issueDate).toLocaleDateString()}</p>
                                           {inv.nfeFileUrl && <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1"><FileText size={10}/> {inv.nfeFileUrl}</p>}
                                           {inv.isAdvance && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded">Antecipação</span>}
                                       </div>
                                       <div className="text-right">
                                           <p className="font-bold text-slate-700">R$ {inv.netValue.toFixed(2)}</p>
                                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                               inv.status === InvoiceStatus.PENDING_MANAGER ? 'bg-amber-100 text-amber-700' :
                                               inv.status === InvoiceStatus.PENDING_ADMIN ? 'bg-blue-100 text-blue-700' :
                                               inv.status === InvoiceStatus.PAID ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
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
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-300">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800">Emitir Nota Fiscal</h3>
                      <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl mb-6">
                      <p className="text-xs text-slate-500 uppercase font-bold">Cliente</p>
                      <p className="font-bold text-slate-800">{selectedOrgForInvoice.name}</p>
                      <p className="text-xs text-slate-500 mt-2 uppercase font-bold">Tipo de Faturamento</p>
                      <p className={`font-bold ${invoiceForm.isAdvance ? 'text-amber-600' : 'text-slate-800'}`}>
                          {invoiceForm.isAdvance ? 'Antecipação de Recebíveis (+ Taxa)' : 'Faturamento Mensal Padrão'}
                      </p>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Número da Nota Fiscal (NFe)</label>
                          <input 
                              type="text" 
                              className="w-full border border-slate-300 rounded-lg p-3" 
                              placeholder="Ex: 000.123.456"
                              value={invoiceForm.number}
                              onChange={e => setInvoiceForm({...invoiceForm, number: e.target.value})}
                          />
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Arquivo XML ou PDF</label>
                          <label className="w-full border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer bg-slate-50/50">
                              <input 
                                  type="file" 
                                  className="hidden" 
                                  onChange={handleFileChange} 
                                  accept=".pdf,.xml,.jpg,.png"
                              />
                              {selectedFile ? (
                                  <>
                                    <CheckCircle size={32} className="text-blue-600 mb-2" />
                                    <span className="font-bold text-blue-900 text-sm text-center">{selectedFile.name}</span>
                                    <span className="text-xs text-blue-500">Clique para alterar</span>
                                  </>
                              ) : (
                                  <>
                                    <Upload size={24} className="mb-2 text-slate-400"/>
                                    <span className="text-xs text-slate-500">Clique para anexar arquivo da NFe</span>
                                  </>
                              )}
                          </label>
                      </div>

                      <button 
                          onClick={handleGenerateInvoice}
                          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!invoiceForm.number || !selectedFile}
                      >
                          Emitir e Enviar para Validação
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
