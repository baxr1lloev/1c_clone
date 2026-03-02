import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoicePrint } from "@/components/print/invoice-print";
import { WaybillPrint } from "@/components/print/waybill-print";
import { ActPrint } from "@/components/print/act-print";
import { PiPrinterBold } from "react-icons/pi";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";

interface PrintPreviewDialogProps {
    document: any;
    tenant?: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function PrintPreviewDialog({ document, tenant, open, onOpenChange }: PrintPreviewDialogProps) {
    const [formType, setFormType] = useState<"invoice" | "waybill" | "act">("invoice");
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `${formType}_${document?.number || 'draft'}`, // Safe access
    });

    const renderForm = () => {
        const props = { document, tenant: tenant || { name: "Demo Company LLC", inn: "1234567890", address: "123 Business Rd", bankName: "Main Bank", bik: "044525225", accountNumber: "40702810..." } };

        switch (formType) {
            case "invoice": return <InvoicePrint {...props} />;
            case "waybill": return <WaybillPrint {...props} />;
            case "act": return <ActPrint {...props} />;
            default: return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                <div className="p-4 border-b flex items-center justify-between bg-muted/10">
                    <div className="flex items-center gap-4">
                        <h2 className="font-semibold">Print Document</h2>
                        <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select Form" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="invoice">Invoice (Счет)</SelectItem>
                                <SelectItem value="waybill">Waybill (Накладная)</SelectItem>
                                <SelectItem value="act">Act (Акт)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => handlePrint()}>
                            <PiPrinterBold className="mr-2 h-4 w-4" />
                            Print Now
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-gray-100 p-8">
                    <div className="shadow-lg mx-auto w-fit bg-background" ref={printRef}>
                        {renderForm()}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
