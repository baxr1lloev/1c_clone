'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/stores/app-store';
import { CommandBar } from '@/components/ui/command-bar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    PiCheckCircleBold,
    PiWarningBold,
    PiSpinnerGapBold,
    PiLockKeyBold,
    PiCurrencyDollarBold,
    PiCalculatorBold,
    PiListChecksBold
} from 'react-icons/pi';
import { toast } from 'sonner';

type ClosingStep = {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    status: 'pending' | 'running' | 'completed' | 'error';
    log?: string[];
};

export default function MonthClosingPage() {
    const t = useTranslations('accounting');
    const tc = useTranslations('common');

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    // Mock Steps State
    const [steps, setSteps] = useState<ClosingStep[]>([
        {
            id: 'integrity',
            title: 'Data Integrity Check',
            description: 'Verifies sequential document numbering, negative stocks, and draft documents.',
            icon: <PiListChecksBold className="h-6 w-6" />,
            status: 'pending',
            log: []
        },
        {
            id: 'fx_reval',
            title: 'FX Revaluation',
            description: 'Calculates exchange rate differences for foreign currency accounts (GL 60, 62, 52).',
            icon: <PiCurrencyDollarBold className="h-6 w-6" />,
            status: 'pending'
        },
        {
            id: 'cogs',
            title: 'Cost Adjustment (COGS)',
            description: 'Adjusts moving average costs and closes cost accounts (GL 20, 90).',
            icon: <PiCalculatorBold className="h-6 w-6" />,
            status: 'pending'
        },
        {
            id: 'lock',
            title: 'Lock Period',
            description: 'Sets the "Prohibit Editing Date" to prevent changes to closed periods.',
            icon: <PiLockKeyBold className="h-6 w-6" />,
            status: 'pending'
        }
    ]);

    const runStep = async (index: number) => {
        if (index >= steps.length) {
            setIsRunning(false);
            toast.success("Month closed successfully!");
            return;
        }

        const step = steps[index];

        // Update status to running
        setSteps(prev => prev.map((s, i) => i === index ? { ...s, status: 'running' } : s));
        setCurrentStepIndex(index);

        // Simulate API call / Process time
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Random Mock Log
        const mockLog = [
            `Started ${step.title}...`,
            `Processing data...`,
            `Checked 145 documents...`,
            `Completed successfully.`
        ];

        // Update status to completed
        setSteps(prev => prev.map((s, i) => i === index ? { ...s, status: 'completed', log: mockLog } : s));

        // Next step
        runStep(index + 1);
    };

    const handleStartClosing = () => {
        setIsRunning(true);
        runStep(0);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar
                mainActions={[
                    {
                        label: 'Perform Closing',
                        onClick: handleStartClosing,
                        icon: <PiCheckCircleBold />,
                        variant: 'default',
                        disabled: isRunning || steps.every(s => s.status === 'completed')
                    },
                    {
                        label: 'Reset',
                        onClick: () => {
                            setSteps(steps.map(s => ({ ...s, status: 'pending', log: [] })));
                            setCurrentStepIndex(0);
                            setIsRunning(false);
                        },
                        variant: 'ghost'
                    }
                ]}
                className="border-b"
            />

            <div className="p-8 max-w-4xl mx-auto w-full overflow-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold mb-2">Month Closing Wizard: January 2026</h1>
                    <p className="text-muted-foreground">
                        This wizard performs all necessary accounting routines to close the financial period.
                        Please ensure all external documents are entered before proceeding.
                    </p>
                </div>

                <div className="grid gap-4">
                    {steps.map((step, index) => (
                        <Card key={step.id} className={`transition-all ${index === currentStepIndex && isRunning ? 'border-primary shadow-md' : 'opacity-80'}`}>
                            <CardHeader className="flex flex-row items-start gap-4 pb-2">
                                <div className={`p-2 rounded-md ${step.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                                    step.status === 'running' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                                        step.status === 'error' ? 'bg-red-100 text-red-600' :
                                            'bg-muted text-muted-foreground'
                                    }`}>
                                    {step.status === 'running' ? <PiSpinnerGapBold className="animate-spin h-6 w-6" /> : step.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{step.title}</CardTitle>
                                        {step.status === 'completed' && <PiCheckCircleBold className="text-emerald-500 h-5 w-5" />}
                                    </div>
                                    <CardDescription className="mt-1">
                                        {step.description}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            {step.log && step.log.length > 0 && (
                                <CardContent className="pt-0 pl-[4.5rem]">
                                    <div className="bg-muted/30 p-2 rounded text-xs font-mono text-muted-foreground space-y-1">
                                        {step.log.map((line, i) => (
                                            <div key={i}>{line}</div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
