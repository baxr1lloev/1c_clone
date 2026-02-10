from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
from tenants.models import Tenant
from directories.models import Warehouse, Item
from registers.models import StockBatch


class WarehouseOrder(models.Model):
    """
    Ордер на склад (Warehouse Execution Order).
    
    CRITICAL: Separates business document from warehouse execution!
    
    Workflow:
    1. Manager creates SalesDocument → автоматически создаётся WarehouseOrder (CREATED)
    2. Warehouse approves → status = APPROVED
    3. Warehouse clerk executes (picks items, scans barcodes) → status = IN_PROGRESS
    4. Warehouse confirms → status = EXECUTED → Movements created
    
    Benefits:
    - Manager ≠ Warehouse clerk (separation of duties)
    - Variance tracking (planned vs. actual)
    - WMS integration ready
    - Audit trail (who approved, who executed)
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    
    number = models.CharField(_('Order Number'), max_length=50)
    date = models.DateTimeField(_('Date'))
    
    ORDER_TYPES = [
        ('INBOUND', _('Inbound (Приход)')),
        ('OUTBOUND', _('Outbound (Расход)')),
        ('TRANSFER', _('Transfer (Перемещение)')),
        ('ADJUSTMENT', _('Adjustment (Инвентаризация)')),
    ]
    order_type = models.CharField(_('Order Type'), max_length=20, choices=ORDER_TYPES)
    
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='warehouse_orders')
    
    # Source Document (PurchaseDocument, SalesDocument, etc.)
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.PositiveIntegerField()
    source_document = GenericForeignKey('content_type', 'object_id')
    
    # Workflow Status
    STATUS_CHOICES = [
        ('CREATED', _('Created (Создан)')),
        ('APPROVED', _('Approved (Утверждён)')),
        ('IN_PROGRESS', _('In Progress (В работе)')),
        ('EXECUTED', _('Executed (Исполнен)')),
        ('CANCELLED', _('Cancelled (Отменён)')),
    ]
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='CREATED')
    
    # Responsible persons
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='warehouse_orders_created')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='warehouse_orders_approved')
    executed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='warehouse_orders_executed')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    
    comment = models.TextField(_('Comment'), blank=True)
    
    class Meta:
        verbose_name = _('Warehouse Order')
        verbose_name_plural = _('Warehouse Orders')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['tenant', 'status', 'date']),
            models.Index(fields=['warehouse', 'status']),
        ]
    
    def __str__(self):
        return f"Order #{self.number} - {self.get_order_type_display()} ({self.get_status_display()})"
    
    def approve(self, user):
        """Approve order (Warehouse manager)"""
        from django.utils import timezone
        if self.status != 'CREATED':
            raise ValueError("Can only approve CREATED orders")
        
        self.status = 'APPROVED'
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save()
    
    def start_execution(self, user):
        """Start picking/packing (Warehouse clerk)"""
        from django.utils import timezone
        if self.status != 'APPROVED':
            raise ValueError("Can only execute APPROVED orders")
        
        self.status = 'IN_PROGRESS'
        self.executed_by = user
        self.save()
    
    def execute(self, user):
        """
        Complete execution → Create StockMovements!
        
        This is where movements are actually created (not in document posting).
        """
        from django.utils import timezone
        from django.db import transaction
        from registers.models import StockMovement
        
        if self.status != 'IN_PROGRESS':
            raise ValueError("Can only complete IN_PROGRESS orders")
        
        with transaction.atomic():
            # Create movements for each line
            for line in self.lines.all():
                if line.quantity_actual > 0:
                    # Determine movement type
                    movement_type = 'RECEIPT' if self.order_type == 'INBOUND' else 'EXPENSE'
                    
                    StockMovement.objects.create(
                        tenant=self.tenant,
                        date=timezone.now(),
                        item=line.item,
                        warehouse=self.warehouse,
                        quantity=line.quantity_actual,
                        type=movement_type,
                        batch=line.batch,  # For outbound: which batch was picked
                        content_type=ContentType.objects.get_for_model(self),
                        object_id=self.id
                    )
            
            # Update status
            self.status = 'EXECUTED'
            self.executed_by = user
            self.executed_at = timezone.now()
            self.save()
            
            # Recalculate balances for affected items
            from registers.models import StockBalance
            for line in self.lines.all():
                StockBalance.recalculate_for_item(self.tenant, self.warehouse, line.item)


class WarehouseOrderLine(models.Model):
    """
    Line items in warehouse order.
    
    Tracks planned vs. actual quantities (важно для контроля!).
    """
    order = models.ForeignKey(WarehouseOrder, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    
    quantity_planned = models.DecimalField(_('Planned Quantity'), max_digits=15, decimal_places=3,
                                           help_text="From source document")
    quantity_actual = models.DecimalField(_('Actual Quantity'), max_digits=15, decimal_places=3, default=0,
                                          help_text="Actually picked/received by warehouse")
    
    # For outbound orders: which batch to pick from (FEFO/FIFO)
    batch = models.ForeignKey(StockBatch, on_delete=models.SET_NULL, null=True, blank=True,
                              help_text="For outbound: which batch was picked")
    
    comment = models.CharField(_('Comment'), max_length=255, blank=True,
                               help_text="e.g., Damaged, Wrong SKU, etc.")
    
    class Meta:
        verbose_name = _('Warehouse Order Line')
        verbose_name_plural = _('Warehouse Order Lines')
    
    def __str__(self):
        return f"{self.item}: {self.quantity_actual}/{self.quantity_planned}"
    
    @property
    def variance(self):
        """Difference between planned and actual"""
        return self.quantity_actual - self.quantity_planned
    
    @property
    def has_variance(self):
        """Check if there's a discrepancy"""
        return self.variance != 0
