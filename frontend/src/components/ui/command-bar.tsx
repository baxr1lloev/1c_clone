"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    PiMagnifyingGlassBold,
    PiPlusBold,
    PiCopyBold,
    PiPencilBold,
    PiCheckCircleBold,
    PiXCircleBold,
    PiTrashBold,
    PiPrinterBold,
    PiFunnelBold,
    PiArrowsClockwiseBold
} from "react-icons/pi"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"

export interface CommandBarAction {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    disabled?: boolean
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    shortcut?: string
}

export interface CommandBarProps extends React.HTMLAttributes<HTMLDivElement> {
    onSearch?: (term: string) => void
    searchValue?: string
    searchPlaceholder?: string

    // Action groups
    mainActions?: CommandBarAction[]
    selectionActions?: CommandBarAction[] // Only show when row selected

    onRefresh?: () => void
    onFilterToggle?: () => void

    className?: string
}

export function CommandBar({
    onSearch,
    searchValue,
    searchPlaceholder,
    mainActions = [],
    selectionActions = [],
    onRefresh,
    onFilterToggle,
    className,
    ...props
}: CommandBarProps) {
    const t = useTranslations('common')

    return (
        <div
            className={cn(
                "flex h-10 w-full items-center gap-1 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                className
            )}
            {...props}
        >
            {/* Main Actions (Create) */}
            <div className="flex items-center gap-1">
                {mainActions.map((action, i) => (
                    <CommandBarButton key={i} action={action} />
                ))}
            </div>

            {mainActions.length > 0 && <Separator orientation="vertical" className="mx-1 h-6" />}

            {/* Selection Actions (Edit, Post, etc) */}
            {selectionActions.length > 0 && (
                <div className="flex items-center gap-1">
                    {selectionActions.map((action, i) => (
                        <CommandBarButton key={i} action={action} />
                    ))}
                    <Separator orientation="vertical" className="mx-1 h-6" />
                </div>
            )}

            {/* Standard Tools */}
            <div className="flex items-center gap-1">
                {onRefresh && (
                    <Button variant="ghost" size="sm" onClick={onRefresh} className="h-8 px-2 text-xs" title={t('refresh')}>
                        <PiArrowsClockwiseBold className="mr-1 h-3.5 w-3.5" />
                        {t('refresh')}
                    </Button>
                )}
                {onFilterToggle && (
                    <Button variant="ghost" size="sm" onClick={onFilterToggle} className="h-8 px-2 text-xs" title={t('filter')}>
                        <PiFunnelBold className="mr-1 h-3.5 w-3.5" />
                        {t('filter')}
                    </Button>
                )}
            </div>

            <div className="ml-auto flex items-center gap-2">
                {onSearch && (
                    <div className="relative">
                        <PiMagnifyingGlassBold className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            data-search-input
                            className="h-7 w-[200px] pl-8 text-xs bg-muted/50 border-none shadow-none focus-visible:ring-1"
                            placeholder={searchPlaceholder || t('searchPlaceholder')}
                            value={searchValue}
                            onChange={(e) => onSearch(e.target.value)}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

function CommandBarButton({ action }: { action: CommandBarAction }) {
    return (
        <Button
            variant={action.variant || "ghost"}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
                "h-8 px-2.5 text-xs font-medium transition-all duration-200",
                "hover:scale-[1.02] active:scale-[0.98]",
                // Default variant with gradient
                action.variant === 'default' && cn(
                    "bg-gradient-to-r from-primary to-primary/90",
                    "text-primary-foreground shadow-sm",
                    "hover:shadow-md hover:from-primary/90 hover:to-primary/80"
                ),
                // Destructive variant with gradient
                action.variant === 'destructive' && cn(
                    "text-destructive hover:text-destructive-foreground",
                    "hover:bg-gradient-to-r hover:from-destructive hover:to-destructive/90",
                    "hover:shadow-sm"
                ),
                // Ghost variant with subtle hover
                !action.variant || action.variant === 'ghost' && cn(
                    "hover:bg-accent/10 hover:text-accent-foreground"
                )
            )}
            title={action.shortcut}
        >
            {action.icon && <span className="mr-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5">{action.icon}</span>}
            {action.label}
        </Button>
    )
}
