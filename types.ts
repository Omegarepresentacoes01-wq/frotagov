
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  FLEET_MANAGER = 'FLEET_MANAGER',
  FUEL_STATION = 'FUEL_STATION'
}

export enum TransactionStatus {
  REQUESTED = 'REQUESTED',      // Manager asked for fuel
  VALIDATED = 'VALIDATED',      // Station filled and confirmed details
  INVOICED = 'INVOICED',        // Linked to an Invoice (NFe)
  PAID = 'PAID',                // Admin paid the Invoice
  CANCELLED = 'CANCELLED'
}

export enum InvoiceStatus {
  PENDING_MANAGER = 'PENDING_MANAGER', // Posto emitiu, Gestor precisa atestar
  PENDING_ADMIN = 'PENDING_ADMIN',     // Gestor atestou, Admin precisa pagar
  PAID = 'PAID',                       // Admin pagou
  REJECTED = 'REJECTED'                // Gestor recusou (erro na nota, etc)
}

export enum FuelType {
  GASOLINE = 'Gasolina',
  ETHANOL = 'Etanol',
  DIESEL = 'Diesel',
  DIESEL_S10 = 'Diesel S10',
  CNG = 'GNV'
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  orgId?: string;
  stationId?: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  contactName: string;
  contactPhone: string;
  balanceDue: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface FuelStation {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  contactName: string;
  baseFeePercentage: number;
  advanceFeePercentage: number;
  balancePending: number; // Validated but not invoiced
  balanceInvoiced: number; // Invoiced (waiting approval or payment)
  balancePaid: number;
  products: Product[];
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Product {
  type: FuelType;
  price: number;
  lastUpdated: string;
}

export interface Vehicle {
  id: string;
  orgId: string;
  plate: string;
  model: string;
  department: string;
  type: 'Light' | 'Heavy' | 'Machine';
  currentOdometer: number;
  avgConsumption: number;
}

export interface Transaction {
  id: string;
  voucherCode: string;
  orgId: string;
  stationId: string;
  vehicleId: string;
  driverName: string;
  status: TransactionStatus;
  requestDate: string;
  fuelType: FuelType;
  requestedLiters: number;
  
  // Validation details
  validationDate?: string;
  filledLiters?: number;
  pricePerLiter?: number;
  totalValue?: number;
  odometer?: number;
  
  // Invoice Link
  invoiceId?: string;

  // Financials
  feePercentageApplied?: number;
  feeAmount?: number;
  netValue?: number;
  isAdvanced?: boolean;
  paymentDate?: string;
}

export interface Invoice {
  id: string;
  stationId: string;
  orgId: string;
  nfeNumber: string;
  nfeAccessKey?: string; // Simulate XML key
  nfeFileUrl?: string; // Simulated file
  totalValue: number;
  netValue: number; // Value station receives after fees
  feeAmount: number; // Platform cut
  issueDate: string;
  status: InvoiceStatus;
  isAdvance: boolean;
  transactionIds: string[];
}
