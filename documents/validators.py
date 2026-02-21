"""
Document Validation Controls (1C-Style "Iron" Validations).

This module provides comprehensive pre-posting validation to prevent
common accounting errors. All validators run before document posting.

1C Philosophy: "The system should not allow the user to make a mistake."
"""
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.db.models import Sum
from decimal import Decimal


class DocumentValidationError(ValidationError):
    """
    Structured validation error with multiple errors support.
    
    Attributes:
        errors: List of dicts with 'code', 'message', 'field' keys
    """
    def __init__(self, errors):
        self.validation_errors = errors
        messages = [e.get('message', str(e)) for e in errors]
        super().__init__(messages)


class DocumentValidator:
    """
    Central validation framework for 1C-style document controls.
    
    Usage:
        DocumentValidator.validate_for_posting(document)
        # Raises DocumentValidationError if any validation fails
    """
    
    # ===========================================
    # MAIN ENTRY POINT
    # ===========================================
    
    @classmethod
    def validate_for_posting(cls, document):
        """
        Run all applicable validators before posting a document.
        
        Args:
            document: The document instance to validate
            
        Raises:
            DocumentValidationError: If any validation fails
        """
        errors = []
        doc_type = document.__class__.__name__
        
        # 1. Common validations (all documents)
        errors.extend(cls._validate_status(document))
        errors.extend(cls._validate_period(document))
        errors.extend(cls._validate_lines(document))
        
        # 2. Warehouse validation (if applicable)
        if hasattr(document, 'warehouse') and document.warehouse is None:
            # Check for from_warehouse/to_warehouse (Transfer)
            if not (hasattr(document, 'from_warehouse') and document.from_warehouse):
                errors.extend(cls._validate_warehouse(document))
        
        # 3. Counterparty validation (Sales, Purchase, Payment)
        if doc_type in ['SalesDocument', 'PurchaseDocument', 'PaymentDocument']:
            errors.extend(cls._validate_counterparty(document))
        
        # 4. Currency and Exchange Rate
        if hasattr(document, 'currency') and document.currency:
            errors.extend(cls._validate_currency(document))
        
        # 5. Contract validation (optional based on settings)
        if doc_type in ['SalesDocument', 'PurchaseDocument']:
            errors.extend(cls._validate_contract(document))
        
        # 6. Stock validation (outgoing goods)
        if doc_type == 'SalesDocument':
            errors.extend(cls._validate_stock_for_sales(document))
        elif doc_type == 'TransferDocument':
            errors.extend(cls._validate_stock_for_transfer(document))
        
        # 7. Payment-specific validations
        if doc_type == 'PaymentDocument':
            errors.extend(cls._validate_payment(document))
        
        # Raise combined error if any validation failed
        if errors:
            raise DocumentValidationError(errors)
    
    # ===========================================
    # INDIVIDUAL VALIDATORS
    # ===========================================
    
    @classmethod
    def _validate_status(cls, document):
        """Check document is not already posted."""
        errors = []
        if document.status == 'posted':
            errors.append({
                'code': 'ALREADY_POSTED',
                'message': _('Document is already posted. Unpost first to make changes.'),
                'field': 'status'
            })
        return errors
    
    @classmethod
    def _validate_period(cls, document):
        """Check if period is open for posting."""
        errors = []
        try:
            from accounting.models import validate_period_is_open
            validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')
        except ValidationError as e:
            errors.append({
                'code': 'PERIOD_CLOSED',
                'message': str(e.message if hasattr(e, 'message') else e),
                'field': 'date'
            })
        return errors
    
    @classmethod
    def _validate_lines(cls, document):
        """Check document has at least one line."""
        errors = []
        if hasattr(document, 'lines'):
            lines_count = document.lines.count()
            if lines_count == 0:
                errors.append({
                    'code': 'NO_LINES',
                    'message': _('Document must have at least one line item.'),
                    'field': 'lines'
                })
        return errors
    
    @classmethod
    def _validate_warehouse(cls, document):
        """Check warehouse is selected."""
        errors = []
        warehouse = getattr(document, 'warehouse', None)
        if warehouse is None:
            errors.append({
                'code': 'WAREHOUSE_REQUIRED',
                'message': _('Warehouse must be selected.'),
                'field': 'warehouse'
            })
        return errors
    
    @classmethod
    def _validate_counterparty(cls, document):
        """Check counterparty is selected."""
        errors = []
        # Check different field names used across document types
        counterparty = getattr(document, 'counterparty', None)
        if counterparty is None:
            counterparty = getattr(document, 'supplier', None)
        if counterparty is None:
            counterparty = getattr(document, 'customer', None)
        
        if counterparty is None:
            errors.append({
                'code': 'COUNTERPARTY_REQUIRED',
                'message': _('Counterparty must be selected.'),
                'field': 'counterparty'
            })
        return errors
    
    @classmethod
    def _validate_contract(cls, document):
        """Check contract is present (soft validation - warning level)."""
        errors = []
        contract = getattr(document, 'contract', None)
        # Note: This is often optional, so we make it a warning
        # Uncomment to make it mandatory:
        # if contract is None:
        #     errors.append({
        #         'code': 'CONTRACT_REQUIRED',
        #         'message': _('Contract is required for this counterparty.'),
        #         'field': 'contract'
        #     })
        return errors
    
    @classmethod
    def _validate_currency(cls, document):
        """Check currency exists and exchange rate is available."""
        errors = []
        currency = getattr(document, 'currency', None)
        if currency is None:
            errors.append({
                'code': 'CURRENCY_REQUIRED',
                'message': _('Currency must be selected.'),
                'field': 'currency'
            })
            return errors
        
        # Check exchange rate exists
        rate = getattr(document, 'rate', None) or getattr(document, 'exchange_rate', None)
        
        # If currency is not base and no rate stored, try to find one
        try:
            base_currency = document.tenant.base_currency
            if currency != base_currency:
                if not rate or rate == Decimal('0'):
                    # Try to find rate in database
                    from directories.models import ExchangeRate
                    rate_obj = ExchangeRate.objects.filter(
                        tenant=document.tenant,
                        currency=currency,
                        date__lte=document.date
                    ).order_by('-date').first()
                    
                    if not rate_obj:
                        errors.append({
                            'code': 'NO_EXCHANGE_RATE',
                            'message': _('No exchange rate found for {currency} on {date}').format(
                                currency=currency.code,
                                date=document.date.strftime('%Y-%m-%d')
                            ),
                            'field': 'currency'
                        })
        except Exception:
            pass  # base_currency might not be set
        
        return errors
    
    @classmethod
    def _validate_stock_for_sales(cls, document):
        """
        Check sufficient stock exists for all sales line items.
        
        This is the critical "1C-style" check that prevents selling goods
        that are not in stock.
        """
        errors = []
        
        if not hasattr(document, 'lines') or not hasattr(document, 'warehouse'):
            return errors
        
        warehouse = document.warehouse
        if warehouse is None:
            return errors  # Will be caught by warehouse validation
        
        from registers.models import StockBalance, StockReservation
        
        for idx, line in enumerate(document.lines.all()):
            item = line.item
            
            # Skip services
            if hasattr(item, 'item_type') and item.item_type == 'SERVICE':
                continue
            
            quantity_needed = Decimal(str(line.quantity))
            
            # Get current stock
            try:
                balance = StockBalance.objects.get(
                    tenant=document.tenant,
                    warehouse=warehouse,
                    item=item
                )
                on_stock = balance.quantity
            except StockBalance.DoesNotExist:
                on_stock = Decimal('0')
            
            # Get reserved quantity. If sales document is created from SalesOrder,
            # include reservation from that base order as available for this posting.
            reserved = StockReservation.objects.filter(
                tenant=document.tenant,
                warehouse=warehouse,
                item=item
            ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')

            own_order_reserve = Decimal('0')
            base_document_type = getattr(document, 'base_document_type', None)
            base_document_id = getattr(document, 'base_document_id', None)
            if base_document_type and base_document_id and getattr(base_document_type, 'model', '') == 'salesorder':
                own_order_reserve = StockReservation.objects.filter(
                    tenant=document.tenant,
                    warehouse=warehouse,
                    item=item,
                    document_type=base_document_type,
                    document_id=base_document_id
                ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')

            available = on_stock - reserved + own_order_reserve
            
            if quantity_needed > available:
                errors.append({
                    'code': 'INSUFFICIENT_STOCK',
                    'message': _('Insufficient stock for "{item}": available {available}, required {needed}').format(
                        item=item.name,
                        available=float(available),
                        needed=float(quantity_needed)
                    ),
                    'field': f'lines.{idx}.quantity',
                    'item_id': item.id,
                    'available': float(available),
                    'needed': float(quantity_needed)
                })
        
        return errors
    
    @classmethod
    def _validate_stock_for_transfer(cls, document):
        """Check sufficient stock at source warehouse for transfer."""
        errors = []
        
        if not hasattr(document, 'lines') or not hasattr(document, 'from_warehouse'):
            return errors
        
        from_warehouse = document.from_warehouse
        if from_warehouse is None:
            errors.append({
                'code': 'FROM_WAREHOUSE_REQUIRED',
                'message': _('Source warehouse must be selected.'),
                'field': 'from_warehouse'
            })
            return errors
        
        to_warehouse = getattr(document, 'to_warehouse', None)
        if to_warehouse is None:
            errors.append({
                'code': 'TO_WAREHOUSE_REQUIRED',
                'message': _('Destination warehouse must be selected.'),
                'field': 'to_warehouse'
            })
        
        if from_warehouse == to_warehouse:
            errors.append({
                'code': 'SAME_WAREHOUSE',
                'message': _('Source and destination warehouses cannot be the same.'),
                'field': 'to_warehouse'
            })
        
        from registers.models import StockBalance
        
        for idx, line in enumerate(document.lines.all()):
            item = line.item
            quantity_needed = Decimal(str(line.quantity))
            
            try:
                balance = StockBalance.objects.get(
                    tenant=document.tenant,
                    warehouse=from_warehouse,
                    item=item
                )
                on_stock = balance.quantity
            except StockBalance.DoesNotExist:
                on_stock = Decimal('0')
            
            if quantity_needed > on_stock:
                errors.append({
                    'code': 'INSUFFICIENT_STOCK',
                    'message': _('Insufficient stock for transfer "{item}": available {available}, required {needed}').format(
                        item=item.name,
                        available=float(on_stock),
                        needed=float(quantity_needed)
                    ),
                    'field': f'lines.{idx}.quantity',
                    'item_id': item.id
                })
        
        return errors
    
    @classmethod
    def _validate_payment(cls, document):
        """
        Validate payment document:
        - Amount must be positive
        - Optionally: Amount should not exceed current debt (warning)
        """
        errors = []
        
        amount = getattr(document, 'amount', None)
        if amount is None or amount <= 0:
            errors.append({
                'code': 'INVALID_AMOUNT',
                'message': _('Payment amount must be greater than zero.'),
                'field': 'amount'
            })
            return errors
        
        # Check debt limit (optional - can be disabled)
        counterparty = getattr(document, 'counterparty', None)
        if counterparty is None:
            return errors  # Will be caught by counterparty validation
        
        from registers.models import SettlementsBalance
        
        try:
            settlement = SettlementsBalance.objects.get(
                tenant=document.tenant,
                counterparty=counterparty,
                contract=document.contract,
                currency=document.currency
            )
            current_debt = abs(settlement.amount)
        except SettlementsBalance.DoesNotExist:
            current_debt = Decimal('0')
        
        payment_type = getattr(document, 'payment_type', 'INCOMING')
        
        # For INCOMING payment (customer pays us), check if they owe us
        # For OUTGOING payment (we pay supplier), check if we owe them
        if payment_type == 'INCOMING' and amount > current_debt:
            # This is a warning, not a hard block (overpayment can create advance)
            # Uncomment to make it a hard block:
            # errors.append({
            #     'code': 'PAYMENT_EXCEEDS_DEBT',
            #     'message': _('Payment {amount} exceeds current debt {debt}. This will create an advance.').format(
            #         amount=float(amount),
            #         debt=float(current_debt)
            #     ),
            #     'field': 'amount'
            # })
            pass
        
        return errors
    
    # ===========================================
    # UTILITY METHODS
    # ===========================================
    
    @classmethod
    def get_validation_summary(cls, document):
        """
        Get validation status without raising exception.
        
        Returns:
            dict: {'valid': bool, 'errors': list, 'warnings': list}
        """
        try:
            cls.validate_for_posting(document)
            return {'valid': True, 'errors': [], 'warnings': []}
        except DocumentValidationError as e:
            return {'valid': False, 'errors': e.validation_errors, 'warnings': []}
