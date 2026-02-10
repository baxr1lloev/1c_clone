from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import (
    SalesDocument, SalesDocumentLine, 
    PurchaseDocument, PurchaseDocumentLine, 
    PaymentDocument,
    SalesOrder, SalesOrderLine,
    InventoryDocument, InventoryDocumentLine,
    TransferDocument, TransferDocumentLine
)
from .corrections import CorrectionDocument

class SalesDocumentLineInline(admin.TabularInline):
    model = SalesDocumentLine
    extra = 0

@admin.register(SalesDocument)
class SalesDocumentAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'counterparty', 'total_amount', 'status', 'tenant')
    list_filter = ('tenant', 'status')
    inlines = [SalesDocumentLineInline]

class PurchaseDocumentLineInline(admin.TabularInline):
    model = PurchaseDocumentLine
    extra = 0

@admin.register(PurchaseDocument)
class PurchaseDocumentAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'counterparty', 'total_amount', 'status', 'tenant')
    list_filter = ('tenant', 'status')
    inlines = [PurchaseDocumentLineInline]

@admin.register(PaymentDocument)
class PaymentDocumentAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'counterparty', 'amount', 'payment_type', 'tenant')
    list_filter = ('tenant', 'payment_type')


# New document types

class SalesOrderLineInline(admin.TabularInline):
    model = SalesOrderLine
    extra = 0

@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'counterparty', 'total_amount', 'status', 'tenant')
    list_filter = ('tenant', 'status')
    inlines = [SalesOrderLineInline]



class InventoryDocumentLineInline(admin.TabularInline):
    model = InventoryDocumentLine
    extra = 0
    readonly_fields = ('quantity_book',)

@admin.register(InventoryDocument)
class InventoryDocumentAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'warehouse', 'status', 'tenant')
    list_filter = ('tenant', 'status', 'warehouse')
    inlines = [InventoryDocumentLineInline]


class TransferDocumentLineInline(admin.TabularInline):
    model = TransferDocumentLine
    extra = 0

@admin.register(TransferDocument)
class TransferDocumentAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'from_warehouse', 'to_warehouse', 'status', 'tenant')
    list_filter = ('tenant', 'status')
    inlines = [TransferDocumentLineInline]


@admin.register(CorrectionDocument)
class CorrectionDocumentAdmin(admin.ModelAdmin):
    list_display = ('number', 'correction_date', 'correction_type', 'original_document', 
                    'status', 'created_by', 'tenant')
    list_filter = ('tenant', 'status', 'correction_type', 'correction_date')
    date_hierarchy = 'correction_date'
    readonly_fields = ('original_content_type', 'original_object_id', 'created_at', 'posted_at')
    search_fields = ('number', 'correction_reason')
    
    fieldsets = (
        (_('Basic Information'), {
            'fields': ('tenant', 'number', 'correction_date', 'status')
        }),
        (_('Correction'), {
            'fields': ('correction_type', 'correction_reason', 'original_content_type', 'original_object_id')
        }),
        (_('New Document (if replacement)'), {
            'fields': ('new_content_type', 'new_object_id'),
            'classes': ('collapse',)
        }),
        (_('Metadata'), {
            'fields': ('created_by', 'created_at', 'posted_at')
        }),
    )
    
    def has_delete_permission(self, request, obj=None):
        # Cannot delete posted corrections
        if obj and obj.status == 'POSTED':
            return False
        return super().has_delete_permission(request, obj)
