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
import type { IconType } from "react-icons";

export interface NavItem {
  id: string; // Added for translation
  title: string; // Fallback
  href: string;
  icon: IconType;
  keywords?: string[];
  description?: string;
  children?: NavItem[];
}

export interface NavGroup {
  id: string;
  title: string; // Fallback
  icon: IconType;
  items: NavItem[];
}

export const navigationConfig: NavGroup[] = [
  {
    id: "main",
    title: "Главная",
    icon: PiSquaresFourBold,
    items: [
      {
        id: "dashboard",
        title: "Рабочий стол",
        href: "/",
        icon: PiSquaresFourBold,
        keywords: ["Рабочий стол", "Главная"],
      },
    ],
  },
  {
    id: "bank_cash",
    title: "Банк и касса",
    icon: PiBankBold,
    items: [
      {
        id: "bankStatements",
        title: "Банковские выписки",
        href: "/documents/bank-statements",
        icon: PiFileTextBold,
        keywords: ["Банковские выписки", "Счет"],
      },
      {
        id: "cashOrders",
        title: "Рабочий стол касса",
        href: "/documents/cash-orders",
        icon: PiCoinsBold,
        keywords: ["Налоговая отчетность", "НДС", "НДС"],
      },
      {
        id: "cashDirectory",
        title: "Касса",
        href: "/bank-cash/cash",
        icon: PiWalletBold,
        keywords: ["Касса", "Банк", "Наличные", "Безнал"],
      },
      {
        id: "payments",
        title: "Платежи",
        href: "/documents/payments",
        icon: PiArrowsLeftRightBold,
        keywords: ["currency operations"],
      },
      {
        id: "bankAccounts",
        title: "Банковские счета",
        href: "/directories/bank-accounts",
        icon: PiBankBold,
        keywords: ["bank accounts", "51", "52"],
      },
      {
        id: "bankExchangeSettings",
        title: "Настройки обмена с банком",
        href: "/directories/bank-exchange-settings",
        icon: PiGearBold,
        keywords: ["client bank", "iso20022", "exchange"],
      },
    ],
  },
  {
    id: "sales",
    title: "Продажи",
    icon: PiReceiptBold,
    items: [
      {
        id: "salesRealization",
        title: "Реализации",
        href: "/documents/sales",
        icon: PiFileTextBold,
        keywords: ["Реализации", "Начисления", "НДС"],
      },
      {
        id: "salesOrders",
        title: "Заказы покупателей",
        href: "/documents/sales-orders",
        icon: PiClipboardTextBold,
        keywords: ["Заказы", "Отчет по складу"],
      },
      {
        id: "counterparties",
        title: "Контрагенты",
        href: "/directories/counterparties",
        icon: PiUsersBold,
        keywords: ["Контрагент"],
      },
      {
        id: "contracts",
        title: "Договоры",
        href: "/directories/contracts",
        icon: PiFilesBold,
        keywords: ["Договоры", "Управление договорами контрагентов"],
      },
      {
        id: "nomenclature",
        title: "Номенклатура",
        href: "/directories/items",
        icon: PiPackageBold,
        keywords: ["Номенклатура", "Товары для продажи"],
      },
      {
        id: "salesReports",
        title: "Отчеты",
        href: "/reports/sales-menu",
        icon: PiScrollBold,
        keywords: ["Отчеты", "Акт сверки", "Отчет по продажам"],
      },
    ],
  },
  {
    id: "purchases",
    title: "Закупки",
    icon: PiWalletBold,
    items: [
      {
        id: "purchasesReceipts",
        title: "Поступления",
        href: "/documents/purchases",
        icon: PiFileTextBold,
        keywords: ["Перемещение товаров и услуг", "Валютные операции"],
      },
      {
        id: "counterparties",
        title: "Контрагенты",
        href: "/directories/counterparties",
        icon: PiUsersBold,
        keywords: ["Амортизация", "Контрагент"],
      },
      {
        id: "purchasesReports",
        title: "Отчеты",
        href: "/reports",
        icon: PiScrollBold,
        keywords: ["Отчеты", "Материальный отчет", "Отчет по поставщикам"],
      },
    ],
  },
  {
    id: "warehouse",
    title: "Склад",
    icon: PiBuildingsBold,
    items: [
      {
        id: "stockBalance",
        title: "Материальный отчет общий",
        href: "/reports/warehouse-materials",
        icon: PiChartBarBold,
        keywords: ["Материальный отчет", "Общий материальный отчет"],
      },
      {
        id: "transfers",
        title: "Перемещения",
        href: "/documents/transfers",
        icon: PiTruckBold,
        keywords: ["Перемещение товаров"],
      },
      {
        id: "inventory",
        title: "Инвентаризация",
        href: "/documents/inventory",
        icon: PiClipboardTextBold,
        keywords: ["Контрагенты", "Номенклатура", "Переводы"],
      },
      {
        id: "nomenclature",
        title: "Номенклатура",
        href: "/directories/items",
        icon: PiPackageBold,
        keywords: ["Номенклатура", "Склады"],
      },
      {
        id: "warehouses",
        title: "Склады",
        href: "/directories/warehouses",
        icon: PiBuildingsBold,
        keywords: ["Склады"],
      },
    ],
  },
  {
    id: "operations",
    title: "Операции",
    icon: PiTreeStructureBold,
    items: [
      {
        id: "journalEntries",
        title: "Журнал операций",
        href: "/accounting/journal",
        icon: PiBookOpenBold,
        keywords: ["Журнал операций", "Переводы", "Корреспонденция счет"],
      },
      {
        id: "periodClosing",
        title: "Закрытие периода",
        href: "/accounting/period-closing",
        icon: PiLightningBold,
        keywords: ["Кассовые ордера", "Типовые операции"],
      },
    ],
  },
  {
    id: "reports",
    title: "Отчеты",
    icon: PiChartBarBold,
    items: [
      {
        id: "trialBalance",
        title: "Оборотно-сальдовая ведомость",
        href: "/reports/trial-balance",
        icon: PiChartBarBold,
        keywords: ["НДС", "Оборотно-сальдовая ведомость"],
      },
      {
        id: "profitLoss",
        title: "Прибыли и убытки",
        href: "/reports/profit-loss",
        icon: PiTrendUpBold,
        keywords: ["Финансовые отчеты"],
      },
    ],
  },
  {
    id: "directories",
    title: "Справочники",
    icon: PiFolderOpenBold,
    items: [
      {
        id: "contracts",
        title: "Договоры",
        href: "/directories/contracts",
        icon: PiFilesBold,
        keywords: ["Переводы"],
      },
      {
        id: "currencies",
        title: "Валюты",
        href: "/directories/currencies",
        icon: PiCoinsBold,
        keywords: ["Склады"],
      },
      {
        id: "allDirectories",
        title: "Все справочники",
        href: "/directories",
        icon: PiFolderOpenBold,
        keywords: ["all directories"],
      },
    ],
  },
  {
    id: "admin",
    title: "Администрирование",
    icon: PiGearBold,
    items: [
      {
        id: "users",
        title: "Пользователи",
        href: "/admin/users",
        icon: PiUsersBold,
        keywords: ["Номенклатура"],
      },
      {
        id: "settings",
        title: "Настройки",
        href: "/settings",
        icon: PiGearBold,
        keywords: ["Начисления"],
      },
      {
        id: "allFunctions",
        title: "Все функции",
        href: "/system/functions",
        icon: PiScrollBold,
        keywords: ["Все функции"],
      },
    ],
  },
];

