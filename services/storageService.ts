
import { User, UserRole, Organization, FuelStation, Vehicle, Transaction, FuelType, TransactionStatus } from '../types';

// Storage Keys
const KEYS = {
  USERS: 'frotagov_users',
  ORGS: 'frotagov_orgs',
  STATIONS: 'frotagov_stations',
  VEHICLES: 'frotagov_vehicles',
  TRANSACTIONS: 'frotagov_transactions',
  SESSION: 'frotagov_user_session'
};

// Helper to load/save
const load = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error(`Error loading key ${key}`, e);
    return defaultValue;
  }
};

const save = <T,>(key: string, data: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving key ${key}`, e);
    alert('Erro ao salvar dados localmente. Seu armazenamento pode estar cheio.');
  }
};

export const storageService = {
  init: () => {
    // 1. Ensure all arrays exist to prevent crashes
    if (!localStorage.getItem(KEYS.ORGS)) save(KEYS.ORGS, []);
    if (!localStorage.getItem(KEYS.STATIONS)) save(KEYS.STATIONS, []);
    if (!localStorage.getItem(KEYS.VEHICLES)) save(KEYS.VEHICLES, []);
    if (!localStorage.getItem(KEYS.TRANSACTIONS)) save(KEYS.TRANSACTIONS, []);

    // 2. USER RECOVERY SYSTEM
    let users = load<User[]>(KEYS.USERS, []);
    if (!Array.isArray(users)) users = [];

    // Check if the master admin exists. 
    // We explicitly check for the username 'admin' to guarantee access.
    const masterAdminIndex = users.findIndex(u => u.username === 'admin');

    const masterAdmin: User = {
      id: 'admin_master',
      name: 'Super Admin (Master)',
      username: 'admin',
      password: '123', // Hardcoded recovery password
      role: UserRole.SUPER_ADMIN,
      createdAt: new Date().toISOString()
    };

    if (masterAdminIndex === -1) {
      // If missing, add it immediately.
      console.log("⚠️ Master Admin missing. Restoring 'admin' / '123' access...");
      users.push(masterAdmin);
      save(KEYS.USERS, users);
    } else {
      // Optional: Ensure the master role is always correct, even if edited manually by mistake
      if (users[masterAdminIndex].role !== UserRole.SUPER_ADMIN) {
         users[masterAdminIndex].role = UserRole.SUPER_ADMIN;
         save(KEYS.USERS, users);
      }
    }
  },

  // --- BACKUP & RESTORE SYSTEM ---
  exportDatabase: (): string => {
    const db = {
      users: load(KEYS.USERS, []),
      orgs: load(KEYS.ORGS, []),
      stations: load(KEYS.STATIONS, []),
      vehicles: load(KEYS.VEHICLES, []),
      transactions: load(KEYS.TRANSACTIONS, []),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(db, null, 2);
  },

  importDatabase: (jsonContent: string): boolean => {
    try {
      const db = JSON.parse(jsonContent);
      
      // Basic validation schema
      if (!Array.isArray(db.users) || !Array.isArray(db.orgs)) {
        throw new Error("Formato de arquivo inválido.");
      }

      save(KEYS.USERS, db.users);
      save(KEYS.ORGS, db.orgs);
      save(KEYS.STATIONS, db.stations || []);
      save(KEYS.VEHICLES, db.vehicles || []);
      save(KEYS.TRANSACTIONS, db.transactions || []);
      
      // Re-run init to ensure admin is still there after import
      storageService.init();
      
      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  },
  
  clearDatabase: () => {
      // We clear everything EXCEPT the session maybe? No, clear all.
      localStorage.removeItem(KEYS.USERS);
      localStorage.removeItem(KEYS.ORGS);
      localStorage.removeItem(KEYS.STATIONS);
      localStorage.removeItem(KEYS.VEHICLES);
      localStorage.removeItem(KEYS.TRANSACTIONS);
      localStorage.removeItem(KEYS.SESSION);
      
      // Immediately re-init to restore Admin before reload
      storageService.init();
      
      window.location.reload();
  },

  // --- AUTH ---
  login: (username: string, pass: string): User | null => {
    const users = load<User[]>(KEYS.USERS, []);
    const user = users.find(u => u.username === username && u.password === pass);
    if (user) {
      localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
      return user;
    }
    return null;
  },
  
  logout: () => {
    localStorage.removeItem(KEYS.SESSION);
  },

  getSession: (): User | null => {
    return load<User | null>(KEYS.SESSION, null);
  },

  // --- CRUD Users ---
  getUsers: (): User[] => load(KEYS.USERS, []),
  createUser: (user: User) => {
    const users = load<User[]>(KEYS.USERS, []);
    if (users.find(u => u.username === user.username)) {
      throw new Error('Nome de usuário já existe');
    }
    save(KEYS.USERS, [...users, user]);
  },
  deleteUser: (id: string) => {
    const users = load<User[]>(KEYS.USERS, []);
    const userToDelete = users.find(u => u.id === id);
    
    // Protect the Master Admin
    if (userToDelete?.username === 'admin') {
        throw new Error("O Super Admin principal não pode ser removido.");
    }
    
    // Prevent deleting the last Super Admin (redundancy check)
    if (userToDelete?.role === UserRole.SUPER_ADMIN) {
        const adminCount = users.filter(u => u.role === UserRole.SUPER_ADMIN).length;
        if (adminCount <= 1) throw new Error("Não é possível remover o último Super Admin.");
    }
    save(KEYS.USERS, users.filter(u => u.id !== id));
  },

  // --- CRUD Orgs ---
  getOrgs: (): Organization[] => load(KEYS.ORGS, []),
  createOrg: (org: Organization) => {
    const orgs = load<Organization[]>(KEYS.ORGS, []);
    save(KEYS.ORGS, [...orgs, org]);
  },
  updateOrg: (org: Organization) => {
      const orgs = load<Organization[]>(KEYS.ORGS, []);
      save(KEYS.ORGS, orgs.map(o => o.id === org.id ? org : o));
  },

  // --- CRUD Stations ---
  getStations: (): FuelStation[] => load(KEYS.STATIONS, []),
  addStation: (station: FuelStation) => {
    const stations = load<FuelStation[]>(KEYS.STATIONS, []);
    save(KEYS.STATIONS, [...stations, station]);
  },
  updateStations: (stations: FuelStation[]) => save(KEYS.STATIONS, stations),

  // --- CRUD Vehicles ---
  getVehicles: (): Vehicle[] => load(KEYS.VEHICLES, []),
  updateVehicles: (vehicles: Vehicle[]) => save(KEYS.VEHICLES, vehicles),
  addVehicle: (vehicle: Vehicle) => {
      const vs = load<Vehicle[]>(KEYS.VEHICLES, []);
      save(KEYS.VEHICLES, [...vs, vehicle]);
  },
  deleteVehicle: (id: string) => {
    const vs = load<Vehicle[]>(KEYS.VEHICLES, []);
    save(KEYS.VEHICLES, vs.filter(v => v.id !== id));
  },

  // --- CRUD Transactions ---
  getTransactions: (): Transaction[] => load(KEYS.TRANSACTIONS, []),
  updateTransactions: (txs: Transaction[]) => save(KEYS.TRANSACTIONS, txs),

  // --- Financial Logic ---
  applyFees: (tx: Transaction, station: FuelStation, isAdvance: boolean): Transaction => {
    if (!tx.totalValue) return tx;
    
    const appliedRate = isAdvance 
      ? station.baseFeePercentage + station.advanceFeePercentage 
      : station.baseFeePercentage;

    const feeAmount = (tx.totalValue * appliedRate) / 100;
    const netValue = tx.totalValue - feeAmount;

    return {
      ...tx,
      feePercentageApplied: appliedRate,
      feeAmount,
      netValue,
      isAdvanced: isAdvance
    };
  }
};
