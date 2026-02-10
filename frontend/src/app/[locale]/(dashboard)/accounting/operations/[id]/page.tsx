"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import api from "@/lib/api";
import { OperationForm } from "@/components/accounting/operation-form";
import type { Operation } from "@/types";

export default function EditOperationPage() {
    const t = useTranslations("accounting");
    const params = useParams();
    const id = params.id as string;

    const { data, isLoading } = useQuery<Operation>({
        queryKey: ["operation", id],
        queryFn: async () => {
            const res = await api.get(`/accounting/operations/${id}/`);
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
                <h1 className="text-xl font-bold">{t("editOperation")} #{data?.number}</h1>
            </div>
            <OperationForm mode="edit" initialData={data} />
        </div>
    );
}
