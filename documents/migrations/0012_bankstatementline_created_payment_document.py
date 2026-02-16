# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0011_alter_bankstatementline_options_cashorder'),
    ]

    operations = [
        migrations.AddField(
            model_name='bankstatementline',
            name='created_payment_document',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='bank_statement_line',
                to='documents.paymentdocument',
                verbose_name='Created Payment Document'
            ),
        ),
    ]
