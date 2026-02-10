'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PiDownloadBold, PiArrowsClockwiseBold } from 'react-icons/pi';

export default function ProfitLossPage() {
  const t = useTranslations('accounting');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('profitLoss')}</h1>
          <p className="text-muted-foreground">Income statement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <PiArrowsClockwiseBold className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button>
            <PiDownloadBold className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss Report</CardTitle>
          <CardDescription>For period ending {new Date().toLocaleDateString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            Report implementation coming soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
