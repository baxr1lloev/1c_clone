from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum

from accounting.models import AccountingEntry
from documents.models import CashOrder


class CashBookService:
    """Cash Book report service (Kasovaya kniga)."""

    @staticmethod
    def get_report(tenant, start_date, end_date):
        opening_balance = CashBookService._get_opening_balance(tenant, start_date)

        posted_orders = (
            CashOrder.objects.filter(
                tenant=tenant,
                status=CashOrder.STATUS_POSTED,
                date__date__gte=start_date,
                date__date__lte=end_date,
            )
            .select_related("currency", "counterparty")
            .order_by("date", "id")
        )

        grouped = defaultdict(list)
        for order in posted_orders:
            grouped[order.date.date()].append(order)

        rows = []
        current_balance = opening_balance
        current_date = start_date
        total_receipts = Decimal("0")
        total_payments = Decimal("0")

        while current_date <= end_date:
            day_orders = grouped.get(current_date, [])
            day_receipts = sum(
                (o.amount for o in day_orders if o.order_type == CashOrder.TYPE_INCOMING),
                Decimal("0"),
            )
            day_payments = sum(
                (o.amount for o in day_orders if o.order_type == CashOrder.TYPE_OUTGOING),
                Decimal("0"),
            )
            day_opening = current_balance
            day_closing = day_opening + day_receipts - day_payments

            total_receipts += day_receipts
            total_payments += day_payments

            rows.append(
                {
                    "date": current_date,
                    "opening_balance": day_opening,
                    "receipts": day_receipts,
                    "payments": day_payments,
                    "closing_balance": day_closing,
                    "documents": [
                        {
                            "id": order.id,
                            "number": order.number,
                            "order_type": order.order_type,
                            "counterparty_name": order.counterparty_name,
                            "purpose": order.purpose,
                            "amount": order.amount,
                            "currency_code": order.currency.code if order.currency else "",
                        }
                        for order in day_orders
                    ],
                }
            )

            current_balance = day_closing
            current_date += timedelta(days=1)

        return {
            "period": {"start_date": start_date, "end_date": end_date},
            "opening_balance": opening_balance,
            "total_receipts": total_receipts,
            "total_payments": total_payments,
            "closing_balance": current_balance,
            "rows": rows,
        }

    @staticmethod
    def _get_opening_balance(tenant, start_date):
        debit_total = (
            AccountingEntry.objects.filter(
                tenant=tenant,
                date__date__lt=start_date,
                debit_account__code__startswith="50",
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        credit_total = (
            AccountingEntry.objects.filter(
                tenant=tenant,
                date__date__lt=start_date,
                credit_account__code__startswith="50",
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        return debit_total - credit_total
