'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Item, ItemUnit } from '@/types';

interface PackageSelectorProps {
    item: Item;
    quantity: number;
    selectedPackageId: number | null;
    pricePerPackage: number;
    onQuantityChange: (qty: number) => void;
    onPackageChange: (pkgId: number | null) => void;
    onPriceChange: (price: number) => void;
    disabled?: boolean;
    showPriceInputs?: boolean;
}

export function PackageSelector({
    item,
    quantity,
    selectedPackageId,
    pricePerPackage,
    onQuantityChange,
    onPackageChange,
    onPriceChange,
    disabled = false,
    showPriceInputs = true,
}: PackageSelectorProps) {
    const selectedPackage = item.units?.find((u: ItemUnit) => u.id === selectedPackageId);
    const coefficient = selectedPackage?.coefficient || 1;
    const baseQuantity = quantity * coefficient;
    const pricePerBase = pricePerPackage / coefficient;

    return (
        <div className="space-y-3">
            {/* Quantity and Unit Selection Row */}
            <div className="grid grid-cols-3 gap-3">
                {/* Quantity Input */}
                <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input
                        type="number"
                        step="0.001"
                        value={quantity || ''}
                        onChange={(e) => onQuantityChange(parseFloat(e.target.value) || 0)}
                        disabled={disabled}
                        className="h-9"
                    />
                </div>

                {/* Package/Unit Selector */}
                <div>
                    <Label className="text-xs">Unit</Label>
                    <Select
                        value={selectedPackageId?.toString() || 'base'}
                        onValueChange={(val) => onPackageChange(val === 'base' ? null : parseInt(val))}
                        disabled={disabled}
                    >
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="base">{item.base_unit || 'pcs'}</SelectItem>
                            {item.units?.map((pkg: ItemUnit) => (
                                <SelectItem key={pkg.id} value={pkg.id.toString()}>
                                    {pkg.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Base Quantity Display with Coefficient */}
                <div>
                    <Label className="text-xs">Base Qty</Label>
                    <div className="h-9 flex items-center px-3 bg-muted/50 rounded-md border text-sm font-mono">
                        {baseQuantity.toFixed(3)} {item.base_unit || 'pcs'}
                    </div>
                </div>
            </div>

            {/* Coefficient Display (1C Style) */}
            {selectedPackage && (
                <div className="text-xs text-muted-foreground px-1">
                    📦 1 {selectedPackage.name} = {selectedPackage.coefficient} {item.base_unit || 'pcs'}
                </div>
            )}

            {/* Price Inputs Row */}
            {showPriceInputs && (
                <div className="grid grid-cols-2 gap-3">
                    {/* Price per Package */}
                    <div>
                        <Label className="text-xs">
                            Price per {selectedPackage?.name || item.base_unit || 'unit'}
                        </Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={pricePerPackage || ''}
                            onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
                            disabled={disabled}
                            className="h-9 font-mono"
                        />
                    </div>

                    {/* Price per Base Unit (Auto-calculated) */}
                    <div>
                        <Label className="text-xs">
                            Price per {item.base_unit || 'pcs'}
                        </Label>
                        <div className="h-9 flex items-center px-3 bg-muted/50 rounded-md border text-sm font-mono">
                            {pricePerBase.toFixed(2)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
