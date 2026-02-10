import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { PiQuestionBold, PiKeyboardBold, PiLightbulbBold } from 'react-icons/pi';
import { Badge } from '@/components/ui/badge';

interface HelpPanelProps {
    context?: 'sales-list' | 'purchase-list' | 'counterparty-list' | 'item-list' | 'transfer-list' | 'document-form';
}

export function HelpPanel({ context = 'sales-list' }: HelpPanelProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    const helpContent = getHelpContent(context);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                    <PiQuestionBold className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PiQuestionBold className="h-5 w-5" />
                        {helpContent.title}
                    </DialogTitle>
                    <DialogDescription>
                        {helpContent.description}
                    </DialogDescription>
                </DialogHeader>

                <Accordion type="multiple" className="w-full">
                    <AccordionItem value="shortcuts">
                        <AccordionTrigger>
                            <div className="flex items-center gap-2">
                                <PiKeyboardBold className="h-4 w-4" />
                                Keyboard Shortcuts
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-2">
                                {helpContent.shortcuts.map((shortcut, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-1">
                                        <span className="text-sm">{shortcut.action}</span>
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {shortcut.key}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="tips">
                        <AccordionTrigger>
                            <div className="flex items-center gap-2">
                                <PiLightbulbBold className="h-4 w-4" />
                                Tips & Tricks
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <ul className="space-y-2 list-disc list-inside">
                                {helpContent.tips.map((tip, idx) => (
                                    <li key={idx} className="text-sm">{tip}</li>
                                ))}
                            </ul>
                        </AccordionContent>
                    </AccordionItem>

                    {helpContent.features && (
                        <AccordionItem value="features">
                            <AccordionTrigger>Features</AccordionTrigger>
                            <AccordionContent>
                                <ul className="space-y-2 list-disc list-inside">
                                    {helpContent.features.map((feature, idx) => (
                                        <li key={idx} className="text-sm">{feature}</li>
                                    ))}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    )}
                </Accordion>
            </DialogContent>
        </Dialog>
    );
}

function getHelpContent(context: string) {
    const content = {
        'sales-list': {
            title: 'Sales Documents Help',
            description: 'Learn how to work with sales documents efficiently',
            shortcuts: [
                { key: 'Insert', action: 'Create new document' },
                { key: 'F2', action: 'Edit selected document' },
                { key: 'Delete', action: 'Delete selected document' },
                { key: 'Enter', action: 'Open selected document' },
                { key: 'F5', action: 'Refresh list' },
                { key: 'Ctrl+F', action: 'Focus search' },
                { key: '↑ / ↓', action: 'Navigate rows' },
                { key: 'PageUp / PageDown', action: 'Jump 10 rows' },
                { key: 'Home / End', action: 'First / Last row' },
                { key: 'Escape', action: 'Clear selection' }
            ],
            tips: [
                'Use quick filters to instantly filter documents by status',
                'Double-click a document to open it (draft) or view it (posted)',
                'Right-click on a row for context menu actions',
                'Group documents by status, date, or counterparty for better organization',
                'Save your current view (filters, sorting, columns) for quick access',
                'Use Ctrl+Click to select multiple documents for batch operations',
                'The status bar shows total records, filtered count, and selected count'
            ],
            features: [
                'Quick Filters - Filter by status with one click',
                'Conditional Highlighting - Posted (green), Cancelled (red), Draft (default)',
                'Grouping - Organize documents by any field',
                'Saved Views - Save and load your preferred view settings',
                'Column Customization - Show/hide columns as needed',
                'Batch Operations - Post, unpost, or delete multiple documents',
                'Inline Editing - Double-click cells to edit values'
            ]
        },
        'purchase-list': {
            title: 'Purchase Documents Help',
            description: 'Learn how to work with purchase documents efficiently',
            shortcuts: [
                { key: 'Insert', action: 'Create new document' },
                { key: 'F2', action: 'Edit selected document' },
                { key: 'Delete', action: 'Delete selected document' },
                { key: 'Enter', action: 'Open selected document' },
                { key: 'F5', action: 'Refresh list' },
                { key: 'Ctrl+F', action: 'Focus search' }
            ],
            tips: [
                'Use quick filters to find documents by status',
                'Group by supplier to see all purchases from each vendor',
                'Save views for frequently used filter combinations'
            ]
        },
        'counterparty-list': {
            title: 'Counterparties Help',
            description: 'Manage your customers and suppliers',
            shortcuts: [
                { key: 'Insert', action: 'Create new counterparty' },
                { key: 'F2', action: 'Edit selected' },
                { key: 'Enter', action: 'View details' },
                { key: 'F5', action: 'Refresh list' }
            ],
            tips: [
                'Use search to quickly find counterparties by name or code',
                'Inactive counterparties are shown in gray',
                'Click on a counterparty to see all related documents'
            ]
        },
        'item-list': {
            title: 'Items Help',
            description: 'Manage your product catalog',
            shortcuts: [
                { key: 'Insert', action: 'Create new item' },
                { key: 'F2', action: 'Edit selected' },
                { key: 'Enter', action: 'View details' },
                { key: 'F5', action: 'Refresh list' },
                { key: 'Ctrl+F', action: 'Focus search' }
            ],
            tips: [
                'Use search to find items by name or SKU',
                'Filter by Active/Inactive to manage your catalog',
                'Inactive items are shown in gray',
                'Group by category to organize your product list'
            ]
        },
        'transfer-list': {
            title: 'Transfer Documents Help',
            description: 'Manage warehouse transfers',
            shortcuts: [
                { key: 'Insert', action: 'Create new transfer' },
                { key: 'F2', action: 'Edit selected document' },
                { key: 'Delete', action: 'Delete selected document' },
                { key: 'Enter', action: 'Open selected document' },
                { key: 'F5', action: 'Refresh list' },
                { key: 'Ctrl+F', action: 'Focus search' }
            ],
            tips: [
                'Use quick filters to find transfers by status',
                'Double-click a document to open it (draft) or view it (posted)',
                'Group by source or target warehouse for better organization',
                'Posted transfers cannot be edited'
            ]
        },
        'document-form': {
            title: 'Document Form Help',
            description: 'Working with document forms',
            shortcuts: [
                { key: 'Ctrl+S', action: 'Save document' },
                { key: 'Ctrl+P', action: 'Post document' },
                { key: 'Escape', action: 'Cancel / Go back' }
            ],
            tips: [
                'Use tabs to navigate between General, Lines, Totals, and Postings',
                'The Postings tab shows accounting entries (only for posted documents)',
                'Double-click line item cells to edit inline',
                'Press Tab to move to the next field'
            ]
        }
    };

    return content[context as keyof typeof content] || content['sales-list'];
}
