import Link from "next/link";
import { cn } from "@/lib/utils";
import { PiArrowSquareOutBold } from "react-icons/pi";

type ReferenceType =
    | 'counterparty' | 'item' | 'warehouse' | 'contract'
    | 'sales_document' | 'purchase_document' | 'payment_document'
    | 'transfer_document' | 'inventory_document' | 'sales_order'
    | 'sales-document' | 'purchase-document' | 'payment-document'
    | 'salesdocument' | 'purchasedocument' | 'paymentdocument'
    | 'transferdocument' | 'inventorydocument' | 'stockmovement' | 'accountingentry'
    | 'account' | 'bank-account' | 'cash-order';


interface ReferenceLinkProps {
    id: number | null | undefined;
    type: string; // Relaxed to string to allow dynamic types from backend, but checked against map
    label?: string | number | null;
    className?: string;
    showIcon?: boolean;
    href?: string;
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
    'salesdocument': '/documents/sales', // Django model name
    'purchasedocument': '/documents/purchases',
    'paymentdocument': '/documents/payments',
    'transferdocument': '/documents/transfers',
    'inventorydocument': '/documents/inventory',
    'stockmovement': '/registers/stock-movements', // Fallback
    'accountingentry': '/registers/journal-entries', // Fallback
    'account': '/accounting/general-ledger',
    'bank-account': '/directories/bank-accounts',
    'cash-order': '/documents/cash-orders',
};


export function ReferenceLink({ id, type, label, className, showIcon = false, href: customHref }: ReferenceLinkProps) {
    if (!id) return <span className="text-muted-foreground">-</span>;

    const baseUrl = URL_MAP[type as ReferenceType];

    let href = customHref;

    if (!href && baseUrl) {
        href = `${baseUrl}/${id}`;
        if (type === 'account') {
            href = `${baseUrl}?account=${id}`;
        }
    }

    if (!href) return <span className="text-muted-foreground">{label || `#${id}`}</span>;

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
