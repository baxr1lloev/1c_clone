'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface AuditLog {
    id: number;
    user: string;
    action: string;
    timestamp: string;
    changes: Record<string, { old: any; new: any }>;
}

interface AuditTrailTableProps {
    trail: AuditLog[] | undefined;
}

export function AuditTrailTable({ trail: logs }: AuditTrailTableProps) {
    if (!logs) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!logs || logs.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                No audit trail available
            </div>
        );
    }

    const getActionBadgeVariant = (action: string) => {
        switch (action) {
            case 'CREATE':
                return 'default';
            case 'UPDATE':
                return 'secondary';
            case 'DELETE':
                return 'destructive';
            case 'POST':
                return 'default';
            case 'UNPOST':
                return 'outline';
            default:
                return 'outline';
        }
    };

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead className="w-[120px]">User</TableHead>
                        <TableHead className="w-[100px]">Action</TableHead>
                        <TableHead>Changes</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                        <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs">
                                {new Date(log.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">{log.user}</TableCell>
                            <TableCell>
                                <Badge variant={getActionBadgeVariant(log.action) as any}>
                                    {log.action}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {log.changes && Object.keys(log.changes).length > 0 ? (
                                    <div className="space-y-1">
                                        {Object.entries(log.changes).map(([field, change]) => (
                                            <div key={field} className="text-sm">
                                                <span className="font-medium">{field}:</span>{' '}
                                                <span className="text-muted-foreground line-through">
                                                    {JSON.stringify(change.old)}
                                                </span>{' '}
                                                → <span className="text-primary">{JSON.stringify(change.new)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-sm">No field changes</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
