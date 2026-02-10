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
    PiFactoryBold,
    PiHardDrivesBold,
    PiUserListBold,
    PiBankBold,
    PiScrollBold
} from 'react-icons/pi';

export interface NavItem {
    title: string;
    href: string;
    icon?: any;
    keywords?: string[]; // Russian 1C terms for "All Functions"
    description?: string;
    children?: NavItem[];
}

export interface NavGroup {
    id: string;
    title: string;
    icon: any;
    items: NavItem[];
}

export const navigationConfig: NavGroup[] = [
    {
        id: 'main',
        title: 'Main', // Главная
        icon: PiSquaresFourBold,
        items: [
            {
                title: 'Getting Started',
                href: '/',
                icon: PiSquaresFourBold,
                keywords: ['Рабочий стол', 'Главная']
            }
        ]
    },
    {
        id: 'bank_cash',
        title: 'Bank and Cash', // Банк и Касса
        icon: PiBankBold,
        items: [
            {
                title: 'Bank Statements',
                href: '/documents/bank-statements',
                icon: PiFileTextBold,
                keywords: ['Банковские выписки', 'Счет']
            },
            {
                title: 'Cash Orders',
                href: '/documents/cash-orders',
                icon: PiCoinsBold,
                keywords: ['Налоговая отчетность', 'НДС', 'НДС']
            },
            {
                title: 'Payments',
                href: '/documents/payments',
                icon: PiArrowsLeftRightBold,
                keywords: ['Валютные операции']
            }
        ]
    },
    {
        id: 'sales',
        title: 'Sales', // Главная
        icon: PiReceiptBold,
        items: [
            {
                title: 'Sales (Realization)',
                href: '/documents/sales',
                icon: PiFileTextBold,
                keywords: ['Начисление налогов и сборов', 'Начисления', 'НДС']
            },
            {
                title: 'Sales Orders',
                href: '/documents/sales-orders',
                icon: PiClipboardTextBold,
                keywords: ['Журнал справочников', 'Отчет по складу']
            },
            {
                title: 'Counterparties',
                href: '/directories/counterparties',
                icon: PiUsersBold,
                keywords: ['Амортизация', 'Контрагент']
            }
        ]
    },
    {
        id: 'purchases',
        title: 'Purchases', // Главная
        icon: PiWalletBold,
        items: [
            {
                title: 'Purchases (Receipts)',
                href: '/documents/purchases',
                icon: PiFileTextBold,
                keywords: ['Перемещение товаров и услуг', 'Валютные операции']
            },
            {
                title: 'Counterparties',
                href: '/directories/counterparties',
                icon: PiUsersBold,
                keywords: ['Амортизация', 'Контрагент']
            }
        ]
    },
    {
        id: 'warehouse',
        title: 'Warehouse', // Склады
        icon: PiBuildingsBold,
        items: [
            {
                title: 'Stock Balance',
                href: '/reports/stock-balance',
                icon: PiChartBarBold,
                keywords: ['Остатки товаров']
            },
            {
                title: 'Transfers',
                href: '/documents/transfers',
                icon: PiTruckBold,
                keywords: ['Перемещение товаров']
            },
            {
                title: 'Inventories',
                href: '/documents/inventory',
                icon: PiClipboardTextBold,
                keywords: ['Контрагенты', 'Номенклатура', 'Переводы']
            },
            {
                title: 'Nomenclature',
                href: '/directories/categories',
                icon: PiPackageBold,
                keywords: ['Номенклатура', 'Склады']
            },
            {
                title: 'Warehouses',
                href: '/directories/warehouses',
                icon: PiBuildingsBold,
                keywords: ['Склады']
            }
        ]
    },
    {
        id: 'production',
        title: 'Production', // Производство
        icon: PiFactoryBold,
        items: [
            {
                title: 'Production Orders',
                href: '/production/orders', // Placeholder
                icon: PiClipboardTextBold,
                keywords: ['Заказы на производство']
            },
            {
                title: 'Output',
                href: '/production/output', // Placeholder
                icon: PiPackageBold,
                keywords: ['Расход материалов', 'Выпуск продукции']
            }
        ]
    },
    {
        id: 'os_nma',
        title: 'OS and NMA', // ОС и НМА
        icon: PiHardDrivesBold,
        items: [
            {
                title: 'Fixed Assets',
                href: '/os', // Placeholder
                icon: PiBuildingsBold,
                keywords: ['Основные средства', 'Амортизация']
            }
        ]
    },
    {
        id: 'salary',
        title: 'Salary and Personnel', // Зарплата и кадры
        icon: PiUserListBold,
        items: [
            {
                title: 'Employees',
                href: '/salary/employees', // Placeholder
                icon: PiUsersBold,
                keywords: ['Контрагент', 'Кадры']
            },
            {
                title: 'Payroll',
                href: '/salary/payroll', // Placeholder
                icon: PiCoinsBold,
                keywords: ['Банковские выписки', 'Начисления']
            }
        ]
    },
    {
        id: 'operations',
        title: 'Operations', // Операции
        icon: PiTreeStructureBold,
        items: [
            {
                title: 'Journal Entries',
                href: '/accounting/journal',
                icon: PiBookOpenBold,
                keywords: ['Журнал операций', 'Переводы', 'Корреспонденция счет']
            },
            {
                title: 'Period Closing',
                href: '/accounting/period-closing',
                icon: PiLightningBold,
                keywords: ['Кассовые ордера', 'Типовые операции']
            }
        ]
    },
    {
        id: 'reports',
        title: 'Reports', // Отчеты
        icon: PiChartBarBold,
        items: [
            {
                title: 'Trial Balance',
                href: '/reports/trial-balance',
                icon: PiChartBarBold,
                keywords: ['НДС', 'Оборотно-сальдовая ведомость']
            },
            {
                title: 'Profit & Loss',
                href: '/reports/profit-loss',
                icon: PiTrendUpBold,
                keywords: ['Финансовые отчеты']
            }
        ]
    },
    {
        id: 'directories', // Справочники (All references)
        title: 'Directories',
        icon: PiFolderOpenBold,
        items: [
            {
                title: 'Contracts',
                href: '/directories/contracts',
                icon: PiFilesBold,
                keywords: ['Переводы']
            },
            {
                title: 'Currencies',
                href: '/directories/currencies',
                icon: PiCoinsBold,
                keywords: ['Склады']
            },
            {
                title: 'All Directories',
                href: '/directories', // Could be a dashboard of all directories if implemented
                icon: PiFolderOpenBold,
                keywords: ['Все справочники']
            }
        ]
    },
    {
        id: 'admin',
        title: 'Administration',
        icon: PiGearBold,
        items: [
            {
                title: 'Users',
                href: '/admin/users',
                icon: PiUsersBold,
                keywords: ['Номенклатура']
            },
            {
                title: 'Settings',
                href: '/settings',
                icon: PiGearBold,
                keywords: ['Начисления']
            },
            {
                title: 'All Functions',
                href: '/system/functions',
                icon: PiScrollBold,
                keywords: ['Все функции']
            }
        ],
    },
];
