"""
Reservation Service - Управление резервами товаров

Prevents overselling by tracking reserved stock.
Available = Stock - Reserved
"""
from decimal import Decimal
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from .models import StockReservation, StockBatch
from django.db.models import Sum


class ReservationService:
    """
    Service for managing stock reservations.
    
    Philosophy:
    - Sales Orders create reservations
    - Sales Documents consume reservations
    - Available stock = Physical stock - Reservations
    """
    
    @staticmethod
    def get_available_quantity(tenant, warehouse, item):
        """
        Calculate available quantity: Stock - Reserved
        
        Args:
            tenant: Tenant instance
            warehouse: Warehouse instance
            item: Item instance
        
        Returns:
            Decimal: Available quantity
        """
        # Get physical stock from batches
        physical_stock = StockBatch.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item,
            qty_remaining__gt=0
        ).aggregate(total=Sum('qty_remaining'))['total'] or Decimal('0')
        
        # Get reserved quantity
        reserved = StockReservation.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
        
        return physical_stock - reserved
    
    @staticmethod
    @transaction.atomic
    def create_reservation(tenant, warehouse, item, quantity, source_document):
        """
        Create a stock reservation.
        
        Args:
            tenant: Tenant instance
            warehouse: Warehouse instance
            item: Item instance
            quantity: Decimal - quantity to reserve
            source_document: Document instance (usually SalesOrder)
        
        Returns:
            StockReservation instance
        
        Raises:
            ValidationError: If not enough stock available
        """
        # Check availability
        available = ReservationService.get_available_quantity(tenant, warehouse, item)
        
        if available < quantity:
            raise ValidationError(
                f"Not enough stock available for {item}. "
                f"Available: {available}, Requested: {quantity}"
            )
        
        reservation = StockReservation.objects.create(
            tenant=tenant,
            item=item,
            warehouse=warehouse,
            quantity=quantity,
            document_type=ContentType.objects.get_for_model(source_document),
            document_id=source_document.id
        )
        
        return reservation
    
    @staticmethod
    @transaction.atomic
    def release_reservation(source_document):
        """
        Release all reservations for a document.
        
        Args:
            source_document: Document instance
        
        Returns:
            int: Number of reservations released
        """
        content_type = ContentType.objects.get_for_model(source_document)
        
        reservations = StockReservation.objects.filter(
            document_type=content_type,
            document_id=source_document.id
        )
        
        count = reservations.count()
        reservations.delete()
        
        return count
    
    @staticmethod
    @transaction.atomic
    def consume_reservation(tenant, warehouse, item, quantity, source_document):
        """
        Consume (reduce) reservation when goods are shipped.
        
        Used when SalesDocument is posted - it consumes the reservation
        created by the SalesOrder.
        
        Args:
            tenant: Tenant instance
            warehouse: Warehouse instance
            item: Item instance
            quantity: Decimal - quantity being shipped
            source_document: Document instance (SalesDocument)
        
        Returns:
            Decimal: Quantity consumed from reservations
        """
        # Find reservations for this item/warehouse
        reservations = StockReservation.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item
        ).order_by('created_at')
        
        remaining_to_consume = Decimal(str(quantity))
        
        for reservation in reservations:
            if remaining_to_consume <= 0:
                break
            
            qty_from_reservation = min(reservation.quantity, remaining_to_consume)
            
            reservation.quantity -= qty_from_reservation
            if reservation.quantity <= 0:
                reservation.delete()
            else:
                reservation.save()
            
            remaining_to_consume -= qty_from_reservation
        
        return quantity - remaining_to_consume
    
    @staticmethod
    def get_reservation_details(tenant, warehouse=None, item=None):
        """
        Get detailed reservation information.
        
        Returns:
            QuerySet of reservations with details
        """
        filters = {'tenant': tenant}
        if warehouse:
            filters['warehouse'] = warehouse
        if item:
            filters['item'] = item
        
        return StockReservation.objects.filter(**filters).select_related(
            'item', 'warehouse', 'document_type'
        )
    
    @staticmethod
    def validate_availability(tenant, warehouse, item, quantity):
        """
        Validate that enough stock is available for reservation.
        
        Args:
            tenant: Tenant instance
            warehouse: Warehouse instance
            item: Item instance
            quantity: Decimal - quantity needed
        
        Returns:
            dict: {
                'available': Decimal,
                'physical_stock': Decimal,
                'reserved': Decimal,
                'is_available': bool
            }
        """
        from django.db.models import Sum
        
        physical_stock = StockBatch.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item,
            qty_remaining__gt=0
        ).aggregate(total=Sum('qty_remaining'))['total'] or Decimal('0')
        
        reserved = StockReservation.objects.filter(
            tenant=tenant,
            warehouse=warehouse,
            item=item
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
        
        available = physical_stock - reserved
        
        return {
            'available': available,
            'physical_stock': physical_stock,
            'reserved': reserved,
            'is_available': available >= quantity
        }
