import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PiPrinterBold, PiFilePdfBold } from 'react-icons/pi';
import { toast } from 'sonner';

interface PrintTemplateProps {
    document: any;
    documentType: 'sales' | 'purchase' | 'transfer';
}

export function PrintTemplate({ document, documentType }: PrintTemplateProps) {
    const [template, setTemplate] = React.useState<'invoice' | 'packing' | 'receipt'>('invoice');
    const [isOpen, setIsOpen] = React.useState(false);

    const handlePrint = () => {
        window.print();
        toast.success('Print dialog opened');
    };

    const handleExportPDF = () => {
        // In a real implementation, this would use jsPDF or similar
        // For now, we'll use the browser's print to PDF
        toast.info('Use Print > Save as PDF to export');
        window.print();
    };

    const getTemplateOptions = () => {
        const options = {
            sales: [
                { value: 'invoice', label: 'Invoice' },
                { value: 'packing', label: 'Packing List' },
                { value: 'receipt', label: 'Receipt' }
            ],
            purchase: [
                { value: 'invoice', label: 'Purchase Order' },
                { value: 'receipt', label: 'Goods Receipt' }
            ],
            transfer: [
                { value: 'packing', label: 'Transfer Document' }
            ]
        };

        return options[documentType] || options.sales;
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <PiPrinterBold className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Print Document</DialogTitle>
                        <DialogDescription>
                            Select a template and print or export to PDF
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Template</label>
                            <Select value={template} onValueChange={(v: any) => setTemplate(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {getTemplateOptions().map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="border rounded-lg p-4 bg-muted/20">
                            <PrintPreview document={document} template={template} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleExportPDF}>
                            <PiFilePdfBold className="mr-2 h-4 w-4" />
                            Export PDF
                        </Button>
                        <Button onClick={handlePrint}>
                            <PiPrinterBold className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Print styles */}
            <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
        </>
    );
}

function PrintPreview({ document, template }: { document: any; template: string }) {
    return (
        <div className="print-content text-xs space-y-2">
            <div className="text-center font-bold text-lg">
                {template === 'invoice' && 'INVOICE'}
                {template === 'packing' && 'PACKING LIST'}
                {template === 'receipt' && 'RECEIPT'}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <div className="font-semibold">Number:</div>
                    <div>{document.number}</div>
                </div>
                <div>
                    <div className="font-semibold">Date:</div>
                    <div>{new Date(document.date).toLocaleDateString()}</div>
                </div>
            </div>

            <div className="text-xs text-muted-foreground">
                Preview only - actual print will include full details
            </div>
        </div>
    );
}
