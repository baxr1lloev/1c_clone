"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import api from "@/lib/api";
import { PayrollForm } from "@/components/documents/payroll-form";
import type { PayrollDocument } from "@/types";

export default function EditPayrollPage() {
    const t = useTranslations("documents");
    const params = useParams();
    const id = params.id as string;

    const { data, isLoading } = useQuery<PayrollDocument>({
        queryKey: ["payroll", id],
        queryFn: async () => {
            const res = await api.get(`/documents/payroll/${id}/`);
            return res.data;
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="border-b shrink-0 p-4">
                <h1 className="text-xl font-bold">{t("editPayroll")} - {data?.number}</h1>
            </div>
            <PayrollForm mode="edit" initialData={data} />
        </div>
    );
}
