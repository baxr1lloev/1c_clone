import React from 'react';

interface PrintLayoutProps {
    children: React.ReactNode;
    title?: string;
}

export function PrintLayout({ children, title }: PrintLayoutProps) {
    return (
        <div className="print-container bg-white text-black font-serif text-[12px] leading-tight p-8 max-w-[210mm] mx-auto min-h-[297mm]">
            <style jsx global>{`
                @media print {
                    @page { margin: 10mm; }
                    body { background: white; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-container { padding: 0; box-shadow: none; margin: 0; }
                }
                .print-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
                .print-table th, .print-table td { border: 1px solid black; padding: 4px; text-align: left; }
                .print-table th { background-color: #f0f0f0; font-weight: bold; text-align: center;}
                .print-header { border-bottom: 2px solid black; margin-bottom: 15px; padding-bottom: 5px; font-weight: bold; font-size: 14px; }
                .signature-line { border-bottom: 1px solid black; display: inline-block; width: 150px; margin-left: 10px; }
            `}</style>
            {title && <h1 className="text-xl font-bold text-center mb-6">{title}</h1>}
            {children}
        </div>
    );
}
