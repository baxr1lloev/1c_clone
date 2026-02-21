from django.db import transaction
from registers.models import StockBalance, SettlementsBalance, StockMovement
from django.contrib.contenttypes.models import ContentType
from registers.batch_service import BatchService
from registers.reservation_service import ReservationService
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum


class DocumentPostingService:
    """
    Handles the 'Posting' of documents.
    
    1C-Architecture:
    - Documents → Movements → Registers
    - Batch-based FIFO/AVG accounting
    - Stock reservations
    - Accounting entries (проводки)
    """
    
    @staticmethod
    @transaction.atomic
    def post_purchase_document(document):
        """
        Post a PurchaseDocument (Goods Receipt).
        
        Effects:
        1. Create batches for each line
        2. Increase Stock (via batches)
        3. Increase Debt to Supplier (SettlementsBalance)
        4. Create Accounting Entries (Дт 41 Кт 60)
        """
        # 1C-Style Validations (Iron Controls)
        from .validators import DocumentValidator
        DocumentValidator.validate_for_posting(document)
        
        if document.status == 'posted':
            return  # Already posted
        
        # Ensure totals are calculated before posting
        document.recalculate_totals()
        
        from accounting.models import validate_period_is_open
        
        # Validate period is open
        validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')
        
        batches_created = []
        total_cost = Decimal('0')
        
        # Process each line
        for line in document.lines.all():
            # Calculate unit cost in base currency
            # Calculate unit cost in base currency
            # Use stored base price if available, otherwise calculate
            if hasattr(line, 'price_base') and line.price_base:
                unit_cost = line.price_base
            else:
                # Fallback (should not be needed with new logic)
                if document.rate:
                    unit_cost = line.price * document.rate
                else:
                    unit_cost = line.price # Assuming base currency
            
            # Ensure document rate is preserved or set if missing
            if not document.rate:
                 document.rate = Decimal('1')
                 document.save()
            
            # Create batch
            batch = BatchService.create_batch_from_purchase(
                tenant=document.tenant,
                warehouse=document.warehouse,
                item=line.item,
                quantity=line.quantity,
                unit_cost=unit_cost,
                incoming_date=document.date,
                source_document=document
            )
            
            batches_created.append(batch)
            total_cost += batch.qty_initial * batch.unit_cost
        
        # Update Settlements (Increase Debt to Supplier)
        settlement, _ = SettlementsBalance.objects.get_or_create(
            tenant=document.tenant,
            counterparty=document.counterparty,
            contract=document.contract,
            currency=document.currency
        )
        # Negative = we owe supplier
        settlement.amount -= document.total_amount
        settlement.save()
        
        # Create Accounting Entries (if accounting module available)
        try:
            from accounting.accounting_service import AccountingService
            AccountingService.create_purchase_entries(document, batches_created)
        except ImportError:
            pass  # Accounting module not available
        
        # Rebuild stock balance for affected items
        for batch in batches_created:
            StockBalance.recalculate_for_item(
                document.tenant, 
                document.warehouse, 
                batch.item
            )
        
        # Mark as Posted
        document.status = 'posted'
        from django.utils import timezone
        document.posted_at = timezone.now()
        document.save()
        
        return {
            'batches_created': batches_created,
            'total_cost': total_cost
        }
    
    @staticmethod
    @transaction.atomic
    def post_sales_document(document):
        """
        Post a SalesDocument (Goods Issue / Realization).
        
        Effects:
        1. Consume batches (FIFO/AVG) and calculate COGS
        2. Decrease Stock
        3. Increase Customer Debt (SettlementsBalance)
        4. Release reservations (if from SalesOrder)
        5. Create Accounting Entries:
           - Дт 62 Кт 90.1 (Revenue)
           - Дт 90.2 Кт 41 (COGS)
        """
        # 1C-Style Validations (Iron Controls)
        from .validators import DocumentValidator
        DocumentValidator.validate_for_posting(document)
        
        if document.status == 'posted':
            return  # Already posted
        
        # Ensure totals are calculated before posting
        document.recalculate_totals()
        
        from accounting.models import validate_period_is_open
        
        # Validate period is open
        validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')
        
        # Lock Exchange Rate (Use stored rate if available)
        if hasattr(document, 'rate') and document.rate and document.rate != Decimal('1'):
             # Rate is already set by Form
             pass
        elif document.currency != document.tenant.base_currency:
             # Fetch if missing (fallback)
             from directories.models import ExchangeRate
             rate_obj = ExchangeRate.objects.filter(
                tenant=document.tenant,
                currency=document.currency,
                date__lte=document.date
             ).first()
             document.rate = rate_obj.rate if rate_obj else Decimal('1')
             document.save()
        
        # Ensure base total is consistent
        if hasattr(document, 'total_amount_base') and not document.total_amount_base:
             document.total_amount_base = document.total_amount * document.rate
             document.save()
        
        total_cogs = Decimal('0')
        all_batches_consumed = []
        
        # Process each line
        for line in document.lines.all():
            # Consume batches using FIFO/AVG
            # Skip for Services
            if line.item.item_type == 'SERVICE':
                continue
                
            result = BatchService.consume_batches(
                tenant=document.tenant,
                warehouse=document.warehouse,
                item=line.item,
                quantity=line.quantity,
                consumption_date=document.date,
                source_document=document
            )
            
            total_cogs += result['total_cost']
            all_batches_consumed.extend(result['batches_consumed'])
            
            # Try to consume reservation (if exists)
            try:
                ReservationService.consume_reservation(
                    tenant=document.tenant,
                    warehouse=document.warehouse,
                    item=line.item,
                    quantity=line.quantity,
                    source_document=document
                )
            except Exception:
                pass  # No reservation exists, that's OK
        
        # Update Settlements (Increase Customer Debt)
        settlement, _ = SettlementsBalance.objects.get_or_create(
            tenant=document.tenant,
            counterparty=document.counterparty,
            contract=document.contract,
            currency=document.currency
        )
        # Positive = customer owes us
        settlement.amount += document.total_amount
        settlement.save()
        
        # Create Accounting Entries
        try:
            from accounting.accounting_service import AccountingService
            AccountingService.create_sales_entries(document, total_cogs)
        except ImportError:
            pass  # Accounting module not available
        
        # Rebuild stock balances
        processed_items = set()
        for batch, qty, cost in all_batches_consumed:
            if batch.item.id not in processed_items:
                StockBalance.recalculate_for_item(
                    document.tenant,
                    document.warehouse,
                    batch.item
                )
                processed_items.add(batch.item.id)
        
        # Mark as Posted
        document.status = 'posted'
        document.posted_at = timezone.now()
        document.save()
        
        return {
            'batches_consumed': all_batches_consumed,
            'total_cogs': total_cogs
        }
    
    @staticmethod
    @transaction.atomic
    def post_transfer_document(document):
        """
        Post a TransferDocument (Stock Movement between warehouses).
        
        Effects:
        1. Consume batches from source warehouse
        2. Create new batches in destination warehouse
        3. Update Stock at both warehouses
        4. Log Movements
        """
        if document.status == 'posted':
            return
        
        # 1C-Style Validations (Iron Controls)
        from .validators import DocumentValidator
        DocumentValidator.validate_for_posting(document)
        
        from accounting.models import validate_period_is_open
        
        # Validate period is open
        validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')
        
        all_batches_consumed = []
        all_batches_created = []
        
        for line in document.lines.all():
            # Transfer batches
            result = BatchService.transfer_batches(
                tenant=document.tenant,
                from_warehouse=document.from_warehouse,
                to_warehouse=document.to_warehouse,
                item=line.item,
                quantity=line.quantity,
                transfer_date=document.date,
                source_document=document
            )
            
            all_batches_consumed.extend(result['batches_consumed'])
            all_batches_created.extend(result['batches_created'])
        
        # Rebuild stock balances for both warehouses
        processed_items = set()
        for batch, qty, cost in all_batches_consumed:
            if batch.item.id not in processed_items:
                # Source warehouse
                StockBalance.recalculate_for_item(
                    document.tenant,
                    document.from_warehouse,
                    batch.item
                )
                # Destination warehouse
                StockBalance.recalculate_for_item(
                    document.tenant,
                    document.to_warehouse,
                    batch.item
                )
                processed_items.add(batch.item.id)
        
        # Mark as Posted
        document.status = 'posted'
        from django.utils import timezone
        document.posted_at = timezone.now()
        document.save()
        
        return {
            'batches_consumed': all_batches_consumed,
            'batches_created': all_batches_created
        }

    @staticmethod
    @transaction.atomic
    def unpost_transfer_document(document):
        """
        Unpost a TransferDocument.

        Rules:
        1. Destination batches created by this transfer must not be consumed.
        2. Source OUT movements are reversed back to source batches.
        3. Destination IN movements and transfer-created batches are removed.
        """
        if document.status != 'posted':
            return

        from accounting.models import validate_period_is_open
        from django.core.exceptions import ValidationError
        from registers.models import StockBatch, StockMovement

        validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')

        content_type = ContentType.objects.get_for_model(document)

        transfer_batches = StockBatch.objects.filter(
            tenant=document.tenant,
            incoming_document_type=content_type,
            incoming_document_id=document.id
        )

        for batch in transfer_batches:
            if batch.qty_remaining < batch.qty_initial:
                raise ValidationError(
                    f"Cannot unpost transfer #{document.number}: "
                    f"batch for {batch.item.name} in {batch.warehouse.name} was already consumed."
                )

        out_movements = StockMovement.objects.filter(
            tenant=document.tenant,
            content_type=content_type,
            object_id=document.id,
            type='OUT'
        ).select_related('batch', 'item', 'warehouse')

        in_movements = StockMovement.objects.filter(
            tenant=document.tenant,
            content_type=content_type,
            object_id=document.id,
            type='IN'
        )

        affected = set()
        for movement in out_movements:
            affected.add((movement.warehouse, movement.item))
            if movement.batch:
                movement.batch.qty_remaining += movement.quantity
                movement.batch.save(update_fields=['qty_remaining'])

        for batch in transfer_batches.select_related('item', 'warehouse'):
            affected.add((batch.warehouse, batch.item))

        in_movements.delete()
        out_movements.delete()
        transfer_batches.delete()

        for warehouse, item in affected:
            StockBalance.recalculate_for_item(document.tenant, warehouse, item)

        document.status = 'draft'
        document.posted_at = None
        document.save()
    
    @staticmethod
    @transaction.atomic
    def post_sales_order(order):
        """
        Post a SalesOrder - creates stock reservations.
        
        Effects:
        1. Create reservations for each line
        2. Mark order as posted
        
        Note: Does NOT move stock - only reserves it!
        """
        if order.status == 'posted':
            return
        
        # 1C-Style Validations (Iron Controls)
        from .validators import DocumentValidator
        DocumentValidator.validate_for_posting(order)
        
        from accounting.models import validate_period_is_open
        
        # Validate period is open
        validate_period_is_open(order.date, order.tenant, check_type='OPERATIONAL')
        
        reservations_created = []
        
        for line in order.lines.all():
            # Create reservation
            reservation = ReservationService.create_reservation(
                tenant=order.tenant,
                warehouse=order.warehouse,
                item=line.item,
                quantity=line.quantity,
                source_document=order
            )
            reservations_created.append(reservation)
        
        # Mark as Posted
        order.status = 'posted'
        from django.utils import timezone
        order.posted_at = timezone.now()
        order.save()
        
        return {
            'reservations_created': reservations_created
        }
    
    @staticmethod
    @transaction.atomic
    def unpost_sales_order(order):
        """
        Unpost a SalesOrder - releases reservations.
        """
        if order.status != 'posted':
            return
        
        # Release all reservations
        count = ReservationService.release_reservation(order)
        
        # Mark as Draft
        order.status = 'draft'
        order.posted_at = None
        order.save()
        
        return {
            'reservations_released': count
        }
    
    @staticmethod
    @transaction.atomic
    def post_payment_document(document):
        """
        Post a PaymentDocument (Incoming/Outgoing Payment).
        
        Effects:
        1. Create Settlement Movement (Audit Trace)
        2. Update SettlementsBalance (Snapshot)
        3. Create Accounting Entries (Dt 1030 Kt 1210 etc.)
        """
        if document.status == 'posted':
            return
        
        # 1C-Style Validations (Iron Controls)
        from .validators import DocumentValidator
        DocumentValidator.validate_for_posting(document)
        
        from accounting.models import validate_period_is_open, AccountingEntry, ChartOfAccounts
        from registers.models import SettlementMovement
        
        # Validate period is open
        validate_period_is_open(document.date, document.tenant, check_type='ACCOUNTING')
        
        # 1. Accounts Discovery
        try:
            acc_bank = ChartOfAccounts.objects.get(tenant=document.tenant, code='1030')
            if document.counterparty.type == 'CUSTOMER':
                 acc_partner = ChartOfAccounts.objects.get(tenant=document.tenant, code='1210')
            else:
                 acc_partner = ChartOfAccounts.objects.get(tenant=document.tenant, code='3310')
        except ChartOfAccounts.DoesNotExist:
             # Standard fallback or fail
             from django.core.exceptions import ValidationError
             raise ValidationError("Required accounts (1030, 1210/3310) not found in Chart of Accounts.")

        # 2. Settlement Logic
        # INCOMING (Customer pays) -> Decrease Asset (Receivable) -> Movement = -Amount
        # OUTGOING (We pay) -> Decrease Liability (Payable) -> Movement = +Amount (Wait, Payable is Credit)
        
        # Unified Register "Settlements Balance":
        # Positive = Receivable (Asset).
        # Negative = Payable (Liability).
        
        movement_amount = document.amount
        if document.payment_type == 'INCOMING':
            movement_amount = -document.amount
        else:
            movement_amount = document.amount
        
        # Create Movement
        SettlementMovement.objects.create(
            tenant=document.tenant,
            date=document.date,
            counterparty=document.counterparty,
            contract=document.contract,
            currency=document.currency,
            amount=movement_amount,
            content_type=ContentType.objects.get_for_model(document),
            object_id=document.id
        )
        
        # Update Balance (Snapshot)
        settlement, _ = SettlementsBalance.objects.get_or_create(
            tenant=document.tenant,
            counterparty=document.counterparty,
            contract=document.contract,
            currency=document.currency
        )
        settlement.amount += movement_amount
        settlement.save()
        
        # 3. Accounting Entries
        if document.payment_type == 'INCOMING':
                # Dt 1030 (Bank) - Kt 1210 (Customer)
                debit = acc_bank
                credit = acc_partner
        else:
                # Dt 3310 (Supplier) - Kt 1030 (Bank)
                debit = acc_partner
                credit = acc_bank
        
        AccountingEntry.objects.create(
                tenant=document.tenant,
                date=document.date,
                period=document.date.date().replace(day=1),
                content_type=ContentType.objects.get_for_model(document),
                object_id=document.id,
                debit_account=debit,
                credit_account=credit,
                amount=document.amount,
                currency=document.currency,
                description=f"Payment #{document.number}: {document.purpose}"
        )
        
        # Mark as Posted
        document.status = 'posted'
        from django.utils import timezone
        document.posted_at = timezone.now()
        document.save()

    @staticmethod
    @transaction.atomic
    def unpost_payment_document(document):
        """
        Unpost PaymentDocument.
        Reverse all movements and entries.
        """
        if document.status != 'posted':
            return
            
        from accounting.models import validate_period_is_open, AccountingEntry
        from registers.models import SettlementMovement
        
        validate_period_is_open(document.date, document.tenant, check_type='ACCOUNTING')
        
        content_type = ContentType.objects.get_for_model(document)
        
        # 1. Reverse Settlements Balance
        # Find movements to know what to reverse? No, just reverse the logic.
        # But allow specific recalc?
        # Simpler: Read the movement we created.
        movements = SettlementMovement.objects.filter(
            tenant=document.tenant,
            content_type=content_type,
            object_id=document.id
        )
        
        for mov in movements:
            try:
                settlement = SettlementsBalance.objects.get(
                    tenant=document.tenant,
                    counterparty=mov.counterparty,
                    contract=mov.contract,
                    currency=mov.currency
                )
                settlement.amount -= mov.amount # Reverse
                if settlement.amount == 0:
                    settlement.delete()
                else:
                    settlement.save()
            except SettlementsBalance.DoesNotExist:
                pass
            mov.delete()
            
        # 2. Delete Accounting Entries
        AccountingEntry.objects.filter(
            tenant=document.tenant,
            content_type=content_type,
            object_id=document.id
        ).delete()
        
        # Mark as Draft
        document.status = 'draft'
        document.posted_at = None
        document.save()

    @staticmethod
    @transaction.atomic
    def unpost_purchase_document(document):
        """
        Unpost a PurchaseDocument - reverse all register movements.
        
        Effects:
        1. Delete/void batches created by this document
        2. Reverse Settlements (decrease debt to supplier)
        3. Reverse Accounting Entries
        4. Recalculate Stock
        """
        if document.status != 'posted':
            return  # Not posted, nothing to unpost
        
        from accounting.models import validate_period_is_open
        
        # Validate period is open
        validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')
        
        from django.core.exceptions import ValidationError
        from registers.models import StockBatch, StockMovement

        content_type = ContentType.objects.get_for_model(document)
        batches = StockBatch.objects.filter(
            tenant=document.tenant,
            incoming_document_type=content_type,
            incoming_document_id=document.id
        )

        affected_items = set()
        for batch in batches:
            if batch.qty_remaining < batch.qty_initial:
                raise ValidationError(
                    f"Cannot unpost purchase #{document.number}: "
                    f"batch for {batch.item.name} was already consumed."
                )
            affected_items.add((batch.warehouse, batch.item))

        StockMovement.objects.filter(
            tenant=document.tenant,
            content_type=content_type,
            object_id=document.id
        ).delete()
        batches.delete()
        
        # Reverse Settlements
        try:
            settlement = SettlementsBalance.objects.get(
                tenant=document.tenant,
                counterparty=document.counterparty,
                contract=document.contract,
                currency=document.currency
            )
            settlement.amount += document.total_amount  # Reverse the debt
            if settlement.amount == 0:
                settlement.delete()
            else:
                settlement.save()
        except SettlementsBalance.DoesNotExist:
            pass
        
        # Reverse Accounting Entries
        try:
            from accounting.models import AccountingEntry
            AccountingEntry.objects.filter(
                tenant=document.tenant,
                content_type=content_type,
                object_id=document.id
            ).delete()
        except ImportError:
            pass
        
        # Recalculate stock balances
        for warehouse, item in affected_items:
            StockBalance.recalculate_for_item(document.tenant, warehouse, item)
        
        # Mark as Draft
        document.status = 'draft'
        document.posted_at = None
        document.save()
    
    @staticmethod
    @transaction.atomic
    def unpost_sales_document(document):
        """
        Unpost a SalesDocument - reverse all register movements.
        
        Effects:
        1. Restore batches (reverse consumption)
        2. Reverse Settlements (decrease customer debt)
        3. Reverse Accounting Entries
        4. Recreate reservations if needed
        5. Recalculate Stock
        """
        if document.status != 'posted':
            return  # Not posted
        
        from accounting.models import validate_period_is_open
        
        # Validate period is open
        validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')
        
        # Reverse stock movements
        from registers.models import StockMovement, StockReservation
        content_type = ContentType.objects.get_for_model(document)
        movements = StockMovement.objects.filter(
            tenant=document.tenant,
            content_type=content_type,
            object_id=document.id
        )
        
        affected_items = set()
        for movement in movements:
            affected_items.add((movement.warehouse, movement.item))
            # Restore batch quantity
            if movement.type == 'OUT' and movement.batch:
                movement.batch.qty_remaining += abs(movement.quantity)
                movement.batch.save()
            movement.delete()
        
        # Reverse Settlements
        try:
            settlement = SettlementsBalance.objects.get(
                tenant=document.tenant,
                counterparty=document.counterparty,
                contract=document.contract,
                currency=document.currency
            )
            settlement.amount -= document.total_amount  # Reverse the receivable
            if settlement.amount == 0:
                settlement.delete()
            else:
                settlement.save()
        except SettlementsBalance.DoesNotExist:
            pass
        
        # Reverse Accounting Entries
        try:
            from accounting.models import AccountingEntry
            AccountingEntry.objects.filter(
                tenant=document.tenant,
                content_type=content_type,
                object_id=document.id
            ).delete()
        except ImportError:
            pass

        # Restore reservations and reopen base sales order if this document was created on its basis.
        if getattr(document, 'base_document_type_id', None) and getattr(document, 'base_document_id', None):
            if getattr(document.base_document_type, 'model', '') == 'salesorder':
                order_ct = document.base_document_type
                for line in document.lines.all():
                    if getattr(line.item, 'item_type', '') == 'SERVICE':
                        continue
                    existing_qty = StockReservation.objects.filter(
                        tenant=document.tenant,
                        warehouse=document.warehouse,
                        item=line.item,
                        document_type=order_ct,
                        document_id=document.base_document_id
                    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
                    missing_qty = Decimal(str(line.quantity)) - existing_qty
                    if missing_qty > 0:
                        StockReservation.objects.create(
                            tenant=document.tenant,
                            warehouse=document.warehouse,
                            item=line.item,
                            quantity=missing_qty,
                            document_type=order_ct,
                            document_id=document.base_document_id
                        )

                base_order = getattr(document, 'base_document', None)
                if base_order and getattr(base_order, 'shipped_document_id', None) == document.id:
                    base_order.shipped_document = None
                    if hasattr(base_order, 'STATUS_CONFIRMED'):
                        base_order.status = base_order.STATUS_CONFIRMED
                    base_order.save(update_fields=['shipped_document', 'status'])
        
        # Recalculate stock balances
        for warehouse, item in affected_items:
            StockBalance.recalculate_for_item(document.tenant, warehouse, item)
        
        # Mark as Draft
        document.status = 'draft'
        document.posted_at = None
        document.save()

    @staticmethod
    @transaction.atomic
    def post_inventory_document(document):
        """
        Post Inventory Document (Phys. Count).
        
        Logic:
        1. Compare Actual vs Book quantity.
        2. Surplus (Actual > Book): Create Batch (Income).
        3. Shortage (Actual < Book): Consume Batches (Expense).
        """
        if document.status == 'posted':
            return
        
        # 1C-Style Validations (Iron Controls)
        from .validators import DocumentValidator
        DocumentValidator.validate_for_posting(document)
            
        from accounting.models import validate_period_is_open
        validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')
        
        surplus_batches = []
        shortage_consumptions = []
        
        for line in document.lines.all():
            diff = line.difference
            
            if diff > 0:
                # Surplus -> Create Batch
                # Cost? Use entered price or 0
                batch = BatchService.create_batch_from_purchase(
                    tenant=document.tenant,
                    warehouse=document.warehouse,
                    item=line.item,
                    quantity=diff,
                    unit_cost=line.price,
                    incoming_date=document.date,
                    source_document=document
                )
                surplus_batches.append(batch)
                
            elif diff < 0:
                # Shortage -> Consume Batches
                qty = abs(diff)
                result = BatchService.consume_batches(
                    tenant=document.tenant,
                    warehouse=document.warehouse,
                    item=line.item,
                    quantity=qty,
                    consumption_date=document.date,
                    source_document=document
                )
                shortage_consumptions.extend(result['batches_consumed'])

        # TODO: Create Accounting Entries (Dt 41 Kt 91 / Dt 94 Kt 41)
        
        # Recalculate Stock Balances for all affected items
        affected_items = set(line.item for line in document.lines.all())
        for item in affected_items:
            StockBalance.recalculate_for_item(document.tenant, document.warehouse, item)

        document.status = 'posted'
        from django.utils import timezone
        document.posted_at = timezone.now()
        document.save()
        
        return {
            'surplus_batches': surplus_batches,
            'shortage_consumptions': shortage_consumptions
        }


    @staticmethod
    @transaction.atomic
    def unpost_inventory_document(document):
        """
        Unpost Inventory Document.
        """
        if document.status != 'posted':
            return
            
        from accounting.models import validate_period_is_open
        validate_period_is_open(document.date, document.tenant, check_type='OPERATIONAL')
        
        # 1. Delete created batches (Surplus)
        from registers.models import StockBatch
        content_type = ContentType.objects.get_for_model(document)
        StockBatch.objects.filter(
            incoming_document_type=content_type,
            incoming_document_id=document.id
        ).delete()
        
        # 2. Reverse consumptions (Shortage)
        from registers.models import StockMovement
        movements = StockMovement.objects.filter(
            tenant=document.tenant,
            content_type=content_type,
            object_id=document.id
        )
        
        # Manually restore batch quantities
        for movement in movements:
             if movement.batch:
                 movement.batch.qty_remaining += abs(movement.quantity)
                 movement.batch.save()
             movement.delete()
             
        # Recalculate Stock Balances for all affected items
        # Just use the document lines logic
        affected_items = set(line.item for line in document.lines.all())
        for item in affected_items:
            StockBalance.recalculate_for_item(document.tenant, document.warehouse, item)

        document.status = 'draft'
        document.posted_at = None
        document.save()


class SequenceRestorationService:
    """
    Service for restoring the document sequence (Group Reposting).
    
    Why needed?
    In 1C/Accounting, if you edit a document in the past (e.g. Purchase),
    subsequent documents (e.g. Sales) might now validly post but with WRONG cost/profit stats.
    
    Sequence Restoration:
    1. Unposts all documents from Start Date.
    2. Reposts them in strict chronological order.
    3. Stops on first error.
    """
    
    @staticmethod
    def restore_sequence(tenant, start_date, user):
        """
        Repost all documents starting from start_date.
        """
        logs = []
        
        # 1. Collect all POSTED documents >= start_date
        documents = []
        from documents.models import (
            SalesDocument, PurchaseDocument, 
            PaymentDocument, TransferDocument, 
            InventoryDocument
        )
        
        models_to_check = [
            SalesDocument, PurchaseDocument, 
            PaymentDocument, TransferDocument, 
            InventoryDocument
        ]
        
        for model in models_to_check:
            docs = model.objects.filter(
                tenant=tenant,
                date__gte=start_date,
                status='posted'
            )
            for doc in docs:
                documents.append(doc)
                
        # 2. Sort critically by Date + Time
        documents.sort(key=lambda x: x.date)
        
        logs.append(f"Found {len(documents)} documents to repost from {start_date}.")
        
        success_count = 0
        error_count = 0
        
        # 3. Process
        for doc in documents:
            doc_str = f"{doc._meta.verbose_name} #{doc.number} ({doc.date})"
            try:
                if isinstance(doc, SalesDocument):
                    DocumentPostingService.unpost_sales_document(doc)
                    DocumentPostingService.post_sales_document(doc)
                elif isinstance(doc, PurchaseDocument):
                    DocumentPostingService.unpost_purchase_document(doc)
                    DocumentPostingService.post_purchase_document(doc)
                elif isinstance(doc, PaymentDocument):
                    DocumentPostingService.unpost_payment_document(doc)
                    DocumentPostingService.post_payment_document(doc)
                elif isinstance(doc, TransferDocument):
                    DocumentPostingService.post_transfer_document(doc) 
                elif isinstance(doc, InventoryDocument):
                    DocumentPostingService.unpost_inventory_document(doc)
                    DocumentPostingService.post_inventory_document(doc)
                
                logs.append(f"✅ Reposted: {doc_str}")
                success_count += 1
                
            except Exception as e:
                logs.append(f"❌ FAILED: {doc_str} - {str(e)}")
                error_count += 1
                logs.append("⛔ Sequence restoration STOPPED due to error.")
                break
                
        return {
            'total_found': len(documents),
            'success_count': success_count,
            'error_count': error_count,
            'logs': logs
        }


