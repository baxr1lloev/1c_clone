# documents/reposting_service.py
"""
Reposting Service - Rebuild registers from documents.

1C Pattern: Перепроведение документов за период.
"""

from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from documents.models import (
    SalesDocument, PurchaseDocument, TransferDocument,
    PaymentDocument, InventoryDocument
)
from registers.models import StockMovement, SettlementMovement, StockBatch


class RepostingService:
    """
    Service for reposting documents in period.
    
    Use cases:
    - Exchange rate changed
    - Found error in old document
    - Accounting policy changed
    - Opening balances corrected
    """
    
    @staticmethod
    def repost_period(tenant, period_start, period_end, document_types=None, user=None):
        """
        Repost all documents in period.
        
        Algorithm:
        1.  Get all posted documents in period
        2. Unpost ALL (delete movements)
        3. Re-post in DATE ORDER (determinism!)
        
        Args:
            tenant: Tenant object
            period_start: datetime
            period_end: datetime
            document_types: Optional list ['sales', 'purchase', ...]
            user: User performing repost (for audit)
        
        Returns:
            {
                'total': 150,
                'success': 148,
                'failed': 2,
                'errors': [...]
            }
        """
        with transaction.atomic():
            # 1. Collect all posted documents
            documents = RepostingService._get_documents_in_period(
                tenant, period_start, period_end, document_types
            )
            
            results = {
                'total': len(documents),
                'success': 0,
                'failed': 0,
                'errors': []
            }
            
            # 2. Unpost ALL documents first
            print(f"Unposting {len(documents)} documents...")
            for doc in documents:
                try:
                    doc.unpost()
                except Exception as e:
                    results['errors'].append({
                        'phase': 'unpost',
                        'doc_type': doc.__class__.__name__,
                        'doc_number': doc.number,
                        'error': str(e)
                    })
            
            # 3. Re-post in DATE ORDER (critical for FIFO!)
            documents_sorted = sorted(documents, key=lambda d: (d.date, d.id))
            
            print(f"Reposting {len(documents_sorted)} documents in order...")
            for doc in documents_sorted:
                try:
                    # Refresh from DB after unpost
                    doc.refresh_from_db()
                    doc.post()
                    doc.posted_by = user
                    doc.save(skip_version_check=True)
                    results['success'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append({
                        'phase': 'post',
                        'doc_type': doc.__class__.__name__,
                        'doc_number': doc.number,
                        'doc_date': str(doc.date),
                        'error': str(e)
                    })
            
            return results
    
    @staticmethod
    def _get_documents_in_period(tenant, period_start, period_end, document_types):
        """Get all posted documents in period"""
        documents = []
        
        # Map document type names to classes
        doc_classes = {
            'sales': SalesDocument,
            'purchase': PurchaseDocument,
            'transfer': TransferDocument,
            'payment': PaymentDocument,
            'inventory': InventoryDocument,
        }
        
        # If no types specified, use all
        if not document_types:
            document_types = doc_classes.keys()
        
        # Collect documents from each type
        for doc_type in document_types:
            if doc_type in doc_classes:
                doc_class = doc_classes[doc_type]
                docs = doc_class.objects.filter(
                    tenant=tenant,
                    date__gte=period_start,
                    date__lte=period_end,
                    status='posted'
                )
                documents.extend(list(docs))
        
        return documents
    
    @staticmethod
    def rebuild_fifo_batches(tenant, warehouse=None, item=None, cutoff_date=None):
        """
        Rebuild FIFO batches from scratch.
        
        Use when:
        - Corrected old purchase prices
        - Fixed quantity errors
        - Changed costing method
        
        Args:
            tenant: Tenant object
            warehouse: Optional - rebuild only for this warehouse
            item: Optional - rebuild only for this item
            cutoff_date: Optional - rebuild from this date forward
        """
        with transaction.atomic():
            # Build filter
            batch_filter = {'tenant': tenant}
            if warehouse:
                batch_filter['warehouse'] = warehouse
            if item:
                batch_filter['item'] = item
            if cutoff_date:
                batch_filter['batch_date__gte'] = cutoff_date
            
            # Delete existing batches
            deleted_count = StockBatch.objects.filter(**batch_filter).delete()[0]
            print(f"Deleted {deleted_count} old batches")
            
            # Rebuild from purchase documents
            purchase_filter = {'tenant': tenant, 'status': 'posted'}
            if warehouse:
                purchase_filter['warehouse'] = warehouse
            if cutoff_date:
                purchase_filter['date__gte'] = cutoff_date
            
            purchases = PurchaseDocument.objects.filter(
                **purchase_filter
            ).order_by('date', 'id')
            
            # Re-create batches
            created_count = 0
            for purchase in purchases:
                for line in purchase.lines.all():
                    # Skip if item filter doesn't match
                    if item and line.item != item:
                        continue
                    
                    # Create batch
                    StockBatch.objects.create(
                        tenant=tenant,
                        item=line.item,
                        warehouse=purchase.warehouse,
                        batch_date=purchase.date,
                        quantity=line.quantity,
                        remaining_quantity=line.quantity,
                        cost=line.price_base,
                        source_type='purchase',
                        source_document_type=ContentType.objects.get_for_model(purchase),
                        source_document_id=purchase.id
                    )
                    created_count += 1
            
            print(f"Created {created_count} new batches")
            
            # Now re-apply all sales/dispatches to consume batches
            sales_filter = {'tenant': tenant, 'status': 'posted'}
            if warehouse:
                sales_filter['warehouse'] = warehouse
            if cutoff_date:
                sales_filter['date__gte'] = cutoff_date
            
            sales = SalesDocument.objects.filter(
                **sales_filter
            ).order_by('date', 'id')
            
            for sale in sales:
                for line in sale.lines.all():
                    if item and line.item != item:
                        continue
                    
                    # Re-consume FIFO batches
                    RepostingService._consume_fifo_batches(
                        tenant, line.item, warehouse or sale.warehouse, line.quantity
                    )
            
            return {
                'deleted_batches': deleted_count,
                'created_batches': created_count
            }
    
    @staticmethod
    def _consume_fifo_batches(tenant, item, warehouse, quantity):
        """Consume FIFO batches for a dispatch"""
        remaining = quantity
        
        # Get oldest batches first (FIFO)
        batches = StockBatch.objects.filter(
            tenant=tenant,
            item=item,
            warehouse=warehouse,
            remaining_quantity__gt=0
        ).order_by('batch_date', 'id')
        
        for batch in batches:
            if remaining <= 0:
                break
            
            # Take from this batch
            take_qty = min(remaining, batch.remaining_quantity)
            batch.remaining_quantity -= take_qty
            batch.save()
            
            remaining -= take_qty
    
    @staticmethod
    def verify_determinism(tenant, period_start, period_end, iterations=3):
        """
        Test determinism: repost N times and compare results.
        
        Returns:
            {
                'is_deterministic': True/False,
                'diffs': [...]  # Differences found
            }
        """
        snapshots = []
        
        for i in range(iterations):
            print(f"Iteration {i+1}/{iterations}...")
            
            # Repost
            RepostingService.repost_period(tenant, period_start, period_end)
            
            # Snapshot state
            snapshot = RepostingService._snapshot_registers(tenant)
            snapshots.append(snapshot)
        
        # Compare all snapshots
        diffs = []
        for i in range(1, len(snapshots)):
            diff = RepostingService._compare_snapshots(snapshots[0], snapshots[i])
            if diff:
                diffs.append({
                    'iteration': i + 1,
                    'differences': diff
                })
        
        return {
            'is_deterministic': len(diffs) == 0,
            'iterations': iterations,
            'diffs': diffs
        }
    
    @staticmethod
    def _snapshot_registers(tenant):
        """Create snapshot of all register states"""
        snapshot = {
            'stock_movements': list(StockMovement.objects.filter(
                tenant=tenant
            ).values('item_id', 'warehouse_id', 'quantity', 'unit_cost')),
            'settlement_movements': list(SettlementMovement.objects.filter(
                tenant=tenant
            ).values('counterparty_id', 'amount', 'currency_id')),
        }
        
        # Try to include journal entries if accounting module exists
        try:
            from accounting.models import JournalEntry
            snapshot['journal_entries'] = list(JournalEntry.objects.filter(
                tenant=tenant
            ).values('number', 'total_debit', 'total_credit'))
        except ImportError:
            # Accounting module not installed
            snapshot['journal_entries'] = []
        
        return snapshot
    
    @staticmethod
    def _compare_snapshots(snap1, snap2):
        """Compare two snapshots, return differences"""
        diffs = []
        
        for key in snap1.keys():
            if snap1[key] != snap2[key]:
                diffs.append({
                    'register': key,
                    'expected_count': len(snap1[key]),
                    'actual_count': len(snap2[key])
                })
        
        return diffs
