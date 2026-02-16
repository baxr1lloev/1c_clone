import {
  PiFolderOpenBold,
  PiUsersBold,
  PiPackageBold,
  PiBuildingsBold,
  PiFilesBold,
  PiCoinsBold,
  PiFileTextBold,
  PiReceiptBold,
  PiClipboardTextBold,
  PiWalletBold,
  PiArrowsLeftRightBold,
  PiTruckBold,
  PiChartBarBold,
  PiTrendUpBold,
  PiBookOpenBold,
  PiGearBold,
  PiSquaresFourBold,
  PiLightningBold,
  PiTreeStructureBold,
  PiBankBold,
  PiScrollBold,
} from "react-icons/pi";

export interface NavItem {
  id: string; // Added for translation
  title: string; // Fallback
  href: string;
  icon?: any;
  keywords?: string[];
  description?: string;
  children?: NavItem[];
}

export interface NavGroup {
  id: string;
  title: string; // Fallback
  icon: any;
  items: NavItem[];
}

export const navigationConfig: NavGroup[] = [
  {
    id: "main",
    title: "Main",
    icon: PiSquaresFourBold,
    items: [
      {
        id: "dashboard",
        title: "Getting Started",
        href: "/",
        icon: PiSquaresFourBold,
        keywords: ["Р Р°Р±РѕС‡РёР№ СЃС‚РѕР»", "Р“Р»Р°РІРЅР°СЏ"],
      },
    ],
  },
  {
    id: "bank_cash",
    title: "Bank and Cash",
    icon: PiBankBold,
    items: [
      {
        id: "bankStatements",
        title: "Bank Statements",
        href: "/documents/bank-statements",
        icon: PiFileTextBold,
        keywords: ["Р‘Р°РЅРєРѕРІСЃРєРёРµ РІС‹РїРёСЃРєРё", "РЎС‡РµС‚"],
      },
      {
        id: "cashOrders",
        title: "Cash Orders",
        href: "/documents/cash-orders",
        icon: PiCoinsBold,
        keywords: ["РќР°Р»РѕРіРѕРІР°СЏ РѕС‚С‡РµС‚РЅРѕСЃС‚СЊ", "РќР”РЎ", "РќР”РЎ"],
      },
      {
        id: "payments",
        title: "Payments",
        href: "/documents/payments",
        icon: PiArrowsLeftRightBold,
        keywords: ["currency operations"],
      },
      {
        id: "bankAccounts",
        title: "Bank Accounts",
        href: "/directories/bank-accounts",
        icon: PiBankBold,
        keywords: ["bank accounts", "51", "52"],
      },
      {
        id: "bankExchangeSettings",
        title: "Bank Exchange Settings",
        href: "/directories/bank-exchange-settings",
        icon: PiGearBold,
        keywords: ["client bank", "iso20022", "exchange"],
      },
    ],
  },
  {
    id: "sales",
    title: "Sales",
    icon: PiReceiptBold,
    items: [
      {
        id: "salesRealization",
        title: "Sales (Realization)",
        href: "/documents/sales",
        icon: PiFileTextBold,
        keywords: ["Р РµР°Р»РёР·Р°С†РёРё", "РќР°С‡РёСЃР»РµРЅРёСЏ", "РќР”РЎ"],
      },
      {
        id: "salesOrders",
        title: "Sales Orders",
        href: "/documents/sales-orders",
        icon: PiClipboardTextBold,
        keywords: ["Р—Р°РєР°Р·С‹", "РћС‚С‡РµС‚ РїРѕ СЃРєР»Р°РґСѓ"],
      },
      {
        id: "counterparties",
        title: "Counterparties",
        href: "/directories/counterparties",
        icon: PiUsersBold,
        keywords: ["РљРѕРЅС‚СЂР°РіРµРЅС‚"],
      },
      {
        id: "contracts",
        title: "Contracts",
        href: "/directories/contracts",
        icon: PiFilesBold,
        keywords: ["Р”РѕРіРѕРІРѕСЂС‹", "РЈРїСЂР°РІР»РµРЅРёРµ РґРѕРіРѕРІРѕСЂР°РјРё РєРѕРЅС‚СЂР°РіРµРЅС‚РѕРІ"],
      },
      {
        id: "nomenclature",
        title: "Nomenclature (Items)",
        href: "/directories/categories",
        icon: PiPackageBold,
        keywords: ["РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°", "РўРѕРІР°СЂС‹ РґР»СЏ РїСЂРѕРґР°Р¶Рё"],
      },
    ],
  },
  {
    id: "purchases",
    title: "Purchases",
    icon: PiWalletBold,
    items: [
      {
        id: "purchasesReceipts",
        title: "Purchases (Receipts)",
        href: "/documents/purchases",
        icon: PiFileTextBold,
        keywords: ["РџРµСЂРµРјРµС‰РµРЅРёРµ С‚РѕРІР°СЂРѕРІ Рё СѓСЃР»СѓРі", "Р’Р°Р»СЋС‚РЅС‹Рµ РѕРїРµСЂР°С†РёРё"],
      },
      {
        id: "counterparties",
        title: "Counterparties",
        href: "/directories/counterparties",
        icon: PiUsersBold,
        keywords: ["РђРјРѕСЂС‚РёР·Р°С†РёСЏ", "РљРѕРЅС‚СЂР°РіРµРЅС‚"],
      },
    ],
  },
  {
    id: "warehouse",
    title: "Warehouse",
    icon: PiBuildingsBold,
    items: [
      {
        id: "stockBalance",
        title: "Stock Balance",
        href: "/reports/stock-balance",
        icon: PiChartBarBold,
        keywords: ["РћСЃС‚Р°С‚РєРё С‚РѕРІР°СЂРѕРІ"],
      },
      {
        id: "transfers",
        title: "Transfers",
        href: "/documents/transfers",
        icon: PiTruckBold,
        keywords: ["РџРµСЂРµРјРµС‰РµРЅРёРµ С‚РѕРІР°СЂРѕРІ"],
      },
      {
        id: "inventory",
        title: "Inventories",
        href: "/documents/inventory",
        icon: PiClipboardTextBold,
        keywords: ["РљРѕРЅС‚СЂР°РіРµРЅС‚С‹", "РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°", "РџРµСЂРµРІРѕРґС‹"],
      },
      {
        id: "nomenclature",
        title: "Nomenclature",
        href: "/directories/categories",
        icon: PiPackageBold,
        keywords: ["РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°", "РЎРєР»Р°РґС‹"],
      },
      {
        id: "warehouses",
        title: "Warehouses",
        href: "/directories/warehouses",
        icon: PiBuildingsBold,
        keywords: ["РЎРєР»Р°РґС‹"],
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    icon: PiTreeStructureBold,
    items: [
      {
        id: "journalEntries",
        title: "Journal Entries",
        href: "/accounting/journal",
        icon: PiBookOpenBold,
        keywords: ["Р–СѓСЂРЅР°Р» РѕРїРµСЂР°С†РёР№", "РџРµСЂРµРІРѕРґС‹", "РљРѕСЂСЂРµСЃРїРѕРЅРґРµРЅС†РёСЏ СЃС‡РµС‚"],
      },
      {
        id: "periodClosing",
        title: "Period Closing",
        href: "/accounting/period-closing",
        icon: PiLightningBold,
        keywords: ["РљР°СЃСЃРѕРІС‹Рµ РѕСЂРґРµСЂР°", "РўРёРїРѕРІС‹Рµ РѕРїРµСЂР°С†РёРё"],
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    icon: PiChartBarBold,
    items: [
      {
        id: "trialBalance",
        title: "Trial Balance",
        href: "/reports/trial-balance",
        icon: PiChartBarBold,
        keywords: ["РќР”РЎ", "РћР±РѕСЂРѕС‚РЅРѕ-СЃР°Р»СЊРґРѕРІР°СЏ РІРµРґРѕРјРѕСЃС‚СЊ"],
      },
      {
        id: "profitLoss",
        title: "Profit & Loss",
        href: "/reports/profit-loss",
        icon: PiTrendUpBold,
        keywords: ["Р¤РёРЅР°РЅСЃРѕРІС‹Рµ РѕС‚С‡РµС‚С‹"],
      },
    ],
  },
  {
    id: "directories",
    title: "Directories",
    icon: PiFolderOpenBold,
    items: [
      {
        id: "contracts",
        title: "Contracts",
        href: "/directories/contracts",
        icon: PiFilesBold,
        keywords: ["РџРµСЂРµРІРѕРґС‹"],
      },
      {
        id: "currencies",
        title: "Currencies",
        href: "/directories/currencies",
        icon: PiCoinsBold,
        keywords: ["РЎРєР»Р°РґС‹"],
      },
      {
        id: "allDirectories",
        title: "All Directories",
        href: "/directories",
        icon: PiFolderOpenBold,
        keywords: ["all directories"],
      },
    ],
  },
  {
    id: "admin",
    title: "Administration",
    icon: PiGearBold,
    items: [
      {
        id: "users",
        title: "Users",
        href: "/admin/users",
        icon: PiUsersBold,
        keywords: ["РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°"],
      },
      {
        id: "settings",
        title: "Settings",
        href: "/settings",
        icon: PiGearBold,
        keywords: ["РќР°С‡РёСЃР»РµРЅРёСЏ"],
      },
      {
        id: "allFunctions",
        title: "All Functions",
        href: "/system/functions",
        icon: PiScrollBold,
        keywords: ["Р’СЃРµ С„СѓРЅРєС†РёРё"],
      },
    ],
  },
];

