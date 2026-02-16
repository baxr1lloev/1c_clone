from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from tenants.models import Tenant
from directories.models import Counterparty, Contract, Warehouse, Item, Currency, BankOperationType

class BaseDocument(models.Model):
    """
    Base class for all documents with 1C-style document chain support.
    
    Document Chain (Р¦РµРїРѕС‡РєР° РґРѕРєСѓРјРµРЅС‚РѕРІ):
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
    number = models.CharField(_('Number'), max_length=50, blank=True, db_index=True)
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
    
    # в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
    # OPTIMISTIC LOCKING (Concurrency Control)
    # в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
    version = models.IntegerField(
        default=1,
        editable=False,
        verbose_name=_('Version'),
        help_text=_('Incremented on each save to detect concurrent modifications')
    )
    
    # в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
    # 1C-STYLE DOCUMENT CHAIN (Р¦РµРїРѕС‡РєР° РґРѕРєСѓРјРµРЅС‚РѕРІ)
    # в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
    # Generic FK to base document (РґРѕРєСѓРјРµРЅС‚-РѕСЃРЅРѕРІР°РЅРёРµ)
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
    
    @classmethod
    def get_document_prefix(cls):
        """Overridden in subclasses to provide document-specific prefix"""
        return "DOC"
    
    def save(self, *args, **kwargs):
        """
        Override save to implement:
        1. Optimistic locking (version checking)
        2. Auto-number generation
        3. Number immutability after posting
        """
        # в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
        # OPTIMISTIC LOCKING: Check version hasn't changed
        # в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
        skip_version_check = kwargs.pop('skip_version_check', False)
        
        if self.pk and not skip_version_check:
            # This is an UPDATE - check concurrent modification
            try:
                current = self.__class__.objects.get(pk=self.pk)
                if current.version != self.version:
                    from django.core.exceptions import ValidationError
                    raise ValidationError({
                        'version': _(
                            f'Document was modified by another user. '
                            f'Expected version {self.version}, found {current.version}. '
                            f'Please refresh and try again.'
                        )
                    })
                # Increment version for this save
                self.version = current.version + 1
                
                # в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
                # NUMBER IMMUTABILITY: Lock number after posting
                # в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
                if current.status == self.STATUS_POSTED and current.number != self.number:
                    raise ValidationError({
                        'number': _('Cannot change document number after posting')
                    })
            except self.__class__.DoesNotExist:
                # Document was deleted - let save fail naturally
                pass
        
        # Auto-generate number if empty
        if not self.number:
            # Get the last document of this type for this tenant
            last_doc = self.__class__.objects.filter(
                tenant=self.tenant
            ).order_by('-id').first()
            
            if last_doc and last_doc.number:
                # Extract number from format like "SD-000123"
                import re
                match = re.search(r'(\d+)$', last_doc.number)
                if match:
                    next_num = int(match.group(1)) + 1
                else:
                    next_num = 1
            else:
                next_num = 1
            
            # Format: SD-000001 (Sales Document)
            prefix = self.get_document_prefix()
            self.number = f"{prefix}-{next_num:06d}"
        
        super().save(*args, **kwargs)
    
    class Meta:
        abstract = True


class SalesDocument(BaseDocument):
    """
    Goods Issue / Realization (Р РµР°Р»РёР·Р°С†РёСЏ).
    """
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT, related_name='sales')
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name='sales')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='sales')
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    # Analytics
    project = models.ForeignKey('directories.Project', on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey('directories.Department', on_delete=models.SET_NULL, null=True, blank=True)
    manager = models.ForeignKey('directories.Employee', on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_('Manager'))
    
    @classmethod
    def get_document_prefix(cls):
        return "SD"  # Sales Document
    
    # 1C-Architecture: Snapshot of Currency Data
    # Totals
    subtotal = models.DecimalField(_('Subtotal'), max_digits=15, decimal_places=2, default=0)
    tax_amount = models.DecimalField(_('Tax Amount'), max_digits=15, decimal_places=2, default=0)
    total_amount = models.DecimalField(_('Total Amount'), max_digits=15, decimal_places=2, default=0)
    total_amount_base = models.DecimalField(_('Total Amount (Base Currency)'), max_digits=15, decimal_places=2, default=0, help_text="Calculated as Amount * Rate")
    
    def recalculate_totals(self):
        """
        Recalculates total_amount and total_amount_base from lines.
        Only allowed if document is Draft.
        """
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
        # Base amount usually includes tax if we track debt in base currency
        # But accounting entries for revenue (90.1) separate VAT.
        # Let's verify standard 1C.
        # 1C: 'Sum' (Total Amount) is usually what debt is based on.
        # If rate is applied to Total Amount, then Total Amount Base = Total Amount * Rate.
        # My line logic: amount_base = amount * rate. This excludes VAT?
        # My line logic above: amount = quantity * price.
        # Total = amount + vat.
        # So amount_base should probably be (amount + vat) * rate ??
        # Or do we separate VAT?
        # For simplicity: Total Amount Base = Total Amount * Rate
        self.total_amount_base = (self.total_amount * Decimal(str(rate))).quantize(Decimal("0.01"))
        
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount', 'total_amount_base'])

    # в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    # 1C Mental Model: Backend State Authority
    # в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    
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
    
    def check_cascade_dependencies(self):
        """
        ENTERPRISE: Check if safe to unpost/delete - prevents breaking document chains.
        Returns dict: {can_unpost, can_delete, warnings, blockers, children}
        """
        from django.contrib.contenttypes.models import ContentType
        children = self.get_child_documents()
        warnings, blockers, children_list = [], [], []
        
        for child_type_name, child_docs in children.items():
            if not child_docs:
                continue
            posted = [d for d in child_docs if hasattr(d, 'status') and d.status == 'posted']
            draft = [d for d in child_docs if hasattr(d, 'status') and d.status == 'draft']
            
            if posted:
                blockers.append(f"Has {len(posted)} posted {child_type_name}: " + ', '.join([d.number for d in posted[:3]]))
            elif draft:
                warnings.append(f"Has {len(draft)} draft {child_type_name}")
            
            children_list.append({
                'type': child_type_name,
                'documents': [{'number': d.number, 'status': getattr(d, 'status', 'unknown')} for d in child_docs[:10]]
            })
        
        return {
            'can_unpost': len(blockers) == 0,
            'can_delete': len(blockers) == 0 and len(warnings) == 0,
            'warnings': warnings,
            'blockers': blockers,
            'children': children_list
        }

    def post(self, user=None):
        """
        Post document (1C-style РїСЂРѕРІРµРґРµРЅРёРµ).
        
        Creates accounting entries:
        - Р”С‚ 62 "РџРѕРєСѓРїР°С‚РµР»Рё" РљС‚ 90.1 "Р’С‹СЂСѓС‡РєР°" - total_amount_base
        - Р”С‚ 90.2 "РЎРµР±РµСЃС‚РѕРёРјРѕСЃС‚СЊ" РљС‚ 41 "РўРѕРІР°СЂС‹" - cost (TODO: calculate from batches)
        
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
                acc_62 = ChartOfAccounts.objects.get(tenant=self.tenant, code='62')  # РџРѕРєСѓРїР°С‚РµР»Рё
                acc_90_1 = ChartOfAccounts.objects.get(tenant=self.tenant, code='90.1')  # Р’С‹СЂСѓС‡РєР°
                acc_90_2 = ChartOfAccounts.objects.get(tenant=self.tenant, code='90.2')  # РЎРµР±РµСЃС‚РѕРёРјРѕСЃС‚СЊ
                acc_41 = ChartOfAccounts.objects.get(tenant=self.tenant, code='41')  # РўРѕРІР°СЂС‹
            except ChartOfAccounts.DoesNotExist:
                raise ValidationError(_("Required accounts not found in Chart of Accounts. Please set up accounts first."))
            
            # Get base currency
            base_currency = Currency.objects.get(tenant=self.tenant, is_base=True)
            
            # Entry 1: Revenue (Split by Item for analytics)
            # Р”С‚ 62 "РџРѕРєСѓРїР°С‚РµР»Рё" РљС‚ 90.1 "Р’С‹СЂСѓС‡РєР°"
            
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
            # Р”С‚ 90.2 "РЎРµР±РµСЃС‚РѕРёРјРѕСЃС‚СЊ" РљС‚ 41 "РўРѕРІР°СЂС‹"
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
        Unpost document (1C-style РѕС‚РјРµРЅР° РїСЂРѕРІРµРґРµРЅРёСЏ).
        
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
    discount = models.DecimalField(_('Discount %'), max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    
    # VAT
    vat_rate = models.DecimalField(_('VAT Rate'), max_digits=5, decimal_places=2, default=0)
    vat_amount = models.DecimalField(_('VAT Amount'), max_digits=15, decimal_places=2, default=0)
    total_with_vat = models.DecimalField(_('Total with VAT'), max_digits=15, decimal_places=2, default=0)
    
    # Base currency fields (Snapshot)
    price_base = models.DecimalField(_('Price (Base)'), max_digits=15, decimal_places=2, default=0, editable=False)
    amount_base = models.DecimalField(_('Amount (Base)'), max_digits=15, decimal_places=2, default=0, editable=False)
    
    # ... (existing choices) ...
    PRICE_SOURCE_CHOICES = [
        ('MANUAL', _('Manual Entry')),
        ('LAST_SALE', _('Last Sale Price')),
        ('PRICE_LIST', _('Price List')),
        ('CONTRACT', _('Contract Price')),
        ('DEFAULT', _('Default Item Price')),
    ]
    price_source = models.CharField(
        _('Price Source'),
        max_length=20,
        choices=PRICE_SOURCE_CHOICES,
        default='MANUAL',
        help_text="РСЃС‚РѕС‡РЅРёРє С†РµРЅС‹ - РґР»СЏ РѕР±СЉСЏСЃРЅРµРЅРёСЏ 'РѕС‚РєСѓРґР° СЌС‚Р° С†РµРЅР°?'"
    )
    price_source_date = models.DateField(
        _('Price Source Date'),
        null=True,
        blank=True,
        help_text="Р”Р°С‚Р° РїРѕСЃР»РµРґРЅРµР№ РїСЂРѕРґР°Р¶Рё/РїСЂР°Р№СЃР° (РµСЃР»Рё РїСЂРёРјРµРЅРёРјРѕ)"
    )
    
    RATE_SOURCE_CHOICES = [
        ('OFFICIAL', _('Official CBU Rate')),
        ('MANUAL', _('Manual Entry')),
        ('CONTRACT', _('Contract Rate')),
    ]
    rate_source = models.CharField(
        _('Rate Source'),
        max_length=20,
        choices=RATE_SOURCE_CHOICES,
        default='OFFICIAL',
        help_text="РСЃС‚РѕС‡РЅРёРє РєСѓСЂСЃР° РІР°Р»СЋС‚С‹"
    )
    rate_source_date = models.DateField(
        _('Rate Source Date'),
        null=True,
        blank=True,
        help_text="Р”Р°С‚Р° РѕС„РёС†РёР°Р»СЊРЅРѕРіРѕ РєСѓСЂСЃР°"
    )

    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        if self.document.status != BaseDocument.STATUS_DRAFT:
             raise ValidationError(_("Cannot edit lines of a posted document."))

        from decimal import Decimal
        
        # Helper to ensure Decimal
        def to_d(val):
            return Decimal(str(val)) if val is not None else Decimal('0')

        qty = to_d(self.quantity)
        price = to_d(self.price)
        discount = to_d(self.discount)
        vat_rate_val = to_d(self.vat_rate)

        # 1. Calculate Amount with Discount
        # Amount = Qty * Price * (1 - Discount/100)
        base_amount = qty * price
        discount_amount = base_amount * discount / Decimal('100')
        self.amount = (base_amount - discount_amount).quantize(Decimal("0.01"))
        
        # 2. Calculate VAT based on discounted amount
        self.vat_amount = (self.amount * vat_rate_val / Decimal('100')).quantize(Decimal("0.01"))
        self.total_with_vat = self.amount + self.vat_amount
        
        # 3. Total (Base Currency) - Snapshot
        rate = to_d(self.document.rate or 1)
        
        self.price_base = (price * rate).quantize(Decimal("0.01"))
        self.amount_base = (self.amount * rate).quantize(Decimal("0.01"))
        
        super().save(*args, **kwargs)
        
        # 4. Trigger Header Update
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
    Goods Receipt (РџРѕСЃС‚СѓРїР»РµРЅРёРµ).
    """
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT, related_name='purchases')
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name='purchases')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='purchases')
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    
    # Analytics
    project = models.ForeignKey('directories.Project', on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey('directories.Department', on_delete=models.SET_NULL, null=True, blank=True)
    
    @classmethod
    def get_document_prefix(cls):
        return "PD"  # Purchase Document
    
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
            # Р”С‚ 41 "РўРѕРІР°СЂС‹" РљС‚ 60 "РџРѕСЃС‚Р°РІС‰РёРєРё"
            
            from accounting.models import AccountingEntry, ChartOfAccounts
            
            # Get accounts (assuming they exist - validation already done in Sales, but good to be safe)
            try:
                acc_41 = ChartOfAccounts.objects.get(tenant=self.tenant, code='41')  # РўРѕРІР°СЂС‹
                acc_60 = ChartOfAccounts.objects.get(tenant=self.tenant, code='60')  # РџРѕСЃС‚Р°РІС‰РёРєРё
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
    Incoming/Outgoing Payment (РџР»Р°С‚РµР¶).
    
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
    bank_operation_type = models.ForeignKey(
        BankOperationType,
        on_delete=models.PROTECT,
        related_name='payments',
        null=True,
        blank=True
    )
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    rate = models.DecimalField(_('Exchange Rate'), max_digits=12, decimal_places=6, default=1, help_text="Rate used at time of posting")
    
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    payment_type = models.CharField(_('Type'), max_length=20, choices=PAYMENT_TYPES)
    
    purpose = models.TextField(_('Payment Purpose'), blank=True, help_text="РќР°Р·РЅР°С‡РµРЅРёРµ РїР»Р°С‚РµР¶Р°")
    vat_amount = models.DecimalField(_('VAT Amount'), max_digits=15, decimal_places=2, default=0)
    cash_flow_item = models.ForeignKey(
        'directories.CashFlowItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_documents'
    )
    basis = models.CharField(_('Basis'), max_length=255, blank=True)
    debit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='payment_documents_debit',
        null=True,
        blank=True
    )
    credit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        related_name='payment_documents_credit',
        null=True,
        blank=True
    )
    payment_priority = models.PositiveSmallIntegerField(_('Payment Priority'), default=5)
    PAYMENT_KIND_CHOICES = [
        ('supplier', _('Supplier')),
        ('tax', _('Tax')),
        ('salary', _('Salary')),
        ('other', _('Other')),
    ]
    payment_kind = models.CharField(_('Payment Kind'), max_length=20, choices=PAYMENT_KIND_CHOICES, default='other')
    
    @classmethod
    def get_document_prefix(cls):
        return "PMT"  # Payment
    
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
            if self.bank_operation_type_id and self.bank_operation_type.requires_counterparty and not self.counterparty_id:
                raise ValidationError(_("Counterparty is required for selected operation type."))

            # 1. Accounts
            if self.debit_account_id and self.credit_account_id:
                debit = self.debit_account
                credit = self.credit_account
            elif self.bank_operation_type_id:
                debit = self.bank_operation_type.debit_account
                credit = self.bank_operation_type.credit_account
            else:
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
            if not self.bank_operation_type_id and not (self.debit_account_id and self.credit_account_id):
                if self.payment_type == 'INCOMING':
                    # Debit Bank, Credit Partner
                    # Р”С‚ 1030 РљС‚ 1210
                    debit = acc_bank
                    credit = acc_partner
                else:
                    # Debit Partner, Credit Bank
                    # Р”С‚ 3310 РљС‚ 1030
                    debit = acc_partner
                    credit = acc_bank

            # Balance control for outgoing bank payments.
            if self.payment_type == 'OUTGOING' and getattr(credit, 'code', '').startswith('1030'):
                from decimal import Decimal
                from django.db.models import Sum
                available_debit = AccountingEntry.objects.filter(
                    tenant=self.tenant,
                    date__date__lte=self.date.date(),
                    debit_account__code__startswith='1030'
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                available_credit = AccountingEntry.objects.filter(
                    tenant=self.tenant,
                    date__date__lte=self.date.date(),
                    credit_account__code__startswith='1030'
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                available_balance = available_debit - available_credit
                if self.amount > available_balance:
                    raise ValidationError(
                        _("Insufficient bank balance. Available: %(available)s, required: %(required)s") % {
                            'available': available_balance,
                            'required': self.amount,
                        }
                    )
                
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
            
            needs_settlement = True
            if self.bank_operation_type_id:
                needs_settlement = self.bank_operation_type.requires_counterparty

            if needs_settlement:
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
    Stock Transfer (РџРµСЂРµРјРµС‰РµРЅРёРµ).
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
    РРЅРІРµРЅС‚Р°СЂРёР·Р°С†РёСЏ - Physical stock count / Inventory adjustment.
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
# SALES ORDERS (Р—Р°РєР°Р·С‹ РїРѕРєСѓРїР°С‚РµР»РµР№)
# ============================================================================


class SalesOrder(BaseDocument):
    """
    Sales Order (Р—Р°РєР°Р· РїРѕРєСѓРїР°С‚РµР»СЏ) - Pre-sales document
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
# BANK STATEMENTS (Р‘Р°РЅРєРѕРІСЃРєРёРµ РІС‹РїРёСЃРєРё)
# ============================================================================

class BankStatement(BaseDocument):
    """
    Bank Statement (Р‘Р°РЅРєРѕРІСЃРєР°СЏ РІС‹РїРёСЃРєР°) - 1C Style
    
    Represents a bank statement uploaded from bank.
    Contains multiple lines (transactions).
    """
    bank_account = models.ForeignKey(
        'directories.BankAccount', 
        on_delete=models.PROTECT, 
        related_name='statements',
        verbose_name=_('Bank Account')
    )
    currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT,
        related_name='bank_statements',
        null=True,
        blank=True
    )
    
    statement_date = models.DateField(_('Statement Date'))
    SOURCE_CHOICES = [
        ('manual', _('Manual')),
        ('imported', _('Imported')),
    ]
    source = models.CharField(_('Source'), max_length=20, choices=SOURCE_CHOICES, default='manual')
    
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
    is_balanced = models.BooleanField(_('Is Balanced'), default=True)
    accounting_balance_difference = models.DecimalField(
        _('Accounting Balance Difference'),
        max_digits=15,
        decimal_places=2,
        default=0
    )
    
    @classmethod
    def get_document_prefix(cls):
        """Return document prefix for auto-numbering."""
        return 'BS'
    
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
        self.update_reconciliation()
        
        self.save(update_fields=[
            'total_receipts', 'total_payments', 'closing_balance',
            'lines_count', 'matched_count',
            'is_balanced', 'accounting_balance_difference'
        ])

    def save(self, *args, **kwargs):
        if self.bank_account_id and not self.currency_id:
            self.currency = self.bank_account.currency
        return super().save(*args, **kwargs)

    @classmethod
    def get_previous_statement(cls, tenant, bank_account_id, statement_date):
        return cls.objects.filter(
            tenant=tenant,
            bank_account_id=bank_account_id,
            statement_date__lt=statement_date
        ).order_by('-statement_date', '-id').first()

    @classmethod
    def get_latest_statement(cls, tenant, bank_account_id):
        return cls.objects.filter(
            tenant=tenant,
            bank_account_id=bank_account_id,
        ).order_by('-statement_date', '-id').first()

    def calculate_accounting_balance(self):
        """
        Accounting balance as of statement date.
        Note: currently account-level (1030), not per individual bank account analytics.
        """
        from decimal import Decimal
        from django.db.models import Sum
        from accounting.models import AccountingEntry

        debit_total = AccountingEntry.objects.filter(
            tenant=self.tenant,
            date__date__lte=self.statement_date,
            debit_account__code__startswith='1030'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        credit_total = AccountingEntry.objects.filter(
            tenant=self.tenant,
            date__date__lte=self.statement_date,
            credit_account__code__startswith='1030'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        return (debit_total - credit_total).quantize(Decimal('0.01'))

    def update_reconciliation(self):
        from decimal import Decimal
        accounting_balance = self.calculate_accounting_balance()
        self.accounting_balance_difference = (self.closing_balance - accounting_balance).quantize(Decimal('0.01'))
        self.is_balanced = self.accounting_balance_difference == 0
    
    def __str__(self):
        return f"Statement #{self.number} - {self.bank_account} ({self.statement_date})"
    
    class Meta(BaseDocument.Meta):
        verbose_name = _('Bank Statement')
        verbose_name_plural = _('Bank Statements')
        ordering = ['-statement_date', '-number']


class BankStatementLine(models.Model):
    """
    Bank Statement Line (РЎС‚СЂРѕРєР° Р±Р°РЅРєРѕРІСЃРєРѕР№ РІС‹РїРёСЃРєРё)
    
    Individual transaction from bank statement.
    """
    LINE_STATUS_CHOICES = [
        ('unmatched', _('Unmatched')),
        ('matched', _('Matched')),
        ('ignored', _('Ignored')),
    ]
    OPERATION_CUSTOMER_PAYMENT = 'CUSTOMER_PAYMENT'
    OPERATION_SUPPLIER_PAYMENT = 'SUPPLIER_PAYMENT'
    OPERATION_TAX_PAYMENT = 'TAX_PAYMENT'
    OPERATION_BANK_FEE = 'BANK_FEE'
    OPERATION_TRANSFER_INTERNAL = 'TRANSFER_INTERNAL'
    OPERATION_SALARY_PAYMENT = 'SALARY_PAYMENT'
    OPERATION_ACCOUNTABLE = 'ACCOUNTABLE'
    OPERATION_LOAN_RETURN = 'LOAN_RETURN'
    OPERATION_OTHER = 'OTHER'

    OPERATION_TYPE_CHOICES = [
        (OPERATION_CUSTOMER_PAYMENT, _('Customer Payment')),
        (OPERATION_SUPPLIER_PAYMENT, _('Supplier Payment')),
        (OPERATION_TAX_PAYMENT, _('Tax Payment')),
        (OPERATION_BANK_FEE, _('Bank Fee')),
        (OPERATION_TRANSFER_INTERNAL, _('Internal Transfer')),
        (OPERATION_SALARY_PAYMENT, _('Salary Payment')),
        (OPERATION_ACCOUNTABLE, _('Accountable Person')),
        (OPERATION_LOAN_RETURN, _('Loan Return')),
        (OPERATION_OTHER, _('Other')),
    ]
    
    statement = models.ForeignKey(
        BankStatement,
        on_delete=models.CASCADE,
        related_name='lines',
        verbose_name=_('Statement')
    )
    
    # Transaction details
    transaction_date = models.DateField(_('Transaction Date'))
    bank_document_number = models.CharField(_('Bank Document Number'), max_length=100, blank=True)
    
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
    payment_purpose = models.TextField(_('Payment Purpose'), blank=True)
    operation_type = models.CharField(
        _('Operation Type'),
        max_length=30,
        choices=OPERATION_TYPE_CHOICES,
        default=OPERATION_OTHER
    )
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
    contract = models.ForeignKey(
        Contract,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bank_statement_lines',
        verbose_name=_('Contract')
    )
    
    # Generic relation to matched document
    matched_document_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    matched_document_id = models.PositiveIntegerField(null=True, blank=True)
    
    # Link to created PaymentDocument
    created_payment_document = models.ForeignKey(
        'PaymentDocument',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bank_statement_line',
        verbose_name=_('Created Payment Document')
    )
    
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

    @classmethod
    def detect_operation_type(cls, description, transaction_type):
        """Best-effort operation type detection by payment description keywords."""
        if not description:
            return cls.OPERATION_OTHER

        text = str(description).lower()

        if transaction_type == 'OUTGOING':
            if any(key in text for key in ['комис', 'fee', 'service charge']):
                return cls.OPERATION_BANK_FEE
            if any(key in text for key in ['налог', 'tax', 'ндс', 'vat']):
                return cls.OPERATION_TAX_PAYMENT
            if any(key in text for key in ['подотчет', 'accountable']):
                return cls.OPERATION_ACCOUNTABLE
            if any(key in text for key in ['зарплат', 'salary']):
                return cls.OPERATION_SALARY_PAYMENT
            if any(key in text for key in ['перевод', 'transfer', 'между счетами', 'internal']):
                return cls.OPERATION_TRANSFER_INTERNAL
            if any(key in text for key in ['поставщик', 'supplier']):
                return cls.OPERATION_SUPPLIER_PAYMENT
        else:
            if any(key in text for key in ['займ', 'loan']):
                return cls.OPERATION_LOAN_RETURN
            if any(key in text for key in ['покупател', 'customer', 'оплата']):
                return cls.OPERATION_CUSTOMER_PAYMENT

        return cls.OPERATION_OTHER

    def get_operation_semantics(self):
        """Resolve operation semantics by code for current tenant."""
        if not self.operation_type:
            return None
        return BankOperationType.objects.filter(
            tenant=self.statement.tenant,
            code=self.operation_type,
            is_active=True
        ).select_related('debit_account', 'credit_account').first()

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.debit_amount > 0 and self.credit_amount > 0:
            raise ValidationError(_("Only one of debit_amount or credit_amount can be greater than zero."))

        if self.debit_amount <= 0 and self.credit_amount <= 0:
            raise ValidationError(_("Either debit_amount or credit_amount must be greater than zero."))

        if self.operation_type:
            incoming_only = {self.OPERATION_CUSTOMER_PAYMENT, self.OPERATION_LOAN_RETURN}
            outgoing_only = {
                self.OPERATION_SUPPLIER_PAYMENT,
                self.OPERATION_TAX_PAYMENT,
                self.OPERATION_BANK_FEE,
                self.OPERATION_TRANSFER_INTERNAL,
                self.OPERATION_SALARY_PAYMENT,
                self.OPERATION_ACCOUNTABLE,
            }

            if self.operation_type in incoming_only and self.transaction_type != 'INCOMING':
                raise ValidationError(_("Selected operation type is only allowed for incoming transactions."))

            if self.operation_type in outgoing_only and self.transaction_type != 'OUTGOING':
                raise ValidationError(_("Selected operation type is only allowed for outgoing transactions."))

            semantics = self.get_operation_semantics()
            if semantics and semantics.requires_counterparty and not (self.counterparty_id or self.counterparty_name):
                raise ValidationError(_("Counterparty is required for selected operation type."))

    def save(self, *args, **kwargs):
        if not self.operation_type or self.operation_type == self.OPERATION_OTHER:
            self.operation_type = self.detect_operation_type(self.description, self.transaction_type)
        self.full_clean()
        return super().save(*args, **kwargs)
    
    def create_payment_document(self, user, counterparty=None, contract=None, auto_post=False):
        """
        Create PaymentDocument from this bank statement line.
        
        Args:
            user: User creating the document
            counterparty: Counterparty (if None, will try to find by name or create)
            contract: Contract (optional)
            auto_post: Whether to automatically post the document
            
        Returns:
            PaymentDocument: Created payment document
        """
        from django.db import transaction
        from django.utils import timezone
        from django.contrib.contenttypes.models import ContentType
        from decimal import Decimal
        from directories.models import Counterparty, Contract, Currency
        
        if self.created_payment_document:
            raise ValueError(_("Payment document already created for this line"))
        
        with transaction.atomic():
            operation_semantics = self.get_operation_semantics()

            # Get or create counterparty
            if not counterparty:
                if self.counterparty:
                    counterparty = self.counterparty
                elif self.counterparty_name:
                    # Try to find by name
                    counterparty = Counterparty.objects.filter(
                        tenant=self.statement.tenant,
                        name__icontains=self.counterparty_name
                    ).first()
                    
                    if not counterparty:
                        inferred_type = (
                            'CUSTOMER'
                            if self.operation_type in [self.OPERATION_CUSTOMER_PAYMENT, self.OPERATION_LOAN_RETURN]
                            or self.transaction_type == 'INCOMING'
                            else 'SUPPLIER'
                        )
                        # Create new counterparty
                        counterparty = Counterparty.objects.create(
                            tenant=self.statement.tenant,
                            name=self.counterparty_name,
                            inn=f"AUTO-{timezone.now().strftime('%Y%m%d%H%M%S%f')}",
                            type=inferred_type
                        )
                else:
                    fallback_name_map = {
                        self.OPERATION_TAX_PAYMENT: _("Tax Authority"),
                        self.OPERATION_BANK_FEE: _("Bank Fees"),
                        self.OPERATION_TRANSFER_INTERNAL: _("Internal Transfer"),
                        self.OPERATION_SALARY_PAYMENT: _("Employees"),
                    }
                    fallback_name = fallback_name_map.get(self.operation_type)
                    if operation_semantics and operation_semantics.requires_counterparty and not fallback_name:
                        raise ValueError(_("Counterparty is required"))
                    if fallback_name:
                        counterparty = Counterparty.objects.create(
                            tenant=self.statement.tenant,
                            name=fallback_name,
                            inn=f"AUTO-{timezone.now().strftime('%Y%m%d%H%M%S%f')}",
                            type='SUPPLIER'
                        )

            if not counterparty:
                counterparty = Counterparty.objects.create(
                    tenant=self.statement.tenant,
                    name=_("Undefined Counterparty"),
                    inn=f"AUTO-{timezone.now().strftime('%Y%m%d%H%M%S%f')}",
                    type='SUPPLIER'
                )
            
            # Get contract or create default
            if not contract:
                if self.contract_id:
                    contract = self.contract
                elif self.counterparty:
                    contract = Contract.objects.filter(
                        tenant=self.statement.tenant,
                        counterparty=counterparty
                    ).first()
                
                if not contract:
                    # Create default contract
                    contract = Contract.objects.create(
                        tenant=self.statement.tenant,
                        counterparty=counterparty,
                        name=_("Default Contract"),
                        created_by=user
                    )
            
            # Get currency from bank account
            currency = self.statement.bank_account.currency
            
            # Create PaymentDocument
            payment_doc = PaymentDocument.objects.create(
                tenant=self.statement.tenant,
                created_by=user,
                counterparty=counterparty,
                contract=contract,
                bank_account=self.statement.bank_account,
                bank_operation_type=operation_semantics,
                currency=currency,
                rate=Decimal('1'),  # TODO: Get actual rate
                amount=self.amount,
                payment_type=self.transaction_type,
                purpose=self.payment_purpose or self.description or _("Payment from bank statement"),
                basis=self.bank_document_number,
                date=timezone.now(),
                number=None  # Auto-generated
            )
            
            # Link to this line
            self.created_payment_document = payment_doc
            self.status = 'matched'
            self.matched_document_type = ContentType.objects.get_for_model(PaymentDocument)
            self.matched_document_id = payment_doc.id
            self.save()
            
            # Auto-post if requested
            if auto_post:
                payment_doc.post(user=user)
            
            return payment_doc
    
    def __str__(self):
        return f"{self.transaction_date} - {self.description[:50]}"
    
    class Meta:
        verbose_name = _('Bank Statement Line')
        verbose_name_plural = _('Bank Statement Lines')


class CashOrder(BaseDocument):
    """
    Cash Order (РљР°СЃСЃРѕРІС‹Р№ РѕСЂРґРµСЂ).
    PKO - Incoming (РџСЂРёС…РѕРґРЅС‹Р№ РєР°СЃСЃРѕРІС‹Р№ РѕСЂРґРµСЂ)
    RKO - Outgoing (Р Р°СЃС…РѕРґРЅС‹Р№ РєР°СЃСЃРѕРІС‹Р№ РѕСЂРґРµСЂ)
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
    cash_desk = models.CharField(_('Cash Desk'), max_length=100, default='Main Cash Desk')
    cash_flow_item = models.ForeignKey(
        'directories.CashFlowItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_orders'
    )
    debit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='cash_orders_debit'
    )
    credit_account = models.ForeignKey(
        'accounting.ChartOfAccounts',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='cash_orders_credit'
    )
    
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
        Post cash order (1C-style РїСЂРѕРІРµРґРµРЅРёРµ).
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
            
            if self.debit_account_id and self.credit_account_id:
                acc_debit = self.debit_account
                acc_credit = self.credit_account
            elif self.order_type == self.TYPE_INCOMING:
                # PKO: Debit 50 (Cash) / Credit 62 (Receivables) or 76 (Other)
                try:
                    acc_credit = ChartOfAccounts.objects.get(tenant=self.tenant, code='62')
                except ChartOfAccounts.DoesNotExist:
                    acc_credit = ChartOfAccounts.objects.get(tenant=self.tenant, code='76')
                acc_debit = acc_50
            else:
                # RKO: Debit 60 (Payables) or 76 (Other) / Credit 50 (Cash)
                try:
                    acc_debit = ChartOfAccounts.objects.get(tenant=self.tenant, code='60')
                except ChartOfAccounts.DoesNotExist:
                    acc_debit = ChartOfAccounts.objects.get(tenant=self.tenant, code='76')
                acc_credit = acc_50

            if self.order_type == self.TYPE_OUTGOING and getattr(acc_credit, 'code', '').startswith('50'):
                from decimal import Decimal
                from django.db.models import Sum
                debit_total = AccountingEntry.objects.filter(
                    tenant=self.tenant,
                    date__date__lte=self.date.date(),
                    debit_account__code__startswith='50'
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                credit_total = AccountingEntry.objects.filter(
                    tenant=self.tenant,
                    date__date__lte=self.date.date(),
                    credit_account__code__startswith='50'
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                available_cash = debit_total - credit_total
                if self.amount > available_cash:
                    raise ValidationError(
                        _("Insufficient cash balance. Available: %(available)s, required: %(required)s") % {
                            'available': available_cash,
                            'required': self.amount,
                        }
                    )

            AccountingEntry.objects.create(
                tenant=self.tenant,
                period=self.date.replace(day=1),
                date=self.date,
                content_type=ContentType.objects.get_for_model(self),
                object_id=self.id,
                debit_account=acc_debit,
                credit_account=acc_credit,
                amount=self.amount,
                currency=self.currency,
                description=f"{'PKO' if self.order_type == self.TYPE_INCOMING else 'RKO'} #{self.number} - {self.purpose}"
            )
            
            # Update document status
            self.status = self.STATUS_POSTED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])
    
    def unpost(self):
        """
        Unpost document (1C-style РѕС‚РјРµРЅР° РїСЂРѕРІРµРґРµРЅРёСЏ).
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
# PAYROLL (Р—Р°СЂРїР»Р°С‚Р°)
# ============================================================================

class PayrollDocument(BaseDocument):
    """
    Payroll Document (РќР°С‡РёСЃР»РµРЅРёРµ Р·Р°СЂРїР»Р°С‚С‹).
    
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
# PRODUCTION (РџСЂРѕРёР·РІРѕРґСЃС‚РІРѕ)
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


class OpeningBalanceDocument(BaseDocument):
    """
    Р’РІРѕРґ РЅР°С‡Р°Р»СЊРЅС‹С… РѕСЃС‚Р°С‚РєРѕРІ (Entering Opening Balances).
    
    Acts as the bridge between the old system (1C) and this ERP.
    All balances are entered against the auxiliary account "000".
    """
    OPERATION_STOCK = 'stock'
    OPERATION_SETTLEMENT = 'settlement'
    OPERATION_ACCOUNT = 'account'
    
    OPERATION_CHOICES = [
        (OPERATION_STOCK, _('Stock Balances')),
        (OPERATION_SETTLEMENT, _('Settlement Balances')),
        (OPERATION_ACCOUNT, _('Account Balances')),
    ]
    
    operation_type = models.CharField(_('Operation Type'), max_length=20, choices=OPERATION_CHOICES)
    
    # Optional filtering fields
    warehouse = models.ForeignKey('directories.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)
    
    @classmethod
    def get_document_prefix(cls):
        return "OB"  # Opening Balance
    
    def post(self, user=None):
        """
        Post opening balances.
        
        Stock:
        - Р”С‚ 41 "РўРѕРІР°СЂС‹" РљС‚ 000 "Р’СЃРїРѕРјРѕРіР°С‚РµР»СЊРЅС‹Р№"
        - Create StockBatches (date = 2026-01-01 usually)
        
        Settlements:
        - Receivable: Р”С‚ 62 РљС‚ 000
        - Payable: Р”С‚ 000 РљС‚ 60
        """
        from django.db import transaction
        from django.utils import timezone
        from django.core.exceptions import ValidationError
        from django.contrib.contenttypes.models import ContentType
        from registers.models import StockBatch, SettlementMovement
        from accounting.models import AccountingEntry, ChartOfAccounts, validate_period_is_open
        
        if not self.can_post:
            raise ValidationError(_("Document cannot be posted. Check status and period."))
            
        validate_period_is_open(self.date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            base_currency = Currency.objects.get(tenant=self.tenant, is_base=True)
            acc_000, _ = ChartOfAccounts.objects.get_or_create(tenant=self.tenant, code='000', defaults={'name': 'Auxiliary', 'account_type': 'EQUITY'})
            
            if self.operation_type == self.OPERATION_STOCK:
                acc_41 = ChartOfAccounts.objects.get(tenant=self.tenant, code='41')
                
                for line in self.stock_lines.all():
                    # 1. Create Stock Batch
                    StockBatch.objects.create(
                        tenant=self.tenant,
                        item=line.item,
                        warehouse=self.warehouse or line.warehouse,
                        incoming_document_type=ContentType.objects.get_for_model(self),
                        incoming_document_id=self.id,
                        incoming_date=self.date,
                        qty_initial=line.quantity,
                        qty_remaining=line.quantity,
                        unit_cost=line.price  # Assumed base currency cost
                    )
                    
                    # 2. Accounting Entry
                    AccountingEntry.objects.create(
                        tenant=self.tenant,
                        date=self.date,
                        period=self.date.date().replace(day=1),
                        content_type=ContentType.objects.get_for_model(self),
                        object_id=self.id,
                        debit_account=acc_41,
                        credit_account=acc_000,
                        amount=line.amount,
                        currency=base_currency,
                        description=f"Opening Stock: {line.item.name}",
                        item=line.item,
                        warehouse=self.warehouse or line.warehouse,
                        quantity=line.quantity
                    )
            
            elif self.operation_type == self.OPERATION_SETTLEMENT:
                acc_60 = ChartOfAccounts.objects.get(tenant=self.tenant, code='60')
                acc_62 = ChartOfAccounts.objects.get(tenant=self.tenant, code='62')
                
                for line in self.settlement_lines.all():
                    is_receivable = line.type == 'receivable'
                    
                    # 1. Create Settlement Movement (if register exists)
                    # TODO: SettlementRegister
                    
                    # 2. Accounting Entry
                    if is_receivable:
                        # Client owes us (Debit 62, Credit 000)
                        AccountingEntry.objects.create(
                            tenant=self.tenant,
                            date=self.date,
                            period=self.date.date().replace(day=1),
                            content_type=ContentType.objects.get_for_model(self),
                            object_id=self.id,
                            debit_account=acc_62,
                            credit_account=acc_000,
                            amount=line.amount,
                            currency=base_currency, # Simplified
                            description=f"Opening Balance: {line.counterparty.name}",
                            counterparty=line.counterparty,
                            contract=line.contract
                        )
                    else:
                        # We owe supplier (Debit 000, Credit 60)
                        AccountingEntry.objects.create(
                            tenant=self.tenant,
                            date=self.date,
                            period=self.date.date().replace(day=1),
                            content_type=ContentType.objects.get_for_model(self),
                            object_id=self.id,
                            debit_account=acc_000,
                            credit_account=acc_60,
                            amount=line.amount,
                            currency=base_currency,
                            description=f"Opening Balance: {line.counterparty.name}",
                            counterparty=line.counterparty,
                            contract=line.contract
                        )
            
            self.status = self.STATUS_POSTED
            self.posted_at = timezone.now()
            self.posted_by = user
            self.save(update_fields=['status', 'posted_at', 'posted_by'])
    
    def unpost(self):
        # Implementation of unpost akin to other documents
        pass

    class Meta(BaseDocument.Meta):
        verbose_name = _('Opening Balance Document')
        verbose_name_plural = _('Opening Balance Documents')


class OpeningBalanceStockLine(models.Model):
    document = models.ForeignKey(OpeningBalanceDocument, on_delete=models.CASCADE, related_name='stock_lines')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.DecimalField(_('Quantity'), max_digits=15, decimal_places=3)
    price = models.DecimalField(_('Cost (Base)'), max_digits=15, decimal_places=2)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)
    
    def save(self, *args, **kwargs):
        self.amount = self.quantity * self.price
        super().save(*args, **kwargs)


class OpeningBalanceSettlementLine(models.Model):
    document = models.ForeignKey(OpeningBalanceDocument, on_delete=models.CASCADE, related_name='settlement_lines')
    counterparty = models.ForeignKey(Counterparty, on_delete=models.PROTECT)
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, null=True, blank=True)
    
    TYPE_CHOICES = [
        ('receivable', _('Receivable (Debit)')),
        ('payable', _('Payable (Credit)')),
    ]
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(_('Amount'), max_digits=15, decimal_places=2)


