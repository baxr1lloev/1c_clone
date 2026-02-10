"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import api from "@/lib/api";
import { ProductionForm } from "@/components/documents/production-form";
import type { ProductionDocument } from "@/types";

export default function EditProductionPage() {
    const params = useParams();
    const id = params.id as string;
    const t = useTranslations("documents");

    const { data, isLoading } = useQuery({
        queryKey: ["production", id],
        queryFn: async () => {
            const response = await api.get<ProductionDocument>(`/documents/production/${params.id}/`);
            return response;
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="border-b px-6 py-4 flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">
                    Production #{data?.number}
                </h1>
                <div className="text-sm text-muted-foreground">
                    Status: {data?.status_display}
                </div>
            </div>
            {data && <ProductionForm mode="edit" initialData={data} />}
        </div>
    );
}
