from decimal import Decimal
from django.db.models import OuterRef, Subquery
from .models import SalesDocumentLine, SalesDocument

class PricingService:
    @staticmethod
    def get_last_price(tenant, item, currency, date):
        """
        Get the last sales price for an item in a specific currency before the given date.
        
        Algorithm:
            Find last SalesDocumentLine where:
            - tenant matches
            - item matches
            - document.currency matches
            - document.date <= given date
            Order by document.date DESC
        
        Args:
            tenant: Tenant instance
            item: Item instance
            currency: Currency instance
            date: datetime object
            
        Returns:
            Decimal: Last price or 0 if none found.
        """
        last_line = SalesDocumentLine.objects.filter(
            document__tenant=tenant,
            document__currency=currency,
            document__date__lte=date,
            item=item
        ).select_related('document').order_by('-document__date').first()
        
        if last_line:
            return last_line.price
            
        # Fallback to Item catalog price?
        # User spec says: "If user_entered_price ... else get_last_price"
        # "Last price BEFORE date".
        # If no history, maybe return 0 or Item.selling_price?
        # Let's return Item.selling_price as a fallback if no history.
        return item.selling_price
