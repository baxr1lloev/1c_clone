import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PiClockBold, PiTrendUpBold, PiWarningBold } from "react-icons/pi";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface QuickAccessProps {
  className?: string;
}

interface RecentDocument {
  id: number;
  type: "sales" | "purchase" | "transfer";
  number: string;
  date: string;
  href: string;
}

export function QuickAccess({ className }: QuickAccessProps) {
  const t = useTranslations("dashboard");
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);

  // Load recent documents from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("recent_documents");
    if (saved) {
      try {
        setRecentDocs(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load recent documents:", e);
      }
    }
  }, []);

  return (
    <div className={className}>
      <div className="grid gap-4">
        {/* Recent Documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <PiClockBold className="h-4 w-4" />
              {t("recentDocuments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noRecentDocuments")}
              </p>
            ) : (
              <div className="space-y-2">
                {recentDocs.slice(0, 5).map((doc) => (
                  <Link
                    key={doc.id}
                    href={doc.href}
                    className="block text-sm hover:bg-accent rounded px-2 py-1"
                  >
                    <div className="font-medium">{doc.number}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(doc.date).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Create */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <PiTrendUpBold className="h-4 w-4" />
              {t("quickCreate")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              asChild
            >
              <Link href="/documents/sales/new">+ {t("salesDocument")}</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              asChild
            >
              <Link href="/documents/purchases/new">
                + {t("purchaseDocument")}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              asChild
            >
              <Link href="/directories/counterparties/new">
                + {t("counterparty")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Today's Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("todaysSummary")}</CardTitle>
            <CardDescription className="text-xs">
              {new Date().toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("salesLabel")}</span>
              <span className="font-medium">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("purchasesLabel")}
              </span>
              <span className="font-medium">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("documentsLabel")}
              </span>
              <span className="font-medium">0</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Hook to add document to recent list
export function useRecentDocument(document: RecentDocument) {
  useEffect(() => {
    const saved = localStorage.getItem("recent_documents");
    let recent: RecentDocument[] = saved ? JSON.parse(saved) : [];

    // Remove if already exists
    recent = recent.filter(
      (d) => d.id !== document.id || d.type !== document.type,
    );

    // Add to beginning
    recent.unshift(document);

    // Keep only last 10
    recent = recent.slice(0, 10);

    localStorage.setItem("recent_documents", JSON.stringify(recent));
  }, [document]);
}
