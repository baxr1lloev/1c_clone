from django.db import models
from django.utils.translation import gettext_lazy as _
from tenants.models import Tenant
from directories.models import Warehouse, Item, Counterparty, Contract, Currency
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from decimal import Decimal


class ItemPrice(models.Model):
    """
    Периодический регистр сведений "Цены номенклатуры" (Item Prices).
    Stores price history for items based on 1C philosophy.
    """
    PRICE_TYPE_CHOICES = [
        ('PURCHASE', _('Purchase Price')),
        ('SELLING', _('Selling Price')),
        ('WHOLESALE', _('Wholesale Price')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='price_history')
    date = models.DateField(_('Date'), help_text="Дата установки цены")
    price_type = models.CharField(_('Price Type'), max_length=20, choices=PRICE_TYPE_CHOICES, default='SELLING')
    
    price = models.DecimalField(_('Price'), max_digits=15, decimal_places=2)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    # Audit Trace
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    document = GenericForeignKey('content_type', 'object_id')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        # One price per type per day
        unique_together = ('tenant', 'item', 'price_type', 'date')
        verbose_name = _('Item Price')
        verbose_name_plural = _('Item Prices')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['tenant', 'item', 'date']),
        ]
        
    def __str__(self):
        return f"{self.item} - {self.get_price_type_display()} @ {self.date}: {self.price} {self.currency}"
        
    @classmethod
    def get_latest_price(cls, item, price_type='SELLING', date=None):
        """
        Срез Последних (Slice of Last Records).
        Get the effective price for an item on a specific date.
        """
        from django.utils import timezone
        
        target_date = date or timezone.now().date()
        
        price_record = cls.objects.filter(
            tenant=item.tenant,
            item=item,
            price_type=price_type,
            date__lte=target_date
        ).order_by('-date').first()
        
        if price_record:
            return {
                'price': price_record.price,
                'currency': price_record.currency,
                'date': price_record.date
            }
        return None



class CounterpartyStockBalance(models.Model):
    """
    Accumulation Register: Goods at Agent's (Counterparty) location.
    Unique for (tenant, counterparty, item).
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    counterparty = models.ForeignKey(Counterparty, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3, default=0)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2, default=0)
    
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('tenant', 'counterparty', 'item')
        verbose_name = _('Counterparty Stock Balance')
        verbose_name_plural = _('Counterparty Stock Balances')


class SettlementsBalance(models.Model):
    """
    Accumulation Register: Mutual settlements (Debts).
    Positive Balance = Customer owes us (Debit).
    Negative Balance = We owe Supplier (Credit).
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    counterparty = models.ForeignKey(Counterparty, on_delete=models.CASCADE)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    amount = models.DecimalField(_('Balance'), max_digits=15, decimal_places=2, default=0)
    
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('tenant', 'counterparty', 'contract', 'currency')
        verbose_name = _('Settlements Balance')
        verbose_name_plural = _('Settlements Balances')


class SettlementMovement(models.Model):
    """
    Settlement Register Movement.
    Tracks changes in Debt (Receivable/Payable).
    
    Logic:
    - Positive Amount (+) = Increase Debt (We gave goods/money, they owe us OR We received goods, we owe them?)
      Actually 1C Logic:
      - Variable 'Balance' is usually 'Receivable' (Asset).
      - Sale (Realization) = +Balance (Client owes us).
      - Payment (Incoming) = -Balance (Client pays off).
      
      - For Vendors (Payable):
      - Purchase = -Balance (We owe vendor, i.e. Negative Receivable).
      - Payment (Outgoing) = +Balance (We paid off, debt decreases -> balance goes towards 0 or positive).
      
      Simpler Model: separate 'type' of movement or just signed Amount?
      Standard: Signed Amount.
      + = Debt Increases (Client gets goods)
      - = Debt Decreases (Client pays)
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    date = models.DateTimeField()
    
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT)
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2, help_text="Negative for Payments, Positive for Accruals (usually)")
    
    # Audit Trace
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.PositiveIntegerField()
    document = GenericForeignKey('content_type', 'object_id')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Settlement Movement')
        verbose_name_plural = _('Settlement Movements')
        indexes = [
            models.Index(fields=['tenant', 'counterparty', 'contract']),
            models.Index(fields=['date']),
        ]
        
    def __str__(self):
        return f"{self.counterparty} {self.amount}"


class StockMovement(models.Model):
    """
    The Single Source of Truth for Inventory.
    Stock = Sum(Movements).
    """
    MOVEMENT_TYPES = [
        ('IN', 'Incoming (+)'),
        ('OUT', 'Outgoing (-)'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    date = models.DateTimeField()
    
    # Dimensions
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    
    # Values
    quantity = models.DecimalField(max_digits=15, decimal_places=3, help_text="Always positive value, Type determines sign")
    type = models.CharField(max_length=10, choices=MOVEMENT_TYPES)
    
    # Batch tracking (Critical for FIFO)
    batch = models.ForeignKey('StockBatch', on_delete=models.PROTECT, null=True, blank=True,
                              help_text="Which batch is consumed/created. NULL for movements without batch tracking.")
    
    # Audit Trace (Source Document)
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Event Sourcing: Reversal Logic (КРИТИЧНО ДЛЯ АУДИТА!)
    is_reversal = models.BooleanField(
        _('Is Reversal'), 
        default=False,
        help_text="Сторнирующее движение (отмена предыдущего)"
    )
    reversed_movement = models.ForeignKey(
        'self', 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        related_name='reversals',
        help_text="Ссылка на отменяемое движение"
    )
    reversed_at = models.DateTimeField(
        _('Reversed At'), 
        null=True, 
        blank=True,
        help_text="Когда было сторнировано"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Stock Movement')
        verbose_name_plural = _('Stock Movements')
        indexes = [
            models.Index(fields=['tenant', 'warehouse', 'item']),
            models.Index(fields=['date']),
            models.Index(fields=['is_reversal', 'reversed_movement']),
        ]
    
    def __str__(self):
        storno = " (STORNO)" if self.is_reversal else ""
        return f"{self.item} {self.type} {self.quantity}{storno}"
    
    @property
    def is_active(self):
        """Check if movement is active (not reversed)"""
        return not hasattr(self, 'reversals') or not self.reversals.exists()
    
    def reverse(self):
        """
        Create reversal movement (storno).
        
        В 1С: ❌ движения НЕ удаляются, ✅ создаётся сторно!
        
        Returns:
            StockMovement: The reversal movement
        """
        from django.utils import timezone
        
        if self.is_reversal:
            raise ValueError("Cannot reverse a reversal movement")
        
        if not self.is_active:
            raise ValueError("Movement already reversed")
        
        # Create storno movement (same amount, opposite sign)
        reversal = StockMovement.objects.create(
            tenant=self.tenant,
            date=timezone.now(),
            warehouse=self.warehouse,
            item=self.item,
            quantity=self.quantity,
            type='OUT' if self.type == 'IN' else 'IN',  # Opposite type
            batch=self.batch,
            content_type=self.content_type,
            object_id=self.object_id,
            is_reversal=True,
            reversed_movement=self
        )
        
        # Mark original as reversed
        self.reversed_at = timezone.now()
        self.save()
        
        return reversal


class StockBalance(models.Model):
    """
    ❗ READ-ONLY Aggregate of Stock Movements.
    
    ВАЖНО: НЕ редактировать напрямую!
    Используйте: StockBalance.recalculate_for_item() или rebuild_all()
    
    Остатки — это виртуальное представление, а не источник истины.
    Источник истины = StockMovement
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    
    quantity = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('tenant', 'warehouse', 'item')
        verbose_name = _('Stock Balance (Cache)')
        verbose_name_plural = _('Stock Balances (Cache)')
    
    def save(self, *args, **kwargs):
        """
        Override save to warn about direct edits.
        Use allow_direct_save=True to bypass (for recalculation)
        """
        if not kwargs.pop('allow_direct_save', False):
            import warnings
            warnings.warn(
                "⚠️ StockBalance should not be edited directly! "
                "Use StockBalance.recalculate_for_item() instead.",
                UserWarning
            )
        super().save(*args, **kwargs)
    
    @classmethod
    def recalculate_for_item(cls, tenant, warehouse, item):
        """
        Rebuild balance for specific item from StockMovement (source of truth).
        
        Usage:
            StockBalance.recalculate_for_item(tenant, warehouse, item)
        """
        from django.db.models import Sum, Q
        
        # Calculate from movements
        movements = StockMovement.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item
        )
        
        # Canonical movement types are IN/OUT. Keep legacy aliases for backward compatibility.
        qty_in = movements.filter(
            Q(type__iexact='IN') | Q(type__iexact='RECEIPT')
        ).aggregate(Sum('quantity'))['quantity__sum'] or 0
        qty_out = movements.filter(
            Q(type__iexact='OUT') | Q(type__iexact='EXPENSE')
        ).aggregate(Sum('quantity'))['quantity__sum'] or 0
        adjustment = movements.filter(type__iexact='ADJUSTMENT').aggregate(Sum('quantity'))['quantity__sum'] or 0
        
        quantity = qty_in - qty_out + adjustment
        
        # Calculate amount (cost valuation)
        # For now: sum of batch costs remaining
        # TODO: Respect AccountingPolicy (FIFO/AVG)
        batches = StockBatch.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item,
            qty_remaining__gt=0
        )
        amount = sum(batch.qty_remaining * batch.unit_cost for batch in batches)
        
        # Update or create balance
        balance, created = cls.objects.get_or_create(
            tenant=tenant,
            warehouse=warehouse,
            item=item,
            defaults={'quantity': quantity, 'amount': amount}
        )
        
        if not created:
            balance.quantity = quantity
            balance.amount = amount
            balance.save(allow_direct_save=True)
        
        return balance
    
    @classmethod
    def rebuild_all(cls, tenant=None):
        """
        Rebuild ALL balances from movements.
        
        Usage for nightly batch:
            python manage.py rebuild_balances
        
        Or in code:
            StockBalance.rebuild_all(tenant=some_tenant)
        """
        from django.db.models import Q
        
        if tenant:
            movements = StockMovement.objects.filter(tenant=tenant)
        else:
            movements = StockMovement.objects.all()
        
        # Get unique combinations of (tenant, warehouse, item)
        combinations = movements.values('tenant', 'warehouse', 'item').distinct()
        
        rebuilt_count = 0
        for combo in combinations:
            from directories.models import Warehouse, Item
            from tenants.models import Tenant
            
            t = Tenant.objects.get(id=combo['tenant'])
            w = Warehouse.objects.get(id=combo['warehouse'])
            i = Item.objects.get(id=combo['item'])
            
            cls.recalculate_for_item(t, w, i)
            rebuilt_count += 1
        
        return rebuilt_count


class StockBatch(models.Model):
    """
    Партия / Lot - Critical for FIFO/AVG cost accounting.
    Each Purchase creates a batch with specific cost.
    Sales consume from batches in FIFO order.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    
    # Source Document that created this batch
    incoming_document_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    incoming_document_id = models.PositiveIntegerField()
    incoming_document = GenericForeignKey('incoming_document_type', 'incoming_document_id')
    
    incoming_date = models.DateTimeField(_('Batch Date'))
    
    # Batch quantities
    qty_initial = models.DecimalField(_('Initial Quantity'), max_digits=15, decimal_places=3)
    qty_remaining = models.DecimalField(_('Remaining Quantity'), max_digits=15, decimal_places=3)
    
    # Cost per unit (important!)
    unit_cost = models.DecimalField(_('Unit Cost'), max_digits=15, decimal_places=4, 
                                    help_text="Cost per single unit in base currency")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Stock Batch / Lot')
        verbose_name_plural = _('Stock Batches / Lots')
        indexes = [
            models.Index(fields=['tenant', 'item', 'warehouse', 'incoming_date']),
        ]
        ordering = ['incoming_date']  # FIFO order
    
    def __str__(self):
        return f"Batch {self.id}: {self.item} @ {self.warehouse} ({self.qty_remaining}/{self.qty_initial})"


class StockReservation(models.Model):
    """
    Stock Reservations - prevents overselling.
    Available = StockBalance.quantity - SUM(Reservations.quantity)
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT)
    
    quantity = models.DecimalField(_('Reserved Quantity'), max_digits=15, decimal_places=3)
    
    # Source document (usually Sales Order or Sales Document in draft)
    document_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    document_id = models.PositiveIntegerField()
    document = GenericForeignKey('document_type', 'document_id')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _('Stock Reservation')
        verbose_name_plural = _('Stock Reservations')
        indexes = [
            models.Index(fields=['tenant', 'item', 'warehouse']),
        ]


class GoodsInTransit(models.Model):
    """
    Товары в пути - Goods between supplier and warehouse.
    
    Workflow:
    1. Purchase Order confirmed → Create GoodsInTransit (SHIPPED)
    2. Goods arrive → Create PurchaseDocument → Update status to RECEIVED
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    
    # What's in transit
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3)
    
    # From where to where
    supplier = models.ForeignKey(Counterparty, on_delete=models.PROTECT, related_name='goods_in_transit')
    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='incoming_transit')
    
    # Timeline
    shipped_date = models.DateTimeField(_('Shipped Date'))
    expected_date = models.DateField(_('Expected Arrival'))
    actual_arrival_date = models.DateTimeField(_('Actual Arrival'), null=True, blank=True)
    
    # Logistics tracking (NEW!)
    carrier = models.CharField(_('Carrier'), max_length=100, blank=True,
                               help_text="e.g., DHL, FedEx, СДЭК, Почта России")
    tracking_number = models.CharField(_('Tracking Number'), max_length=100, blank=True,
                                       help_text="Номер отслеживания")
    
    RISK_STATUS_CHOICES = [
        ('ON_TIME', _('On Time (Вовремя)')),
        ('DELAYED', _('Delayed (Задержка)')),
        ('CRITICAL', _('Critical (Критично)')),
        ('UNKNOWN', _('Unknown (Неизвестно)')),
    ]
    risk_status = models.CharField(_('Risk Status'), max_length=20, 
                                   choices=RISK_STATUS_CHOICES, 
                                   default='UNKNOWN',
                                   help_text="Автоматически рассчитывается по срокам")
    
    # Source document (optional - link to purchase order)
    content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    source_document = GenericForeignKey('content_type', 'object_id')
    
    # Status
    STATUS_CHOICES = [
        ('SHIPPED', _('Shipped by Supplier')),
        ('IN_TRANSIT', _('In Transit')),
        ('RECEIVED', _('Received')),
        ('LOST', _('Lost/Damaged')),
    ]
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='SHIPPED')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('Goods in Transit')
        verbose_name_plural = _('Goods in Transit')
        indexes = [
            models.Index(fields=['tenant', 'status', 'expected_date']),
            models.Index(fields=['supplier', 'status']),
        ]
    
    def __str__(self):
        return f"{self.item} ({self.quantity}) from {self.supplier} - {self.get_status_display()}"
    
    @property
    def is_overdue(self):
        """Check if delivery is overdue"""
        from django.utils import timezone
        if self.status in ['SHIPPED', 'IN_TRANSIT']:
            return timezone.now().date() > self.expected_date
        return False
    
    @property
    def days_until_arrival(self):
        """Calculate days until expected arrival (negative if overdue)"""
        from django.utils import timezone
        if self.status in ['SHIPPED', 'IN_TRANSIT']:
            delta = self.expected_date - timezone.now().date()
            return delta.days
        return None
    
    def update_risk_status(self):
        """
        Auto-calculate risk status based on expected arrival.
        
        ON_TIME: > 3 days remaining
        DELAYED: 0-3 days remaining
        CRITICAL: overdue
        """
        from django.utils import timezone
        
        if self.status in ['RECEIVED', 'LOST']:
            return  # No need to update
        
        days = self.days_until_arrival
        if days is None:
            self.risk_status = 'UNKNOWN'
        elif days < 0:
            self.risk_status = 'CRITICAL'
        elif days <= 3:
            self.risk_status = 'DELAYED'
        else:
            self.risk_status = 'ON_TIME'
        
        self.save()
    
    def save(self, *args, **kwargs):
        """Auto-update risk_status on save"""
        if self.status in ['SHIPPED', 'IN_TRANSIT']:
            days = self.days_until_arrival
            if days is not None:
                if days < 0:
                    self.risk_status = 'CRITICAL'
                elif days <= 3:
                    self.risk_status = 'DELAYED'
                else:
                    self.risk_status = 'ON_TIME'
        super().save(*args, **kwargs)
