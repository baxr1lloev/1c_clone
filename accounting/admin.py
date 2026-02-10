from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import ChartOfAccounts, AccountingEntry, TrialBalance, PeriodClosing, PeriodClosingLog, AccountingPolicy, AccountingPolicyHistory
from .vat import VATRate, VATTransaction, ElectronicInvoice, ESoliqIntegrationLog, VATDeclaration


@admin.register(ChartOfAccounts)
class ChartOfAccountsAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'account_type', 'parent', 'is_active', 'tenant')
    list_filter = ('tenant', 'account_type', 'is_active')
    search_fields = ('code', 'name')
    ordering = ('code',)


@admin.register(AccountingEntry)
class AccountingEntryAdmin(admin.ModelAdmin):
    list_display = ('date', 'debit_account', 'credit_account', 'amount', 'currency', 'description', 'tenant')
    list_filter = ('tenant', 'period', 'currency')
    search_fields = ('description',)
    date_hierarchy = 'date'
    readonly_fields = ('created_at',)


@admin.register(TrialBalance)
class TrialBalanceAdmin(admin.ModelAdmin):
    list_display = ('account', 'period', 'turnover_debit', 'turnover_credit', 'closing_debit', 'closing_credit', 'tenant')
    list_filter = ('tenant', 'period')
    date_hierarchy = 'period'



class PeriodClosingLogInline(admin.TabularInline):
    model = PeriodClosingLog
    extra = 0
    can_delete = False
    readonly_fields = ('action', 'user', 'timestamp', 'reason', 'user_role', 'ip_address')
    fields = ('timestamp', 'action', 'user', 'user_role', 'reason')
    ordering = ['-timestamp']


@admin.register(PeriodClosing)
class PeriodClosingAdmin(admin.ModelAdmin):
    list_display = ('period', 'status', 'operational_closed', 'accounting_closed', 
                    'profit_loss', 'closed_by', 'closed_at', 'tenant')
    list_filter = ('tenant', 'status', 'operational_closed', 'accounting_closed')
    date_hierarchy = 'period'
    readonly_fields = ('profit_loss', 'closed_by', 'closed_at', 'created_at', 'updated_at')
    
    inlines = [PeriodClosingLogInline]
    
    actions = ['close_periods']  # Reopen requires reason - use change form
    
    fieldsets = (
        (_('Period'), {
            'fields': ('tenant', 'period', 'status')
        }),
        (_('Closing'), {
            'fields': ('operational_closed', 'accounting_closed', 'allow_operational_after_close')
        }),
        (_('Results'), {
            'fields': ('profit_loss', 'closed_by', 'closed_at')
        }),
    )
    
    def close_periods(self, request, queryset):
        count = 0
        errors = []
        for period in queryset.filter(status='OPEN'):
            try:
                period.close_period(request.user, reason='Closed via admin action')
                count += 1
            except Exception as e:
                errors.append(f"Period {period.period}: {str(e)}")
        
        if count > 0:
            self.message_user(request, f"✅ Closed {count} period(s)")
        if errors:
            self.message_user(request, "❌ Errors: " + "; ".join(errors), level='ERROR')
    close_periods.short_description = "Close selected periods"


@admin.register(PeriodClosingLog)
class PeriodClosingLogAdmin(admin.ModelAdmin):
    list_display = ('period_closing', 'action', 'user', 'user_role', 'timestamp', 'reason_short')
    list_filter = ('action', 'user_role', 'timestamp')
    date_hierarchy = 'timestamp'
    readonly_fields = ('period_closing', 'action', 'user', 'timestamp', 'reason', 'user_role', 'ip_address')
    search_fields = ('reason', 'user__username')
    
    def has_add_permission(self, request):
        return False  # Can only be created via model methods
    
    def has_delete_permission(self, request, obj=None):
        return False  # Audit logs cannot be deleted!
    
    def reason_short(self, obj):
        return obj.reason[:50] + '...' if len(obj.reason) > 50 else obj.reason
    reason_short.short_description = 'Reason'


# ====================
# UZBEKISTAN VAT ADMIN
# ====================

@admin.register(ElectronicInvoice)
class ElectronicInvoiceAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'invoice_type', 'counterparty', 'total_amount', 'status', 'esoliq_uuid', 'tenant')
    list_filter = ('tenant', 'invoice_type', 'status', 'date')
    date_hierarchy = 'date'
    readonly_fields = ('esoliq_uuid', 'esoliq_sent_at', 'esoliq_accepted_at', 'created_at', 'updated_at', 'vat_transaction')
    search_fields = ('number', 'counterparty__name', 'counterparty_tin', 'esoliq_uuid')
    
    fieldsets = (
        (_('Basic Information'), {
            'fields': ('tenant', 'invoice_type', 'number', 'date', 'status', 'created_by')
        }),
        (_('Counterparty'), {
            'fields': ('counterparty', 'counterparty_tin')
        }),
        (_('Amounts'), {
            'fields': ('base_amount', 'vat_rate', 'vat_amount', 'total_amount')
        }),
        (_('E-Soliq'), {
            'fields': ('esoliq_uuid', 'esoliq_sent_at', 'esoliq_accepted_at', 'esoliq_rejection_reason'),
            'classes': ('collapse',)
        }),
        (_('Relationships'), {
            'fields': ('related_content_type', 'related_object_id', 'vat_transaction'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['send_to_esoliq_action']
    
    def send_to_esoliq_action(self, request, queryset):
        count = 0
        for invoice in queryset.filter(status='DRAFT'):
            try:
                invoice.send_to_esoliq()
                count += 1
            except Exception as e:
                self.message_user(request, f"Error sending {invoice.number}: {e}", level='ERROR')
        
        if count > 0:
            self.message_user(request, f"✅ Sent {count} invoice(s) to E-Soliq")
    send_to_esoliq_action.short_description = "Send to E-Soliq"


@admin.register(VATTransaction)
class VATTransactionAdmin(admin.ModelAdmin):
    list_display = ('date', 'vat_type', 'vat_amount', 'base_amount', 'vat_rate', 'electronic_invoice', 'tenant')
    list_filter = ('tenant', 'vat_type', 'period')
    date_hierarchy = 'date'
    readonly_fields = ('created_at', 'electronic_invoice')
    search_fields = ('electronic_invoice__number',)
    
    fieldsets = (
        (_('Basic Information'), {
            'fields': ('tenant', 'date', 'period', 'vat_type')
        }),
        (_('Amounts'), {
            'fields': ('base_amount', 'vat_amount', 'total_amount', 'vat_rate', 'currency')
        }),
        (_('Sources'), {
            'fields': ('electronic_invoice', 'content_type', 'object_id'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ESoliqIntegrationLog)
class ESoliqIntegrationLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'action', 'status', 'invoice', 'error_short', 'tenant')
    list_filter = ('tenant', 'action', 'status', 'created_at')
    date_hierarchy = 'created_at'
    readonly_fields = ('tenant', 'invoice', 'action', 'request_data', 'response_data', 'status', 'error_message', 'created_at')
    search_fields = ('error_message', 'invoice__number')
    
    def has_add_permission(self, request):
        return False  # Logs created automatically
    
    def has_delete_permission(self, request, obj=None):
        return False  # Audit protection
    
    def error_short(self, obj):
        if obj.error_message:
            return obj.error_message[:50] + '...' if len(obj.error_message) > 50 else obj.error_message
        return '-'
    error_short.short_description = 'Error'


@admin.register(VATDeclaration)
class VATDeclarationAdmin(admin.ModelAdmin):
    list_display = ('period', 'status', 'total_output_vat', 'total_input_vat', 'vat_payable', 'submitted_date', 'tenant')
    list_filter = ('tenant', 'status', 'period')
    date_hierarchy = 'period'
    readonly_fields = ('total_output_vat', 'total_input_vat', 'vat_payable', 'submitted_date', 'submitted_by', 
                      'esoliq_submission_id', 'esoliq_status', 'esoliq_submitted_at', 'created_at', 'updated_at')
    
    fieldsets = (
        (_('Period'), {
            'fields': ('tenant', 'period', 'status')
        }),
        (_('VAT Calculation'), {
            'fields': ('total_output_vat', 'total_input_vat', 'vat_payable')
        }),
        (_('Submission'), {
            'fields': ('submitted_date', 'submitted_by', 'notes')
        }),
        (_('E-Soliq'), {
            'fields': ('esoliq_submission_id', 'esoliq_status', 'esoliq_submitted_at', 'esoliq_rejection_reason'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['calculate_action', 'submit_action']
    
    def calculate_action(self, request, queryset):
        count = 0
        for declaration in queryset:
            declaration.calculate()
            count += 1
        self.message_user(request, f"✅ Calculated {count} declaration(s)")
    calculate_action.short_description = "Calculate VAT"
    
    def submit_action(self, request, queryset):
        count = 0
        errors = []
        for declaration in queryset.filter(status__in=['DRAFT', 'CALCULATED']):
            try:
                declaration.submit_to_esoliq(request.user)
                count += 1
            except Exception as e:
                errors.append(f"{declaration.period}: {e}")
        
        if count > 0:
            self.message_user(request, f"✅ Submitted {count} declaration(s) to E-Soliq")
        if errors:
            self.message_user(request, "❌ Errors: " + "; ".join(errors), level='ERROR')
    submit_action.short_description = "Submit to E-Soliq"


@admin.register(AccountingPolicy)
class AccountingPolicyAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'stock_valuation_method', 'effective_from', 'updated_at')
    list_filter = ('stock_valuation_method',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AccountingPolicyHistory)
class AccountingPolicyHistoryAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'valuation_method', 'effective_from', 'effective_to', 'changed_by', 'created_at')
    list_filter = ('valuation_method', 'tenant')
    readonly_fields = ('created_at',)
    date_hierarchy = 'effective_from'
