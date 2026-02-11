"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import axios from "axios"
import { format } from "date-fns"
import { Loader2, ChevronDown, ChevronRight, Calculator, Calendar } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { addDays } from "date-fns"
import { ReportFilterBar } from "@/components/ui/report-filter-bar"

interface CashFlowItemData {
    name: string
    amount: number
}

interface CashFlowSection {
    inflow: CashFlowItemData[]
    outflow: CashFlowItemData[]
    net: number
}

interface CashFlowReportData {
    operating: CashFlowSection
    investing: CashFlowSection
    financing: CashFlowSection
    total_net: number
    opening_balance: number
    closing_balance: number
}

export default function CashFlowReportPage() {
    const t = useTranslations("Reports")

    const [periodStart, setPeriodStart] = useState<string>(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] // First day of current month
    )
    const [periodEnd, setPeriodEnd] = useState<string>(
        new Date().toISOString().split('T')[0] // Today
    )

    const { data, isLoading, refetch } = useQuery<CashFlowReportData>({
        queryKey: ["cash-flow-report", periodStart, periodEnd],
        queryFn: async () => {
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/reports/cash-flow/`,
                {
                    params: {
                        start_date: periodStart,
                        end_date: periodEnd
                    }
                }
            )
            return response.data
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Отчёт о движении денежных средств (Cash Flow)</h1>
                    <p className="text-muted-foreground">
                        Анализ поступлений и выплат по видам деятельности
                    </p>
                </div>
            </div>

            <ReportFilterBar
                onFilterChange={(start, end) => {
                    setPeriodStart(start)
                    setPeriodEnd(end)
                }}
                onRefresh={refetch}
            />

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : data ? (
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                                <CardTitle>Сводка за период</CardTitle>
                                <div className="text-sm text-muted-foreground">
                                    {periodStart} — {periodEnd}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <span className="text-sm font-medium text-muted-foreground">Остаток на начало</span>
                                    <div className="text-2xl font-bold font-mono">
                                        {data.opening_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-sm font-medium text-muted-foreground">Чистый денежный поток</span>
                                    <div className={`text-2xl font-bold font-mono ${data.total_net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {data.total_net > 0 ? '+' : ''}{data.total_net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-sm font-medium text-muted-foreground">Остаток на конец</span>
                                    <div className="text-2xl font-bold font-mono">
                                        {data.closing_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Operating */}
                        <CashFlowSectionCard
                            title="Операционная деятельность"
                            data={data.operating}
                            icon={<Calculator className="h-5 w-5" />}
                            description="Основная деятельность (выручка, поставщики, зарплата)"
                        />

                        {/* Investing */}
                        <CashFlowSectionCard
                            title="Инвестиционная деятельность"
                            data={data.investing}
                            icon={<Calendar className="h-5 w-5" />}
                            description="Покупка/продажа активов, оборудования"
                        />

                        {/* Financing */}
                        <CashFlowSectionCard
                            title="Финансовая деятельность"
                            data={data.financing}
                            icon={<Calculator className="h-5 w-5" />}
                            description="Кредиты, займы, вклады учредителей"
                        />
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function CashFlowSectionCard({ title, data, icon, description }: { title: string, data: CashFlowSection, icon: any, description: string }) {
    return (
        <Card className="flex flex-col h-full">
            <CardHeader>
                <div className="flex items-center gap-2">
                    {icon}
                    <CardTitle className="text-lg">{title}</CardTitle>
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                <div className="space-y-4 flex-1">
                    {/* Inflow */}
                    <div>
                        <h4 className="text-sm font-semibold mb-2 text-green-600 flex items-center gap-1">
                            <ChevronDown className="h-4 w-4" /> Поступления
                        </h4>
                        {data.inflow.length > 0 ? (
                            <ul className="space-y-1 text-sm">
                                {data.inflow.map((item, i) => (
                                    <li key={i} className="flex justify-between border-b border-dashed border-gray-100 pb-1">
                                        <span className="text-muted-foreground">{item.name}</span>
                                        <span className="font-mono">{item.amount.toLocaleString()}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">Нет поступлений</p>
                        )}
                        <div className="mt-1 text-right text-sm font-semibold">
                            Total: {data.inflow.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                        </div>
                    </div>

                    {/* Outflow */}
                    <div>
                        <h4 className="text-sm font-semibold mb-2 text-red-600 flex items-center gap-1">
                            <ChevronDown className="h-4 w-4" /> Выплаты
                        </h4>
                        {data.outflow.length > 0 ? (
                            <ul className="space-y-1 text-sm">
                                {data.outflow.map((item, i) => (
                                    <li key={i} className="flex justify-between border-b border-dashed border-gray-100 pb-1">
                                        <span className="text-muted-foreground">{item.name}</span>
                                        <span className="font-mono">{item.amount.toLocaleString()}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">Нет выплат</p>
                        )}
                        <div className="mt-1 text-right text-sm font-semibold">
                            Total: {data.outflow.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t flex justify-between items-center text-lg font-bold">
                    <span>Net Flow:</span>
                    <span className={data.net >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {data.net > 0 ? '+' : ''}{data.net.toLocaleString()}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
