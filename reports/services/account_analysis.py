from decimal import Decimal
from django.db.models import Sum, Q, F
from accounting.models import AccountingEntry, ChartOfAccounts

class AccountAnalysisService:
    """
    Service for "Account Analysis" (Анализ счёта).
    Provides breakdown of account balance and turnover by dimensions (Subconto).
    
    Example:
    Account 62 (Settlements with Buyers)
    Breakdown by: Counterparty (Subconto 1)
    
    Result:
    | Counterparty | Opening Dr | Opening Cr | Turn Dr | Turn Cr | Closing Dr | Closing Cr |
    |--------------|------------|------------|---------|---------|------------|------------|
    | Client A     | 100        | 0          | 50      | 20      | 130        | 0          |
    | Client B     | 0          | 50         | 0       | 50      | 0          | 100        |
    """

    @staticmethod
    def get_analysis(tenant, account_id, start_date, end_date, group_by='counterparty'):
        """
        Get account analysis grouped by a dimension.
        
        Args:
            tenant: Tenant instance
            account_id: ID of ChartOfAccounts
            start_date: Start of period
            end_date: End of period
            group_by: Field name to group by (counterparty, contract, item, warehouse, etc.)
            
        Returns:
            List of dicts with grouped data.
        """
        # Validate group_by field exists on AccountingEntry
        valid_fields = ['counterparty', 'contract', 'warehouse', 'item', 'project', 'department', 'employee']
        if group_by not in valid_fields:
            raise ValueError(f"Invalid group_by field: {group_by}")

        account = ChartOfAccounts.objects.get(id=account_id, tenant=tenant)
        
        # 1. Fetch distinct groupings (Subcontos) involved in this account's entries
        # We need all subcontos that have EITHER opening balance OR turnover.
        
        # Optimization: Fetch IDs first
        # Debit side
        qs_debit = AccountingEntry.objects.filter(
            tenant=tenant,
            debit_account=account,
            date__lte=end_date
        ).values_list(group_by, flat=True).distinct()
        
        # Credit side
        qs_credit = AccountingEntry.objects.filter(
            tenant=tenant,
            credit_account=account,
            date__lte=end_date
        ).values_list(group_by, flat=True).distinct()
        
        # Union of IDs
        all_ids = set(qs_debit) | set(qs_credit)
        # Remove None if present (entries without subconto)
        if None in all_ids:
            all_ids.remove(None)
            
        # TODO: Handle "Empty" subconto grouping
            
        results = []
        
        # 2. Iterate and calculate for each group
        # Note: In high-volume systems, this loop should be replaced by a single aggregation query.
        # But Django ORM aggregation with conditional sums across self-joins is complex.
        # For now, we iterate over active subcontos (usually < 1000 per account per month).
        
        for group_id in all_ids:
            # 2.1 Calculate Opening Balance (date < start_date)
            op_debit = AccountingEntry.objects.filter(
                tenant=tenant,
                debit_account=account,
                date__lt=start_date,
                **{group_by: group_id}
            ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            
            op_credit = AccountingEntry.objects.filter(
                tenant=tenant,
                credit_account=account,
                date__lt=start_date,
                **{group_by: group_id}
            ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            
            # 2.2 Calculate Turnover (start <= date <= end)
            turn_debit = AccountingEntry.objects.filter(
                tenant=tenant,
                debit_account=account,
                date__gte=start_date,
                date__lte=end_date,
                **{group_by: group_id}
            ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            
            turn_credit = AccountingEntry.objects.filter(
                tenant=tenant,
                credit_account=account,
                date__gte=start_date,
                date__lte=end_date,
                **{group_by: group_id}
            ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0')
            
            # 2.3 Calculate Closing
            # Logic depends on account type, but we perform "passive/active" normalization
            # Net Opening
            net_op = op_debit - op_credit
            
            # Net Activity
            net_activity = turn_debit - turn_credit
            
            # Net Closing
            net_closing = net_op + net_activity
            
            # Display logic
            row = {
                'group_id': group_id,
                'group_name': 'Unknown', # To be filled
                'opening_debit': max(net_op, 0) if net_op > 0 else 0,
                'opening_credit': abs(net_op) if net_op < 0 else 0,
                'turnover_debit': turn_debit,
                'turnover_credit': turn_credit,
                'closing_debit': max(net_closing, 0) if net_closing > 0 else 0,
                'closing_credit': abs(net_closing) if net_closing < 0 else 0,
            }
            results.append(row)
            
        # 3. Resolve Names
        if results:
            model_map = {
                'counterparty': 'directories.Counterparty',
                'contract': 'directories.Contract',
                'item': 'directories.Item',
                'warehouse': 'directories.Warehouse',
                'project': 'directories.Project',
                'department': 'directories.Department',
                'employee': 'directories.Employee'
            }
            
            from django.apps import apps
            Model = apps.get_model(model_map[group_by])
            
            # Bulk fetch names
            ids = [r['group_id'] for r in results]
            objects = Model.objects.filter(id__in=ids).in_bulk()
            
            for row in results:
                obj = objects.get(row['group_id'])
                if obj:
                    row['group_name'] = str(obj)
                    
        # Sort by name
        results.sort(key=lambda x: x['group_name'])
        
        return results
