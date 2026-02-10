"use client";

import { useForm, useFieldArray, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Loader2, Plus, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar";
import api from "@/lib/api";
import type { PayrollDocument, Employee } from "@/types";

// Schema
const lineSchema = z.object({
    employee: z.coerce.number().min(1, "Required"),
    accrual_type: z.string().min(1, "Required"),
    amount: z.coerce.number().min(0.01, "Amount must be > 0"),
});

const formSchema = z.object({
    number: z.string().min(1, "Required"),
    date: z.string().min(1, "Required"),
    period_start: z.string().min(1, "Required"),
    period_end: z.string().min(1, "Required"),
    comment: z.string().optional(),
    lines: z.array(lineSchema).min(1, "At least one line required"),
});

type FormValues = z.infer<typeof formSchema>;

interface PayrollFormProps {
    initialData?: PayrollDocument;
    mode: "create" | "edit";
}

export function PayrollForm({ initialData, mode }: PayrollFormProps) {
    const t = useTranslations("documents");
    const tc = useTranslations("common");
    const td = useTranslations("directories");
    const router = useRouter();
    const queryClient = useQueryClient();

    // Fetch Employees
    const { data: employees } = useQuery<Employee[]>({
        queryKey: ["employees"],
        queryFn: async () => {
            const res: any = await api.get("/directories/employees/");
            return res.results;
        },
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            number: initialData?.number || "",
            date: initialData?.date
                ? new Date(initialData.date).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            period_start: initialData?.period_start
                ? new Date(initialData.period_start).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            period_end: initialData?.period_end
                ? new Date(initialData.period_end).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            comment: initialData?.comment || "",
            lines: initialData?.lines?.map((e) => ({
                employee: e.employee,
                accrual_type: e.accrual_type,
                amount: Number(e.amount),
            })) || [
                    {
                        employee: 0,
                        accrual_type: "Salary",
                        amount: 0,
                    },
                ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    });

    // Calculate Total
    const totalAmount = form.watch("lines").reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            const payload = { ...values };
            // Format dates ? They are already YYYY-MM-DD from input type=date

            if (mode === "create") {
                return api.post("/documents/payroll/", payload);
            } else {
                return api.put(`/documents/payroll/${initialData!.id}/`, payload);
            }
        },
        onSuccess: () => {
            toast.success(tc("savedSuccessfully"));
            queryClient.invalidateQueries({ queryKey: ["payroll"] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || tc("errorSaving"));
        },
    });

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values);
    };

    const onSaveAndClose = (values: FormValues) => {
        mutation.mutate(values, {
            onSuccess: () => router.push("/documents/payroll"),
        });
    };

    const actions: CommandBarAction[] = [
        {
            label: tc("save"),
            icon: <Save className="w-4 h-4" />,
            onClick: form.handleSubmit(onSubmit),
            variant: "default",
            shortcut: "Ctrl+S",
        },
        {
            label: tc("saveAndClose"),
            icon: <Save className="w-4 h-4" />,
            onClick: form.handleSubmit(onSaveAndClose),
            variant: "secondary",
            shortcut: "Ctrl+Enter",
        },
        {
            label: tc("cancel"),
            icon: <X className="w-4 h-4" />,
            onClick: () => router.push("/documents/payroll"),
            variant: "ghost",
            shortcut: "Esc",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={actions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <Form {...form}>
                    <form className="space-y-8 max-w-4xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <FormField
                                control={form.control}
                                name="number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("number")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("date")}</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="period_start"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("periodStart")}</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="period_end"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("periodEnd")}</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="comment"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tc("comment")}</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[300px]">{td("employee")}</TableHead>
                                        <TableHead>{t("accrualType")}</TableHead>
                                        <TableHead className="w-[150px]">{tc("amount")}</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.employee`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <Select
                                                                onValueChange={(val) => field.onChange(Number(val))}
                                                                value={field.value?.toString()}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={td("selectEmployee")} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {employees?.map((emp) => (
                                                                        <SelectItem key={emp.id} value={emp.id.toString()}>
                                                                            {emp.last_name} {emp.first_name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.accrual_type`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.amount`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <Input type="number" step="0.01" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => remove(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="p-4 border-t bg-muted/50 flex justify-between items-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({
                                        employee: 0,
                                        accrual_type: "Salary",
                                        amount: 0
                                    })}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    {tc("addLine")}
                                </Button>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium">{t("totalAmount")}:</span>
                                    <span className="text-lg font-bold">{totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
}
