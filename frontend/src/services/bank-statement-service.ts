
import { api } from '@/lib/api';

export interface BankStatement {
    id: number;
    number: string;
    date: string;
    statement_date: string;
    status: 'draft' | 'processing' | 'posted';
    status_display: string;
    source?: 'manual' | 'imported';
    bank_account: number;
    bank_account_name: string;
    bank_account_number: string;
    currency?: number;
    currency_code?: string;
    opening_balance: string;
    closing_balance: string;
    total_receipts: string;
    total_payments: string;
    lines_count: number;
    matched_count: number;
    unmatched_count?: number;
    matching_percentage: number;
    is_balanced?: boolean;
    accounting_balance_difference?: string;
    file?: string;
    can_post?: boolean;
    can_unpost?: boolean;
    period_is_closed?: boolean;
}

export interface BankStatementLine {
    operation_type?: BankStatementOperationType | '';
    operation_type_display?: string;
    id: number;
    transaction_date: string;
    bank_document_number?: string;
    description: string;
    payment_purpose?: string;
    counterparty_name: string;
    contract?: number | null;
    contract_number?: string;
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
    created_payment_document?: number | null;
    created_payment_document_number?: string | null;
}

export type BankStatementOperationType =
    | 'CUSTOMER_PAYMENT'
    | 'SUPPLIER_PAYMENT'
    | 'TAX_PAYMENT'
    | 'BANK_FEE'
    | 'TRANSFER_INTERNAL'
    | 'SALARY_PAYMENT'
    | 'ACCOUNTABLE'
    | 'LOAN_RETURN'
    | 'OTHER';

export interface BankStatementDetail extends BankStatement {
    lines: BankStatementLine[];
}

export interface OpeningBalanceSuggestion {
    opening_balance: string;
    opening_balance_locked: boolean;
    previous_statement_date: string | null;
    previous_statement_closing_balance: string | null;
    latest_statement_date: string | null;
    continuity_warning: string | null;
    can_create_for_date: boolean;
    accounting_balance: string;
}

type ListResponse<T> = T[] | { results?: T[] };

export const BankStatementService = {
    getAll: async () => {
        const response = await api.get<ListResponse<BankStatement>>('/documents/bank-statements/');
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.results)) return response.results;
        return [];
    },

    getById: async (id: number | string) => {
        const response = await api.get<BankStatementDetail>(`/documents/bank-statements/${id}/`);
        return response;
    },

    suggestOpeningBalance: async (bankAccountId: number | string, statementDate: string) => {
        const response = await api.get<OpeningBalanceSuggestion>(
            `/documents/bank-statements/suggest-opening-balance/?bank_account=${bankAccountId}&statement_date=${statementDate}`
        );
        return response;
    },

    create: async (data: {
        bank_account: number;
        statement_date: string;
        opening_balance: string;
        date?: string;
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
        bank_document_number?: string;
        description: string;
        payment_purpose?: string;
        operation_type?: BankStatementOperationType | '';
        counterparty_name?: string;
        contract?: number | null;
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
    },

    // Create PaymentDocument from line
    createPaymentFromLine: async (
        statementId: number | string, 
        lineId: number, 
        options?: {
            counterparty_id?: number;
            contract_id?: number;
            auto_post?: boolean;
        }
    ) => {
        const response = await api.post(`/documents/bank-statements/${statementId}/lines/${lineId}/create-payment/`, options || {});
        return response;
    },

    // Create payments for all unmatched lines
    createPaymentsForUnmatched: async (
        statementId: number | string,
        auto_post?: boolean
    ) => {
        const response = await api.post(`/documents/bank-statements/${statementId}/create-payments-for-unmatched/`, {
            auto_post: auto_post || false
        });
        return response;
    }
};
