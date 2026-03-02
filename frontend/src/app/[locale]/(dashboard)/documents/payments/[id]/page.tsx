"use client";

import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import api from "@/lib/api";
import { PaymentDocumentForm } from "@/components/documents/payment-document-form";
import { Button } from "@/components/ui/button";
import type { PaymentDocument } from "@/types";

export default function PaymentDocumentDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const router = useRouter();
  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

  const id = Number.parseInt(String(params.id || ""), 10);

  const {
    data: paymentDocument,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["payment-document", id],
    queryFn: () => api.get<PaymentDocument>(`/documents/payments/${id}/`),
    enabled: Number.isFinite(id) && id > 0,
    retry: false,
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="rounded-sm border border-border bg-background p-6 text-center">
          <div className="mb-4 text-lg font-semibold">Неверный номер документа</div>
          <Button onClick={() => router.push(localePath("/documents/payments"))}>
            К списку
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6 text-sm text-muted-foreground">
        Загрузка документа...
      </div>
    );
  }

  if (isError || !paymentDocument) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="space-y-4 rounded-sm border border-border bg-background p-6 text-center">
          <div className="text-lg font-semibold">Документ не найден</div>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(localePath("/documents/payments"))}
            >
              К списку
            </Button>
            <Button onClick={() => router.push(localePath("/documents/payments/new"))}>
              Создать
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <PaymentDocumentForm mode="edit" initialData={paymentDocument} />;
}
