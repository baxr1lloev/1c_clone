# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('directories', '0013_bankoperationtype'),
        ('documents', '0024_bankstatementline_operation_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='paymentdocument',
            name='bank_operation_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='payments', to='directories.bankoperationtype'),
        ),
    ]
