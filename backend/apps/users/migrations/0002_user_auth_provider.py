from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='auth_provider',
            field=models.CharField(
                choices=[('email', 'E-mail'), ('microsoft', 'Microsoft')],
                default='email',
                max_length=20,
            ),
        ),
    ]
