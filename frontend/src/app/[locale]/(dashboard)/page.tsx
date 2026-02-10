'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  PiTrendUpBold,
  PiTrendDownBold,
  PiCurrencyDollarBold,
  PiPackageBold,
  PiUsersBold,
  PiFileTextBold,
  PiArrowRightBold,
  PiWarningBold,
  PiShoppingCartBold,
  PiClockBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import type { DashboardStats, RevenueChartData } from '@/types';
import { QuickAccess } from '@/components/layout/quick-access';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tn = useTranslations('nav');

  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get<DashboardStats>('/dashboard/stats/');
      return response;
    },
  });

  const { data: chartData, error: chartError } = useQuery({
    queryKey: ['dashboard-chart'],
    queryFn: async () => {
      const response = await api.get<RevenueChartData[]>('/dashboard/revenue-chart/');
      return response;
    },
  });

  const statCards = [
    {
      title: t('totalRevenue'),
      value: stats?.total_revenue || 0,
      icon: PiCurrencyDollarBold,
      trend: '+12.5%',
      trendUp: true,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: t('totalExpenses'),
      value: stats?.total_expenses || 0,
      icon: PiTrendDownBold,
      trend: '+5.2%',
      trendUp: false,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
    {
      title: t('netProfit'),
      value: stats?.net_profit || 0,
      icon: PiTrendUpBold,
      trend: '+18.3%',
      trendUp: true,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: t('receivables'),
      value: stats?.total_receivables || 0,
      icon: PiUsersBold,
      trend: '-2.1%',
      trendUp: true,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  const quickStats = [
    {
      title: t('lowStock'),
      value: stats?.low_stock_items || 0,
      icon: PiWarningBold,
      color: 'text-amber-600',
      href: '/registers/stock-balance',
    },
    {
      title: t('pendingOrders'),
      value: stats?.pending_orders || 0,
      icon: PiShoppingCartBold,
      color: 'text-blue-600',
      href: '/documents/orders',
    },
    {
      title: t('documentsToday'),
      value: stats?.documents_today || 0,
      icon: PiFileTextBold,
      color: 'text-emerald-600',
      href: '/documents/sales',
    },
    {
      title: t('payables'),
      value: formatCurrency(stats?.total_payables || 0),
      icon: PiClockBold,
      color: 'text-rose-600',
      href: '/registers/settlements',
    },
  ];

  const quickActions = [
    { label: 'Create Sales Document', href: '/documents/sales/new', icon: PiFileTextBold },
    { label: 'Create Purchase', href: '/documents/purchases/new', icon: PiPackageBold },
    { label: 'Add Counterparty', href: '/directories/counterparties/new', icon: PiUsersBold },
    { label: 'Add Product', href: '/directories/items/new', icon: PiPackageBold },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('welcome')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports">
              {tn('reports')}
              <PiArrowRightBold className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(stat.value)}</div>
                    <div className={`flex items-center text-xs mt-1 ${stat.trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stat.trendUp ? (
                        <PiTrendUpBold className="h-3 w-3 mr-1" />
                      ) : (
                        <PiTrendDownBold className="h-3 w-3 mr-1" />
                      )}
                      {stat.trend} from last month
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('salesChart')}</CardTitle>
            <CardDescription>Revenue vs Expenses over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(142, 76%, 36%)', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="hsl(346, 87%, 43%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(346, 87%, 43%)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Access Widget */}
        <QuickAccess />
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>{t('overview')}</CardTitle>
          <CardDescription>Key metrics at a glance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quickStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.title} href={stat.href}>
                <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg bg-muted`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <span className="font-medium">{stat.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{stat.value}</span>
                    <PiArrowRightBold className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickActions')}</CardTitle>
          <CardDescription>Frequently used actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.href}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  asChild
                >
                  <Link href={action.href}>
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{action.label}</span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
