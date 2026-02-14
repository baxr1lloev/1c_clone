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
        keywords: ["Рабочий стол", "Главная"],
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
        keywords: ["Банковские выписки", "Счет"],
      },
      {
        id: "cashOrders",
        title: "Cash Orders",
        href: "/documents/cash-orders",
        icon: PiCoinsBold,
        keywords: ["Налоговая отчетность", "НДС", "НДС"],
      },
      {
        id: "payments",
        title: "Payments",
        href: "/documents/payments",
        icon: PiArrowsLeftRightBold,
        keywords: ["Валютные операции"],
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
        keywords: ["Реализации", "Начисления", "НДС"],
      },
      {
        id: "salesOrders",
        title: "Sales Orders",
        href: "/documents/sales-orders",
        icon: PiClipboardTextBold,
        keywords: ["Заказы", "Отчет по складу"],
      },
      {
        id: "counterparties",
        title: "Counterparties",
        href: "/directories/counterparties",
        icon: PiUsersBold,
        keywords: ["Контрагент"],
      },
      {
        id: "contracts",
        title: "Contracts",
        href: "/directories/contracts",
        icon: PiFilesBold,
        keywords: ["Договоры", "Управление договорами контрагентов"],
      },
      {
        id: "nomenclature",
        title: "Nomenclature (Items)",
        href: "/directories/categories",
        icon: PiPackageBold,
        keywords: ["Номенклатура", "Товары для продажи"],
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
        keywords: ["Перемещение товаров и услуг", "Валютные операции"],
      },
      {
        id: "counterparties",
        title: "Counterparties",
        href: "/directories/counterparties",
        icon: PiUsersBold,
        keywords: ["Амортизация", "Контрагент"],
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
        keywords: ["Остатки товаров"],
      },
      {
        id: "transfers",
        title: "Transfers",
        href: "/documents/transfers",
        icon: PiTruckBold,
        keywords: ["Перемещение товаров"],
      },
      {
        id: "inventory",
        title: "Inventories",
        href: "/documents/inventory",
        icon: PiClipboardTextBold,
        keywords: ["Контрагенты", "Номенклатура", "Переводы"],
      },
      {
        id: "nomenclature",
        title: "Nomenclature",
        href: "/directories/categories",
        icon: PiPackageBold,
        keywords: ["Номенклатура", "Склады"],
      },
      {
        id: "warehouses",
        title: "Warehouses",
        href: "/directories/warehouses",
        icon: PiBuildingsBold,
        keywords: ["Склады"],
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
        keywords: ["Журнал операций", "Переводы", "Корреспонденция счет"],
      },
      {
        id: "periodClosing",
        title: "Period Closing",
        href: "/accounting/period-closing",
        icon: PiLightningBold,
        keywords: ["Кассовые ордера", "Типовые операции"],
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
        keywords: ["НДС", "Оборотно-сальдовая ведомость"],
      },
      {
        id: "profitLoss",
        title: "Profit & Loss",
        href: "/reports/profit-loss",
        icon: PiTrendUpBold,
        keywords: ["Финансовые отчеты"],
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
        keywords: ["Переводы"],
      },
      {
        id: "currencies",
        title: "Currencies",
        href: "/directories/currencies",
        icon: PiCoinsBold,
        keywords: ["Склады"],
      },
      {
        id: "allDirectories",
        title: "All Directories",
        href: "/directories",
        icon: PiFolderOpenBold,
        keywords: ["Все справочники"],
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
        keywords: ["Номенклатура"],
      },
      {
        id: "settings",
        title: "Settings",
        href: "/settings",
        icon: PiGearBold,
        keywords: ["Начисления"],
      },
      {
        id: "allFunctions",
        title: "All Functions",
        href: "/system/functions",
        icon: PiScrollBold,
        keywords: ["Все функции"],
      },
    ],
  },
];
