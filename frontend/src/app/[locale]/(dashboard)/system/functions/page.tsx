'use client';

import { navigationConfig } from '@/config/navigation';
import Link from 'next/link';
import { PiCaretRightBold, PiPlusBold } from 'react-icons/pi';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// export const metadata: Metadata = {
//     title: 'All Functions | 1C ERP',
// };

export default function AllFunctionsPage() {
    const [search, setSearch] = useState('');

    // Filter logic
    const filteredConfig = navigationConfig.map(group => {
        const filteredItems = group.items.filter(item => {
            const match =
                item.title.toLowerCase().includes(search.toLowerCase()) ||
                item.keywords?.some(k => k.toLowerCase().includes(search.toLowerCase())) ||
                item.children?.some(child => child.title.toLowerCase().includes(search.toLowerCase()));

            return match;
        });
        return { ...group, items: filteredItems };
    }).filter(group => group.items.length > 0);

    const getGroupColor = (id: string, dark = false) => {
        const colors: Record<string, string> = {
            directories: dark ? "border-emerald-900 bg-emerald-900/30 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-700",
            documents: dark ? "border-blue-900 bg-blue-900/30 text-blue-300" : "border-blue-200 bg-blue-50 text-blue-700",
            treasury: dark ? "border-cyan-900 bg-cyan-900/30 text-cyan-300" : "border-cyan-200 bg-cyan-50 text-cyan-700",
            warehouse: dark ? "border-amber-900 bg-amber-900/30 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-700",
            reports: dark ? "border-purple-900 bg-purple-900/30 text-purple-300" : "border-purple-200 bg-purple-50 text-purple-700",
            admin: dark ? "border-zinc-800 bg-zinc-900/30 text-zinc-300" : "border-zinc-200 bg-zinc-50 text-zinc-700",
        };
        return colors[id] || colors['admin'];
    }

    return (
        <div className="p-6 h-[calc(100vh-4rem)] overflow-auto bg-slate-50 dark:bg-zinc-950">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <div className="w-2 h-8 bg-orange-500 rounded-sm" />
                    Все функции
                </h1>
                <p className="text-muted-foreground mt-1 mb-4">
                    Карта системы. Поиск документов, отчетов и регистров по терминологии 1С.
                </p>
                <Input
                    placeholder="Поиск функций (например: Продажи, Контрагенты, НДС)..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-md bg-white dark:bg-zinc-900"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredConfig.map(group => (
                    <div key={group.id} className="border rounded-lg bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col h-full">
                        <div className={cn(
                            "px-4 py-3 border-b font-bold text-sm uppercase tracking-wide flex items-center gap-2",
                            getGroupColor(group.id)
                        )}>
                            <group.icon className="h-4 w-4" />
                            {group.title}
                        </div>
                        <div className="p-2 space-y-1 flex-1">
                            {group.items.map(item => (
                                <div key={item.href} className="group/item">
                                    <div className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <div className="flex flex-col gap-0.5">
                                            <Link href={item.href} className="font-medium text-sm text-slate-700 dark:text-slate-300 hover:text-primary hover:underline">
                                                {item.title}
                                            </Link>
                                            {item.keywords && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    {item.keywords[0]}
                                                </span>
                                            )}
                                        </div>
                                        {/* Quick Actions if available */}
                                        <div className="opacity-0 group-hover/item:opacity-100 transition-opacity flex gap-1">
                                            {item.children?.find(c => c.href.includes('/new')) && (
                                                <Link
                                                    href={item.children.find(c => c.href.includes('/new'))!.href}
                                                    title="Создать"
                                                    className="p-1 hover:bg-green-100 text-green-700 rounded"
                                                >
                                                    <PiPlusBold />
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    {/* Children */}
                                    {item.children && (
                                        <div className="ml-4 pl-3 border-l border-dashed space-y-1 mt-1 mb-2">
                                            {item.children.map(child => (
                                                <Link key={child.href} href={child.href} className="block">
                                                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 rounded">
                                                        <PiCaretRightBold className="h-2 w-2" />
                                                        {child.title}
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {filteredConfig.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                    По запросу: {search}. Ничего не найдено.
                </div>
            )}
        </div>
    );
}
