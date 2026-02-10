# Generated manually for document chain feature

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('documents', '0015_productiondocument_productionmaterialline_and_more'),
    ]

    operations = [
        # Add base_document fields to SalesDocument
        migrations.AddField(
            model_name='salesdocument',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='salesdocument',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='salesdocument_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to PurchaseDocument
        migrations.AddField(
            model_name='purchasedocument',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='purchasedocument',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='purchasedocument_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to PaymentDocument
        migrations.AddField(
            model_name='paymentdocument',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='paymentdocument',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='paymentdocument_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to TransferDocument
        migrations.AddField(
            model_name='transferdocument',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='transferdocument',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transferdocument_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to SalesOrder
        migrations.AddField(
            model_name='salesorder',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='salesorder',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='salesorder_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to InventoryDocument
        migrations.AddField(
            model_name='inventorydocument',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='inventorydocument',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventorydocument_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to BankStatement
        migrations.AddField(
            model_name='bankstatement',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='bankstatement',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bankstatement_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to CashOrder
        migrations.AddField(
            model_name='cashorder',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='cashorder',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cashorder_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to PayrollDocument
        migrations.AddField(
            model_name='payrolldocument',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='payrolldocument',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payrolldocument_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
        
        # Add base_document fields to ProductionDocument
        migrations.AddField(
            model_name='productiondocument',
            name='base_document_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Base Document ID'),
        ),
        migrations.AddField(
            model_name='productiondocument',
            name='base_document_type',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='productiondocument_based_on', to='contenttypes.contenttype', verbose_name='Base Document Type'),
        ),
    ]
