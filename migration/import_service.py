# migration/import_service.py
"""
1C Import Service - Maps parsed XML data to Django models.

This service takes output from C1XmlParser and creates actual Django objects.
Includes validation, duplicate detection, and transaction rollback.
"""

from django.db import transaction
from django.core.exceptions import ValidationError
from typing import Dict, List, Any, Tuple
from decimal import Decimal
import logging

from directories.models import (
    Counterparty, Item, Warehouse, Currency, Contract
)
from documents.models import (
    SalesDocument, PurchaseDocument, PaymentDocument,
    OpeningBalanceDocument, OpeningBalanceStockLine, OpeningBalanceSettlementLine,
    SalesDocumentLine, PurchaseDocumentLine
)
from migration.parsers.c1_xml_parser import C1XmlParser

logger = logging.getLogger(__name__)


class ImportProgress:
    """Track import progress for reporting"""
    def __init__(self):
        self.total = 0
        self.processed = 0
        self.created = 0
        self.updated = 0
        self.skipped = 0
        self.errors = []
    
    def to_dict(self):
        return {
            'total': self.total,
            'processed': self.processed,
            'created': self.created,
            'updated': self.updated,
            'skipped': self.skipped,
            'errors': self.errors,
            'progress_percent': (self.processed / self.total * 100) if self.total > 0 else 0
        }


class ImportService:
    """
    Service for importing 1C data into Django models.
    
    Usage:
        service = ImportService(tenant)
        parser = C1XmlParser()
        parsed_data = parser.parse_file('export.xml')
        result = service.import_all(parsed_data)
    """
    
    def __init__(self, tenant):
        self.tenant = tenant
        self.progress = ImportProgress()
        
        # Caches for lookups (avoid repeated queries)
        self._currency_cache = {}
        self._warehouse_cache = {}
        self._item_cache = {}
        self._counterparty_cache = {}
        # self._unit_cache = {}  # Unit model doesn't exist
    
    def import_all(self, parsed_data: Dict[str, Any], validate_only: bool = False) -> Dict[str, Any]:
        """
        Import all data from parsed 1C export.
        
        Args:
            parsed_data: Output from C1XmlParser.parse_file()
            validate_only: If True, only validate without saving
        
        Returns:
            {
                'success': True/False,
                'progress': {...},
                'errors': [...]
            }
        """
        try:
            with transaction.atomic():
                # Import in correct order (dependencies first)
                logger.info("Starting 1C import...")
                
                # 1. Directories (no dependencies)
                self._import_currencies(parsed_data.get('currencies', []))
                self._import_warehouses(parsed_data.get('warehouses', []))
                # self._import_units(parsed_data.get('units', []))  # Unit model doesn't exist
                self._import_counterparties(parsed_data.get('counterparties', []))
                self._import_items(parsed_data.get('items', []))
                
                # 2. Documents (depend on directories)
                self._import_documents(parsed_data.get('documents', []))
                
                # 3. Opening balances (depend on everything)
                self._import_balances(parsed_data.get('balances', {}))
                
                if validate_only:
                    logger.info("Validation successful - rolling back (validate_only=True)")
                    raise ValidationError("Validation mode - no changes saved")
                
                logger.info(f"Import complete: {self.progress.created} created, {self.progress.updated} updated")
                
                return {
                    'success': True,
                    'progress': self.progress.to_dict(),
                    'message': 'Import completed successfully'
                }
                
        except Exception as e:
            logger.error(f"Import failed: {str(e)}")
            return {
                'success': False,
                'progress': self.progress.to_dict(),
                'error': str(e)
            }
    
    # ==================== DIRECTORIES ====================
    
    def _import_currencies(self, currencies: List[Dict]) -> None:
        """Import currencies"""
        self.progress.total += len(currencies)
        
        for curr_data in currencies:
            try:
                code = curr_data.get('code')
                if not code:
                    self.progress.skipped += 1
                    continue
                
                # Check if exists
                currency, created = Currency.objects.update_or_create(
                    tenant=self.tenant,
                    code=code,
                    defaults={
                        'name': curr_data.get('name', code),
                        'symbol': curr_data.get('symbol', code),
                        'is_active': True
                    }
                )
                
                self._currency_cache[code] = currency
                
                if created:
                    self.progress.created += 1
                else:
                    self.progress.updated += 1
                
                self.progress.processed += 1
                
            except Exception as e:
                self.progress.errors.append(f"Currency {curr_data.get('code')}: {str(e)}")
                self.progress.processed += 1
    
    def _import_warehouses(self, warehouses: List[Dict]) -> None:
        """Import warehouses"""
        self.progress.total += len(warehouses)
        
        for wh_data in warehouses:
            try:
                code = wh_data.get('code')
                if not code:
                    self.progress.skipped += 1
                    continue
                
                warehouse, created = Warehouse.objects.update_or_create(
                    tenant=self.tenant,
                    code=code,
                    defaults={
                        'name': wh_data.get('name', code),
                        'is_active': True
                    }
                )
                
                self._warehouse_cache[code] = warehouse
                
                if created:
                    self.progress.created += 1
                else:
                    self.progress.updated += 1
                
                self.progress.processed += 1
                
            except Exception as e:
                self.progress.errors.append(f"Warehouse {wh_data.get('code')}: {str(e)}")
                self.progress.processed += 1
    
    def _import_units(self, units: List[Dict]) -> None:
        """Import units of measure - DISABLED (Unit model doesn't exist)"""
        # Skipping units import - model doesn't exist in current schema
        self.progress.total += len(units)
        self.progress.skipped += len(units)
        logger.info(f"Skipped {len(units)} units (Unit model не существует)")
    
    def _import_counterparties(self, counterparties: List[Dict]) -> None:
        """Import counterparties (customers/suppliers)"""
        self.progress.total += len(counterparties)
        
        for cp_data in counterparties:
            try:
                code = cp_data.get('code')
                if not code:
                    self.progress.skipped += 1
                    continue
                
                counterparty, created = Counterparty.objects.update_or_create(
                    tenant=self.tenant,
                    code=code,
                    defaults={
                        'name': cp_data.get('name', code),
                        'full_name': cp_data.get('full_name', cp_data.get('name', code)),
                        'type': cp_data.get('type', 'both'),  # customer, supplier, both
                        'is_active': True
                    }
                )
                
                self._counterparty_cache[code] = counterparty
                
                if created:
                    self.progress.created += 1
                else:
                    self.progress.updated += 1
                
                self.progress.processed += 1
                
            except Exception as e:
                self.progress.errors.append(f"Counterparty {cp_data.get('code')}: {str(e)}")
                self.progress.processed += 1
    
    def _import_items(self, items: List[Dict]) -> None:
        """Import items (products/goods)"""
        self.progress.total += len(items)
        
        for item_data in items:
            try:
                sku = item_data.get('sku')
                if not sku:
                    self.progress.skipped += 1
                    continue
                
                # Skipping unit assignment - Unit model doesn't exist
                # unit_code = item_data.get('unit_code', 'шт')
                
                item, created = Item.objects.update_or_create(
                    tenant=self.tenant,
                    sku=sku,
                    defaults={
                        'name': item_data.get('name', sku),
                        # 'unit': unit,  # Skipped - Unit model doesn't exist
                        'type': item_data.get('type', 'product'),
                        'is_active': True
                    }
                )
                
                self._item_cache[sku] = item
                
                if created:
                    self.progress.created += 1
                else:
                    self.progress.updated += 1
                
                self.progress.processed += 1
                
            except Exception as e:
                self.progress.errors.append(f"Item {item_data.get('sku')}: {str(e)}")
                self.progress.processed += 1
    
    # ==================== DOCUMENTS ====================
    
    def _import_documents(self, documents: List[Dict]) -> None:
        """Import documents (sales, purchases, payments)"""
        self.progress.total += len(documents)
        
        for doc_data in documents:
            try:
                doc_type = doc_data.get('type')
                
                if doc_type == 'sale':
                    self._import_sale_document(doc_data)
                elif doc_type == 'purchase':
                    self._import_purchase_document(doc_data)
                elif doc_type == 'payment':
                    self._import_payment_document(doc_data)
                else:
                    logger.warning(f"Unknown document type: {doc_type}")
                    self.progress.skipped += 1
                
                self.progress.processed += 1
                
            except Exception as e:
                self.progress.errors.append(f"Document {doc_data.get('number')}: {str(e)}")
                self.progress.processed += 1
    
    def _import_sale_document(self, doc_data: Dict) -> None:
        """Import sales document"""
        # Skip if already exists
        if SalesDocument.objects.filter(tenant=self.tenant, number=doc_data['number']).exists():
            self.progress.skipped += 1
            return
        
        # Get counterparty
        cp_code = doc_data.get('counterparty_code')
        counterparty = self._counterparty_cache.get(cp_code)
        if not counterparty:
            raise ValueError(f"Counterparty not found: {cp_code}")
        
        # Get warehouse
        wh_code = doc_data.get('warehouse_code')
        warehouse = self._warehouse_cache.get(wh_code)
        if not warehouse:
            raise ValueError(f"Warehouse not found: {wh_code}")
        
        # Get currency
        curr_code = doc_data.get('currency_code', 'USD')
        currency = self._currency_cache.get(curr_code)
        if not currency:
            currency = Currency.objects.get(tenant=self.tenant, code=curr_code)
            self._currency_cache[curr_code] = currency
        
        # Create document
        doc = SalesDocument.objects.create(
            tenant=self.tenant,
            number=doc_data['number'],
            date=doc_data['date'],
            counterparty=counterparty,
            warehouse=warehouse,
            currency=currency,
            status='draft',  # Import as draft
            comment=doc_data.get('comment', '')
        )
        
        # Create lines
        for line_data in doc_data.get('lines', []):
            item_sku = line_data.get('item_sku')
            item = self._item_cache.get(item_sku)
            if not item:
                logger.warning(f"Item not found: {item_sku}, skipping line")
                continue
            
            SalesLine.objects.create(
                document=doc,
                item=item,
                quantity=Decimal(str(line_data['quantity'])),
                price_foreign=Decimal(str(line_data.get('price', 0))),
                price_base=Decimal(str(line_data.get('price', 0)))
            )
        
        self.progress.created += 1
    
    def _import_purchase_document(self, doc_data: Dict) -> None:
        """Import purchase document"""
        if PurchaseDocument.objects.filter(tenant=self.tenant, number=doc_data['number']).exists():
            self.progress.skipped += 1
            return
        
        # Get counterparty
        cp_code = doc_data.get('counterparty_code')
        counterparty = self._counterparty_cache.get(cp_code)
        if not counterparty:
            raise ValueError(f"Counterparty not found: {cp_code}")
        
        # Get warehouse
        wh_code = doc_data.get('warehouse_code')
        warehouse = self._warehouse_cache.get(wh_code)
        if not warehouse:
            raise ValueError(f"Warehouse not found: {wh_code}")
        
        # Get currency
        curr_code = doc_data.get('currency_code', 'USD')
        currency = self._currency_cache.get(curr_code)
        if not currency:
            currency = Currency.objects.get(tenant=self.tenant, code=curr_code)
            self._currency_cache[curr_code] = currency
            
        # Create document
        doc = PurchaseDocument.objects.create(
            tenant=self.tenant,
            number=doc_data['number'],
            date=doc_data['date'],
            counterparty=counterparty,
            warehouse=warehouse,
            currency=currency,
            status='draft',
            comment=doc_data.get('comment', '')
        )
        
        # Create lines
        for line_data in doc_data.get('lines', []):
            item_sku = line_data.get('item_sku')
            item = self._item_cache.get(item_sku)
            if not item:
                logger.warning(f"Item not found: {item_sku}, skipping line")
                continue
            
            PurchaseDocumentLine.objects.create(
                document=doc,
                item=item,
                quantity=Decimal(str(line_data['quantity'])),
                price=Decimal(str(line_data.get('price', 0))),
                amount=Decimal(str(line_data.get('amount', 0))),
                vat_rate=Decimal(str(line_data.get('vat_rate', 0))),
                vat_amount=Decimal(str(line_data.get('vat_amount', 0))),
                total_with_vat=Decimal(str(line_data.get('total', 0)))
            )
        
        self.progress.created += 1
    
    def _import_payment_document(self, doc_data: Dict) -> None:
        """Import payment document"""
        # Simplified implementation
        # TODO: Full payment document logic
        self.progress.skipped += 1
    
    # ==================== OPENING BALANCES ====================
    
    def _import_balances(self, balances: Dict) -> None:
        """Import opening balances"""
        # 1. Stock Balances
        stock_balances = balances.get('stock', [])
        if stock_balances:
            # Group by warehouse to create separate documents (optional but cleaner)
            from collections import defaultdict
            by_warehouse = defaultdict(list)
            for b in stock_balances:
                by_warehouse[b.get('warehouse_code')].append(b)
            
            for wh_code, lines in by_warehouse.items():
                warehouse = self._warehouse_cache.get(wh_code)
                if not warehouse:
                    logger.warning(f"Warehouse {wh_code} not found for balances")
                    continue
                
                # Create Opening Balance Document for Stock
                doc = OpeningBalanceDocument.objects.create(
                    tenant=self.tenant,
                    operation_type=OpeningBalanceDocument.OPERATION_STOCK,
                    warehouse=warehouse,
                    date='2026-01-01',  # Default to start of year
                    status='draft',
                    comment=f"Imported Stock Balance {wh_code}"
                )
                
                for line_data in lines:
                    item_sku = line_data.get('sku')
                    item = self._item_cache.get(item_sku)
                    if not item:
                        continue
                        
                    OpeningBalanceStockLine.objects.create(
                        document=doc,
                        item=item,
                        quantity=Decimal(str(line_data['quantity'])),
                        price=Decimal(str(line_data.get('price', 0))),
                        amount=Decimal(str(line_data.get('amount', 0)))
                    )
                
                self.progress.created += 1
                self.progress.processed += len(lines)

        # 2. Settlement Balances
        settlement_balances = balances.get('settlements', [])
        if settlement_balances:
            doc = OpeningBalanceDocument.objects.create(
                tenant=self.tenant,
                operation_type=OpeningBalanceDocument.OPERATION_SETTLEMENT,
                date='2026-01-01',
                status='draft',
                comment="Imported Settlement Balances"
            )
            
            for line_data in settlement_balances:
                cp_code = line_data.get('counterparty_code')
                counterparty = self._counterparty_cache.get(cp_code)
                if not counterparty:
                    continue
                
                OpeningBalanceSettlementLine.objects.create(
                    document=doc,
                    counterparty=counterparty,
                    type='receivable' if line_data.get('amount') > 0 else 'payable',
                    amount=abs(Decimal(str(line_data.get('amount', 0))))
                )
            
            self.progress.created += 1
            self.progress.processed += len(settlement_balances)

