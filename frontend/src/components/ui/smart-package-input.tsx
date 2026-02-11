'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { PiWarningBold, PiCheckCircleBold } from 'react-icons/pi';

interface SmartPackageInputProps {
    item: any;
    warehouseId?: number;
    value: number; // base quantity
    onChange: (baseQty: number) => void;
    tenantId: number;
    packageId?: number | null;
    onPackageChange?: (id: number | null) => void;
}

export function SmartPackageInput({
    item,
    warehouseId,
    value,
    onChange,
    tenantId,
    packageId,
    onPackageChange
}: SmartPackageInputProps) {
    const [packageQty, setPackageQty] = useState(0);
    const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

    // Get stock balance
    const { data: stock } = useQuery({
        queryKey: ['stock-balance', item?.id, warehouseId, tenantId],
        queryFn: async () => {
            if (!item?.id || !warehouseId) return null;

            const response = await api.get(`/items/${item.id}/context`, {
                params: {
                    warehouse: warehouseId,
                }
            });
            return response.data.stock;
        },
        enabled: !!item?.id && !!warehouseId,
    });

    // Get available packages for the item
    const packages = item?.packages || [];
    const selectedPackage = packages.find((p: any) => p.id === selectedPackageId);
    const coefficient = selectedPackage?.coefficient || 1;

    // Calculate base quantity from package quantity
    const baseQty = packageQty * coefficient;

    // Stock availability
    const available = stock?.available || 0;
    const availableInPackages = Math.floor(available / coefficient);
    const hasEnough = baseQty <= available;

    // Set default package on mount or when packageId changes
    useEffect(() => {
        if (packages.length > 0) {
            if (packageId) {
                setSelectedPackageId(packageId);
            } else if (!selectedPackageId) {
                const defaultPkg = packages.find((p: any) => p.is_default) || packages[0];
                setSelectedPackageId(defaultPkg.id);
                // Notify parent of default selection if controlled
                if (onPackageChange) {
                    onPackageChange(defaultPkg.id);
                }
            }
        }
    }, [packages, packageId, selectedPackageId, onPackageChange]);

    // Sync with external value changes
    useEffect(() => {
        if (coefficient > 0) {
            setPackageQty(value / coefficient);
        }
    }, [value, coefficient]);

    const handlePackageQtyChange = (qty: number) => {
        setPackageQty(qty);
        onChange(qty * coefficient);
    };

    if (!item) {
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                {/* Package quantity input */}
                <div className="flex-1">
                    <Label>Quantity</Label>
                    <Input
                        type="number"
                        step="0.01"
                        value={packageQty}
                        onChange={(e) => handlePackageQtyChange(parseFloat(e.target.value) || 0)}
                        className={cn(
                            !hasEnough && baseQty > 0 && "border-red-500 focus-visible:ring-red-500"
                        )}
                    />
                </div>

                {/* Package selector */}
                {packages.length > 0 && (
                    <div className="flex-1">
                        <Label>Unit</Label>
                        <Select
                            value={selectedPackageId?.toString()}
                            onValueChange={(val) => {
                                setSelectedPackageId(parseInt(val));
                                if (onPackageChange) {
                                    onPackageChange(parseInt(val));
                                }
                                // Recalculate when package changes
                                const newPkg = packages.find((p: any) => p.id === parseInt(val));
                                if (newPkg) {
                                    onChange(packageQty * newPkg.coefficient);
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {packages.map((pkg: any) => (
                                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                                        {pkg.name} (1={pkg.coefficient} {item.base_unit || 'pcs'})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Base quantity display */}
            {
                coefficient > 1 && (
                    <div className="text-sm text-muted-foreground font-mono">
                        = {baseQty.toFixed(2)} {item.base_unit || 'pcs'}
                    </div>
                )
            }

            {/* Stock availability indicator */}
            {
                warehouseId && stock && (
                    <div className={cn(
                        "text-sm font-medium p-2 rounded-md",
                        hasEnough
                            ? "text-green-700 bg-green-50 border border-green-200"
                            : "text-red-700 bg-red-50 border border-red-200"
                    )}>
                        <div className="flex items-center gap-2">
                            {hasEnough ? (
                                <PiCheckCircleBold className="h-4 w-4" />
                            ) : (
                                <PiWarningBold className="h-4 w-4" />
                            )}
                            <span>
                                Available: {availableInPackages} {selectedPackage?.name || 'units'}
                                ({available} {item.base_unit || 'pcs'})
                            </span>
                        </div>
                    </div>
                )
            }

            {/* Insufficient stock warning */}
            {
                !hasEnough && baseQty > 0 && (
                    <Alert variant="destructive">
                        <PiWarningBold className="h-4 w-4" />
                        <AlertTitle>Insufficient Stock</AlertTitle>
                        <AlertDescription className="space-y-1">
                            <div>Need: <strong>{packageQty} {selectedPackage?.name}</strong> ({baseQty} {item.base_unit})</div>
                            <div>Available: <strong>{availableInPackages} {selectedPackage?.name}</strong> ({available} {item.base_unit})</div>
                            <div className="text-red-800 font-bold">
                                Short: {(baseQty - available).toFixed(2)} {item.base_unit}
                            </div>
                        </AlertDescription>
                    </Alert>
                )
            }
        </div >
    );
}
