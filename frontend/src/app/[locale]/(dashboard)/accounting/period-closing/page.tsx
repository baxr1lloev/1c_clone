import { getTranslations } from 'next-intl/server';
import { PeriodClosingWizard } from '@/components/accounting/period-closing-wizard';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'Accounting' });
  return {
    title: t('periodClosing'),
  };
}

export default function PeriodClosingPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PeriodClosingWizard />
    </div>
  );
}
