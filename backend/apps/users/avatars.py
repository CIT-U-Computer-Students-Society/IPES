import logging
import warnings
from io import BytesIO
from uuid import uuid4

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

logger = logging.getLogger(__name__)
MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_AVATAR_PIXELS = 16_000_000


def prepare_avatar(upload):
    """Re-encode uploads without their metadata or original name."""
    if upload.size > MAX_AVATAR_BYTES:
        raise serializers.ValidationError(
            'Choose an image smaller than 2 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            upload.seek(0)
            with Image.open(upload) as image:
                if image.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise serializers.ValidationError(
                        'Use a JPEG, PNG, or WebP image.')
                if image.width * image.height > MAX_AVATAR_PIXELS:
                    raise serializers.ValidationError(
                        'Image dimensions are too large.')
                image = ImageOps.exif_transpose(image)
                image = ImageOps.fit(image.convert('RGB'), (256, 256))
                output = BytesIO()
                image.save(output, format='WEBP', quality=80)
    except (
        UnidentifiedImageError, OSError, ValueError,
        Image.DecompressionBombError, Image.DecompressionBombWarning,
    ) as exc:
        raise serializers.ValidationError(
            'Choose a valid image.') from exc
    return ContentFile(output.getvalue(), name=f'{uuid4().hex}.webp')


def delete_avatar(storage, name):
    """A cleanup failure must not undo a successfully saved profile."""
    try:
        storage.delete(name)
    except Exception:
        logger.exception('Could not delete superseded avatar %s', name)
