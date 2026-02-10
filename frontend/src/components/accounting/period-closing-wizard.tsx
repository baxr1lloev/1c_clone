"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, startOfMonth } from "date-fns"
import {
    PiCalendarBold,
    PiCheckCircleBold,
    PiCircleDashedBold,
    PiPlayBold,
    PiLockBold,
    PiSpinnerBold,
    PiWarningBold,
    PiCalculatorBold,
    PiMoneyBold,
    PiArrowsLeftRightBold,
    PiBookOpenBold,
    PiChartLineUpBold
} from "react-icons/pi"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ClosingTask {
    code: string
    name: string
    name_ru: string
    description: string
    status: 'pending' | 'completed' | 'skipped' | 'error'
    result?: Record<string, unknown>
    error_message?: string
    order: number
}

interface WizardStatus {
    period: string
    period_date: string
    status: string
    is_closed: boolean
    closed_by?: string
    closed_at?: string
    profit_loss: number
    tasks: ClosingTask[]
    can_close: boolean
}

const TASK_ICONS: Record<string, React.ReactNode> = {
    'DEPRECIATION': <PiCalculatorBold className="h-5 w-5" />,
    'EXCHANGE_DIFF': <PiArrowsLeftRightBold className="h-5 w-5" />,
    'CLOSE_PL': <PiBookOpenBold className="h-5 w-5" />,
    'VAT': <PiMoneyBold className="h-5 w-5" />,
    'LOCK': <PiLockBold className="h-5 w-5" />,
}

// Generate month options for the last 12 months
function getMonthOptions() {
    const options = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        options.push({
            value: format(date, 'yyyy-MM-dd'),
            label: format(date, 'MMMM yyyy')
        })
    }
    return options
}

export function PeriodClosingWizard() {
    const [selectedPeriod, setSelectedPeriod] = useState(() =>
        format(startOfMonth(new Date()), 'yyyy-MM-dd')
    )
    const [executingTask, setExecutingTask] = useState<string | null>(null)
    const queryClient = useQueryClient()

    // Fetch wizard status
    const { data: wizardStatus, isLoading, refetch } = useQuery<WizardStatus>({
        queryKey: ['period-closing-wizard', selectedPeriod],
        queryFn: async () => {
            const res = await api.get(`/api/accounting/periods/wizard_status/?period=${selectedPeriod}`)
            return res.data
        }
    })

    // Execute single task
    const executeTaskMutation = useMutation({
        mutationFn: async (taskCode: string) => {
            const res = await api.post('/api/accounting/periods/execute_task/', {
                period: selectedPeriod,
                task_code: taskCode
            })
            return res.data
        },
        onMutate: (taskCode) => {
            setExecutingTask(taskCode)
        },
        onSuccess: (data) => {
            toast.success(data.message)
            refetch()
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
            toast.error(error.response?.data?.message || 'Task failed')
        },
        onSettled: () => {
            setExecutingTask(null)
        }
    })

    // Execute all tasks
    const closeFullMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/api/accounting/periods/close_full/', {
                period: selectedPeriod
            })
            return res.data
        },
        onMutate: () => {
            setExecutingTask('ALL')
        },
        onSuccess: (data) => {
            if (data.success) {
                toast.success('Period closed successfully!')
            } else {
                toast.error('Some tasks failed')
            }
            refetch()
            queryClient.invalidateQueries({ queryKey: ['periods'] })
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
            toast.error(error.response?.data?.message || 'Close failed')
        },
        onSettled: () => {
            setExecutingTask(null)
        }
    })

    const monthOptions = getMonthOptions()

    const getTaskStatusIcon = (task: ClosingTask) => {
        if (executingTask === task.code || executingTask === 'ALL') {
            return <PiSpinnerBold className="h-5 w-5 animate-spin text-blue-500" />
        }

        switch (task.status) {
            case 'completed':
                return <PiCheckCircleBold className="h-5 w-5 text-green-500" />
            case 'error':
                return <PiWarningBold className="h-5 w-5 text-red-500" />
            case 'skipped':
                return <PiCircleDashedBold className="h-5 w-5 text-gray-400" />
            default:
                return <PiCircleDashedBold className="h-5 w-5 text-gray-300" />
        }
    }

    return (
        <div className="space-y-6 p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <PiChartLineUpBold className="h-6 w-6" />
                        Закрытие периода
                    </h1>
                    <p className="text-muted-foreground">Period Closing Wizard</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <PiCalendarBold className="h-4 w-4 text-muted-foreground" />
                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                            <SelectContent>
                                {monthOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Status Card */}
            {wizardStatus && (
                <Card className={cn(
                    "border-2",
                    wizardStatus.is_closed ? "border-green-200 bg-green-50/50" : "border-yellow-200 bg-yellow-50/50"
                )}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                                {format(new Date(selectedPeriod), 'MMMM yyyy')}
                            </CardTitle>
                            <Badge variant={wizardStatus.is_closed ? "default" : "secondary"}>
                                {wizardStatus.is_closed ? 'Открыт' : 'Открыт'}
                            </Badge>
                        </div>
                        <CardDescription>
                            {wizardStatus.is_closed
                                ? `Closed by ${wizardStatus.closed_by} on ${wizardStatus.closed_at ? format(new Date(wizardStatus.closed_at), 'dd.MM.yyyy HH:mm') : 'unknown'}`
                                : 'Complete all tasks to close the period'
                            }
                        </CardDescription>
                    </CardHeader>
                    {wizardStatus.profit_loss !== 0 && (
                        <CardContent>
                            <div className="text-sm">
                                <span className="text-muted-foreground">Profit/Loss: </span>
                                <span className={cn(
                                    "font-bold",
                                    wizardStatus.profit_loss >= 0 ? "text-green-600" : "text-red-600"
                                )}>
                                    {wizardStatus.profit_loss.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Tasks List */}
            <Card>
                <CardHeader>
                    <CardTitle>Закрытие периода</CardTitle>
                    <CardDescription>
                        Execute each task in order to close the period
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <PiSpinnerBold className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        wizardStatus?.tasks.map((task, idx) => (
                            <div key={task.code}>
                                <div className={cn(
                                    "flex items-center justify-between p-4 rounded-lg transition-colors",
                                    task.status === 'completed' ? "bg-green-50" : "bg-muted/30 hover:bg-muted/50"
                                )}>
                                    <div className="flex items-center gap-4">
                                        {/* Task Icon */}
                                        <div className={cn(
                                            "p-2 rounded-lg",
                                            task.status === 'completed' ? "bg-green-100" : "bg-muted"
                                        )}>
                                            {TASK_ICONS[task.code]}
                                        </div>

                                        {/* Task Info */}
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                <span className="text-muted-foreground text-sm">{idx + 1}.</span>
                                                {task.name_ru}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {task.name} — {task.description}
                                            </div>
                                            {task.result && task.status === 'completed' && (
                                                <div className="text-xs text-green-600 mt-1">
                                                    {JSON.stringify(task.result)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action/Status */}
                                    <div className="flex items-center gap-3">
                                        {getTaskStatusIcon(task)}

                                        {!wizardStatus?.is_closed && task.status !== 'completed' && task.code !== 'LOCK' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => executeTaskMutation.mutate(task.code)}
                                                disabled={!!executingTask}
                                            >
                                                <PiPlayBold className="h-4 w-4 mr-1" />
                                                Выполнить
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {idx < wizardStatus!.tasks.length - 1 && <Separator className="my-1" />}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Close Period Button */}
            {wizardStatus && !wizardStatus.is_closed && (
                <div className="flex justify-end gap-4">
                    <Button
                        size="lg"
                        onClick={() => closeFullMutation.mutate()}
                        disabled={!!executingTask}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {executingTask === 'ALL' ? (
                            <PiSpinnerBold className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                            <PiLockBold className="h-5 w-5 mr-2" />
                        )}
                        Закрыть период
                    </Button>
                </div>
            )}

            {/* Already Closed Message */}
            {wizardStatus?.is_closed && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="py-6">
                        <div className="flex items-center justify-center gap-3 text-green-700">
                            <PiCheckCircleBold className="h-6 w-6" />
                            <span className="font-medium">Период закрыт. Закрытие периода завершено. Все задачи выполнены.</span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
