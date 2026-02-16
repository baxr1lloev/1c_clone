'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    PiUsersBold,
    PiWarehouseBold,
    PiCurrencyDollarBold,
    PiHandshakeBold,
    PiPackageBold,
    PiTagBold,
    PiBankBold,
    PiArrowsClockwiseBold,
} from 'react-icons/pi';

export default function DirectoriesPage() {
    const t = useTranslations('directories');
    const router = useRouter();

    const directories = [
        { name: 'Items', icon: PiPackageBold, path: '/directories/items', description: 'Manage products and services' },
        { name: 'Counterparties', icon: PiHandshakeBold, path: '/directories/counterparties', description: 'Manage customers and suppliers' },
        { name: 'Warehouses', icon: PiWarehouseBold, path: '/directories/warehouses', description: 'Manage storage locations' },
        { name: 'Currencies', icon: PiCurrencyDollarBold, path: '/directories/currencies', description: 'Manage currencies and exchange rates' },
        { name: 'Bank Accounts', icon: PiBankBold, path: '/directories/bank-accounts', description: 'Manage settlement, foreign and deposit accounts' },
        { name: 'Bank Exchange Settings', icon: PiArrowsClockwiseBold, path: '/directories/bank-exchange-settings', description: 'Configure import/export from bank systems' },
        { name: 'Categories', icon: PiTagBold, path: '/directories/categories', description: 'Manage item categories' },
        { name: 'Contacts', icon: PiUsersBold, path: '/directories/contacts', description: 'Manage contact persons' },
    ];

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Directories</h1>
                <p className="text-muted-foreground">Manage all reference data and master records</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {directories.map((dir) => (
                    <Card key={dir.path} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push(dir.path)}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <dir.icon className="h-5 w-5" />
                                {dir.name}
                            </CardTitle>
                            <CardDescription>{dir.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full">Open</Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
