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
import type { Operation, Account } from "@/types";

// Schema
const lineSchema = z.object({
    debit_account: z.coerce.number().min(1, "Required"),
    credit_account: z.coerce.number().min(1, "Required"),
    amount: z.coerce.number().min(0.01, "Amount must be > 0"),
    description: z.string().optional(),
});

const formSchema = z.object({
    number: z.string().min(1, "Required"),
    date: z.string().min(1, "Required"),
    comment: z.string().optional(),
    entries: z.array(lineSchema).min(1, "At least one entry required"),
});

type FormValues = z.infer<typeof formSchema>;

interface OperationFormProps {
    initialData?: Operation;
    mode: "create" | "edit";
}

export function OperationForm({ initialData, mode }: OperationFormProps) {
    const t = useTranslations("accounting");
    const tc = useTranslations("common");
    const router = useRouter();
    const queryClient = useQueryClient();

    // Fetch Accounts
    const { data: accounts } = useQuery<Account[]>({
        queryKey: ["accounts"],
        queryFn: async () => {
            const res = await api.get("/accounting/accounts/");
            return res.data.results;
        },
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            number: initialData?.number || "",
            date: initialData?.date
                ? new Date(initialData.date).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            comment: initialData?.comment || "",
            entries: initialData?.entries?.map((e) => ({
                debit_account: e.debit_account,
                credit_account: e.credit_account,
                amount: Number(e.amount), // Ensure number
                description: e.description || "",
            })) || [
                    {
                        debit_account: 0,
                        credit_account: 0,
                        amount: 0,
                        description: "",
                    },
                ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "entries",
    });

    // Calculate Total
    const totalAmount = form.watch("entries").reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            // Format date to ISO
            const payload = {
                ...values,
                date: new Date(values.date).toISOString(),
            };

            if (mode === "create") {
                return api.post("/accounting/operations/", payload);
            } else {
                return api.put(`/accounting/operations/${initialData!.id}/`, payload);
            }
        },
        onSuccess: () => {
            toast.success(tc("savedSuccessfully"));
            queryClient.invalidateQueries({ queryKey: ["operations"] });
            queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
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
            onSuccess: () => router.push("/accounting/operations"),
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
            onClick: () => router.push("/accounting/operations"),
            variant: "ghost",
            shortcut: "Esc",
        },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <CommandBar mainActions={actions} className="border-b shrink-0" />

            <div className="flex-1 overflow-auto p-6">
                <Form {...form}>
                    <form className="space-y-8 max-w-5xl mx-auto">
                        {/* Header */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc("number")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Auto" />
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

                        {/* Lines */}
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead className="w-[200px]">{t("debit")}</TableHead>
                                        <TableHead className="w-[200px]">{t("credit")}</TableHead>
                                        <TableHead className="w-[150px]">{tc("amount")}</TableHead>
                                        <TableHead>{tc("description")}</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`entries.${index}.debit_account`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <Select
                                                                onValueChange={(val) => field.onChange(Number(val))}
                                                                value={field.value ? String(field.value) : undefined}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Db" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {accounts?.filter(a => a.is_active).map((account) => (
                                                                        <SelectItem key={account.id} value={String(account.id)}>
                                                                            {account.code} - {account.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`entries.${index}.credit_account`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <Select
                                                                onValueChange={(val) => field.onChange(Number(val))}
                                                                value={field.value ? String(field.value) : undefined}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Cr" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {accounts?.filter(a => a.is_active).map((account) => (
                                                                        <SelectItem key={account.id} value={String(account.id)}>
                                                                            {account.code} - {account.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`entries.${index}.amount`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    {...field}
                                                                    className="text-right"
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`entries.${index}.description`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-0">
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex justify-between items-center">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => append({ debit_account: 0, credit_account: 0, amount: 0, description: "" })}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {tc("addLine")}
                            </Button>

                            <div className="flex items-center gap-2 text-lg font-bold">
                                <span>{tc("total")}:</span>
                                <span>{totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
}
