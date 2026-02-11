"""
Document Mixins - Base functionality for all documents.

КРИТИЧНО: Все документы должны проверять период при post/unpost!
"""
from django.core.exceptions import ValidationError


class PeriodEnforcementMixin:
    """
    Mixin for documents to enforce period closing rules.
    
    ПРАВИЛО 1С:
    ❌ Если период закрыт бухгалтерски — НИКАКИХ изменений!
    
    Это касается:
    - post() - создание движений
    - unpost() - отмена движений (КРИТИЧНО!)
    - edit() - редактирование
    """
    
    def validate_period_open(self, date=None):
        """
        Validate that the period is open for the given date.
        
        Args:
            date: Date to check. If None, uses self.date or instance.date.
        
        Raises:
            ValidationError: If period is closed.
        """
        from accounting.models import validate_period_is_open
        
        target_date = date
        if not target_date:
            if hasattr(self, 'date'):
                target_date = self.date
            elif hasattr(self, 'get_object'):
                try:
                    target_date = self.get_object().date
                except:
                    pass
        
        if not target_date:
            # If we still don't have a date (e.g. creating without date?), skip or default to today
            # For strictness, better to let the model validation handle if date is missing
            return

        validate_period_is_open(
            date=target_date,
            tenant=self.request.user.tenant if hasattr(self, 'request') else None,
            check_type='ACCOUNTING'
        )

    def perform_create(self, serializer):
        """
        Prevent creation of documents in closed periods.
        """
        # Get date from validated data
        date = serializer.validated_data.get('date')
        if date:
            from accounting.models import validate_period_is_open
            validate_period_is_open(
                date=date,
                tenant=self.request.user.tenant,
                check_type='ACCOUNTING'
            )
        super().perform_create(serializer)

    def perform_update(self, serializer):
        """
        Prevent update of documents in closed periods.
        """
        # Check BOTH old date (if moving FROM closed period) AND new date (if moving TO closed period)
        instance = self.get_object()
        new_date = serializer.validated_data.get('date', instance.date)
        
        from accounting.models import validate_period_is_open
        
        # 1. 1C Rule: Cannot change objects IN a closed period
        validate_period_is_open(
            date=instance.date,
            tenant=self.request.user.tenant,
            check_type='ACCOUNTING'
        )
        
        # 2. 1C Rule: Cannot move objects INTO a closed period
        if new_date != instance.date:
             validate_period_is_open(
                date=new_date,
                tenant=self.request.user.tenant,
                check_type='ACCOUNTING'
            )
            
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        """
        Prevent deletion of documents in closed periods.
        """
        from accounting.models import validate_period_is_open
        
        validate_period_is_open(
            date=instance.date,
            tenant=self.request.user.tenant,
            check_type='ACCOUNTING'
        )
        super().perform_destroy(instance)
    
    def validate_period_for_posting(self):
        """
        Validate period is open before post/unpost.
        """
        # This delegator method keeps the name expected by viewsets custom actions
        self.validate_period_open()

    def post(self):
        """Override in subclass with actual posting logic"""
        raise NotImplementedError("Subclass must implement post()")
    
    def unpost(self):
        """
        Unpost document (reverse movements).
        
        КРИТИЧНО: Проверяет период!
        ❌ Нельзя unpost в закрытом периоде!
        """
        # ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА!
        self.validate_period_for_posting()
        
        # Call subclass implementation
        return self._do_unpost()
    
    def _do_unpost(self):
        """Override in subclass with actual unposting logic"""
        raise NotImplementedError("Subclass must implement _do_unpost()")


class CorrectionMixin:
    """
    Mixin to add correction document support.
    
    В РЕАЛЬНОЙ БУХГАЛТЕРИИ:
    ❌ Нельзя просто unpost() в закрытом периоде
    ✅ Нужно создать CorrectionDocument
    """
    
    def create_correction(self, user, reason, correction_type='FULL_REVERSAL'):
        """
        Create correction document for this document.
        
        Use this instead of unpost() when period is closed!
        
        Args:
            user: User creating correction
            reason: REQUIRED reason (min 20 chars)
            correction_type: Type of correction
        
        Returns:
            CorrectionDocument instance
        """
        from documents.corrections import CorrectionDocument
        
        return CorrectionDocument.create_for_document(
            original_document=self,
            user=user,
            reason=reason,
            correction_type=correction_type
        )
    
    def can_unpost_directly(self):
        """
        Check if document can be unposted directly (period open).
        
        If False, must use create_correction() instead!
        """
        from accounting.models import PeriodClosing
        
        try:
            is_closed = PeriodClosing.is_period_closed(
                date=self.date,
                tenant=self.tenant,
                check_type='ACCOUNTING'
            )
            return not is_closed
        except Exception:
            return True  # If period record doesn't exist, assume open
