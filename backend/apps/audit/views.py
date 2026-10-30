from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from django.http import HttpResponse
from datetime import timedelta
import csv

from .models import AuditLog
from .serializers import AuditLogSerializer, AuditLogListSerializer
from .utils import sanitize_csv_cell


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
        
        is_global_admin = self.request.user.is_staff or self.request.user.is_superuser
        org_id = self.request.query_params.get('organization_id')

        # Organization scoping & Authorization
        if not is_global_admin:
            if not org_id:
                # Regular users MUST supply an organization_id to view logs,
                # otherwise return nothing to prevent cross-tenant data leakage
                return AuditLog.objects.none()
                
            from apps.organizations.models import OrganizationRole
            is_org_admin = OrganizationRole.objects.filter(
                user=self.request.user,
                organization_id=org_id,
                role='Admin',
                is_active=True
            ).exists()
            
            if not is_org_admin:
                return AuditLog.objects.none()
                
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by action
        action_param = self.request.query_params.get('action')
        if action_param:
            queryset = queryset.filter(action__icontains=action_param)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(datetime__gte=start_date)
        if end_date:
            queryset = queryset.filter(datetime__lte=end_date)
        
        # Filter by IP
        ip_address = self.request.query_params.get('ip_address')
        if ip_address:
            queryset = queryset.filter(ip_address=ip_address)
            
        # General search query
        q = self.request.query_params.get('q')
        if q:
            queryset = queryset.filter(
                Q(action__icontains=q) |
                Q(ip_address__icontains=q) |
                Q(user_id__email__icontains=q) |
                Q(user_id__first_name__icontains=q) |
                Q(user_id__last_name__icontains=q)
            )
        
        return queryset.select_related('user_id', 'organization_id').order_by('-datetime')
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent audit logs (last 100)"""
        logs = self.get_queryset()[:100]
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
        
        logs = self.get_queryset().filter(user_id=user_id)
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
        
        logs = self.get_queryset().filter(
            datetime__range=[start_date, end_date]
        )
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
        
        logs = self.get_queryset().filter(
            Q(action__icontains=keyword) |
            Q(ip_address__icontains=keyword) |
            Q(user_id__email__icontains=keyword)
        )
        
        serializer = AuditLogListSerializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get audit log statistics"""
        from django.db.models import Count
        
        base_qs = self.get_queryset()
        
        # Total count
        total = base_qs.count()
        
        # Today's count
        today = timezone.now().date()
        today_count = base_qs.filter(datetime__date=today).count()
        
        # Count by action type (top 10)
        action_counts = dict(
            base_qs.values('action')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
            .values_list('action', 'count')
        )
        
        # Count by user (top 10)
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
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="audit_log_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Timestamp', 'User Name', 'User Email', 'Action', 'IP Address'])
        
        for log in queryset:
            writer.writerow([
                sanitize_csv_cell(log.datetime.strftime('%Y-%m-%d %H:%M:%S')),
                sanitize_csv_cell(log.user_id.get_full_name() if log.user_id else 'System'),
                sanitize_csv_cell(log.user_id.email if log.user_id else 'N/A'),
                sanitize_csv_cell(log.action),
                sanitize_csv_cell(log.ip_address or 'N/A')
            ])
            
        return response
