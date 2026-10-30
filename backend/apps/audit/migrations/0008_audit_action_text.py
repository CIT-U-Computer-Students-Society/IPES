from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('audit', '0007_protect_audit_organization'),
    ]

    operations = [
        migrations.AlterField(
            model_name='auditlog',
            name='action',
            field=models.TextField(),
        ),
    ]
