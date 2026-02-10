'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Lock, AlertTriangle } from 'lucide-react';

interface MonthEndClosing {
    id: number;
    period: string;
    status: string;
    step1_verify_documents: boolean;
    step2_calculate_cogs: boolean;
    step3_generate_reports: boolean;
    step4_review_profit: boolean;
    step5_lock_period: boolean;
    unposted_documents_count: number;
    total_revenue: number;
    total_cogs: number;
    gross_profit: number;
    net_profit: number;
}

interface StepResult {
    success: boolean;
    [key: string]: any;
}

export default function MonthEndClosingPage() {
    const t = useTranslations();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedPeriod, setSelectedPeriod] = useState(
        new Date().toISOString().slice(0, 7) // YYYY-MM
    );

    // Fetch current closing
    const { data: closing, isLoading } = useQuery({
        queryKey: ['month-end-closing', selectedPeriod],
        queryFn: async () => {
            const response = await api.get(`/accounting/month-end-closing/?period=${selectedPeriod}`);
            return response.data as MonthEndClosing;
        }
    });

    // Start closing
    const startClosing = useMutation({
        mutationFn: async () => {
            const response = await api.post('/accounting/month-end-closing/start/', {
                period: selectedPeriod
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['month-end-closing'] });
        }
    });

    // Execute step
    const executeStep = useMutation({
        mutationFn: async (step: number) => {
            const response = await api.post(`/accounting/month-end-closing/${closing?.id}/step${step}/`);
            return response.data as StepResult;
        },
        onSuccess: (data, step) => {
            queryClient.invalidateQueries({ queryKey: ['month-end-closing'] });
            if (data.success && step < 5) {
                setCurrentStep(step + 1);
            }
        }
    });

    const steps = [
        {
            number: 1,
            title: 'Verify Documents',
            description: 'Check all documents are posted',
            completed: closing?.step1_verify_documents,
            icon: CheckCircle2
        },
        {
            number: 2,
            title: 'Calculate COGS',
            description: 'Verify FIFO calculations',
            completed: closing?.step2_calculate_cogs,
            icon: CheckCircle2
        },
        {
            number: 3,
            title: 'Generate Reports',
            description: 'Create Trial Balance & P&L',
            completed: closing?.step3_generate_reports,
            icon: CheckCircle2
        },
        {
            number: 4,
            title: 'Review Profit',
            description: 'Verify profit calculation',
            completed: closing?.step4_review_profit,
            icon: CheckCircle2
        },
        {
            number: 5,
            title: 'Lock Period',
            description: 'Prevent further changes',
            completed: closing?.step5_lock_period,
            icon: Lock
        }
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Month-End Closing Wizard</h1>
                <p className="text-muted-foreground">Закрытие месяца - Step-by-step process</p>
            </div>

            {/* Period Selector */}
            <Card>
                <CardHeader>
                    <CardTitle>Select Period</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                    <input
                        type="month"
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-3 py-2 border rounded-md"
                    />
                    {!closing && (
                        <Button
                            onClick={() => startClosing.mutate()}
                            disabled={startClosing.isPending}
                        >
                            {startClosing.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                'Start Closing Process'
                            )}
                        </Button>
                    )}
                    {closing && (
                        <Badge variant={closing.status === 'completed' ? 'default' : 'secondary'}>
                            {closing.status}
                        </Badge>
                    )}
                </CardContent>
            </Card>

            {closing && (
                <>
                    {/* Progress Steps */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {steps.map((step) => (
                            <Card
                                key={step.number}
                                className={`${currentStep === step.number ? 'ring-2 ring-primary' : ''
                                    } ${step.completed ? 'bg-green-50 dark:bg-green-950' : ''}`}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Step {step.number}</span>
                                        {step.completed ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        ) : currentStep === step.number ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        ) : (
                                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                                        )}
                                    </div>
                                    <CardTitle className="text-base">{step.title}</CardTitle>
                                    <CardDescription className="text-xs">{step.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>

                    {/* Current Step Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Step {currentStep}: {steps[currentStep - 1].title}</CardTitle>
                            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Step 1: Verify Documents */}
                            {currentStep === 1 && (
                                <div className="space-y-4">
                                    {closing.unposted_documents_count > 0 ? (
                                        <Alert variant="destructive">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertDescription>
                                                Found {closing.unposted_documents_count} unposted documents.
                                                Please post all documents before proceeding.
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <Alert>
                                            <CheckCircle2 className="h-4 w-4" />
                                            <AlertDescription>
                                                All documents are posted. Ready to proceed.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <Button
                                        onClick={() => executeStep.mutate(1)}
                                        disabled={executeStep.isPending}
                                    >
                                        {executeStep.isPending ? 'Verifying...' : 'Verify Documents'}
                                    </Button>
                                </div>
                            )}

                            {/* Step 2: Calculate COGS */}
                            {currentStep === 2 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Total Revenue</p>
                                            <p className="text-2xl font-bold">
                                                {closing.total_revenue?.toLocaleString()} сўм
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Total COGS</p>
                                            <p className="text-2xl font-bold">
                                                {closing.total_cogs?.toLocaleString()} сўм
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Gross Profit</p>
                                            <p className="text-2xl font-bold text-green-600">
                                                {closing.gross_profit?.toLocaleString()} сўм
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => executeStep.mutate(2)}
                                        disabled={executeStep.isPending}
                                    >
                                        {executeStep.isPending ? 'Calculating...' : 'Calculate COGS'}
                                    </Button>
                                </div>
                            )}

                            {/* Step 3: Generate Reports */}
                            {currentStep === 3 && (
                                <div className="space-y-4">
                                    <p>Generate Trial Balance and Profit & Loss reports for the period.</p>
                                    <Button
                                        onClick={() => executeStep.mutate(3)}
                                        disabled={executeStep.isPending}
                                    >
                                        {executeStep.isPending ? 'Generating...' : 'Generate Reports'}
                                    </Button>
                                </div>
                            )}

                            {/* Step 4: Review Profit */}
                            {currentStep === 4 && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-muted rounded-lg">
                                        <h3 className="font-semibold mb-2">Profit Summary</h3>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Revenue:</span>
                                                <span className="font-mono">{closing.total_revenue?.toLocaleString()} сўм</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>COGS:</span>
                                                <span className="font-mono">-{closing.total_cogs?.toLocaleString()} сўм</span>
                                            </div>
                                            <div className="flex justify-between font-bold text-lg border-t pt-2">
                                                <span>Net Profit:</span>
                                                <span className="font-mono text-green-600">
                                                    {closing.net_profit?.toLocaleString()} сўм
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => executeStep.mutate(4)}
                                        disabled={executeStep.isPending}
                                    >
                                        {executeStep.isPending ? 'Reviewing...' : 'Confirm Profit'}
                                    </Button>
                                </div>
                            )}

                            {/* Step 5: Lock Period */}
                            {currentStep === 5 && (
                                <div className="space-y-4">
                                    <Alert variant="destructive">
                                        <Lock className="h-4 w-4" />
                                        <AlertDescription>
                                            <strong>Warning:</strong> Locking the period will prevent any further changes
                                            to documents in this period. This action cannot be easily undone.
                                        </AlertDescription>
                                    </Alert>
                                    <Button
                                        onClick={() => executeStep.mutate(5)}
                                        disabled={executeStep.isPending}
                                        variant="destructive"
                                    >
                                        {executeStep.isPending ? 'Locking...' : 'Lock Period'}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
