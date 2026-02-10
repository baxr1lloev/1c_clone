"""
Document Chain Service - 1C-style document linking.

Provides:
- create_on_basis(): Create new document from existing
- get_available_basis_types(): What can be created from this doc
- get_settlement_summary(): Show paid/remaining amounts
"""

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from decimal import Decimal


class DocumentChainService:
    """
    Service for 1C-style document chains.
    
    Business Flow Examples:
    - SalesOrder → SalesDocument (shipment)
    - SalesDocument → PaymentDocument (receive payment)
    - PurchaseDocument → PaymentDocument (pay supplier)
    """
    
    # Define allowed document chain transitions
    ALLOWED_CHAINS = {
        'salesorder': [
            {'type': 'salesdocument', 'label': 'Sales Document (Shipment)'},
            {'type': 'paymentdocument', 'label': 'Payment Document (Prepayment)'},
        ],
        'salesdocument': [
            {'type': 'paymentdocument', 'label': 'Payment Document (Receive Payment)'},
        ],
        'purchasedocument': [
            {'type': 'paymentdocument', 'label': 'Payment Document (Pay Supplier)'},
        ],
    }
    
    @classmethod
    def get_available_creation_types(cls, document):
        """
        Get list of document types that can be created from this document.
        
        Args:
            document: Source document instance
            
        Returns:
            list: [{'type': 'paymentdocument', 'label': 'Payment Document'}, ...]
        """
        model_name = document._meta.model_name
        return cls.ALLOWED_CHAINS.get(model_name, [])
    
    @classmethod
    def create_on_basis(cls, base_document, target_type, user=None):
        """
        Create new document based on existing document.
        
        Args:
            base_document: Source document
            target_type: 'salesdocument', 'paymentdocument', etc.
            user: User performing action
            
        Returns:
            New document (draft status)
            
        Raises:
            ValueError: If target_type not allowed for this document
        """
        model_name = base_document._meta.model_name
        allowed_types = [c['type'] for c in cls.ALLOWED_CHAINS.get(model_name, [])]
        
        if target_type not in allowed_types:
            raise ValueError(
                f"Cannot create {target_type} from {model_name}. "
                f"Allowed: {allowed_types}"
            )
        
        if target_type == 'salesdocument':
            return cls._create_sales_from_order(base_document, user)
        elif target_type == 'paymentdocument':
            return cls._create_payment_from_document(base_document, user)
        
        raise ValueError(f"Unknown target type: {target_type}")
    
    @classmethod
    def _create_sales_from_order(cls, order, user):
        """Create SalesDocument from SalesOrder"""
        # SalesOrder already has this method
        return order.create_sales_document(user)
    
    @classmethod
    def _create_payment_from_document(cls, document, user):
        """Create PaymentDocument from Sales/Purchase document"""
        from documents.models import PaymentDocument, SalesDocument
        
        ct = ContentType.objects.get_for_model(document)
        is_sales = isinstance(document, SalesDocument)
        
        # Determine amount from document
        amount = getattr(document, 'total_amount', None)
        if amount is None:
            amount = getattr(document, 'total_amount_base', Decimal('0'))
        
        # Check unpaid amount
        settlement = cls.get_settlement_summary(document)
        remaining = settlement['remaining_amount']
        
        payment = PaymentDocument.objects.create(
            tenant=document.tenant,
            counterparty=document.counterparty,
            contract=document.contract,
            currency=document.currency,
            rate=getattr(document, 'rate', Decimal('1')),
            
            # Payment type based on source document
            payment_type='INCOMING' if is_sales else 'OUTGOING',
            
            # Amount = remaining unpaid amount
            amount=remaining if remaining > 0 else amount,
            
            number=f"PAY-{document.number}",
            date=timezone.now(),
            created_by=user,
            purpose=f"Payment for {document}",
            
            # Document chain link
            base_document_type=ct,
            base_document_id=document.id,
        )
        
        return payment
    
    @classmethod
    def get_settlement_summary(cls, document):
        """
        Get settlement summary for a document.
        
        Returns:
            dict: {
                'total_amount': Decimal,
                'paid_amount': Decimal,
                'remaining_amount': Decimal,
                'payments': [PaymentDocument, ...],
                'is_fully_paid': bool,
            }
        """
        from documents.models import PaymentDocument
        
        ct = ContentType.objects.get_for_model(document)
        
        # Find all posted payments linked to this document
        payments = PaymentDocument.objects.filter(
            base_document_type=ct,
            base_document_id=document.id,
            status='posted'
        )
        
        paid = sum(p.amount for p in payments)
        total = getattr(document, 'total_amount_base', 
                       getattr(document, 'total_amount', Decimal('0')))
        
        # Ensure they're Decimals
        if not isinstance(paid, Decimal):
            paid = Decimal(str(paid)) if paid else Decimal('0')
        if not isinstance(total, Decimal):
            total = Decimal(str(total)) if total else Decimal('0')
        
        remaining = total - paid
        
        return {
            'total_amount': total,
            'paid_amount': paid,
            'remaining_amount': remaining,
            'payments': list(payments),
            'is_fully_paid': remaining <= 0,
        }
    
    @classmethod
    def get_document_url(cls, document):
        """Get frontend URL for a document"""
        model_name = document._meta.model_name
        doc_id = document.id
        
        url_map = {
            'salesdocument': f'/documents/sales/{doc_id}',
            'purchasedocument': f'/documents/purchases/{doc_id}',
            'salesorder': f'/documents/sales-orders/{doc_id}',
            'paymentdocument': f'/documents/payments/{doc_id}',
            'transferdocument': f'/documents/transfers/{doc_id}',
            'inventorydocument': f'/documents/inventory/{doc_id}',
        }
        return url_map.get(model_name)
