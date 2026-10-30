import csv
import ipaddress
from datetime import datetime, time, timedelta

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.organizations.models import OrganizationRole
from apps.validation import positive_id
from .models import AuditLog
from .serializers import AuditLogListSerializer, AuditLogSerializer
from .utils import sanitize_csv_cell


def parse_audit_date_bound(raw_value, field_name, is_end_bound=False):
    """Parse a date or datetime bound; date-only end bounds include the day."""
    if not isinstance(raw_value, str) or not raw_value.strip():
        raise serializers.ValidationError({
            field_name: 'Enter a valid date or datetime.'
        })

    val = raw_value.strip()
    has_time = 'T' in val or (' ' in val and ':' in val)
    try:
        if not has_time:
            day = parse_date(val)
            if day is not None:
                if is_end_bound:
                    day += timedelta(days=1)
                bound = timezone.make_aware(
                    datetime.combine(day, time.min),
                    timezone.get_current_timezone(),
                )
                return bound, '__lt' if is_end_bound else '__gte'

        dt = parse_datetime(val)
        if dt is not None:
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            return dt, '__lte' if is_end_bound else '__gte'
    except (ValueError, OverflowError) as exc:
        raise serializers.ValidationError({
            field_name: f'Enter a valid date or datetime for {field_name}.'
        }) from exc

    raise serializers.ValidationError({
        field_name: f'Enter a valid date or datetime for {field_name}.'
    })


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing audit logs - Admin only access
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter audit logs based on user role and parameters"""
        queryset = AuditLog.objects.all()

        user = self.request.user
        is_global_admin = user.is_staff or user.is_superuser
        header_org = self.request.headers.get('X-Organization-Id')
        if header_org is not None and str(header_org).strip() == '':
            header_org = None
        query_org = self.request.query_params.get('organization_id')
        if query_org is not None and str(query_org).strip() == '':
            query_org = None

        if header_org and query_org and str(header_org) != str(query_org):
            raise ValidationError({
                'organization_id': (
                    'Organization header and parameter must match.'
                )
            })

        raw_org = query_org or header_org
        org_id = positive_id(raw_org, 'organization_id') if raw_org else None

        # Organization scoping & Authorization
        if not is_global_admin:
            if not org_id:
                # Regular users/org admins must specify or pass organization,
                # otherwise return nothing to prevent cross-tenant data leakage
                return AuditLog.objects.none()

            is_org_admin = OrganizationRole.objects.filter(
                user=self.request.user,
                organization_id=org_id,
                role='Admin',
                is_active=True,
                organization__is_active=True,
            ).exists()
            if not is_org_admin:
                return AuditLog.objects.none()

            queryset = queryset.filter(organization_id=org_id)
        else:
            if org_id:
                queryset = queryset.filter(organization_id=org_id)

        # Filter by user
        raw_user_id = self.request.query_params.get('user_id')
        if raw_user_id is not None:
            user_id = positive_id(raw_user_id, 'user_id')
            queryset = queryset.filter(user_id=user_id)

        # Filter by action
        action_param = self.request.query_params.get('action')
        if action_param:
            queryset = queryset.filter(action__icontains=action_param)

        # Filter by date range
        start_date_param = self.request.query_params.get('start_date')
        end_date_param = self.request.query_params.get('end_date')

        start_dt = None
        start_lookup = None
        end_dt = None
        end_lookup = None

        if start_date_param:
            start_dt, start_lookup = parse_audit_date_bound(
                start_date_param, 'start_date', is_end_bound=False
            )
        if end_date_param:
            end_dt, end_lookup = parse_audit_date_bound(
                end_date_param, 'end_date', is_end_bound=True
            )

        if start_dt and end_dt:
            if start_dt > end_dt or (start_dt == end_dt and end_lookup == '__lt'):
                raise serializers.ValidationError({
                    'end_date': 'end_date must be on or after start_date.'
                })

        if start_dt:
            queryset = queryset.filter(**{f'datetime{start_lookup}': start_dt})
        if end_dt:
            queryset = queryset.filter(**{f'datetime{end_lookup}': end_dt})

        # Filter by IP address
        ip_param = self.request.query_params.get('ip_address')
        if ip_param:
            ip_val = ip_param.strip()
            try:
                ipaddress.ip_address(ip_val)
            except ValueError:
                raise serializers.ValidationError({
                    'ip_address': 'Enter a valid IPv4 or IPv6 address.'
                })
            queryset = queryset.filter(ip_address=ip_val)

        # Search on the server before pagination, within the authorized tenant.
        keyword = self.request.query_params.get('q')
        if keyword:
            queryset = queryset.filter(
                Q(action__icontains=keyword) |
                Q(ip_address__icontains=keyword) |
                Q(user_id__email__icontains=keyword)
            )

        return queryset.order_by('-datetime')

    def get_serializer_class(self):
        """Use lightweight serializer for list view"""
        if self.action == 'list':
            return AuditLogListSerializer
        return AuditLogSerializer

    @action(detail=False, methods=['get'])
    def actions(self, request):
        """Get list of distinct actions in the audit log"""
        actions = self.get_queryset().values_list(
            'action', flat=True
        ).distinct().order_by('action')
        return Response(list(actions))

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent audit logs (last 50)"""
        logs = self.get_queryset()[:50]
        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_user(self, request):
        """Get audit logs for a specific user"""
        user_id = request.query_params.get('user_id')

        if not user_id:
            return Response(
                {'error': 'user_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logs = self.get_queryset()
        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_action(self, request):
        """Get audit logs by action type"""
        action_param = request.query_params.get('action')

        if not action_param:
            return Response(
                {'error': 'action parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logs = self.get_queryset().filter(
            action__icontains=action_param
        )
        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_date(self, request):
        """Get audit logs within a date range"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not start_date or not end_date:
            return Response(
                {'error': 'start_date and end_date parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logs = self.get_queryset()
        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's audit logs"""
        today = timezone.now().date()
        logs = self.get_queryset().filter(
            datetime__date=today
        )

        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def this_week(self, request):
        """Get this week's audit logs"""
        week_ago = timezone.now() - timedelta(days=7)
        logs = self.get_queryset().filter(
            datetime__gte=week_ago
        )

        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search audit logs by keyword"""
        keyword = request.query_params.get('q')

        if not keyword:
            return Response(
                {'error': 'q (search query) parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logs = self.get_queryset()

        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get audit log statistics"""
        base_qs = self.get_queryset()

        total = base_qs.count()

        today = timezone.now().date()
        today_count = base_qs.filter(datetime__date=today).count()

        action_counts = dict(
            base_qs.values('action')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
            .values_list('action', 'count')
        )

        user_counts = dict(
            base_qs.values('user_id__email')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
            .values_list('user_id__email', 'count')
        )

        return Response({
            'total': total,
            'today': today_count,
            'by_action': action_counts,
            'by_user': user_counts
        })

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export audit logs to CSV"""
        queryset = self.get_queryset()

        now_str = timezone.now().strftime("%Y%m%d_%H%M%S")
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="audit_log_{now_str}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow([
            'Timestamp', 'User Name', 'User Email', 'Action', 'IP Address'
        ])

        for log in queryset:
            writer.writerow([
                sanitize_csv_cell(log.datetime.strftime('%Y-%m-%d %H:%M:%S')),
                sanitize_csv_cell(
                    log.user_id.get_full_name() if log.user_id else 'System'
                ),
                sanitize_csv_cell(log.user_id.email if log.user_id else 'N/A'),
                sanitize_csv_cell(log.action),
                sanitize_csv_cell(log.ip_address or 'N/A')
            ])

        return response
