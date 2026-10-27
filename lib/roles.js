// Centralized Role Definitions for Zebra IMS (Shared between Client App & Admin Server)

export const ROLE_DEFINITIONS = {
  Admin: {
    key: 'Admin',
    label: '👑 Admin / Business Owner',
    shortLabel: 'Admin',
    icon: '👑',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Full complete administrative access to all modules.',
    tabs: ['ALL'],
  },
  Manager: {
    key: 'Manager',
    label: '💼 General Manager',
    shortLabel: 'Manager',
    icon: '💼',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Overall mill supervision: sales, stock, ledgers, cash flow, and analytics.',
    tabs: [
      'Dashboard',
      'Stock',
      'Stores',
      'Inventory',
      'Customers',
      'Sale Invoice',
      'Purchase Invoice',
      'Suppliers',
      'Categories',
      'Billing History',
      'Daily Ledger',
      'Cash Information',
      'Cash in Hand',
      'Report and Analytics',
      'Expenses',
      'Calculator',
    ],
  },
  Cashier: {
    key: 'Cashier',
    label: '💵 Cashier / Billing Counter',
    shortLabel: 'Cashier',
    icon: '💵',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Billing counter: sale invoices, billing history, daily ledger, cash in hand, and customer khata.',
    tabs: [
      'Sale Invoice',
      'Billing History',
      'Customers',
      'Daily Ledger',
      'Cash in Hand',
      'Calculator',
    ],
  },
  'Purchase Officer': {
    key: 'Purchase Officer',
    label: '🛒 Purchase Officer',
    shortLabel: 'Purchase Officer',
    icon: '🛒',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Handles supplier purchasing, receiving, stock additions, and supplier khata.',
    tabs: [
      'Purchase Invoice',
      'Suppliers',
      'Stock',
      'Stores',
      'Inventory',
      'Categories',
      'Calculator',
    ],
  },
  'Store Keeper': {
    key: 'Store Keeper',
    label: '📦 Store Keeper / Godown Incharge',
    shortLabel: 'Store Keeper',
    icon: '📦',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Warehouse stock levels, godown movement, and inventory counts.',
    tabs: [
      'Stock',
      'Stores',
      'Inventory',
      'Categories',
    ],
  },
  Accountant: {
    key: 'Accountant',
    label: '🏦 Accountant / Munshi',
    shortLabel: 'Accountant',
    icon: '🏦',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Financial accounts: party khatas, daily ledgers, banks, cash, and expenses.',
    tabs: [
      'Dashboard',
      'Customers',
      'Suppliers',
      'Billing History',
      'Daily Ledger',
      'Cash Information',
      'Cash in Hand',
      'Bank Management Credit',
      'Bank Management Debit',
      'Expenses',
      'Report and Analytics',
      'Calculator',
    ],
  },
  Gatekeeper: {
    key: 'Gatekeeper',
    label: '🚪 Gatekeeper / Security',
    shortLabel: 'Gatekeeper',
    icon: '🚪',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Gate pass dispatch checking and warehouse stock verification.',
    tabs: [
      'Stock',
      'Stores',
      'Inventory',
    ],
  },
  Employee: {
    key: 'Employee',
    label: '👤 Staff / General Employee',
    shortLabel: 'Employee',
    icon: '👤',
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
    description: 'General staff: sale invoices and billing history.',
    tabs: [
      'Sale Invoice',
      'Billing History',
    ],
  },
}

export function getRoleMeta(roleKey) {
  if (!roleKey) return ROLE_DEFINITIONS.Employee
  const key = String(roleKey).trim()
  if (ROLE_DEFINITIONS[key]) return ROLE_DEFINITIONS[key]

  // Case-insensitive fallback
  const found = Object.values(ROLE_DEFINITIONS).find(
    (r) => r.key.toLowerCase() === key.toLowerCase() || r.shortLabel.toLowerCase() === key.toLowerCase()
  )
  if (found) return found

  return {
    key,
    label: `👤 ${key}`,
    shortLabel: key,
    icon: '👤',
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
    description: 'Custom staff member',
    tabs: ['Sale Invoice', 'Billing History'],
  }
}

// Backwards-compatible export for existing code using ROLE_PRESETS
export const ROLE_PRESETS = ROLE_DEFINITIONS
