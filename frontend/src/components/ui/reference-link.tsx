import Link from "next/link";
import { cn } from "@/lib/utils";
import { PiArrowSquareOutBold } from "react-icons/pi";

type ReferenceType =
    | 'counterparty' | 'item' | 'warehouse' | 'contract'
    | 'sales_document' | 'purchase_document' | 'payment_document'
    | 'transfer_document' | 'inventory_document' | 'sales_order'
    | 'sales-document' | 'purchase-document' | 'payment-document'
    | 'account' | 'bank-account';


interface ReferenceLinkProps {
    id: number | null | undefined;
    type: string; // Relaxed to string to allow dynamic types from backend, but checked against map
    label?: string | number | null;
    className?: string;
    showIcon?: boolean;
}

const URL_MAP: Record<ReferenceType, string> = {
    'counterparty': '/directories/counterparties',
    'item': '/directories/items',
    'warehouse': '/directories/warehouses',
    'contract': '/directories/contracts',
    'sales_document': '/documents/sales',
    'purchase_document': '/documents/purchases',
    'payment_document': '/documents/payments',
    'transfer_document': '/documents/transfers',
    'inventory_document': '/documents/inventory',
    'sales_order': '/documents/sales-orders',
    'sales-document': '/documents/sales', // Legacy/Duplicate support
    'purchase-document': '/documents/purchases',
    'payment-document': '/documents/payments',
    'account': '/accounting/general-ledger',
    'bank-account': '/directories/bank-accounts'
};


export function ReferenceLink({ id, type, label, className, showIcon = false }: ReferenceLinkProps) {
    if (!id) return <span className="text-muted-foreground">-</span>;

    const baseUrl = URL_MAP[type as ReferenceType];
    if (!baseUrl) return <span className="text-muted-foreground">{label || `#${id}`}</span>;

    let href = `${baseUrl}/${id}`;
    if (type === 'account') {
        href = `${baseUrl}?account=${id}`;
    }

    return (
        <Link
            href={href}
            className={cn(
                "font-medium text-primary hover:underline hover:text-blue-600 transition-colors inline-flex items-center gap-1",
                className
            )}
            onClick={(e) => e.stopPropagation()} // Prevent row click
        >
            {label || `#${id}`}
            {showIcon && <PiArrowSquareOutBold className="h-3 w-3 opacity-50" />}
        </Link>
    );
}
