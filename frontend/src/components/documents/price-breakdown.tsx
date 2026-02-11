'use client';

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PiMagnifyingGlassBold } from 'react-icons/pi';

interface PriceBreakdownProps {
    price: number;
    quantity: number;
    discount?: number;
    discountPercent?: number;
    vatRate: number;
    exchangeRate?: number;
    currency?: string;
}

export function PriceBreakdown({
    price,
    quantity,
    discount = 0,
    discountPercent = 0,
    vatRate,
    exchangeRate = 1,
    currency = 'UZS'
}: PriceBreakdownProps) {
    const subtotalBeforeDiscount = price * quantity;
    const discountAmount = discount || (subtotalBeforeDiscount * discountPercent / 100);
    const subtotal = subtotalBeforeDiscount - discountAmount;
    const vatAmount = subtotal * vatRate / 100;
    const total = subtotal + vatAmount;
    const totalBase = exchangeRate !== 1 ? total * exchangeRate : total;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-0 font-mono">
                    {total.toFixed(2)} <PiMagnifyingGlassBold className="ml-1 h-3 w-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="space-y-3">
                    <div className="font-semibold text-sm">Price Calculation</div>

                    <div className="space-y-2 font-mono text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Price:</span>
                            <span>{price.toFixed(2)} × {quantity}</span>
                        </div>

                        <div className="flex justify-between font-bold">
                            <span>Subtotal:</span>
                            <span>{subtotalBeforeDiscount.toFixed(2)}</span>
                        </div>

                        {discountAmount > 0 && (
                            <>
                                <div className="flex justify-between text-red-600">
                                    <span>- Discount {discountPercent > 0 && `(${discountPercent}%)`}:</span>
                                    <span>-{discountAmount.toFixed(2)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold">
                                    <span>After Discount:</span>
                                    <span>{subtotal.toFixed(2)}</span>
                                </div>
                            </>
                        )}

                        <div className="flex justify-between">
                            <span className="text-muted-foreground">+ VAT ({vatRate}%):</span>
                            <span>{vatAmount.toFixed(2)}</span>
                        </div>

                        <Separator />

                        <div className="flex justify-between font-bold text-lg">
                            <span>Total:</span>
                            <span>{total.toFixed(2)} {currency}</span>
                        </div>

                        {exchangeRate !== 1 && (
                            <>
                                <Separator />
                                <div className="text-muted-foreground text-xs space-y-1">
                                    <div>Exchange Rate: {exchangeRate}</div>
                                    <div className="flex justify-between">
                                        <span>Base Currency:</span>
                                        <span className="font-bold">{totalBase.toFixed(2)} UZS</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
