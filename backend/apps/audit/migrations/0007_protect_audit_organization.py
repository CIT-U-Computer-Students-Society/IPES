from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('audit', '0006_audit_organization_datetime_index'),
    ]

    operations = [
        migrations.AlterField(
            model_name='auditlog',
            name='organization_id',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name='audit_logs', to='organizations.organization',
            ),
        ),
    ]
