import { PrintLayout } from "./print-layout";
import { format } from "date-fns";

interface WaybillPrintProps {
    document: any;
    tenant: any;
}

export function WaybillPrint({ document, tenant }: WaybillPrintProps) {
    const totalQty = document.lines.reduce((sum: number, line: any) => sum + Number(line.quantity), 0);
    const totalAmount = document.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.price), 0);

    return (
        <PrintLayout title={`WAYBILL No. ${document.number}`}>
            <div className="text-right text-xs mb-8">
                Form No. TORG-12<br />
                Approved by Goskomstat of Russia No. 132
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-y-2 mb-6 border-b pb-4">
                <div className="font-bold">Consignor:</div>
                <div>{tenant?.name}, {tenant?.address}</div>

                <div className="font-bold">Consignee:</div>
                <div>{document.counterparty_name}, [Address]</div>

                <div className="font-bold">Payer:</div>
                <div>{document.counterparty_name}, [Address]</div>

                <div className="font-bold">Basis:</div>
                <div>Contract No. ... dated ...</div>
            </div>

            <table className="print-table text-[10px]">
                <thead>
                    <tr>
                        <th className="w-8">#</th>
                        <th>Item</th>
                        <th className="w-16">Code</th>
                        <th className="w-16">Unit</th>
                        <th className="w-16">Pkg</th>
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
                            <td className="text-center">{line.item_code || "000" + (index + 1)}</td>
                            <td className="text-center">{line.unit || 'pcs'}</td>
                            <td className="text-center">-</td>
                            <td className="text-right font-bold">{line.quantity}</td>
                            <td className="text-right">{line.price.toFixed(2)}</td>
                            <td className="text-right">{(line.quantity * line.price).toFixed(2)}</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={5} className="text-right font-bold bg-gray-100">Total:</td>
                        <td className="text-right font-bold">{totalQty}</td>
                        <td className="text-center">X</td>
                        <td className="text-right font-bold">{totalAmount.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-8 grid grid-cols-2 gap-12">
                <div>
                    <div className="mb-2 font-bold">Released by (Sender):</div>
                    <div className="border-b border-black h-8"></div>
                    <div className="text-[10px] text-center text-gray-500">(Position, Signature, Full Name)</div>
                </div>
                <div>
                    <div className="mb-2 font-bold">Accepted by (Receiver):</div>
                    <div className="border-b border-black h-8"></div>
                    <div className="text-[10px] text-center text-gray-500">(Position, Signature, Full Name)</div>
                </div>
            </div>
        </PrintLayout>
    );
}
