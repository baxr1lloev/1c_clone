"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    PiCalendarBlankBold,
    PiBuildingsBold,
    PiUsersBold
} from "react-icons/pi"

interface ReportFilterBarProps {
    reportType?: 'financial' | 'sales'
    onFilterChange?: (start: string, end: string) => void
    onRefresh?: () => void
}

export function ReportFilterBar({ reportType = 'financial', onFilterChange, onRefresh }: ReportFilterBarProps) {
    const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10))
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10))
    const [isAdvanced, setIsAdvanced] = useState(false)

    return (
        <div className="flex flex-col border-b bg-muted/10">
            {/* Top Bar: Basic Filters */}
            <div className="flex flex-wrap items-end gap-4 p-4">
                {/* Period */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-end gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <PiCalendarBlankBold /> Period Start
                            </Label>
                            <Input
                                type="date"
                                value={periodStart}
                                onChange={(e) => {
                                    setPeriodStart(e.target.value)
                                    onFilterChange?.(e.target.value, periodEnd)
                                }}
                                className="h-8 w-32"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">End</Label>
                            <Input
                                type="date"
                                value={periodEnd}
                                onChange={(e) => {
                                    setPeriodEnd(e.target.value)
                                    onFilterChange?.(periodStart, e.target.value)
                                }}
                                className="h-8 w-32"
                            />
                        </div>
                    </div>
                    {/* Period Presets */}
                    <div className="flex gap-1">
                        <button
                            onClick={() => {
                                const now = new Date();
                                setPeriodStart(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
                                setPeriodEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
                            }}
                            className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                        >
                            This Month
                        </button>
                        <span className="text-[10px] text-muted-foreground">|</span>
                        <button
                            onClick={() => {
                                const now = new Date();
                                setPeriodStart(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10));
                                setPeriodEnd(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-primary hover:underline cursor-pointer"
                        >
                            Last Month
                        </button>
                        <span className="text-[10px] text-muted-foreground">|</span>
                        <button
                            onClick={() => {
                                const now = new Date();
                                const quarter = Math.floor(now.getMonth() / 3);
                                setPeriodStart(new Date(now.getFullYear(), quarter * 3, 1).toISOString().slice(0, 10));
                                setPeriodEnd(new Date(now.getFullYear(), (quarter + 1) * 3, 0).toISOString().slice(0, 10));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-primary hover:underline cursor-pointer"
                        >
                            Quarter
                        </button>
                    </div>
                </div>

                {/* Organization */}
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <PiBuildingsBold /> Organization
                    </Label>
                    <Input
                        value="Main Company LLC"
                        readOnly
                        className="h-8 w-48 bg-muted/50"
                    />
                </div>

                {/* Counterparty */}
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <PiUsersBold /> Counterparty
                    </Label>
                    <Input
                        placeholder="All"
                        className="h-8 w-48"
                    />
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-2 pb-1">
                    <input
                        type="checkbox"
                        id="adv-mode"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={isAdvanced}
                        onChange={(e) => setIsAdvanced(e.target.checked)}
                    />
                    <Label htmlFor="adv-mode" className="text-xs cursor-pointer select-none">Advanced</Label>
                </div>
            </div>

            {/* Advanced Settings Panel */}
            {isAdvanced && (
                <div className="px-4 pb-4 grid grid-cols-3 gap-6 animate-in slide-in-from-top-1">
                    <div className="space-y-2 border rounded p-2 bg-background">
                        <span className="text-xs font-bold block border-b pb-1 mb-1">Grouping</span>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="h-3 w-3" /> <span className="text-xs">Counterparty</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="h-3 w-3" /> <span className="text-xs">Contract</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" className="h-3 w-3" /> <span className="text-xs">Document</span>
                        </div>
                    </div>

                    <div className="space-y-2 border rounded p-2 bg-background">
                        <span className="text-xs font-bold block border-b pb-1 mb-1">Additional Filters</span>
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                            <span className="text-xs">Warehouse:</span>
                            <Input className="h-6 text-xs" placeholder="All" />
                            <span className="text-xs">Project:</span>
                            <Input className="h-6 text-xs" placeholder="All" />

                            {/* SALES REPORT SPECIFIC FILTERS */}
                            {reportType === 'sales' && (
                                <>
                                    <span className="text-xs font-bold text-primary mt-1">Manager:</span>
                                    <Input className="h-6 text-xs bg-primary/5 border-primary/20" placeholder="All Managers" />
                                    <span className="text-xs font-bold text-primary">Item:</span>
                                    <Input className="h-6 text-xs bg-primary/5 border-primary/20" placeholder="All Items" />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2 border rounded p-2 bg-background">
                        <span className="text-xs font-bold block border-b pb-1 mb-1">Sorting</span>
                        <div className="flex items-center gap-2">
                            <input type="radio" name="sort" defaultChecked className="h-3 w-3" /> <span className="text-xs">Date (Asc)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="radio" name="sort" className="h-3 w-3" /> <span className="text-xs">Date (Desc)</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
