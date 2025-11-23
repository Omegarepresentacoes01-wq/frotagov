
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  FLEET_MANAGER = 'FLEET_MANAGER',
  FUEL_STATION = 'FUEL_STATION'
}

export enum TransactionStatus {
  REQUESTED = 'REQUESTED',      // Manager asked for fuel
  VALIDATED = 'VALIDATED',      // Station filled and confirmed details
  INVOICED = 'INVOICED',        // Station sent monthly bill
  ADVANCE_REQUESTED = 'ADVANCE_REQUESTED', // Station requested early payment
  PAID = 'PAID',                // Admin paid the station
  CANCELLED = 'CANCELLED'
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
  username: string; // Login
  password?: string; // Stored locally for MVP demo purposes
  role: UserRole;
  orgId?: string; // For managers
  stationId?: string; // For station owners
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  contactName: string;
  contactPhone: string;
  balanceDue: number; // How much the Org owes the platform
  status: 'ACTIVE' | 'INACTIVE';
}

export interface FuelStation {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  contactName: string;
  baseFeePercentage: number; // Configured by Admin (1.5% - 15%)
  advanceFeePercentage: number; // Extra fee for early payment
  balancePending: number; // Validated but not invoiced
  balanceInvoiced: number; // Invoiced, waiting payment
  balancePaid: number; // Money already received
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
  department: string; // "Centro de Custo"
  type: 'Light' | 'Heavy' | 'Machine';
  currentOdometer: number;
  avgConsumption: number; // km/l target
}

export interface Transaction {
  id: string;
  orgId: string;
  stationId: string;
  vehicleId: string;
  driverName: string;
  status: TransactionStatus;
  requestDate: string;
  fuelType: FuelType;
  requestedLiters: number;
  
  // Validation details (filled by Station)
  validationDate?: string;
  filledLiters?: number;
  pricePerLiter?: number;
  totalValue?: number;
  odometer?: number;
  
  // Financials (Calculated by System)
  feePercentageApplied?: number; // Snapshot of fee at time of calc
  feeAmount?: number; // Total * Fee%
  netValue?: number; // Total - Fee
  isAdvanced?: boolean;
  paymentDate?: string;
}
