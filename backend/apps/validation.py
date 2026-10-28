"""Translate model validation into API errors, including partial updates."""

from copy import copy
from math import isfinite

from django.core.exceptions import ValidationError as ModelValidationError
from rest_framework import serializers


def positive_id(value, field_name):
    text = str(value)
    if not text.isascii() or not text.isdigit() or len(text) > 10 or not 1 <= int(text) <= 2147483647:
        raise serializers.ValidationError({field_name: 'A positive 32-bit integer ID is required.'})
    return int(text)


class FiniteFloatField(serializers.FloatField):
    def to_internal_value(self, data):
        if isinstance(data, bool):
            self.fail('invalid')
        value = super().to_internal_value(data)
        if not isfinite(value):
            self.fail('invalid')
        return value


class ValidatedModelSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = copy(self.instance) if self.instance else self.Meta.model()
        for name, value in attrs.items():
            if name != 'questions':
                setattr(instance, name, value)
        try:
            instance.clean()
        except ModelValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs
