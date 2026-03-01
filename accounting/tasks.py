from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

@shared_task
def calculate_trial_balance_task(tenant_id, period_str):
    """
    Асинхронный расчет Оборотно-сальдовой ведомости (ОСВ).
    period_str должен быть в формате 'YYYY-MM-01'.
    """
    from accounting.models import TrialBalance
    from tenants.models import Tenant
    from datetime import datetime

    logger.info(f"Starting async Trial Balance calculation for tenant {tenant_id}, period {period_str}")
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        period = datetime.strptime(period_str, '%Y-%m-%d').date()
        
        # Вызов тяжелого синхронного метода в фоне
        TrialBalance.calculate_for_period(tenant, period)
        
        logger.info(f"Successfully calculated Trial Balance for tenant {tenant_id}, period {period_str}")
        return {"status": "success", "tenant_id": tenant_id, "period": period_str}
    except Exception as e:
        logger.error(f"Error calculating Trial Balance: {str(e)}")
        # Raise exceptions to allow Celery to mark the task as failed or retry.
        raise


@shared_task
def close_period_task(tenant_id, period_str, user_id, reason):
    """
    Асинхронное закрытие периода. 
    В 1С это может занимать часы.
    """
    from accounting.models import PeriodClosing
    from tenants.models import Tenant
    from accounts.models import User
    from datetime import datetime

    logger.info(f"Starting async Period Closing for tenant {tenant_id}, period {period_str}")
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        user = User.objects.get(id=user_id)
        period = datetime.strptime(period_str, '%Y-%m-%d').date()
        
        closing = PeriodClosing.objects.get(tenant=tenant, period=period)
        closing.close_period(user=user, reason=reason)
        
        logger.info(f"Successfully closed period {period_str} for tenant {tenant_id}")
        return {"status": "success", "tenant_id": tenant_id, "period": period_str}
    except Exception as e:
        logger.error(f"Error closing period: {str(e)}")
        raise
