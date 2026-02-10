import { PrintLayout } from "./print-layout";
import { format } from "date-fns";

interface ActPrintProps {
    document: any;
    tenant: any;
}

export function ActPrint({ document, tenant }: ActPrintProps) {
    const totalAmount = document.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.price), 0);

    return (
        <PrintLayout title={`ACT of Services Rendered No. ${document.number} dated ${format(new Date(document.date), 'dd.MM.yyyy')}`}>

            <div className="grid grid-cols-[100px_1fr] gap-y-4 mb-6">
                <div className="font-bold">Contractor:</div>
                <div className="font-bold">{tenant?.name}</div>

                <div className="font-bold">Customer:</div>
                <div className="font-bold">{document.counterparty_name}</div>
            </div>

            <p className="mb-4">
                We, the undersigned, certify that the Contractor has rendered the following services in full and in accordance with the contract terms. The Customer has no claims regarding volume, quality, or timing.
            </p>

            <table className="print-table">
                <thead>
                    <tr>
                        <th className="w-8">#</th>
                        <th>Service Description</th>
                        <th className="w-20">Qty</th>
                        <th className="w-20">Unit</th>
                        <th className="w-24">Price</th>
                        <th className="w-24">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {document.lines.map((line: any, index: number) => (
                        <tr key={index}>
                            <td className="text-center">{index + 1}</td>
                            <td>{line.item_name}</td>
                            <td className="text-right">{line.quantity}</td>
                            <td className="text-center">{line.unit || 'srv'}</td>
                            <td className="text-right">{line.price.toFixed(2)}</td>
                            <td className="text-right">{(line.quantity * line.price).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end font-bold text-lg mb-8">
                Total Value of Services: {totalAmount.toFixed(2)} USD
            </div>

            <div className="mt-12 grid grid-cols-2 gap-12">
                <div>
                    <div className="mb-2 font-bold">Contractor:</div>
                    <div className="h-16 mb-2"></div>
                    <div className="border-t border-black text-[10px] text-center">Signature / Stamp</div>
                </div>
                <div>
                    <div className="mb-2 font-bold">Customer:</div>
                    <div className="h-16 mb-2"></div>
                    <div className="border-t border-black text-[10px] text-center">Signature / Stamp</div>
                </div>
            </div>
        </PrintLayout>
    );
}
