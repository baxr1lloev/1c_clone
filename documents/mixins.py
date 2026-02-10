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
    
    def validate_period_for_posting(self):
        """
        Validate period is open before post/unpost.
        
        MUST be called in BOTH post() AND unpost()!
        """
        from accounting.models import validate_period_is_open
        
        # Check accounting period
        validate_period_is_open(
            date=self.date,
            tenant=self.tenant,
            check_type='ACCOUNTING'
        )
    
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
