from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from tenants.models import Tenant
from directories.models import Counterparty, Contract, Warehouse, Item, Currency

class BaseDocument(models.Model):
    """
    Base class for all documents with 1C-style document chain support.
    
    Document Chain (Цепочка документов):
    - base_document: The source document this was created from
    - Related documents can be found via get_child_documents()
    """
    STATUS_DRAFT = 'draft'
    STATUS_POSTED = 'posted'
    STATUS_CANCELLED = 'cancelled'
    
    STATUS_CHOICES = [
        (STATUS_DRAFT, _('Draft')),
        (STATUS_POSTED, _('Posted')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    number = models.CharField(_('Number'), max_length=50)
    date = models.DateTimeField(_('Date'))
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    comment = models.TextField(_('Comment'), blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    
    # Audit fields
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='%(class)s_created')
    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name='%(class)s_posted')
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 1C-STYLE DOCUMENT CHAIN (Цепочка документов)
    # ═══════════════════════════════════════════════════════════════════════════
    # Generic FK to base document (документ-основание)
    base_document_type = models.ForeignKey(
        ContentType, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='%(class)s_based_on',
        verbose_name=_('Base Document Type')
    )
    base_document_id = models.PositiveIntegerField(
        null=True, 
        blank=True,
        verbose_name=_('Base Document ID')
    )
    base_document = GenericForeignKey('base_document_type', 'base_document_id')
    
    def get_base_document_display(self):
        """Get human-readable base document reference"""
        if self.base_document:
            return str(self.base_document)
        return None
    
    def get_base_document_url(self):
        """Get URL to base document for frontend navigation"""
        if not self.base_document_type or not self.base_document_id:
            return None
        doc_type = self.base_document_type.model
        doc_id = self.base_document_id
        # Map model to frontend URL
        url_map = {
            'salesdocument': f'/documents/sales/{doc_id}',
            'purchasedocument': f'/documents/purchases/{doc_id}',
            'salesorder': f'/documents/sales-orders/{doc_id}',
            'paymentdocument': f'/documents/payments/{doc_id}',
            'transferdocument': f'/documents/transfers/{doc_id}',
            'inventorydocument': f'/documents/inventory/{doc_id}',
        }
        return url_map.get(doc_type)
    
    def get_child_documents(self):
        """
        Find all documents that reference this document as their base.
        
        Returns:
            dict: {model_verbose_name: [documents]}
        """
        ct = ContentType.objects.get_for_model(self)
        related = {}
        
        # Import here to avoid circular imports
        from documents.models import (
            SalesDocument, PurchaseDocument, PaymentDocument, 
            TransferDocument, SalesOrder, InventoryDocument
        )
        
        # Check each document type for children
        for doc_model in [SalesDocument, PurchaseDocument, PaymentDocument, 
                          TransferDocument, SalesOrder, InventoryDocument]:
            docs = doc_model.objects.filter(
                base_document_type=ct,
                base_document_id=self.id
            )
            if docs.exists():
                model_name = doc_model._meta.verbose_name_plural
                related[model_name] = list(docs)
        
        return related
    
    def get_document_chain(self):
        """
        Get full document chain (ancestors + descendants).
        
        Returns:
            dict: {'ancestors': [...], 'descendants': {...}}
        """
        chain = {'ancestors': [], 'descendants': {}}
        
        # Walk up - find all ancestors (base documents)
        current = self
        visited = set()
        while current.base_document and current.id not in visited:
            visited.add(current.id)
            chain['ancestors'].insert(0, {
                'type': current.base_document_type.model,
                'id': current.base_document_id,
                'display': str(current.base_document),
                'url': current.get_base_document_url(),
            })
            current = current.base_document
        
        # Walk down - find all descendants
        chain['descendants'] = self.get_child_documents()
        
        return chain
    
    class Meta:
        abstract = True


class SalesDocument(BaseDocument):
    """
    Goods Issue / Realization (Реализация).
    """
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT, related_name='sales')
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name='sales')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='sales')
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    # Analytics
    project = models.ForeignKey('directories.Project', on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey('directories.Department', on_delete=models.SET_NULL, null=True, blank=True)
    manager = models.ForeignKey('directories.Employee', on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Manager'))
    
    # 1C-Architecture: Snapshot of Currency Data
    rate = models.DecimalField(_('Exchange Rate'), max_digits=12, decimal_places=6, default=1, help_text="Rate used at time of posting")
    total_amount = models.DecimalField(_('Total Amount (Doc Currency)'), max_digits=15, decimal_places=2, default=0)
    total_amount_base = models.DecimalField(_('Total Amount (Base Currency)'), max_digits=15, decimal_places=2, default=0, help_text="Calculated as Amount * Rate")
    
    def recalculate_totals(self):
        """
        Recalculates total_amount and total_amount_base from lines.
        Only allowed if document is Draft.
        """
        if self.status != self.STATUS_DRAFT:
            return

        from django.db.models import Sum
        # Ensure we have a rate, default to 1 if not set (though it should be enforced)
        rate = self.rate or 1
        
        # Calculate totals from lines
        # We manually sum to ensure python-side consistencies if needed, but aggregate is faster.
        # However, we need to ensure local line buffer is considered if called during save?
        # Usually called AFTER line save.
        
        agg = self.lines.aggregate(
            total=Sum('amount'), 
            total_base=Sum('amount_base')
        )
        
        # Let's trust the aggregate if lines are correct.
        
        from decimal import Decimal
        total = agg['total'] or Decimal('0')
        total_base = agg['total_base'] or Decimal('0')
        
        self.total_amount = total.quantize(Decimal("0.01"))
        self.total_amount_base = total_base.quantize(Decimal("0.01"))
        
        self.save(update_fields=['total_amount', 'total_amount_base'])

    # ─────────────────────────────────────────────────────────────────
    # 1C Mental Model: Backend State Authority
    # ─────────────────────────────────────────────────────────────────
    
    @property
    def period_is_closed(self):
        from accounting.models import PeriodClosing
        return PeriodClosing.is_period_closed(self.date, self.tenant, check_type='ACCOUNTING')

    @property
    def can_edit(self):
        """Standard 1C Rule: Only Drafts in Open Period can be edited."""
        if self.status != self.STATUS_DRAFT:
            return False
        if self.period_is_closed:
            return False
        return True

    @property
    def can_post(self):
        """Can be posted if Draft and Period Open."""
        return self.status == self.STATUS_DRAFT and not self.period_is_closed

    @property
    def can_unpost(self):
        """Can be unposted if Posted and Period Open."""
        return self.status == self.STATUS_POSTED and not self.period_is_closed

    def post(self, user=None):
        """
        Post document (1C-style проведение).
        
        Creates accounting entries:
        - Дт 62 "Покупатели" Кт 90.1 "Выручка" - total_amount_base
        - Дт 90.2 "Себестоимость" Кт 41 "Товары" - cost (TODO: calculate from batches)
        
        Also creates register movements (stock, settlements, etc.)
        """
        from django.db import transaction
        from django.utils import timezone
        from django.core.exceptions import ValidationError
        from accounting.models import AccountingEntry, ChartOfAccounts, validate_period_is_open
        
        if not self.can_post:
            raise ValidationError(_("Document cannot be posted. Check status and period."))
        
        # Validate period is open
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # Get accounts (assuming they exist)
            try:
                acc_62 = ChartOfAccounts.objects.get(tenant=self.tenant, code='62')  # Покупатели
                acc_90_1 = ChartOfAccounts.objects.get(tenant=self.tenant, code='90.1')  # Выручка
                acc_90_2 = ChartOfAccounts.objects.get(tenant=self.tenant, code='90.2')  # Себестоимость
                acc_41 = ChartOfAccounts.objects.get(tenant=self.tenant, code='41')  # Товары
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError(_("Required accounts not found in Chart of Accounts. Please set up accounts first."))
            
            # Get base currency
            base_currency = Currency.objects.get(tenant=self.tenant, is_base=True)
            
            # Entry 1: Revenue (Split by Item for analytics)
            # Дт 62 "Покупатели" Кт 90.1 "Выручка"
            
            # Group lines by VAT/Department/Project if needed, but for Item analytics we iterate
            for line in self.lines.all():
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    date=self.date,
                    period=self.date.date().replace(day=1),
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id,
                    debit_account=acc_62,
                    credit_account=acc_90_1,
                    amount=line.amount,  # Line amount (includes VAT if any)
                    currency=base_currency,
                    description=f"Sales #{self.number} - Revenue {line.item.name}",
                    
                    # --- Analytics ---
                    counterparty=self.counterparty,
                    contract=self.contract,
                    item=line.item,
                    quantity=line.quantity,
                    project=getattr(self, 'project', None),  # Future: from document header
                    department=getattr(self, 'department', None), # Future: from document header
                    employee=getattr(self, 'manager', None) # Future: from document header
                )
            
            # Entry 2: COGS (Cost of Goods Sold) using FIFO
            # Дт 90.2 "Себестоимость" Кт 41 "Товары"
            from registers.services import FIFOService
            from decimal import Decimal
            
            total_cogs = Decimal('0')
            
            # Calculate COGS for each line using FIFO
            for line in self.lines.all():
                try:
                    # Get FIFO cost from batches
                    cogs, batch_consumptions = FIFOService.calculate_cogs(
                        item=line.item,
                        warehouse=self.warehouse,
                        quantity_sold=line.quantity,
                        sale_date=self.date,
                        tenant=self.tenant
                    )
                    
                    # Consume batches (decrease qty_remaining)
                    FIFOService.consume_batches(batch_consumptions)
                    
                    total_cogs += cogs
                    
                    # Create COGS entry per line (or per item) for analytics
                    AccountingEntry.objects.create(
                        tenant=self.tenant,
                        date=self.date,
                        period=self.date.date().replace(day=1),
                        content_type=ContentType.objects.get_for_model(self),
                        object_id=self.id,
                        debit_account=acc_90_2,
                        credit_account=acc_41,
                        amount=cogs,  # REAL COST from FIFO!
                        currency=base_currency,
                        description=f"Sales #{self.number} - COGS {line.item.name}",
                        
                        # --- Analytics ---
                        warehouse=self.warehouse,
                        item=line.item,
                        quantity=line.quantity,
                        project=getattr(self, 'project', None),
                        department=getattr(self, 'department', None)
                    )
                    
                except ValueError as e:
                    # Insufficient stock - rollback will happen automatically
                    raise ValidationError(
                        f"Cannot post: {str(e)}. "
                        f"Please ensure sufficient stock for {line.item.name}."
                    )
            
            # Update document status
            self.status = self.STATUS_POSTED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])
    
    def unpost(self):
        """
        Unpost document (1C-style отмена проведения).
        
        Deletes all accounting entries created by this document.
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from accounting.models import AccountingEntry, validate_period_is_open
        
        if not self.can_unpost:
            raise ValidationError(_("Document cannot be unposted. Check status and period."))
        
        # Validate period is open
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # Delete all accounting entries for this document
            AccountingEntry.objects.filter(
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id
            ).delete()
            
            # Update document status
            self.status = self.STATUS_DRAFT
            self.posted_at = None
            self.posted_by = None
            self.save(update_fields=['status', 'posted_at', 'posted_by'])

    def __str__(self):
        return f"Sales #{self.number} ({self.date.date()})"
        
    class Meta(BaseDocument.Meta):
        verbose_name = _('Sales Document')
        verbose_name_plural = _('Sales Documents')


class SalesDocumentLine(models.Model):
    document = models.ForeignKey(SalesDocument, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    # 1C Logic: Quantity is ALWAYS in Base Units (e.g. pcs).
    # Packaged quantity (e.g. boxes) is calculated in UI using 'package' and 'coefficient'.
    quantity = models.DecimalField(_('Quantity (Base)'), max_digits=15, decimal_places=3)
    
    # UI Interaction History
    package = models.ForeignKey('directories.ItemPackage', on_delete=models.SET_NULL, null=True, blank=True)
    coefficient = models.DecimalField(_('Coefficient'), max_digits=10, decimal_places=3, default=1, help_text="Snapshot of pack coefficient")
    
    price = models.DecimalField(_('Price'), max_digits=15, decimal_places=2)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    
    # Base currency fields (Snapshot)
    price_base = models.DecimalField(_('Price (Base)'), max_digits=15, decimal_places=2, default=0, editable=False)
    amount_base = models.DecimalField(_('Amount (Base)'), max_digits=15, decimal_places=2, default=0, editable=False)

    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        if self.document.status != BaseDocument.STATUS_DRAFT:
             raise ValidationError(_("Cannot edit lines of a posted document."))

        # 1. Total (Doc Currency)
        self.amount = self.quantity * self.price
        
        # 2. Total (Base Currency) - Snapshot
        # Use document rate
        rate = self.document.rate or 1
        
        from decimal import Decimal
        if not isinstance(rate, Decimal):
            rate = Decimal(str(rate))
            
        price = self.price
        if not isinstance(price, Decimal):
            price = Decimal(str(price))
            
        amount = self.amount
        if not isinstance(amount, Decimal):
            amount = Decimal(str(amount))

        self.price_base = (price * rate).quantize(Decimal("0.01"))
        self.amount_base = (amount * rate).quantize(Decimal("0.01"))
        
        super().save(*args, **kwargs)
        
        # 3. Trigger Header Update
        self.document.recalculate_totals()
        
    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        if self.document.status != BaseDocument.STATUS_DRAFT:
             raise ValidationError(_("Cannot delete lines of a posted document."))

        doc = self.document
        super().delete(*args, **kwargs)
        doc.recalculate_totals()


class PurchaseDocument(BaseDocument):
    """
    Goods Receipt (Поступление).
    """
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT, related_name='purchases')
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name='purchases')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='purchases')
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    # Analytics
    project = models.ForeignKey('directories.Project', on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey('directories.Department', on_delete=models.SET_NULL, null=True, blank=True)
    
    # 1C-Architecture: Snapshot of Currency Data
    rate = models.DecimalField(_('Exchange Rate'), max_digits=12, decimal_places=6, default=1, help_text="Rate used at time of posting")
    
    # Totals
    subtotal = models.DecimalField(_('Subtotal'), max_digits=15, decimal_places=2, default=0)
    tax_amount = models.DecimalField(_('Tax Amount'), max_digits=15, decimal_places=2, default=0)
    total_amount = models.DecimalField(_('Total Amount'), max_digits=15, decimal_places=2, default=0)
    total_amount_base = models.DecimalField(_('Total Amount (Base Currency)'), max_digits=15, decimal_places=2, default=0, help_text="Calculated as Amount * Rate")
    
    def recalculate_totals(self):
        if self.status != self.STATUS_DRAFT:
            return

        from django.db.models import Sum
        rate = self.rate or 1
        
        agg = self.lines.aggregate(
            total=Sum('amount'), 
            tax=Sum('vat_amount'),
            total_base=Sum('amount_base')
        )
        from decimal import Decimal
        total = agg['total'] or Decimal('0')
        tax = agg['tax'] or Decimal('0')
        total_base = agg['total_base'] or Decimal('0')
        
        self.subtotal = total
        self.tax_amount = tax
        self.total_amount = (total + tax).quantize(Decimal("0.01"))
        self.total_amount_base = (total_base + (tax * rate)).quantize(Decimal("0.01"))
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount', 'total_amount_base'])
    
    def post(self, user=None):
        """
        Post purchase document - creates batches for FIFO costing.
        
        Each purchase line creates a StockBatch with:
        - qty_initial = quantity purchased
        - qty_remaining = quantity purchased (not yet sold)
        - unit_cost = price_base (cost per unit in base currency)
        """
        from django.db import transaction
        from django.utils import timezone
        from django.core.exceptions import ValidationError
        from django.contrib.contenttypes.models import ContentType
        from registers.models import StockBatch
        from accounting.models import validate_period_is_open
        
        if not self.can_post:
            raise ValidationError(_("Document cannot be posted. Check status and period."))
        
        # Validate period is open
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # Create batches for each line
            for line in self.lines.all():
                StockBatch.objects.create(
                    tenant=self.tenant,
                    item=line.item,
                    warehouse=self.warehouse,
                    incoming_document_type=ContentType.objects.get_for_model(self),
                    incoming_document_id=self.id,
                    incoming_date=self.date,
                    qty_initial=line.quantity,
                    qty_remaining=line.quantity,
                    unit_cost=line.price_base  # Cost in base currency
                )
            
            # Create Accounting Entries (1C-style)
            # Дт 41 "Товары" Кт 60 "Поставщики"
            
            from accounting.models import AccountingEntry, ChartOfAccounts
            
            # Get accounts (assuming they exist - validation already done in Sales, but good to be safe)
            try:
                acc_41 = ChartOfAccounts.objects.get(tenant=self.tenant, code='41')  # Товары
                acc_60 = ChartOfAccounts.objects.get(tenant=self.tenant, code='60')  # Поставщики
            except ChartOfAccounts.DoesNotExist:
                 # Should be caught earlier or seeded
                 pass
            else:
                base_currency = Currency.objects.get(tenant=self.tenant, is_base=True)
                
                # Per-line entry for analytics (Item granularity)
                for line in self.lines.all():
                    AccountingEntry.objects.create(
                        tenant=self.tenant,
                        date=self.date,
                        period=self.date.date().replace(day=1),
                        content_type=ContentType.objects.get_for_model(self),
                        object_id=self.id,
                        debit_account=acc_41,
                        credit_account=acc_60,
                        amount=line.amount_base,  # In base currency
                        currency=base_currency,
                        description=f"Purchase #{self.number} - {line.item.name}",
                        
                        # --- Analytics ---
                        counterparty=self.counterparty,
                        contract=self.contract,
                        warehouse=self.warehouse,
                        item=line.item,
                        quantity=line.quantity,
                        project=getattr(self, 'project', None),
                        department=getattr(self, 'department', None)
                    )
            
            # Update document status
            self.status = self.STATUS_POSTED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])
    
    def unpost(self):
        """
        Unpost purchase document - deletes batches.
        
        WARNING: Can only unpost if batches haven't been consumed by sales!
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from django.contrib.contenttypes.models import ContentType
        from registers.models import StockBatch
        from accounting.models import validate_period_is_open
        
        if not self.can_unpost:
            raise ValidationError(_("Document cannot be unposted. Check status and period."))
        
        # Validate period is open
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # Check if any batches have been consumed
            batches = StockBatch.objects.filter(
                incoming_document_type=ContentType.objects.get_for_model(self),
                incoming_document_id=self.id
            )
            
            for batch in batches:
                if batch.qty_remaining < batch.qty_initial:
                    raise ValidationError(
                        f"Cannot unpost: Batch for {batch.item.name} has been partially consumed. "
                        f"Remaining: {batch.qty_remaining}, Initial: {batch.qty_initial}"
                    )
            
            # Delete all batches
            batches.delete()
            
            # Update document status
            self.status = self.STATUS_DRAFT
            self.posted_at = None
            self.posted_by = None
            self.save(update_fields=['status', 'posted_at', 'posted_by'])
    
    class Meta(BaseDocument.Meta):
        verbose_name = _('Purchase Document')
        verbose_name_plural = _('Purchase Documents')


class PurchaseDocumentLine(models.Model):
    document = models.ForeignKey(PurchaseDocument, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3)
    price = models.DecimalField(_('Price'), max_digits=15, decimal_places=2)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    
    # Units
    package = models.ForeignKey('directories.ItemPackage', on_delete=models.SET_NULL, null=True, blank=True)
    coefficient = models.DecimalField(_('Coefficient'), max_digits=10, decimal_places=3, default=1)
    
    # VAT
    vat_rate = models.DecimalField(_('VAT Rate'), max_digits=5, decimal_places=2, default=0)
    vat_amount = models.DecimalField(_('VAT Amount'), max_digits=15, decimal_places=2, default=0)
    total_with_vat = models.DecimalField(_('Total with VAT'), max_digits=15, decimal_places=2, default=0)

    # Base currency fields (Snapshot)
    price_base = models.DecimalField(_('Price (Base)'), max_digits=15, decimal_places=2, default=0, editable=False)
    amount_base = models.DecimalField(_('Amount (Base)'), max_digits=15, decimal_places=2, default=0, editable=False)

    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        if self.document.status != BaseDocument.STATUS_DRAFT:
             raise ValidationError(_('Cannot edit lines of a posted document.'))

        # Calculate Amounts
        self.amount = self.quantity * self.price
        self.vat_amount = self.amount * (self.vat_rate / 100)
        self.total_with_vat = self.amount + self.vat_amount
        
        # Base Currency (Snapshot)
        rate = self.document.rate or 1
        from decimal import Decimal
        if not isinstance(rate, Decimal): rate = Decimal(str(rate))
        
        self.price_base = (self.price * rate).quantize(Decimal("0.01"))
        self.amount_base = (self.amount * rate).quantize(Decimal("0.01"))
        # We don't store vat_amount_base, but could if needed.

        

        
        super().save(*args, **kwargs)
        self.document.recalculate_totals()
        
    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        if self.document.status != BaseDocument.STATUS_DRAFT:
             raise ValidationError(_('Cannot delete lines of a posted document.'))

        doc = self.document
        super().delete(*args, **kwargs)
        doc.recalculate_totals()

class PaymentDocument(BaseDocument):
    """
    Incoming/Outgoing Payment (Платеж).
    
    Universal document for Bank Operations.
    """
    PAYMENT_TYPES = [
        ('INCOMING', _('Incoming (Receipt)')),
        ('OUTGOING', _('Outgoing (Payment)')),
    ]
    
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT, related_name='payments')
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name='payments')
    
    # Financial Details
    bank_account = models.ForeignKey('directories.BankAccount', on_delete=models.PROTECT, related_name='payments', null=True) # null=True for migration safe
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    rate = models.DecimalField(_('Exchange Rate'), max_digits=12, decimal_places=6, default=1, help_text="Rate used at time of posting")
    
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    payment_type = models.CharField(_('Type'), max_length=20, choices=PAYMENT_TYPES)
    
    purpose = models.TextField(_('Payment Purpose'), blank=True, help_text="Назначение платежа")
    
    class Meta(BaseDocument.Meta):
        verbose_name = _('Payment Document')
        verbose_name_plural = _('Payment Documents')
        
    @property
    def can_post(self):
        return self.status == self.STATUS_DRAFT and not self.period_is_closed
        
    @property
    def can_unpost(self):
        return self.status == self.STATUS_POSTED and not self.period_is_closed

    def post(self, user=None):
        """
        Post Payment:
        1. Accounting Entries (Double Entry).
        2. Settlement Register (Debt Management).
        """
        from django.db import transaction
        from django.utils import timezone
        from django.core.exceptions import ValidationError
        from accounting.models import AccountingEntry, ChartOfAccounts, validate_period_is_open
        from registers.models import SettlementMovement
        
        if not self.can_post:
            raise ValidationError(_("Document cannot be posted. Check status and period."))
            
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # 1. Accounts
            try:
                acc_bank = ChartOfAccounts.objects.get(tenant=self.tenant, code='1030') # Bank
                
                if self.counterparty.type == 'CUSTOMER':
                    acc_partner = ChartOfAccounts.objects.get(tenant=self.tenant, code='1210') # Receivable
                else:
                    acc_partner = ChartOfAccounts.objects.get(tenant=self.tenant, code='3310') # Payable
            except ChartOfAccounts.DoesNotExist:
                 # Fallback or Error? 1C requires accounts.
                 # For now, let's assume they exist or error out.
                 raise ValidationError(_("System Accounts (1030, 1210/3310) not found! Please configure Chart of Accounts."))

            # 2. Accounting Entries
            if self.payment_type == 'INCOMING':
                # Debit Bank, Credit Partner
                # Дт 1030 Кт 1210
                debit = acc_bank
                credit = acc_partner
            else:
                # Debit Partner, Credit Bank
                # Дт 3310 Кт 1030
                debit = acc_partner
                credit = acc_bank
                
            AccountingEntry.objects.create(
                tenant=self.tenant,
                date=self.date,
                period=self.date.date().replace(day=1),
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id,
                debit_account=debit,
                credit_account=credit,
                amount=self.amount,
                currency=self.currency,
                description=f"Payment #{self.number}: {self.purpose}"
            )
            
            # 3. Settlement Register
            # Logic:
            # INCOMING (Customer pays) -> Debt DECREASES (-Amount)
            # OUTGOING (We pay Supplier) -> Debt INCREASES (+Amount relative to Payable? No.)
            # Universal Balance Sign:
            # + = Application owes us (Asset)
            # - = We owe Application (Liability)
            
            # Sales = +1000
            # Payment In = -1000 => 0
            
            # Purchase = -1000 (We owe)
            # Payment Out = +1000 => 0
            
            movement_amount = self.amount
            if self.payment_type == 'INCOMING':
                 movement_amount = -self.amount
            else:
                 movement_amount = self.amount 
                 
            SettlementMovement.objects.create(
                tenant=self.tenant,
                date=self.date,
                counterparty=self.counterparty,
                contract=self.contract,
                currency=self.currency,
                amount=movement_amount,
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id
            )
            
            # Update Document
            self.status = self.STATUS_POSTED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])

    def unpost(self):
        """
        Unpost: Remove Entries and Movements.
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from accounting.models import AccountingEntry, validate_period_is_open
        from registers.models import SettlementMovement
        
        if not self.can_unpost:
             raise ValidationError(_("Document cannot be unposted."))
             
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # Delete Accounting
            AccountingEntry.objects.filter(
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id
            ).delete()
            
            # Delete Settlements
            SettlementMovement.objects.filter(
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id
            ).delete()
            
            self.status = self.STATUS_DRAFT
            self.posted_at = None
            self.posted_by = None
            self.save(update_fields=['status', 'posted_at', 'posted_by'])


class TransferDocument(BaseDocument):
    """
    Stock Transfer (Перемещение).
    Can be to another internal warehouse OR to "Agent" warehouse.
    """
    from_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='transfers_out')
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='transfers_in')
    
    # Optional relevant counterparty if transferring to Agent
    counterparty = models.ForeignKey(Counterparty, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta(BaseDocument.Meta):
        verbose_name = _('Transfer Document')
        verbose_name_plural = _('Transfer Documents')


class TransferDocumentLine(models.Model):
    document = models.ForeignKey(TransferDocument, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3)






class InventoryDocument(BaseDocument):
    """
    Инвентаризация - Physical stock count / Inventory adjustment.
    Compares book quantity vs actual counted quantity and creates adjustments.
    """
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='inventories')
    responsible = models.CharField(_('Responsible Person'), max_length=255, blank=True)
    
    def __str__(self):
        return f"Inventory #{self.number} @ {self.warehouse} ({self.date.date()})"
    
    class Meta(BaseDocument.Meta):
        verbose_name = _('Inventory Document')
        verbose_name_plural = _('Inventory Documents')


class InventoryDocumentLine(models.Model):
    """
    Lines of Inventory - item-by-item count.
    """
    document = models.ForeignKey(InventoryDocument, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    
    quantity_book = models.DecimalField(_('Book Quantity'), max_digits=15, decimal_places=3,
                                        help_text="Quantity according to system (from StockBalance)")
    quantity_actual = models.DecimalField(_('Actual Quantity'), max_digits=15, decimal_places=3,
                                          help_text="Physically counted quantity")
    
    # Valuation for Surplus (Income)
    price = models.DecimalField(_('Price'), max_digits=15, decimal_places=2, default=0, help_text="Estimated price for surplus")
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2, default=0, editable=False)

    @property
    def difference(self):
        """Surplus (+) or Shortage (-)"""
        return self.quantity_actual - self.quantity_book
        
    def save(self, *args, **kwargs):
        # Auto-calc amount
        self.amount = self.price * max(self.difference, 0) # Only value surplus?
        # Or should we value shortage too? Shortage value comes from FIFO.
        # But UI might want to show estimated loss.
        # Let's keep strict 1C logic: Price is for Surplus capitalization.
        super().save(*args, **kwargs)


# ============================================================================
# SALES ORDERS (Заказы покупателей)
# ============================================================================


class SalesOrder(BaseDocument):
    """
    Sales Order (Заказ покупателя) - Pre-sales document
    """
    STATUS_CONFIRMED = 'confirmed'
    STATUS_SHIPPED = 'shipped'
    
    STATUS_CHOICES = BaseDocument.STATUS_CHOICES + [
        (STATUS_CONFIRMED, _('Confirmed')),
        (STATUS_SHIPPED, _('Shipped')),
    ]
    
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT, related_name='sales_orders')
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name='sales_orders')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='sales_orders')
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    # Dates
    order_date = models.DateField(_('Order Date'))
    delivery_date = models.DateField(_('Delivery Date'), null=True, blank=True)
    
    # Amounts
    rate = models.DecimalField(_('Exchange Rate'), max_digits=12, decimal_places=6, default=1)
    total_amount = models.DecimalField(_('Total Amount'), max_digits=15, decimal_places=2, default=0)
    total_amount_base = models.DecimalField(_('Total Amount (Base)'), max_digits=15, decimal_places=2, default=0)
    
    # Tracking
    shipped_document = models.ForeignKey(SalesDocument, null=True, blank=True, 
                                        on_delete=models.SET_NULL, related_name='source_orders',
                                        help_text="Sales Document created from this order")
    
    def recalculate_totals(self):
        """Recalculate totals from lines"""
        if self.status not in [self.STATUS_DRAFT, self.STATUS_CONFIRMED]:
            return
        
        agg = self.lines.aggregate(
            total=Sum('amount'),
            total_base=Sum('amount_base')
        )
        
        self.total_amount = (agg['total'] or Decimal('0')).quantize(Decimal('0.01'))
        self.total_amount_base = (agg['total_base'] or Decimal('0')).quantize(Decimal('0.01'))
        self.save(update_fields=['total_amount', 'total_amount_base'])
    
    @property
    def can_post(self):
        """Can be posted if Draft"""
        return self.status == self.STATUS_DRAFT
    
    @property
    def can_unpost(self):
        """Can be unposted if Confirmed and not shipped"""
        return self.status == self.STATUS_CONFIRMED and not self.shipped_document
    
    @property
    def can_create_sales_document(self):
        """Can create sales document if Confirmed"""
        return self.status == self.STATUS_CONFIRMED and not self.shipped_document
    
    def post(self, user=None):
        """Post order - creates stock reservations"""
        from django.db import transaction
        from django.utils import timezone
        from django.core.exceptions import ValidationError
        from registers.models import StockReservation, StockBalance
        
        if not self.can_post:
            raise ValidationError(_("Order cannot be posted. Check status."))
        
        with transaction.atomic():
            # Create reservations for each line
            for line in self.lines.all():
                # Check stock availability
                try:
                    balance = StockBalance.objects.get(
                        tenant=self.tenant,
                        warehouse=self.warehouse,
                        item=line.item
                    )
                    
                    # Get existing reservations
                    existing_reservations = StockReservation.objects.filter(
                        tenant=self.tenant,
                        warehouse=self.warehouse,
                        item=line.item
                    ).aggregate(total=Sum('quantity'))['total'] or 0
                    
                    available = balance.quantity - existing_reservations
                    
                    if available < line.quantity:
                        raise ValidationError(
                            f"Insufficient stock for {line.item.name}. "
                            f"Available: {available}, Requested: {line.quantity}"
                        )
                
                except StockBalance.DoesNotExist:
                    raise ValidationError(
                        f"No stock available for {line.item.name} in {self.warehouse.name}"
                    )
                
                # Create reservation
                StockReservation.objects.create(
                    tenant=self.tenant,
                    item=line.item,
                    warehouse=self.warehouse,
                    quantity=line.quantity,
                    document_type=ContentType.objects.get_for_model(self),
                    document_id=self.id
                )
            
            # Update status
            self.status = self.STATUS_CONFIRMED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])
    
    def unpost(self):
        """Unpost order - deletes stock reservations"""
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from registers.models import StockReservation
        
        if not self.can_unpost:
            raise ValidationError(_("Order cannot be unposted. Check status."))
        
        with transaction.atomic():
            # Delete all reservations
            StockReservation.objects.filter(
                document_type=ContentType.objects.get_for_model(self),
                document_id=self.id
            ).delete()
            
            # Update status
            self.status = self.STATUS_DRAFT
            self.posted_at = None
            self.posted_by = None
            self.save(update_fields=['status', 'posted_at', 'posted_by'])
    
    def create_sales_document(self, user=None):
        """
        Create Sales Document from this order
        
        Returns:
            SalesDocument: The created sales document
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from django.utils import timezone
        
        if not self.can_create_sales_document:
            raise ValidationError(_("Cannot create sales document from this order."))
        
        with transaction.atomic():
            # Create sales document with chain link
            sales_doc = SalesDocument.objects.create(
                tenant=self.tenant,
                counterparty=self.counterparty,
                contract=self.contract,
                warehouse=self.warehouse,
                currency=self.currency,
                rate=self.rate,
                number=f"SD-{self.number}",
                date=timezone.now(),
                created_by=user,
                comment=f"Created from Sales Order #{self.number}",
                # 1C-style document chain link
                base_document_type=ContentType.objects.get_for_model(self),
                base_document_id=self.id,
            )
            
            # Copy lines
            for order_line in self.lines.all():
                SalesDocumentLine.objects.create(
                    document=sales_doc,
                    item=order_line.item,
                    quantity=order_line.quantity,
                    price=order_line.price,
                )
            
            # Recalculate totals
            sales_doc.recalculate_totals()
            
            # Update this order
            self.shipped_document = sales_doc
            self.status = self.STATUS_SHIPPED
            self.save(update_fields=['shipped_document', 'status'])
            
            # Release reservations
            from registers.models import StockReservation
            StockReservation.objects.filter(
                document_type=ContentType.objects.get_for_model(self),
                document_id=self.id
            ).delete()
            
            return sales_doc
    
    class Meta(BaseDocument.Meta):
        verbose_name = _('Sales Order')
        verbose_name_plural = _('Sales Orders')
        ordering = ['-date', '-number']


class SalesOrderLine(models.Model):
    """Sales Order Line - item ordered by customer"""
    document = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3)
    price = models.DecimalField(_('Price'), max_digits=15, decimal_places=2)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2, default=0)
    
    # Base currency fields
    price_base = models.DecimalField(_('Price (Base)'), max_digits=15, decimal_places=2, default=0, editable=False)
    amount_base = models.DecimalField(_('Amount (Base)'), max_digits=15, decimal_places=2, default=0, editable=False)
    
    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        
        if self.document.status not in [BaseDocument.STATUS_DRAFT, SalesOrder.STATUS_CONFIRMED]:
            raise ValidationError(_("Cannot edit lines of a shipped or cancelled order."))
        
        # Calculate amounts
        self.amount = self.quantity * self.price
        
        rate = self.document.rate or 1
        self.price_base = (self.price * rate).quantize(Decimal('0.01'))
        self.amount_base = (self.amount * rate).quantize(Decimal('0.01'))
        
        super().save(*args, **kwargs)
        self.document.recalculate_totals()
    
    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        
        if self.document.status not in [BaseDocument.STATUS_DRAFT, SalesOrder.STATUS_CONFIRMED]:
            raise ValidationError(_("Cannot delete lines of a shipped or cancelled order."))
        
        super().delete(*args, **kwargs)
        self.document.recalculate_totals()
    
    class Meta:
        verbose_name = _('Sales Order Line')
        verbose_name_plural = _('Sales Order Lines')


# ============================================================================
# BANK STATEMENTS (Банковские выписки)
# ============================================================================

class BankStatement(BaseDocument):
    """
    Bank Statement (Банковская выписка) - 1C Style
    
    Represents a bank statement uploaded from bank.
    Contains multiple lines (transactions).
    """
    bank_account = models.ForeignKey(
        'directories.BankAccount', 
        on_delete=models.PROTECT, 
        related_name='statements',
        verbose_name=_('Bank Account')
    )
    
    statement_date = models.DateField(_('Statement Date'))
    
    # Balances
    opening_balance = models.DecimalField(
        _('Opening Balance'), 
        max_digits=15, 
        decimal_places=2,
        default=0
    )
    closing_balance = models.DecimalField(
        _('Closing Balance'), 
        max_digits=15, 
        decimal_places=2,
        default=0
    )
    
    # Calculated totals
    total_receipts = models.DecimalField(
        _('Total Receipts'), 
        max_digits=15, 
        decimal_places=2,
        default=0
    )
    total_payments = models.DecimalField(
        _('Total Payments'), 
        max_digits=15, 
        decimal_places=2,
        default=0
    )
    
    # File upload
    file = models.FileField(
        _('Statement File'),
        upload_to='bank_statements/%Y/%m/',
        null=True,
        blank=True
    )
    
    # Statistics
    lines_count = models.IntegerField(_('Lines Count'), default=0)
    matched_count = models.IntegerField(_('Matched Lines'), default=0)
    
    def recalculate_totals(self):
        """Recalculate totals from lines"""
        from django.db.models import Sum
        from decimal import Decimal
        
        agg = self.lines.aggregate(
            receipts=Sum('debit_amount'),
            payments=Sum('credit_amount')
        )
        
        self.total_receipts = (agg['receipts'] or Decimal('0')).quantize(Decimal('0.01'))
        self.total_payments = (agg['payments'] or Decimal('0')).quantize(Decimal('0.01'))
        self.lines_count = self.lines.count()
        self.matched_count = self.lines.filter(status='matched').count()
        
        calculated_closing = self.opening_balance + self.total_receipts - self.total_payments
        self.closing_balance = calculated_closing.quantize(Decimal('0.01'))
        
        self.save(update_fields=[
            'total_receipts', 'total_payments', 'closing_balance',
            'lines_count', 'matched_count'
        ])
    
    def __str__(self):
        return f"Statement #{self.number} - {self.bank_account} ({self.statement_date})"
    
    class Meta(BaseDocument.Meta):
        verbose_name = _('Bank Statement')
        verbose_name_plural = _('Bank Statements')
        ordering = ['-statement_date', '-number']


class BankStatementLine(models.Model):
    """
    Bank Statement Line (Строка банковской выписки)
    
    Individual transaction from bank statement.
    """
    LINE_STATUS_CHOICES = [
        ('unmatched', _('Unmatched')),
        ('matched', _('Matched')),
        ('ignored', _('Ignored')),
    ]
    
    statement = models.ForeignKey(
        BankStatement,
        on_delete=models.CASCADE,
        related_name='lines',
        verbose_name=_('Statement')
    )
    
    # Transaction details
    transaction_date = models.DateField(_('Transaction Date'))
    
    # Amounts
    debit_amount = models.DecimalField(
        _('Debit Amount'),
        max_digits=15,
        decimal_places=2,
        default=0
    )
    credit_amount = models.DecimalField(
        _('Credit Amount'),
        max_digits=15,
        decimal_places=2,
        default=0
    )
    
    balance = models.DecimalField(
        _('Balance'),
        max_digits=15,
        decimal_places=2,
        default=0
    )
    
    # Description
    description = models.TextField(_('Description'), blank=True)
    counterparty_name = models.CharField(
        _('Counterparty Name'),
        max_length=255,
        blank=True
    )
    
    # Matching
    counterparty = models.ForeignKey(
        Counterparty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bank_statement_lines',
        verbose_name=_('Counterparty')
    )
    
    # Generic relation to matched document
    matched_document_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    matched_document_id = models.PositiveIntegerField(null=True, blank=True)
    
    status = models.CharField(
        _('Status'),
        max_length=20,
        choices=LINE_STATUS_CHOICES,
        default='unmatched'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def amount(self):
        """Return the non-zero amount"""
        return self.debit_amount if self.debit_amount > 0 else self.credit_amount
    
    @property
    def transaction_type(self):
        """Return 'INCOMING' or 'OUTGOING'"""
        return 'INCOMING' if self.debit_amount > 0 else 'OUTGOING'
    
    def __str__(self):
        return f"{self.transaction_date} - {self.description[:50]}"
    
    class Meta:
        verbose_name = _('Bank Statement Line')
        verbose_name_plural = _('Bank Statement Lines')


class CashOrder(BaseDocument):
    """
    Cash Order (Кассовый ордер).
    PKO - Incoming (Приходный кассовый ордер)
    RKO - Outgoing (Расходный кассовый ордер)
    """
    TYPE_INCOMING = 'incoming'
    TYPE_OUTGOING = 'outgoing'
    
    TYPE_CHOICES = [
        (TYPE_INCOMING, _('Incoming (PKO)')),
        (TYPE_OUTGOING, _('Outgoing (RKO)')),
    ]
    
    order_type = models.CharField(_('Order Type'), max_length=20, choices=TYPE_CHOICES)
    counterparty_name = models.CharField(_('Counterparty Name'), max_length=255, help_text="Person or organization")
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    purpose = models.TextField(_('Purpose'), help_text="Reason for cash transaction")
    basis = models.CharField(_('Basis Document'), max_length=255, blank=True, help_text="Reference document number")
    
    # Optional link to counterparty if exists
    counterparty = models.ForeignKey(Counterparty, on_delete=models.SET_NULL, null=True, blank=True, related_name='cash_orders')
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, default=1)
    
    @property
    def period_is_closed(self):
        from accounting.models import PeriodClosing
        return PeriodClosing.is_period_closed(self.date, self.tenant, check_type='ACCOUNTING')

    @property
    def can_edit(self):
        """Standard 1C Rule: Only Drafts in Open Period can be edited."""
        if self.status != self.STATUS_DRAFT:
            return False
        if self.period_is_closed:
            return False
        return True

    @property
    def can_post(self):
        """Can post if draft and period is open."""
        if self.status != self.STATUS_DRAFT:
            return False
        if self.period_is_closed:
            return False
        return True

    @property
    def can_unpost(self):
        """Can unpost if posted and period is open."""
        if self.status != self.STATUS_POSTED:
            return False
        if self.period_is_closed:
            return False
        return True

    def post(self, user=None):
        """
        Post cash order (1C-style проведение).
        Creates accounting entries: Debit 50 (Cash) / Credit 62 (Receivables) for incoming
        or Debit 60 (Payables) / Credit 50 (Cash) for outgoing.
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from django.utils import timezone
        from accounting.models import AccountingEntry, ChartOfAccounts, validate_period_is_open
        
        if not self.can_post:
            raise ValidationError(_("Document cannot be posted. Check status and period."))
        
        # Validate period is open
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # Get accounts
            acc_50 = ChartOfAccounts.objects.get(tenant=self.tenant, code='50')  # Cash
            
            if self.order_type == self.TYPE_INCOMING:
                # PKO: Debit 50 (Cash) / Credit 62 (Receivables) or 76 (Other)
                try:
                    acc_credit = ChartOfAccounts.objects.get(tenant=self.tenant, code='62')
                except ChartOfAccounts.DoesNotExist:
                    acc_credit = ChartOfAccounts.objects.get(tenant=self.tenant, code='76')
                
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    period=self.date.replace(day=1),
                    date=self.date,
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id,
                    debit_account=acc_50,
                    credit_account=acc_credit,
                    amount=self.amount,
                    currency=self.currency,
                    description=f"PKO #{self.number} - {self.purpose}"
                )
            else:
                # RKO: Debit 60 (Payables) or 76 (Other) / Credit 50 (Cash)
                try:
                    acc_debit = ChartOfAccounts.objects.get(tenant=self.tenant, code='60')
                except ChartOfAccounts.DoesNotExist:
                    acc_debit = ChartOfAccounts.objects.get(tenant=self.tenant, code='76')
                
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    period=self.date.replace(day=1),
                    date=self.date,
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id,
                    debit_account=acc_debit,
                    credit_account=acc_50,
                    amount=self.amount,
                    currency=self.currency,
                    description=f"RKO #{self.number} - {self.purpose}"
                )
            
            # Update document status
            self.status = self.STATUS_POSTED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])
    
    def unpost(self):
        """
        Unpost document (1C-style отмена проведения).
        Deletes all accounting entries created by this document.
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from accounting.models import AccountingEntry, validate_period_is_open
        
        if not self.can_unpost:
            raise ValidationError(_("Document cannot be unposted. Check status and period."))
        
        # Validate period is open
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # Delete all accounting entries for this document
            AccountingEntry.objects.filter(
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id
            ).delete()
            
            # Update document status
            self.status = self.STATUS_DRAFT
            self.posted_at = None
            self.posted_by = None
            self.save(update_fields=['status', 'posted_at', 'posted_by'])

    def __str__(self):
        order_prefix = "PKO" if self.order_type == self.TYPE_INCOMING else "RKO"
        return f"{order_prefix} #{self.number} ({self.date.date()})"
        
    class Meta(BaseDocument.Meta):
        verbose_name = _('Cash Order')
        verbose_name_plural = _('Cash Orders')
        ordering = ['date', 'id']


# ============================================================================
# PAYROLL (Зарплата)
# ============================================================================

class PayrollDocument(BaseDocument):
    """
    Payroll Document (Начисление зарплаты).
    
    Accrues salary to employees.
    Debit 26/44 (Expenses) / Credit 70 (Payroll Payable)
    """
    period_start = models.DateField(_('Period Start'))
    period_end = models.DateField(_('Period End'))
    
    amount = models.DecimalField(_('Total Amount'), max_digits=15, decimal_places=2, default=0)
    
    @property
    def can_post(self):
        return self.status == self.STATUS_DRAFT
    
    @property
    def can_unpost(self):
        return self.status == self.STATUS_POSTED
        
    def post(self, user=None):
        """
        Post payroll.
        Creates entries: Dt 26 (General Expenses) / Ct 70 (Payroll Payable)
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from django.utils import timezone
        from accounting.models import AccountingEntry, ChartOfAccounts
        
        if not self.can_post:
            raise ValidationError("Cannot post document")
            
        with transaction.atomic():
            # Get accounts
            try:
                acc_debit = ChartOfAccounts.objects.get(tenant=self.tenant, code='26') # General Expenses
            except ChartOfAccounts.DoesNotExist:
                 acc_debit = ChartOfAccounts.objects.get(tenant=self.tenant, code='44') # Selling Expenses
                 
            acc_credit = ChartOfAccounts.objects.get(tenant=self.tenant, code='70') # Payroll Payable
            
            # Create entries for each line
            for line in self.lines.all():
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    period=self.date.replace(day=1),
                    date=self.date,
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id,
                    debit_account=acc_debit,
                    credit_account=acc_credit,
                    amount=line.amount,
                    currency=self.currency,
                    description=f"Payroll {self.number}: {line.employee} ({line.accrual_type})"
                )
            
            self.status = self.STATUS_POSTED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])

    def unpost(self):
        from django.db import transaction
        from accounting.models import AccountingEntry
        
        if not self.can_unpost:
             raise ValidationError("Cannot unpost document")
             
        with transaction.atomic():
            AccountingEntry.objects.filter(
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id
            ).delete()
            
            self.status = self.STATUS_DRAFT
            self.posted_at = None
            self.posted_by = None
            self.save(update_fields=['status', 'posted_at', 'posted_by'])

    class Meta(BaseDocument.Meta):
        verbose_name = _('Payroll Document')
        verbose_name_plural = _('Payroll Documents')


class PayrollDocumentLine(models.Model):
    """Line for Payroll Document"""
    document = models.ForeignKey(PayrollDocument, on_delete=models.CASCADE, related_name='lines')
    employee = models.ForeignKey('directories.Employee', on_delete=models.PROTECT)
    accrual_type = models.CharField(_('Accrual Type'), max_length=50, default='Salary')
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    
    class Meta:
        verbose_name = _('Payroll Line')
        verbose_name_plural = _('Payroll Lines')


# ============================================================================
# PRODUCTION (Производство)
# ============================================================================

class ProductionDocument(BaseDocument):
    """
    Production Document (Otchet proizvodstva za smenu).
    
    1. Output of Finished Goods (Debit 43 / Credit 20)
    2. Consumption of Materials (Debit 20 / Credit 10)
    """
    # Warehouse for Finished Goods
    warehouse = models.ForeignKey('directories.Warehouse', on_delete=models.PROTECT, related_name='production_outputs')
    
    # Warehouse for Materials (optional, defaults to same)
    materials_warehouse = models.ForeignKey(
        'directories.Warehouse', 
        on_delete=models.PROTECT, 
        null=True, blank=True,
        related_name='production_inputs',
        help_text="Warehouse where materials are taken from. If empty, uses main warehouse."
    )
    
    production_account_code = models.CharField(
        _('Production Account'), 
        max_length=10, 
        default='20.01',
        help_text="Account to accumulate costs (Debit) and release goods (Credit)"
    )
    
    @property
    def source_warehouse(self):
        return self.materials_warehouse or self.warehouse
    
    @property
    def can_post(self):
        return self.status == self.STATUS_DRAFT
    
    @property
    def can_unpost(self):
        return self.status == self.STATUS_POSTED
        
    def post(self, user=None):
        """
        Post production report.
        1. Materials: Stock OUT, Dt 20 Ct 10
        2. Products: Stock IN, Dt 43 Ct 20
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        from django.utils import timezone
        from accounting.models import AccountingEntry, ChartOfAccounts
        from registers.models import StockMovement
        
        if not self.can_post:
            raise ValidationError("Cannot post document")
            
        with transaction.atomic():
            # Accounts
            # 20 - Main Production
            try:
                acc_production = ChartOfAccounts.objects.get(tenant=self.tenant, code=self.production_account_code.split('.')[0])
            except ChartOfAccounts.DoesNotExist:
                # Fallback or error? Let's try to find 20
                acc_production, _ = ChartOfAccounts.objects.get_or_create(tenant=self.tenant, code='20', defaults={'name': 'Main Production'})

            # 10 - Materials
            acc_materials, _ = ChartOfAccounts.objects.get_or_create(tenant=self.tenant, code='10', defaults={'name': 'Materials'})
            
            # 43 - Finished Goods
            acc_goods, _ = ChartOfAccounts.objects.get_or_create(tenant=self.tenant, code='43', defaults={'name': 'Finished Goods'})

            # 1. Process Materials (Consumption)
            for line in self.materials.all():
                # Stock OUT
                StockMovement.objects.create(
                    tenant=self.tenant,
                    date=self.date,
                    warehouse=self.source_warehouse,
                    item=line.item,
                    quantity=line.quantity,
                    type='OUT',
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id
                )
                
                # Accounting: Dt 20 Ct 10
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    period=self.date.replace(day=1),
                    date=self.date,
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id,
                    debit_account=acc_production,
                    credit_account=acc_materials,
                    amount=line.amount, # Cost
                    description=f"Material consumption: {line.item.name}"
                )

            # 2. Process Products (Output)
            for line in self.products.all():
                # Stock IN
                StockMovement.objects.create(
                    tenant=self.tenant,
                    date=self.date,
                    warehouse=self.warehouse,
                    item=line.item,
                    quantity=line.quantity,
                    type='IN',
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id
                )
                
                # Accounting: Dt 43 Ct 20
                AccountingEntry.objects.create(
                    tenant=self.tenant,
                    period=self.date.replace(day=1),
                    date=self.date,
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id,
                    debit_account=acc_goods,
                    credit_account=acc_production,
                    amount=line.amount, # Planned Cost
                    description=f"Production output: {line.item.name}"
                )
            
            self.status = self.STATUS_POSTED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])

    def unpost(self):
        from django.db import transaction
        from accounting.models import AccountingEntry
        from registers.models import StockMovement
        
        if not self.can_unpost:
             raise ValidationError("Cannot unpost document")
             
        with transaction.atomic():
            # Delete Stock Movements
            StockMovement.objects.filter(
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id
            ).delete()
            
            # Delete Accounting Entries
            AccountingEntry.objects.filter(
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id
            ).delete()
            
            self.status = self.STATUS_DRAFT
            self.posted_at = None
            self.posted_by = None
            self.save(update_fields=['status', 'posted_at', 'posted_by'])

    class Meta(BaseDocument.Meta):
        verbose_name = _('Production Document')
        verbose_name_plural = _('Production Documents')


class ProductionProductLine(models.Model):
    """Output Products"""
    document = models.ForeignKey(ProductionDocument, on_delete=models.CASCADE, related_name='products')
    item = models.ForeignKey('directories.Item', on_delete=models.PROTECT)
    package = models.ForeignKey('directories.ItemPackage', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    coefficient = models.DecimalField(_('Coefficient'), max_digits=10, decimal_places=3, default=1)
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3)
    price = models.DecimalField(_('Planned Cost'), max_digits=15, decimal_places=2)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2, help_text="Qty * Planned Price")
    
    def save(self, *args, **kwargs):
        self.amount = self.quantity * self.price
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _('Produced Product')


class ProductionMaterialLine(models.Model):
    """Consumed Materials"""
    document = models.ForeignKey(ProductionDocument, on_delete=models.CASCADE, related_name='materials')
    item = models.ForeignKey('directories.Item', on_delete=models.PROTECT)
    package = models.ForeignKey('directories.ItemPackage', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    coefficient = models.DecimalField(_('Coefficient'), max_digits=10, decimal_places=3, default=1)
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3)
    cost_price = models.DecimalField(_('Cost Price'), max_digits=15, decimal_places=2, default=0)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2, help_text="Qty * Cost")

    def save(self, *args, **kwargs):
        self.amount = self.quantity * self.cost_price
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _('Consumed Material')

