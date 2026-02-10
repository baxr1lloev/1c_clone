from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
from tenants.models import Tenant


class CorrectionDocument(models.Model):
    """
    Исправительный документ (Correction Document).
    
    В РЕАЛЬНОЙ БУХГАЛТЕРИИ:
    ❌ Нельзя просто отменить документ в закрытом периоде
    ✅ Нужно ИСПРАВЛЕНИЕ текущей датой
    
    Логика:
    1. Создаёт новые движения (текущая дата)
    2. Сторнирует старые (reversal)
    3. Всё в ТЕКУЩЕМ периоде (не в закрытом!)
    
    Это уровень ПРОМЫШЛЕННОЙ бухгалтерии! 🏭
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    
    # Original document being corrected
    original_content_type = models.ForeignKey(ContentType, on_delete=models.PROTECT)
    original_object_id = models.PositiveIntegerField()
    original_document = GenericForeignKey('original_content_type', 'original_object_id')
    
    # Correction metadata
    number = models.CharField(_('Correction Number'), max_length=50)
    correction_date = models.DateTimeField(_('Correction Date'), 
                                           help_text="Дата исправления (ТЕКУЩАЯ, не дата оригинала!)")
    
    correction_reason = models.TextField(_('Correction Reason'),
                                         help_text="ОБЯЗАТЕЛЬНО: Почему нужно исправление?")
    
    # Correction type
    CORRECTION_TYPES = [
        ('FULL_REVERSAL', _('Полная отмена (Full Reversal)')),
        ('PARTIAL_CORRECTION', _('Частичное исправление (Partial Correction)')),
        ('AMOUNT_CORRECTION', _('Исправление суммы (Amount Correction)')),
        ('VAT_CORRECTION', _('Исправление НДС (VAT Correction)')),
    ]
    correction_type = models.CharField(_('Correction Type'), max_length=30, choices=CORRECTION_TYPES)
    
    # New document (if replacement needed)
    new_content_type = models.ForeignKey(
        ContentType, 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        related_name='correction_new_documents'
    )
    new_object_id = models.PositiveIntegerField(null=True, blank=True)
    new_document = GenericForeignKey('new_content_type', 'new_object_id')
    
    # Who and when
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Status
    STATUS_CHOICES = [
        ('DRAFT', _('Draft')),
        ('POSTED', _('Posted')),
        ('CANCELLED', _('Cancelled')),
    ]
    status = models.CharField(_('Status'), max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    posted_at = models.DateTimeField(_('Posted At'), null=True, blank=True)
    
    class Meta:
        verbose_name = _('Correction Document')
        verbose_name_plural = _('Correction Documents')
        ordering = ['-correction_date']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['original_content_type', 'original_object_id']),
            models.Index(fields=['correction_date']),
        ]
    
    def __str__(self):
        return f"Correction #{self.number} for {self.original_document} ({self.correction_date.date()})"
    
    def post(self):
        """
        Post correction document.
        
        Process:
        1. Validate correction_date period is OPEN
        2. Create reversal movements for original (with correction_date)
        3. Create new movements if needed
        4. Mark original as corrected
        """
        from django.db import transaction
        from django.utils import timezone
        from accounting.models import validate_period_is_open
        
        if self.status == 'POSTED':
            raise ValueError("Correction already posted")
        
        if not self.correction_reason or len(self.correction_reason.strip()) < 20:
            raise ValueError("Correction reason is REQUIRED and must be at least 20 characters!")
        
        # КРИТИЧНО: Проверяем ТЕКУЩИЙ период, НЕ оригинальный!
        validate_period_is_open(self.correction_date, self.tenant, check_type='ACCOUNTING')
        
        with transaction.atomic():
            # 1. Reverse original movements (with correction_date!)
            self._reverse_original_movements()
            
            # 2. Create new movements if replacement document
            if self.new_document:
                self._create_new_movements()
            
            # 3. Mark as posted
            self.status = 'POSTED'
            self.posted_at = timezone.now()
            self.save()
    
    def _reverse_original_movements(self):
        """Create reversal movements for original document"""
        from registers.models import StockMovement
        from accounting.models import AccountingEntry
        from django.contrib.contenttypes.models import ContentType
        
        # Get original document's movements
        original_ct = ContentType.objects.get_for_model(self.original_document)
        
        # Reverse stock movements
        stock_movements = StockMovement.objects.filter(
            content_type=original_ct,
            object_id=self.original_object_id,
            is_reversal=False  # Only reverse active movements
        )
        
        for movement in stock_movements:
            if movement.is_active:  # Not already reversed
                # Create reversal with CORRECTION DATE!
                StockMovement.objects.create(
                    tenant=movement.tenant,
                    date=self.correction_date,  # ← ТЕКУЩАЯ ДАТА!
                    warehouse=movement.warehouse,
                    item=movement.item,
                    quantity=movement.quantity,
                    type='OUT' if movement.type == 'IN' else 'IN',
                    batch=movement.batch,
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=self.id,
                    is_reversal=True,
                    reversed_movement=movement
                )
                movement.reversed_at = self.correction_date
                movement.save()
        
        # TODO: Reverse AccountingEntry, VATTransaction similarly
    
    def _create_new_movements(self):
        """Create movements for new/replacement document"""
        # TODO: Implement when new_document posts
        pass
    
    @classmethod
    def create_for_document(cls, original_document, user, reason, correction_type='FULL_REVERSAL'):
        """
        Create correction document for an existing document.
        
        Usage:
            correction = CorrectionDocument.create_for_document(
                original_document=sales_doc,
                user=request.user,
                reason='Found error in VAT calculation during audit',
                correction_type='VAT_CORRECTION'
            )
            correction.post()
        """
        from django.utils import timezone
        from django.contrib.contenttypes.models import ContentType
        
        ct = ContentType.objects.get_for_model(original_document)
        
        # Generate number
        last_num = cls.objects.filter(tenant=original_document.tenant).count()
        number = f"CORR-{last_num + 1:06d}"
        
        return cls.objects.create(
            tenant=original_document.tenant,
            original_content_type=ct,
            original_object_id=original_document.id,
            number=number,
            correction_date=timezone.now(),
            correction_reason=reason,
            correction_type=correction_type,
            created_by=user
        )
