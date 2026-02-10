'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/api';
import { TaxiTabs } from '@/components/layout/taxi-tabs';
import { useAppStore } from '@/stores/app-store';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { sidebarCollapsed } = useAppStore();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />
      <main
        className={cn(
          'pt-14 h-screen transition-all duration-300 flex flex-col overflow-hidden',
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        )}
      >
        {/* Tabs - Fixed at top of Main, below Header */}
        <div className="shrink-0 z-20 shadow-sm relative">
          <TaxiTabs />
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto bg-muted/5 relative scroll-smooth">
          <div className="container max-w-full mx-auto p-4 min-h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
