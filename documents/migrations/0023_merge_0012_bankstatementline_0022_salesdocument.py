# Generated manually - Merge migration

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0012_bankstatementline_created_payment_document'),
        ('documents', '0022_salesdocument_rate_back'),
    ]

    operations = [
        # Empty merge migration - just resolves the conflict
    ]
