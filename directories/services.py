from decimal import Decimal
from django.core.exceptions import ValidationError
from .models import ExchangeRate, Currency

class CurrencyService:
    @staticmethod
    def get_rate(tenant, currency, date):
        """
        Get exchange rate for a specific date.
        
        Args:
            tenant: Tenant instance
            currency: Currency instance
            date: Date (datetime.date or datetime.datetime)
            
        Returns:
            Decimal: Exchange rate
            
        Raises:
            ValidationError: If rate is missing for the date.
        """
        # If currency is base currency, rate is always 1
        if tenant.base_currency_id == currency.id or tenant.base_currency == currency:
            return Decimal(1)
            
        # Helper to ensure we have a date object
        if hasattr(date, 'date'):
            query_date = date.date()
        else:
            query_date = date
            
        try:
            er = ExchangeRate.objects.get(
                tenant=tenant,
                currency=currency,
                date=query_date
            )
            return er.rate
        except ExchangeRate.DoesNotExist:
            raise ValidationError(f"No exchange rate found for {currency} on {query_date}")
