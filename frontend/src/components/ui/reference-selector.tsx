'use client';

import * as React from 'react';
import { PiCaretDownBold, PiCheckBold, PiMagnifyingGlassBold } from 'react-icons/pi';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce'; // We might need to create this hook if missing

interface ReferenceSelectorProps {
    value?: number | null;
    onSelect: (value: number | null, item?: any) => void;
    apiEndpoint: string; // e.g., '/directories/counterparties/'
    placeholder?: string;
    label?: string;
    displayField?: string; // Field to show (default: name)
    /** Secondary field for subtitle (e.g. 'sku' for items, 'code' for others) */
    secondaryField?: string;
    className?: string;
    disabled?: boolean;
}

export function ReferenceSelector({
    value,
    onSelect,
    apiEndpoint,
    placeholder = "Select...",
    label = "Select",
    displayField = "name",
    secondaryField,
    className,
    disabled = false
}: ReferenceSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const debouncedSearch = useDebounce(search, 300);

    const isItemsEndpoint = apiEndpoint.includes("/items");
    // Prefetch items when form loads so Sales/Purchases dropdown has stock to choose from
    const fetchWhenOpenOrItems = open || isItemsEndpoint;

    // Fetch Logic (tolerate 404/missing endpoints so form still works)
    const { data: items, isLoading } = useQuery({
        queryKey: [apiEndpoint, debouncedSearch],
        queryFn: async () => {
            try {
                const params = new URLSearchParams();
                if (debouncedSearch) params.append("search", debouncedSearch);
                const qs = params.toString();
                const url = qs ? `${apiEndpoint.replace(/\?$/, "")}?${qs}` : apiEndpoint.replace(/\?$/, "");
                const res: any = await api.get(url);
                return Array.isArray(res) ? res : res.results || [];
            } catch {
                return [];
            }
        },
        enabled: fetchWhenOpenOrItems,
    });

    // Fetch Selected Item (if value exists but we don't have the object)
    const { data: selectedItem } = useQuery({
        queryKey: [apiEndpoint, value, 'detail'],
        queryFn: async () => {
            if (!value) return null;
            try {
                const res = await api.get(`${apiEndpoint}${value}/`);
                return res;
            } catch { return null; }
        },
        enabled: !!value
    });

    const displayValue = selectedItem ? selectedItem[displayField] : (value ? "Loading..." : placeholder);

    return (
        <div className={cn("flex flex-col gap-1", className)}>
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
                    <Command shouldFilter={false}> {/* We filter on server */}
                        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                            <PiMagnifyingGlassBold className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder={`Search ${label.toLowerCase()}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <CommandList>
                            {isLoading && <div className="p-2 text-xs text-muted-foreground">Loading...</div>}
                            {!isLoading && items?.length === 0 && (
                                <CommandEmpty>
                                    {isItemsEndpoint
                                        ? "No items in stock. Add products in Nomenclature (Warehouse → Nomenclature)."
                                        : "No results found."}
                                </CommandEmpty>
                            )}
                            {items?.map((item: any) => {
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
                                                "mr-2 h-4 w-4",
                                                value === item.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{item[displayField]}</span>
                                            {code != null && String(code).trim() !== "" && (
                                                <span className="text-[10px] text-muted-foreground">SKU: {code}</span>
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
