import { PrintLayout } from "./print-layout";
import { format } from "date-fns";

interface InvoicePrintProps {
    document: any;
    tenant: any;
}

export function InvoicePrint({ document, tenant }: InvoicePrintProps) {
    const totalAmount = document.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.price), 0);
    const taxAmount = totalAmount * 0.12; // Mock 12% VAT

    return (
        <PrintLayout>
            {/* Bank Details Header */}
            <table className="w-full border-collapse border border-black mb-6 text-xs">
                <tbody>
                    <tr>
                        <td colSpan={2} rowSpan={2} className="border border-black p-2 w-1/2 align-top">
                            {tenant?.bankName || "AO 'BANK NAME'"}<br />
                            BIK: {tenant?.bik || "000000000"}<br />
                            Corr. Acc: {tenant?.corrAccount || "30101810..."}
                        </td>
                        <td className="border border-black p-2 w-[10%]">BIK</td>
                        <td className="border border-black p-2">{tenant?.bik || "044525225"}</td>
                    </tr>
                    <tr>
                        <td className="border border-black p-2">Acc. No</td>
                        <td className="border border-black p-2">{tenant?.accountNumber || "40702810..."}</td>
                    </tr>
                    <tr>
                        <td colSpan={2} className="border border-black p-2">
                            Payee: {tenant?.name || "My Company LLC"}
                        </td>
                        <td className="border border-black p-2">INN/KPP</td>
                        <td className="border border-black p-2">{tenant?.inn || "7700000000"} / {tenant?.kpp || "770101001"}</td>
                    </tr>
                </tbody>
            </table>

            {/* Document Title */}
            <h1 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">
                Invoice No. {document.number} dated {format(new Date(document.date), 'dd MMMM yyyy')}
            </h1>

            {/* Supplier / Customer */}
            <div className="grid grid-cols-[100px_1fr] gap-y-2 mb-6">
                <div className="font-bold">Supplier:</div>
                <div>{tenant?.name}, INN {tenant?.inn}, {tenant?.address}</div>

                <div className="font-bold">Customer:</div>
                <div>{document.counterparty_name || "Client Name"}, Address details here...</div>
            </div>

            {/* Items Table */}
            <table className="print-table">
                <thead>
                    <tr>
                        <th className="w-8">#</th>
                        <th>Item Description</th>
                        <th className="w-16">Unit</th>
                        <th className="w-20">Qty</th>
                        <th className="w-24">Price</th>
                        <th className="w-24">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {document.lines.map((line: any, index: number) => (
                        <tr key={index}>
                            <td className="text-center">{index + 1}</td>
                            <td>{line.item_name}</td>
                            <td className="text-center">{line.unit || 'pcs'}</td>
                            <td className="text-right">{line.quantity}</td>
                            <td className="text-right">{line.price.toFixed(2)}</td>
                            <td className="text-right">{(line.quantity * line.price).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex flex-col items-end gap-1 mb-6 text-sm">
                <div className="font-bold">Total: {totalAmount.toFixed(2)}</div>
                <div className="font-bold">VAT (12%): {taxAmount.toFixed(2)}</div>
                <div className="font-bold text-base">Total to Pay: {(totalAmount + taxAmount).toFixed(2)}</div>
            </div>

            <div className="border-t border-black mb-8 p-1 text-sm italic">
                Total items: {document.lines.length}, for the amount of {(totalAmount + taxAmount).toFixed(2)} USD
            </div>

            {/* Signatures */}
            <div className="mt-12 flex justify-between px-8">
                <div>
                    <span className="font-bold">Director</span>
                    <span className="signature-line"></span>
                </div>
                <div>
                    <span className="font-bold">Accountant</span>
                    <span className="signature-line"></span>
                </div>
            </div>
        </PrintLayout>
    );
}
