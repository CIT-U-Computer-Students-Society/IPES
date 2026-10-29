from django.core.files.storage import storages


def avatar_storage():
    """Keep private avatars separate from organization file storage."""
    return storages['avatars']
