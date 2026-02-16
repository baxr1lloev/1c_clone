
import { api } from '@/lib/api';

export interface BankStatement {
    id: number;
    number: string;
    date: string;
    statement_date: string;
    status: 'draft' | 'processing' | 'posted';
    status_display: string;
    bank_account: number;
    bank_account_name: string;
    bank_account_number: string;
    opening_balance: string;
    closing_balance: string;
    total_receipts: string;
    total_payments: string;
    lines_count: number;
    matched_count: number;
    matching_percentage: number;
    file?: string;
    can_post?: boolean;
    can_unpost?: boolean;
    period_is_closed?: boolean;
}

export interface BankStatementLine {
    id: number;
    transaction_date: string;
    description: string;
    counterparty_name: string;
    debit_amount: string;
    credit_amount: string;
    balance: string;
    amount: string;
    transaction_type: 'INCOMING' | 'OUTGOING';
    status: 'unmatched' | 'matched' | 'ignored';
    status_display: string;
    counterparty: number | null;
    matched_document_type: number | null;
    matched_document_id: number | null;
}

export interface BankStatementDetail extends BankStatement {
    lines: BankStatementLine[];
}

export const BankStatementService = {
    getAll: async () => {
        const response = await api.get<BankStatement[]>('/documents/bank-statements/');
        return response;
    },

    getById: async (id: number | string) => {
        const response = await api.get<BankStatementDetail>(`/documents/bank-statements/${id}/`);
        return response;
    },

    create: async (data: {
        bank_account: number;
        statement_date: string;
        opening_balance: string;
        comment?: string;
    }) => {
        const response = await api.post<BankStatementDetail>('/documents/bank-statements/', data);
        return response;
    },

    upload: async (file: File, bankAccountId: string, statementDate: string, openingBalance: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bank_account', bankAccountId);
        formData.append('statement_date', statementDate);
        formData.append('opening_balance', openingBalance);

        // Explicitly set Content-Type to multipart/form-data with clean header (let browser set boundary)
        const response = await api.post<BankStatementDetail>('/documents/bank-statements/upload/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response;
    },

    post: async (id: number | string) => {
        const response = await api.post<BankStatementDetail>(`/documents/bank-statements/${id}/post/`);
        return response;
    },

    unpost: async (id: number | string) => {
        const response = await api.post<BankStatementDetail>(`/documents/bank-statements/${id}/unpost/`);
        return response;
    },

    // Line management
    createLine: async (statementId: number | string, data: {
        transaction_date: string;
        description: string;
        counterparty_name?: string;
        debit_amount?: string;
        credit_amount?: string;
    }) => {
        const response = await api.post<BankStatementLine>(`/documents/bank-statements/${statementId}/lines/`, data);
        return response;
    },

    updateLine: async (statementId: number | string, lineId: number, data: Partial<BankStatementLine>) => {
        const response = await api.patch<BankStatementLine>(`/documents/bank-statements/${statementId}/lines/${lineId}/`, data);
        return response;
    },

    deleteLine: async (statementId: number | string, lineId: number) => {
        const response = await api.delete(`/documents/bank-statements/${statementId}/lines/${lineId}/`);
        return response;
    }
};
