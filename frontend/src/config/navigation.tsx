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
        keywords: ["Р Р°Р±РѕС‡РёР№ СЃС‚РѕР»", "Р“Р»Р°РІРЅР°СЏ"],
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
        keywords: ["Р‘Р°РЅРєРѕРІСЃРєРёРµ РІС‹РїРёСЃРєРё", "РЎС‡РµС‚"],
      },
      {
        id: "cashOrders",
        title: "Рабочий стол касса",
        href: "/documents/cash-orders",
        icon: PiCoinsBold,
        keywords: ["РќР°Р»РѕРіРѕРІР°СЏ РѕС‚С‡РµС‚РЅРѕСЃС‚СЊ", "РќР”РЎ", "РќР”РЎ"],
      },
      {
        id: "cashDirectory",
        title: "Касса",
        href: "/bank-cash/cash",
        icon: PiWalletBold,
        keywords: ["РљР°СЃСЃР°", "Р‘Р°РЅРє", "РќР°Р»РёС‡РЅС‹Рµ", "Р‘РµР·РЅР°Р»"],
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
        keywords: ["Р РµР°Р»РёР·Р°С†РёРё", "РќР°С‡РёСЃР»РµРЅРёСЏ", "РќР”РЎ"],
      },
      {
        id: "salesOrders",
        title: "Заказы покупателей",
        href: "/documents/sales-orders",
        icon: PiClipboardTextBold,
        keywords: ["Р—Р°РєР°Р·С‹", "РћС‚С‡РµС‚ РїРѕ СЃРєР»Р°РґСѓ"],
      },
      {
        id: "counterparties",
        title: "Контрагенты",
        href: "/directories/counterparties",
        icon: PiUsersBold,
        keywords: ["РљРѕРЅС‚СЂР°РіРµРЅС‚"],
      },
      {
        id: "contracts",
        title: "Договоры",
        href: "/directories/contracts",
        icon: PiFilesBold,
        keywords: ["Р”РѕРіРѕРІРѕСЂС‹", "РЈРїСЂР°РІР»РµРЅРёРµ РґРѕРіРѕРІРѕСЂР°РјРё РєРѕРЅС‚СЂР°РіРµРЅС‚РѕРІ"],
      },
      {
        id: "nomenclature",
        title: "Номенклатура",
        href: "/directories/items",
        icon: PiPackageBold,
        keywords: ["РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°", "РўРѕРІР°СЂС‹ РґР»СЏ РїСЂРѕРґР°Р¶Рё"],
      },
      {
        id: "salesReports",
        title: "Отчеты",
        href: "/reports/sales-menu",
        icon: PiScrollBold,
        keywords: ["РћС‚С‡РµС‚С‹", "РђРєС‚ СЃРІРµСЂРєРё", "РћС‚С‡РµС‚ РїРѕ РїСЂРѕРґР°Р¶Р°Рј"],
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
        keywords: ["РџРµСЂРµРјРµС‰РµРЅРёРµ С‚РѕРІР°СЂРѕРІ Рё СѓСЃР»СѓРі", "Р’Р°Р»СЋС‚РЅС‹Рµ РѕРїРµСЂР°С†РёРё"],
      },
      {
        id: "counterparties",
        title: "Контрагенты",
        href: "/directories/counterparties",
        icon: PiUsersBold,
        keywords: ["РђРјРѕСЂС‚РёР·Р°С†РёСЏ", "РљРѕРЅС‚СЂР°РіРµРЅС‚"],
      },
      {
        id: "purchasesReports",
        title: "Отчеты",
        href: "/reports",
        icon: PiScrollBold,
        keywords: ["РћС‚С‡РµС‚С‹", "РњР°С‚РµСЂРёР°Р»СЊРЅС‹Р№ РѕС‚С‡РµС‚", "РћС‚С‡РµС‚ РїРѕ РїРѕСЃС‚Р°РІС‰РёРєР°Рј"],
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
        keywords: ["РњР°С‚РµСЂРёР°Р»СЊРЅС‹Р№ РѕС‚С‡РµС‚", "РћР±С‰РёР№ РјР°С‚РµСЂРёР°Р»СЊРЅС‹Р№ РѕС‚С‡РµС‚"],
      },
      {
        id: "transfers",
        title: "Перемещения",
        href: "/documents/transfers",
        icon: PiTruckBold,
        keywords: ["РџРµСЂРµРјРµС‰РµРЅРёРµ С‚РѕРІР°СЂРѕРІ"],
      },
      {
        id: "inventory",
        title: "Инвентаризация",
        href: "/documents/inventory",
        icon: PiClipboardTextBold,
        keywords: ["РљРѕРЅС‚СЂР°РіРµРЅС‚С‹", "РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°", "РџРµСЂРµРІРѕРґС‹"],
      },
      {
        id: "nomenclature",
        title: "Номенклатура",
        href: "/directories/items",
        icon: PiPackageBold,
        keywords: ["РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°", "РЎРєР»Р°РґС‹"],
      },
      {
        id: "warehouses",
        title: "Склады",
        href: "/directories/warehouses",
        icon: PiBuildingsBold,
        keywords: ["РЎРєР»Р°РґС‹"],
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
        keywords: ["Р–СѓСЂРЅР°Р» РѕРїРµСЂР°С†РёР№", "РџРµСЂРµРІРѕРґС‹", "РљРѕСЂСЂРµСЃРїРѕРЅРґРµРЅС†РёСЏ СЃС‡РµС‚"],
      },
      {
        id: "periodClosing",
        title: "Закрытие периода",
        href: "/accounting/period-closing",
        icon: PiLightningBold,
        keywords: ["РљР°СЃСЃРѕРІС‹Рµ РѕСЂРґРµСЂР°", "РўРёРїРѕРІС‹Рµ РѕРїРµСЂР°С†РёРё"],
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
        keywords: ["РќР”РЎ", "РћР±РѕСЂРѕС‚РЅРѕ-СЃР°Р»СЊРґРѕРІР°СЏ РІРµРґРѕРјРѕСЃС‚СЊ"],
      },
      {
        id: "profitLoss",
        title: "Прибыли и убытки",
        href: "/reports/profit-loss",
        icon: PiTrendUpBold,
        keywords: ["Р¤РёРЅР°РЅСЃРѕРІС‹Рµ РѕС‚С‡РµС‚С‹"],
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
        keywords: ["РџРµСЂРµРІРѕРґС‹"],
      },
      {
        id: "currencies",
        title: "Валюты",
        href: "/directories/currencies",
        icon: PiCoinsBold,
        keywords: ["РЎРєР»Р°РґС‹"],
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
        keywords: ["РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°"],
      },
      {
        id: "settings",
        title: "Настройки",
        href: "/settings",
        icon: PiGearBold,
        keywords: ["РќР°С‡РёСЃР»РµРЅРёСЏ"],
      },
      {
        id: "allFunctions",
        title: "Все функции",
        href: "/system/functions",
        icon: PiScrollBold,
        keywords: ["Р’СЃРµ С„СѓРЅРєС†РёРё"],
      },
    ],
  },
];

