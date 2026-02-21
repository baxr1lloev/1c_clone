'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ItemSelect } from '@/components/selectors/item-select';
import { SmartPackageInput } from '@/components/ui/smart-package-input';
import { cn } from '@/lib/utils';
import { PiCheckCircleBold } from 'react-icons/pi';

interface SmartLineItemFormProps {
    documentType: 'sales' | 'purchase';
    customerId?: number;
    warehouseId?: number;
    date?: string;
    tenantId: number;
    onLineChange: (line: any) => void;
    onCancel?: () => void;
}

export function SmartLineItemForm({
    documentType,
    customerId,
    warehouseId,
    date,
    tenantId,
    onLineChange,
    onCancel,
}: SmartLineItemFormProps) {
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [price, setPrice] = useState<number>(0);
    const [vatRate, setVatRate] = useState<number>(0);
    const [discount, setDiscount] = useState<number>(0);
    const [packageId, setPackageId] = useState<number | null>(null);

    // PHASE A: Refs for auto-focus
    const quantityRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch item context when item selected
    const { data: itemContext } = useQuery({
        queryKey: ['item-context', selectedItem?.id, customerId, warehouseId],
        queryFn: async () => {
            if (!selectedItem?.id) return null;
            const response = await api.get(`/directories/items/${selectedItem.id}/context`, {
                params: {
                    customer: customerId,
                    warehouse: warehouseId,
                    date: date,
                    doc_type: documentType,
                }
            });
            return response;
        },
        enabled: !!selectedItem?.id,
    });

    // PHASE A: Auto-fill and auto-focus when item context loads
    useEffect(() => {
        if (itemContext) {
            setPrice(itemContext.pricing?.price || 0);
            setVatRate(itemContext.defaults?.vat_rate || 0);
            setPackageId(itemContext.defaults?.default_package_id || null);
            setDiscount(itemContext.pricing?.discount || 0);

            // PHASE A: Auto-focus on quantity after item selected!
            setTimeout(() => {
                quantityRef.current?.focus();
                quantityRef.current?.select();
            }, 150);

            // Show success toast
            toast.success(`✓ Auto-filled`, {
                description: `Price: ${itemContext.pricing?.price?.toLocaleString() || 0} UZS`,
                duration: 1500,
            });
        }
    }, [itemContext]);

    // PHASE A: Handle Enter key - save and new line!
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleReset();
            onCancel?.();
        }
    };

    const handleSave = () => {
        if (!selectedItem) {
            toast.error('Please select an item');
            return;
        }

        if (quantity <= 0) {
            toast.error('Quantity must be greater than 0');
            return;
        }

        setIsSaving(true);

        const newLine = {
            item_id: selectedItem.id,
            item: selectedItem,
            quantity,
            price,
            vat_rate: vatRate,
            discount,
            package_id: packageId,
        };

        // PHASE A: Visual feedback with animation!
        toast.success('✅ Line added!', {
            duration: 1000,
        });

        onLineChange(newLine);

        // PHASE A: Reset and ready for next line!
        setTimeout(() => {
            handleReset();
            setIsSaving(false);
        }, 300);
    };

    const handleReset = () => {
        setSelectedItem(null);
        setQuantity(1);
        setPrice(0);
        setVatRate(0);
        setDiscount(0);
        setPackageId(null);
    };

    const total = quantity * price * (1 - discount / 100) * (1 + vatRate / 100);

    return (
        <Card className={cn(
            "border-2 transition-all duration-300",
            isSaving ? "border-green-500 bg-green-50 scale-[0.99]" : "border-blue-300 bg-blue-50"
        )}>
            <CardContent className="pt-6">
                <div className="grid grid-cols-4 gap-4">
                    {/* Item Selection */}
                    <div className="col-span-2">
                        <Label className="flex items-center gap-2">
                            Item *
                            {selectedItem && <PiCheckCircleBold className="h-4 w-4 text-green-600" />}
                        </Label>
                        <ItemSelect
                            value={selectedItem}
                            onChange={setSelectedItem}
                            tenantId={tenantId}
                            disabled={isSaving}
                        />
                    </div>

                    {/* Quantity with auto-focus */}
                    <div>
                        <Label>Quantity *</Label>
                        <Input
                            ref={quantityRef}
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                            onKeyDown={handleKeyDown}
                            disabled={isSaving || !selectedItem}
                            className={cn(
                                "font-mono text-lg font-bold",
                                selectedItem && "ring-2 ring-blue-400"
                            )}
                            min="0"
                            step="1"
                            placeholder="0"
                        />
                    </div>

                    {/* Package */}
                    <div>
                        <Label>Package</Label>
                        {selectedItem && warehouseId ? (
                            <SmartPackageInput
                                item={selectedItem}
                                tenantId={tenantId}
                                warehouseId={warehouseId}
                                value={quantity}
                                onChange={setQuantity}
                                packageId={packageId}
                                onPackageChange={setPackageId}
                            />
                        ) : (
                            <Input disabled placeholder="Select item" className="text-sm" />
                        )}
                    </div>

                    {/* Price - auto-filled! */}
                    <div>
                        <Label className="flex items-center gap-2">
                            Price
                            {itemContext?.pricing && <PiCheckCircleBold className="h-4 w-4 text-green-600" />}
                        </Label>
                        <Input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                            onKeyDown={handleKeyDown}
                            disabled={isSaving}
                            className={cn(
                                "font-mono",
                                itemContext?.pricing && "bg-green-50 border-green-400 font-bold"
                            )}
                            min="0"
                            step="0.01"
                        />
                        {itemContext?.pricing?.price_source && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                                ✓ {itemContext.pricing.price_source}
                            </p>
                        )}
                    </div>

                    {/* Discount */}
                    <div>
                        <Label>Discount %</Label>
                        <Input
                            type="number"
                            value={discount}
                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                            onKeyDown={handleKeyDown}
                            disabled={isSaving}
                            className="font-mono"
                            min="0"
                            max="100"
                            step="0.1"
                        />
                    </div>

                    {/* VAT - auto-filled! */}
                    <div>
                        <Label className="flex items-center gap-2">
                            VAT %
                            {itemContext?.defaults && <PiCheckCircleBold className="h-4 w-4 text-green-600" />}
                        </Label>
                        <Input
                            type="number"
                            value={vatRate}
                            onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                            onKeyDown={handleKeyDown}
                            disabled={isSaving}
                            className={cn(
                                "font-mono",
                                itemContext?.defaults && "bg-green-50 border-green-400 font-bold"
                            )}
                            min="0"
                            max="100"
                            step="0.1"
                        />
                    </div>

                    {/* Total - calculated */}
                    <div>
                        <Label>Total</Label>
                        <Input
                            value={total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            disabled
                            className="font-mono font-bold text-lg bg-blue-100 border-blue-400"
                        />
                    </div>
                </div>

                {/* Stock info - if available */}
                {itemContext?.stock && (
                    <div className="mt-4 p-3 bg-white rounded-lg border-2 border-blue-200">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground text-xs uppercase">On Hand:</span>
                                <div className="font-mono font-bold text-lg">
                                    {itemContext.stock.on_hand}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs uppercase">Reserved:</span>
                                <div className="font-mono text-lg">
                                    {itemContext.stock.reserved}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs uppercase">Available:</span>
                                <div className={cn(
                                    "font-mono font-bold text-lg",
                                    itemContext.stock.available >= quantity ? "text-green-600" : "text-red-600"
                                )}>
                                    {itemContext.stock.available}
                                    {itemContext.stock.available < quantity && " ⚠️"}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-3 justify-end">
                    <Button
                        variant="outline"
                        onClick={() => {
                            handleReset();
                            onCancel?.();
                        }}
                        disabled={isSaving}
                        className="min-w-[120px]"
                    >
                        Cancel <kbd className="ml-2 px-1.5 py-0.5 bg-gray-100 border rounded text-xs">Esc</kbd>
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!selectedItem || isSaving || quantity <= 0}
                        className="bg-green-600 hover:bg-green-700 min-w-[160px] font-bold"
                    >
                        {isSaving ? '✓ Adding...' : 'Add Line'}
                        <kbd className="ml-2 px-1.5 py-0.5 bg-green-700 border border-green-500 rounded text-xs">Enter</kbd>
                    </Button>
                </div>

                {/* Keyboard hints */}
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center justify-center gap-4">
                    <div><kbd className="px-2 py-1 bg-white border rounded font-mono">Enter</kbd> Add & Next</div>
                    <div><kbd className="px-2 py-1 bg-white border rounded font-mono">Esc</kbd> Cancel</div>
                    <div><kbd className="px-2 py-1 bg-white border rounded font-mono">Tab</kbd> Next Field</div>
                </div>
            </CardContent>
        </Card>
    );
}
