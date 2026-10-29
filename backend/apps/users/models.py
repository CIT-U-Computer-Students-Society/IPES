from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import FileExtensionValidator
from .storage import avatar_storage

class User(AbstractUser):
    email = models.EmailField(unique=True)

    # AbstractUser already includes: username, email, first_name, last_name, password, is_active
    display_picture = models.ImageField(
        upload_to='users/pictures/', blank=True, null=True,
        storage=avatar_storage,
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'webp'])],
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return self.email
