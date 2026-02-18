'use client';

import * as React from 'react';
import { PiCaretDownBold, PiCheckBold, PiMagnifyingGlassBold } from 'react-icons/pi';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';

type ReferenceItem = {
    id: number;
    [key: string]: unknown;
};

interface ReferenceSelectorProps {
    value?: number | null;
    onSelect: (value: number | null, item?: ReferenceItem) => void;
    apiEndpoint: string; // e.g. '/directories/counterparties/'
    placeholder?: string;
    label?: string;
    displayField?: string; // Field to show (default: name)
    secondaryField?: string; // Secondary field for subtitle (e.g. sku/code)
    className?: string;
    disabled?: boolean;
}

export function ReferenceSelector({
    value,
    onSelect,
    apiEndpoint,
    placeholder = 'Выберите...',
    label = 'Выбор',
    displayField = 'name',
    secondaryField,
    className,
    disabled = false,
}: ReferenceSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const debouncedSearch = useDebounce(search, 300);

    const isItemsEndpoint = apiEndpoint.includes('/items');
    const fetchWhenOpenOrItems = open || isItemsEndpoint;

    const { data: items = [], isLoading } = useQuery<ReferenceItem[]>({
        queryKey: [apiEndpoint, debouncedSearch],
        queryFn: async () => {
            try {
                const params = new URLSearchParams();
                if (debouncedSearch) params.append('search', debouncedSearch);
                const qs = params.toString();
                const url = qs ? `${apiEndpoint.replace(/\?$/, '')}?${qs}` : apiEndpoint.replace(/\?$/, '');
                const res = await api.get(url) as ReferenceItem[] | { results?: ReferenceItem[] };
                return Array.isArray(res) ? res : res.results || [];
            } catch {
                return [];
            }
        },
        enabled: fetchWhenOpenOrItems,
    });

    const { data: selectedItem } = useQuery<ReferenceItem | null>({
        queryKey: [apiEndpoint, value, 'detail'],
        queryFn: async () => {
            if (!value) return null;
            try {
                const res = await api.get(`${apiEndpoint}${value}/`) as ReferenceItem;
                return res;
            } catch {
                return null;
            }
        },
        enabled: !!value,
    });

    const displayValue = selectedItem
        ? String(selectedItem[displayField] ?? '')
        : (value ? 'Загрузка...' : placeholder);

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            {label && <span className="text-xs font-semibold text-muted-foreground">{label}</span>}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal"
                        disabled={disabled}
                    >
                        {displayValue}
                        <PiCaretDownBold className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                            <PiMagnifyingGlassBold className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder={`Поиск: ${label.toLowerCase()}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <CommandList>
                            {isLoading && <div className="p-2 text-xs text-muted-foreground">Загрузка...</div>}
                            {!isLoading && items.length === 0 && (
                                <CommandEmpty>
                                    {isItemsEndpoint
                                        ? 'Нет товаров на складе. Добавьте номенклатуру (Склад -> Номенклатура).'
                                        : 'Ничего не найдено.'}
                                </CommandEmpty>
                            )}
                            {items.map((item) => {
                                const code = secondaryField ? item[secondaryField] : (item.code ?? item.sku);
                                return (
                                    <CommandItem
                                        key={item.id}
                                        value={String(item.id)}
                                        onSelect={() => {
                                            onSelect(item.id, item);
                                            setOpen(false);
                                        }}
                                    >
                                        <PiCheckBold
                                            className={cn(
                                                'mr-2 h-4 w-4',
                                                value === item.id ? 'opacity-100' : 'opacity-0',
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{String(item[displayField] ?? '')}</span>
                                            {code != null && String(code).trim() !== '' && (
                                                <span className="text-[10px] text-muted-foreground">Код: {String(code)}</span>
                                            )}
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
