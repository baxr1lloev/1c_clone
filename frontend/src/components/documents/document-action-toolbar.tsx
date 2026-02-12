'use client';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from 'next-intl';
import { PiCheckBold, PiXBold, PiPrinterBold, PiCaretDownBold, PiCopyBold, PiClockCounterClockwiseBold, PiTrashBold, PiDotsThreeBold } from 'react-icons/pi';

interface DocumentActionToolbarProps {
    documentId?: number;
    documentType: string;
    status: 'draft' | 'posted' | 'cancelled';
    canPost: boolean;
    canUnpost: boolean;
    canDelete: boolean;
    onPost: () => void;
    onUnpost: () => void;
    onPostAndClose?: () => void;
    onShowPostings?: () => void;
    onPrint?: () => void;
    onCopy?: () => void;
    onDelete?: () => void;
    onShowHistory?: () => void;
    createBasedOnOptions?: Array<{
        label: string;
        onClick: () => void;
    }>;
    moreOptions?: Array<{
        label: string;
        onClick: () => void;
        variant?: 'default' | 'destructive';
    }>;
}

export function DocumentActionToolbar({
    status,
    canPost,
    canUnpost,
    canDelete,
    onPost,
    onUnpost,
    onPostAndClose,
    onShowPostings,
    onPrint,
    onCopy,
    onDelete,
    onShowHistory,
    createBasedOnOptions,
    moreOptions,
}: DocumentActionToolbarProps) {
    const tCommon = useTranslations('common');
    const tDocuments = useTranslations('documents');
    const tToolbar = useTranslations('documents.detail.toolbar');
    const isPosted = status === 'posted';
    const isDraft = status === 'draft';
    const isCancelled = status === 'cancelled';

    // Status badge variant based on 1C colors
    const getStatusBadge = () => {
        if (isDraft) {
            return (
                <Badge variant="outline" className="text-base px-4 py-1.5 bg-gray-100 text-gray-700 border-gray-300">
                    ⚪ {tDocuments('draft')}
                </Badge>
            );
        }
        if (isPosted) {
            return (
                <Badge variant="posted" className="text-base px-4 py-1.5 bg-green-100 text-green-700 border-green-300">
                    🟢 {tDocuments('posted')}
                </Badge>
            );
        }
        if (isCancelled) {
            return (
                <Badge variant="cancelled" className="text-base px-4 py-1.5 bg-red-100 text-red-700 border-red-300">
                    🔴 {tDocuments('cancelled')}
                </Badge>
            );
        }
    };

    return (
        <div className="flex items-center justify-between border-b p-4 bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex items-center gap-2 flex-wrap">
                {/* Post Button with Dropdown - 1C Green Style */}
                {onPostAndClose ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                disabled={!canPost || isPosted || isCancelled}
                                variant="default"
                                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                                title={tToolbar('postTitle')}
                            >
                                <PiCheckBold className="mr-2 h-4 w-4" />
                                {tCommon('post')}
                                <PiCaretDownBold className="ml-2 h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={onPost}>
                                <PiCheckBold className="mr-2 h-4 w-4" />
                                {tCommon('post')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onPostAndClose}>
                                <PiCheckBold className="mr-2 h-4 w-4" />
                                {tToolbar('postAndClose')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <Button
                        onClick={onPost}
                        disabled={!canPost || isPosted || isCancelled}
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                        title={tToolbar('postTitle')}
                    >
                        <PiCheckBold className="mr-2 h-4 w-4" />
                        {tCommon('post')}
                    </Button>
                )}

                {/* Unpost Button */}
                <Button
                    onClick={onUnpost}
                    disabled={!canUnpost || !isPosted}
                    variant="outline"
                    title={tToolbar('unpostTitle')}
                >
                    <PiXBold className="mr-2 h-4 w-4" />
                    {tDocuments('unpost')}
                </Button>

                {/* Show Postings Button - Only for posted documents */}
                {isPosted && onShowPostings && (
                    <Button
                        onClick={onShowPostings}
                        variant="outline"
                        title={tToolbar('showPostingsTitle')}
                    >
                        📊 {tToolbar('showPostings')}
                    </Button>
                )}

                <Separator orientation="vertical" className="h-8" />

                {/* Print Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            <PiPrinterBold className="mr-2 h-4 w-4" />
                            {tCommon('print')}
                            <PiCaretDownBold className="ml-2 h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={onPrint}>
                            📄 {tToolbar('printStandard')}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            📋 {tToolbar('printDetailed')}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            📦 {tToolbar('printPacking')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            ⚙️ {tToolbar('printSettings')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Create Based On - Only for posted documents */}
                {isPosted && createBasedOnOptions && createBasedOnOptions.length > 0 && (
                    <>
                        <Separator orientation="vertical" className="h-8" />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    {tToolbar('createBasedOn')}
                                    <PiCaretDownBold className="ml-2 h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                {createBasedOnOptions.map((option, idx) => (
                                    <DropdownMenuItem key={idx} onClick={option.onClick}>
                                        {option.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}

                {/* More Actions Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            <PiDotsThreeBold className="h-4 w-4" />
                            {tToolbar('more')}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {onCopy && (
                            <DropdownMenuItem onClick={onCopy}>
                                <PiCopyBold className="mr-2 h-4 w-4" />
                                {tToolbar('copyDocument')}
                            </DropdownMenuItem>
                        )}

                        {onShowHistory && (
                            <DropdownMenuItem onClick={onShowHistory}>
                                <PiClockCounterClockwiseBold className="mr-2 h-4 w-4" />
                                {tToolbar('changeHistory')}
                            </DropdownMenuItem>
                        )}

                        {moreOptions && moreOptions.length > 0 && (
                            <>
                                <DropdownMenuSeparator />
                                {moreOptions.map((option, idx) => (
                                    <DropdownMenuItem
                                        key={idx}
                                        onClick={option.onClick}
                                        className={option.variant === 'destructive' ? 'text-destructive' : ''}
                                    >
                                        {option.label}
                                    </DropdownMenuItem>
                                ))}
                            </>
                        )}

                        {onDelete && canDelete && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                    <PiTrashBold className="mr-2 h-4 w-4" />
                                    {tToolbar('deleteDocument')}
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Status Badge - Right Side (1C Style) */}
            <div className="flex items-center gap-3">
                {getStatusBadge()}
            </div>
        </div>
    );
}
