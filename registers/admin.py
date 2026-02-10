from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import StockBalance, SettlementsBalance, StockMovement, StockBatch, StockReservation, GoodsInTransit

@admin.register(StockBalance)
class StockBalanceAdmin(admin.ModelAdmin):
    list_display = ('item', 'warehouse', 'quantity', 'amount', 'tenant')
    list_filter = ('tenant', 'warehouse')

@admin.register(SettlementsBalance)
class SettlementsBalanceAdmin(admin.ModelAdmin):
    list_display = ('counterparty', 'contract', 'amount', 'currency', 'tenant')
    list_filter = ('tenant',)

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('date', 'item', 'warehouse', 'type', 'quantity', 'batch', 'tenant')
    list_filter = ('tenant', 'type', 'warehouse')
    date_hierarchy = 'date'

@admin.register(StockBatch)
class StockBatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'item', 'warehouse', 'qty_remaining', 'qty_initial', 'unit_cost', 'incoming_date', 'tenant')
    list_filter = ('tenant', 'warehouse', 'item')
    readonly_fields = ('qty_initial', 'incoming_date', 'created_at')
    date_hierarchy = 'incoming_date'

@admin.register(StockReservation)
class StockReservationAdmin(admin.ModelAdmin):
    list_display = ('item', 'warehouse', 'quantity', 'created_at', 'tenant')
    list_filter = ('tenant', 'warehouse', 'item')
    date_hierarchy = 'created_at'





@admin.register(GoodsInTransit)
class GoodsInTransitAdmin(admin.ModelAdmin):
    list_display = ('item', 'quantity', 'supplier', 'destination_warehouse', 'status', 'risk_status', 
                    'carrier', 'tracking_number', 'expected_date', 'days_until_arrival', 'tenant')
    list_filter = ('tenant', 'status', 'risk_status', 'supplier', 'destination_warehouse', 'carrier')
    search_fields = ('tracking_number', 'item__name', 'supplier__name')
    date_hierarchy = 'shipped_date'
    readonly_fields = ('is_overdue', 'days_until_arrival')
    
    fieldsets = (
        (_('Basic Information'), {
            'fields': ('tenant', 'item', 'quantity', 'supplier', 'destination_warehouse')
        }),
        (_('Logistics'), {
            'fields': ('carrier', 'tracking_number', 'status', 'risk_status')
        }),
        (_('Dates'), {
            'fields': ('shipped_date', 'expected_date', 'actual_arrival_date', 'is_overdue', 'days_until_arrival')
        }),
    )
    
    def is_overdue(self, obj):
        return '🔴 Yes' if obj.is_overdue else '✅ No'
    is_overdue.short_description = 'Overdue'
    
    def days_until_arrival(self, obj):
        days = obj.days_until_arrival
        if days is None:
            return '-'
        elif days < 0:
            return f'🔴 {abs(days)} days overdue'
        elif days <= 3:
            return f'⚠️ {days} days left'
        else:
            return f'✅ {days} days'
    days_until_arrival.short_description = 'Days Until Arrival'
