"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import api from "@/lib/api";
import { EmployeeForm } from "@/components/directories/employee-form";
import type { Employee } from "@/types";

export default function EditEmployeePage() {
    const t = useTranslations("directories");
    const params = useParams();
    const id = params.id as string;

    const { data, isLoading } = useQuery<Employee>({
        queryKey: ["employee", id],
        queryFn: async () => {
            const res = await api.get(`/directories/employees/${id}/`);
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
                <h1 className="text-xl font-bold">{t("editEmployee")} - {data?.last_name} {data?.first_name}</h1>
            </div>
            <EmployeeForm mode="edit" initialData={data} />
        </div>
    );
}
