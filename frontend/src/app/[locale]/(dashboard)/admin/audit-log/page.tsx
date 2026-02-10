'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { PiCheckCircleBold, PiXCircleBold } from 'react-icons/pi';
import { format } from 'date-fns';

interface AuditLogEntry {
    id: number;
    action: string;
    timestamp: string;
    user_name: string;
    model_name: string;
    object_id: string;
    changes: Record<string, any>;
}

export default function AuditLogPage() {
    const { data, isLoading } = useQuery({
        queryKey: ['audit-log'],
        queryFn: async () => {
            const res = await api.get('/admin/audit-log/');
            return res.data;
        }
    });

    const columns: ColumnDef<AuditLogEntry>[] = [
        {
            accessorKey: 'timestamp',
            header: 'Time',
            cell: ({ row }) => <span className="font-mono text-xs">{format(new Date(row.original.timestamp), 'dd.MM.yyyy HH:mm:ss')}</span>
        },
        { accessorKey: 'user_name', header: 'User' },
        {
            accessorKey: 'action',
            header: 'Action',
            cell: ({ row }) => (
                <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-sm ${row.original.action === 'post' ? 'bg-emerald-100 text-emerald-800' :
                        row.original.action === 'delete' ? 'bg-red-100 text-red-800' : 'bg-gray-100'
                    }`}>
                    {row.original.action}
                </span>
            )
        },
        { accessorKey: 'model_name', header: 'Object Type' },
        { accessorKey: 'object_id', header: 'Object ID' },
        {
            accessorKey: 'changes',
            header: 'Changes',
            cell: ({ row }) => <pre className="text-[10px] max-w-[300px] overflow-hidden text-muted-foreground">{JSON.stringify(row.original.changes)}</pre>
        },
    ];

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold">System Audit Log</h1>
            <DataTable
                columns={columns}
                data={data || []}
                isLoading={isLoading}
            />
        </div>
    );
}
