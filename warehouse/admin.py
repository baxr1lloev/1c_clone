from django.contrib import admin
from .models import WarehouseOrder, WarehouseOrderLine


class WarehouseOrderLineInline(admin.TabularInline):
    model = WarehouseOrderLine
    extra = 0
    fields = ('item', 'quantity_planned', 'quantity_actual', 'batch', 'comment')


@admin.register(WarehouseOrder)
class WarehouseOrderAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'warehouse', 'order_type', 'status', 'created_by', 'executed_by', 'tenant')
    list_filter = ('tenant', 'warehouse', 'order_type', 'status')
    date_hierarchy = 'date'
    inlines = [WarehouseOrderLineInline]
    readonly_fields = ('created_at', 'approved_at', 'executed_at')
    
    actions = ['approve_orders', 'start_execution', 'execute_orders']
    
    def approve_orders(self, request, queryset):
        count = 0
        for order in queryset.filter(status='CREATED'):
            order.approve(request.user)
            count += 1
        self.message_user(request, f"Approved {count} order(s)")
    approve_orders.short_description = "Approve selected orders"
    
    def start_execution(self, request, queryset):
        count = 0
        for order in queryset.filter(status='APPROVED'):
            order.start_execution(request.user)
            count += 1
        self.message_user(request, f"Started execution for {count} order(s)")
    start_execution.short_description = "Start execution"
    
    def execute_orders(self, request, queryset):
        count = 0
        errors = []
        for order in queryset.filter(status='IN_PROGRESS'):
            try:
                order.execute(request.user)
                count += 1
            except Exception as e:
                errors.append(f"Order {order.number}: {str(e)}")
        
        if count > 0:
            self.message_user(request, f"Executed {count} order(s)")
        if errors:
            self.message_user(request, "Errors: " + "; ".join(errors), level='ERROR')
    execute_orders.short_description = "Complete execution (create movements)"
