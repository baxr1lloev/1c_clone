"""
Clean all business data but keep users, tenants, chart of accounts, and currencies.

Run from project root:
    python manage.py clean_data

Optional confirmation:
    python manage.py clean_data --no-input  # skip confirmation (e.g. for scripts)
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Remove all documents, registers, and directory data; keep users, tenants, chart of accounts, currencies"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-input",
            action="store_true",
            help="Do not ask for confirmation",
        )

    def handle(self, *args, **options):
        if not options.get("no_input"):
            confirm = input(
                "This will DELETE all documents, stock, settlements, items, counterparties, "
                "contracts, warehouses, and accounting entries. Users and tenants will be kept. "
                "Type 'yes' to continue: "
            )
            if confirm.strip().lower() != "yes":
                self.stdout.write("Aborted.")
                return

        with transaction.atomic():
            self._delete_registers()
            self._delete_document_lines_and_documents()
            self._delete_accounting_data()
            self._delete_vat_and_invoice_data()
            self._delete_directories()
            self._delete_fixed_assets_if_present()

        self.stdout.write(self.style.SUCCESS("Clean finished. Users and tenants are unchanged."))

    def _delete_registers(self):
        self.stdout.write("Deleting registers...")
        from registers.models import (
            StockReservation,
            StockMovement,
            StockBalance,
            StockBatch,
            SettlementMovement,
            SettlementsBalance,
            GoodsInTransit,
            CounterpartyStockBalance,
        )
        StockReservation.objects.all().delete()
        StockMovement.objects.all().delete()
        StockBalance.objects.all().delete()
        StockBatch.objects.all().delete()
        SettlementMovement.objects.all().delete()
        SettlementsBalance.objects.all().delete()
        GoodsInTransit.objects.all().delete()
        CounterpartyStockBalance.objects.all().delete()

    def _delete_document_lines_and_documents(self):
        self.stdout.write("Deleting documents and lines...")
        from documents.models import (
            SalesDocumentLine,
            SalesDocument,
            PurchaseDocumentLine,
            PurchaseDocument,
            PaymentDocument,
            TransferDocumentLine,
            TransferDocument,
            InventoryDocumentLine,
            InventoryDocument,
            SalesOrderLine,
            SalesOrder,
            BankStatementLine,
            BankStatement,
            PayrollDocumentLine,
            PayrollDocument,
            ProductionProductLine,
            ProductionMaterialLine,
            ProductionDocument,
            OpeningBalanceDocument,
            OpeningBalanceStockLine,
            OpeningBalanceSettlementLine,
        )
        from documents.models import CashOrder  # may exist

        SalesDocumentLine.objects.all().delete()
        SalesDocument.objects.all().delete()
        PurchaseDocumentLine.objects.all().delete()
        PurchaseDocument.objects.all().delete()
        PaymentDocument.objects.all().delete()
        TransferDocumentLine.objects.all().delete()
        TransferDocument.objects.all().delete()
        InventoryDocumentLine.objects.all().delete()
        InventoryDocument.objects.all().delete()
        SalesOrderLine.objects.all().delete()
        SalesOrder.objects.all().delete()
        BankStatementLine.objects.all().delete()
        BankStatement.objects.all().delete()
        PayrollDocumentLine.objects.all().delete()
        PayrollDocument.objects.all().delete()
        ProductionProductLine.objects.all().delete()
        ProductionMaterialLine.objects.all().delete()
        ProductionDocument.objects.all().delete()
        OpeningBalanceStockLine.objects.all().delete()
        OpeningBalanceSettlementLine.objects.all().delete()
        OpeningBalanceDocument.objects.all().delete()
        try:
            CashOrder.objects.all().delete()
        except Exception:
            pass

    def _delete_accounting_data(self):
        self.stdout.write("Deleting accounting entries and period closing...")
        try:
            from accounting.models import (
                AccountingEntry,
                PeriodClosing,
                PeriodClosingLog,
                Operation,
                TrialBalance,
            )
            AccountingEntry.objects.all().delete()
            PeriodClosingLog.objects.all().delete()
            PeriodClosing.objects.all().delete()
            Operation.objects.all().delete()
            TrialBalance.objects.all().delete()
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Accounting cleanup: {e}"))

    def _delete_vat_and_invoice_data(self):
        """Remove VAT/electronic invoice data that references counterparties."""
        self.stdout.write("Deleting VAT and electronic invoice data...")
        try:
            from accounting.vat import (
                ElectronicInvoice,
                VATTransaction,
                VATDeclaration,
                ESoliqIntegrationLog,
            )
            # Break circular ref: VATTransaction.electronic_invoice -> ElectronicInvoice
            VATTransaction.objects.all().update(electronic_invoice=None)
            ESoliqIntegrationLog.objects.all().delete()
            ElectronicInvoice.objects.all().delete()
            VATTransaction.objects.all().delete()
            VATDeclaration.objects.all().delete()
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"VAT cleanup: {e}"))

    def _delete_directories(self):
        self.stdout.write("Deleting directory data...")
        from directories.models import (
            ItemPackage,
            Item,
            ExchangeRate,
            Contract,
            ContactPerson,
            Counterparty,
            Warehouse,
            BankAccount,
            Employee,
            Department,
            Project,
        )
        from directories.category_model import ItemCategory
        ItemPackage.objects.all().delete()
        Item.objects.all().delete()
        ItemCategory.objects.all().delete()
        ExchangeRate.objects.all().delete()
        Contract.objects.all().delete()
        ContactPerson.objects.all().delete()
        Counterparty.objects.all().delete()
        Warehouse.objects.all().delete()
        BankAccount.objects.all().delete()
        Employee.objects.all().delete()
        Department.objects.all().delete()
        Project.objects.all().delete()

    def _delete_fixed_assets_if_present(self):
        self.stdout.write("Deleting fixed assets data (if any)...")
        try:
            from fixed_assets.models import (
                DepreciationSchedule,
                AmortizationSchedule,
                FAAcceptanceDocument,
                FADisposalDocument,
                FAReceiptDocument,
                IAAcceptanceDocument,
                IADisposalDocument,
                IAReceiptDocument,
                FixedAsset,
                IntangibleAsset,
                FixedAssetCategory,
                IntangibleAssetCategory,
            )
            DepreciationSchedule.objects.all().delete()
            AmortizationSchedule.objects.all().delete()
            FAAcceptanceDocument.objects.all().delete()
            FADisposalDocument.objects.all().delete()
            FAReceiptDocument.objects.all().delete()
            IAAcceptanceDocument.objects.all().delete()
            IADisposalDocument.objects.all().delete()
            IAReceiptDocument.objects.all().delete()
            FixedAsset.objects.all().delete()
            IntangibleAsset.objects.all().delete()
            FixedAssetCategory.objects.all().delete()
            IntangibleAssetCategory.objects.all().delete()
        except Exception:
            pass
