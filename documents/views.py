from django.views.generic import ListView, CreateView, DetailView, View, UpdateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect, get_object_or_404
from django.urls import reverse_lazy, reverse
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from .models import (
    SalesDocument, SalesDocumentLine, 
    PurchaseDocument, PurchaseDocumentLine, 
    PaymentDocument, 
    TransferDocument, TransferDocumentLine,
    SalesOrder, SalesOrderLine,
    InventoryDocument, InventoryDocumentLine
)
from .forms import (
    SalesDocumentForm, SalesDocumentLineForm, 
    PurchaseDocumentForm, PurchaseDocumentLineForm, 
    PaymentDocumentForm, 
    TransferDocumentForm, TransferDocumentLineForm,
    SalesOrderForm, SalesOrderLineForm,
    InventoryDocumentForm, InventoryDocumentLineForm
)
from .services import DocumentPostingService
from django.http import JsonResponse
from directories.models import Warehouse, Item
from registers.reservation_service import ReservationService

class TenantAwareMixin:
    def get_queryset(self):
        return super().get_queryset().filter(tenant=self.request.user.tenant)
    def form_valid(self, form):
        form.instance.tenant = self.request.user.tenant
        return super().form_valid(form)

class SalesDocumentListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = SalesDocument
    template_name = 'documents/sales_list.html'
    context_object_name = 'documents'
    ordering = ['-date']

class SalesDocumentCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = SalesDocument
    form_class = SalesDocumentForm
    template_name = 'directories/form.html' # Reusing generic form
    extra_context = {'title': 'New Sales Document'}
    
    extra_context = {'title': 'New Sales Document'}
    
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['tenant'] = self.request.user.tenant
        return kwargs
    
    def get_success_url(self):
        return reverse('documents:sales_detail', kwargs={'pk': self.object.pk})

class SalesDocumentUpdateView(LoginRequiredMixin, TenantAwareMixin, UpdateView):
    model = SalesDocument
    form_class = SalesDocumentForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'Edit Sales Document'}
    
    def dispatch(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status != 'draft':
            messages.error(request, "Cannot edit posted documents!")
            return redirect('documents:sales_detail', pk=obj.pk)
        return super().dispatch(request, *args, **kwargs)
        
    def get_success_url(self):
        return reverse('documents:sales_detail', kwargs={'pk': self.object.pk})


class SalesDocumentDetailView(LoginRequiredMixin, TenantAwareMixin, DetailView):
    model = SalesDocument
    template_name = 'documents/sales_detail.html'
    context_object_name = 'doc'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Pass warehouse and tenant to show available qty
        context['line_form'] = SalesDocumentLineForm(
            warehouse=self.object.warehouse,
            tenant=self.object.tenant,
            document=self.object
        )
        return context
    
    def post(self, request, *args, **kwargs):
        # Handle adding lines
        self.object = self.get_object()
        # Pass warehouse/tenant when validating POST data too
        form = SalesDocumentLineForm(
            request.POST, 
            warehouse=self.object.warehouse,
            tenant=self.object.tenant,
            document=self.object
        )
        if form.is_valid():
            line = form.save(commit=False)
            line.document = self.object
            # Calculate amount automatically
            line.amount = line.quantity * line.price
            line.save()
            
            # Update Header Total
            # self.object.total_amount += line.amount -> Moved to model save() recalculation
            # self.object.save()
            
            messages.success(request, 'Line added.')
            return redirect('documents:sales_detail', pk=self.object.pk)
        
        # If invalid, re-render
        context = self.get_context_data()
        context['line_form'] = form
        return self.render_to_response(context)

class SalesDocumentPostView(LoginRequiredMixin, View):
    """Action to Post the document (trigger registers)."""
    
    def post(self, request, pk):
        # Permission check
        from tenants.permissions import PermissionService
        if not PermissionService.user_has_permission(request.user, 'documents.post'):
            messages.error(request, 'You do not have permission to post documents')
            return redirect('documents:sales_detail', pk=pk)
        
        doc = get_object_or_404(SalesDocument, pk=pk, tenant=request.user.tenant)
        
        try:
            # Use the new model method
            doc.post(user=request.user)
            
            # Audit
            from core.audit_service import AuditService
            AuditService.log_post(request.user, doc, request)
            
            messages.success(request, f'✓ Document #{doc.number} posted successfully! Accounting entries created.')
        except Exception as e:
            messages.error(request, f'❌ Error posting document: {str(e)}')
        return redirect('documents:sales_detail', pk=pk)


class SalesDocumentUnpostView(LoginRequiredMixin, View):
    """Action to Unpost the document (reverse registers)."""
    
    def post(self, request, pk):
        # Permission check
        from tenants.permissions import PermissionService
        if not PermissionService.user_has_permission(request.user, 'documents.unpost'):
            messages.error(request, 'You do not have permission to unpost documents')
            return redirect('documents:sales_detail', pk=pk)
        
        doc = get_object_or_404(SalesDocument, pk=pk, tenant=request.user.tenant)
        
        try:
            # Use the new model method
            doc.unpost()
            
            # Audit
            from core.audit_service import AuditService
            AuditService.log_unpost(request.user, doc, request)
            
            messages.success(request, f'⊗ Document #{doc.number} unposted successfully. Accounting entries deleted.')
        except Exception as e:
            messages.error(request, f'❌ Error unposting document: {str(e)}')
        return redirect('documents:sales_detail', pk=pk)

# --- Purchase Documents ---

class PurchaseDocumentListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = PurchaseDocument
    template_name = 'documents/purchase_list.html'
    context_object_name = 'documents'
    ordering = ['-date']

class PurchaseDocumentCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = PurchaseDocument
    form_class = PurchaseDocumentForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'New Purchase Interface'}
    
    extra_context = {'title': 'New Purchase Interface'}
    
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['tenant'] = self.request.user.tenant
        return kwargs
    
    def get_success_url(self):
        return reverse('documents:purchase_detail', kwargs={'pk': self.object.pk})

class PurchaseDocumentUpdateView(LoginRequiredMixin, TenantAwareMixin, UpdateView):
    model = PurchaseDocument
    form_class = PurchaseDocumentForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'Edit Purchase'}
    
    def dispatch(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status != 'draft':
            messages.error(request, "Cannot edit posted documents!")
            return redirect('documents:purchase_detail', pk=obj.pk)
        return super().dispatch(request, *args, **kwargs)

    def get_success_url(self):
        return reverse('documents:purchase_detail', kwargs={'pk': self.object.pk})


class PurchaseDocumentDetailView(LoginRequiredMixin, TenantAwareMixin, DetailView):
    model = PurchaseDocument
    template_name = 'documents/purchase_detail.html'
    context_object_name = 'doc'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['line_form'] = PurchaseDocumentLineForm(
            document=self.object,
            tenant=self.object.tenant
        )
        return context
    
    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        form = PurchaseDocumentLineForm(
            request.POST,
            document=self.object,
            tenant=self.object.tenant
        )
        if form.is_valid():
            line = form.save(commit=False)
            line.document = self.object
            # Price base is calculated in model check
            line.amount = line.quantity * line.price
            line.save()
            line.save()
            # self.object.total_amount += line.amount -> Moved to model save()
            # self.object.save()
            return redirect('documents:purchase_detail', pk=self.object.pk)
        context = self.get_context_data()
        context['line_form'] = form
        return self.render_to_response(context)

class PurchaseDocumentPostView(LoginRequiredMixin, View):
    def post(self, request, pk):
        # Permission check
        from tenants.permissions import PermissionService
        if not PermissionService.user_has_permission(request.user, 'documents.post'):
            messages.error(request, 'You do not have permission to post documents')
            return redirect('documents:purchase_detail', pk=pk)
        
        doc = get_object_or_404(PurchaseDocument, pk=pk, tenant=request.user.tenant)
        
        if doc.status != 'draft':
            messages.error(request, 'Only draft documents can be posted')
            return redirect('documents:purchase_detail', pk=pk)
        
        try:
            # Use the new model method that creates batches
            doc.post(user=request.user)
            
            # Audit
            from core.audit_service import AuditService
            AuditService.log_post(request.user, doc, request)
            
            messages.success(request, f'✓ Purchase #{doc.number} posted successfully! Batches created for FIFO costing.')
        except Exception as e:
            messages.error(request, f'❌ Error posting document: {str(e)}')
        return redirect('documents:purchase_detail', pk=pk)


class PurchaseDocumentUnpostView(LoginRequiredMixin, View):
    def post(self, request, pk):
        # Permission check
        from tenants.permissions import PermissionService
        if not PermissionService.user_has_permission(request.user, 'documents.unpost'):
            messages.error(request, 'You do not have permission to unpost documents')
            return redirect('documents:purchase_detail', pk=pk)
        
        doc = get_object_or_404(PurchaseDocument, pk=pk, tenant=request.user.tenant)
        
        if doc.status != 'posted':
            messages.error(request, 'Only posted documents can be unposted')
            return redirect('documents:purchase_detail', pk=pk)
        
        try:
            # Use the new model method that deletes batches
            doc.unpost()
            
            # Audit
            from core.audit_service import AuditService
            AuditService.log_unpost(request.user, doc, request)
            
            messages.success(request, f'⊗ Purchase #{doc.number} unposted successfully. Batches deleted.')
        except Exception as e:
            messages.error(request, f'❌ Error unposting document: {str(e)}')
        return redirect('documents:purchase_detail', pk=pk)

class SalesDocumentLineDeleteView(LoginRequiredMixin, TenantAwareMixin, View):
    def post(self, request, pk):
        line = get_object_or_404(SalesDocumentLine, pk=pk, document__tenant=request.user.tenant)
        doc = line.document
        if doc.status != 'draft':
             messages.error(request, "Cannot delete lines from posted documents.")
             return redirect('documents:sales_detail', pk=doc.pk)
             
        # Update header total
        doc.total_amount -= line.amount
        doc.save()
        
        line.delete()
        messages.success(request, "Line removed.")
        return redirect('documents:sales_detail', pk=doc.pk)

class PurchaseDocumentLineDeleteView(LoginRequiredMixin, TenantAwareMixin, View):
    def post(self, request, pk):
        line = get_object_or_404(PurchaseDocumentLine, pk=pk, document__tenant=request.user.tenant)
        doc = line.document
        if doc.status != 'draft':
             messages.error(request, "Cannot delete lines from posted documents.")
             return redirect('documents:purchase_detail', pk=doc.pk)
             
        doc.total_amount -= line.amount
        doc.save()
        
        line.delete()
        messages.success(request, "Line removed.")
        return redirect('documents:purchase_detail', pk=doc.pk)


# --- Payment Documents ---

class PaymentDocumentListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = PaymentDocument
    template_name = 'documents/payment_list.html'
    context_object_name = 'documents'
    ordering = ['-date']

class PaymentDocumentCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = PaymentDocument
    form_class = PaymentDocumentForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'New Payment'}
    
    def get_success_url(self):
        # Payments are usually simple (header only) unless split
        return reverse('documents:payment_list')

# --- Transfer Documents ---

class TransferDocumentListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = TransferDocument
    template_name = 'documents/transfer_list.html'
    context_object_name = 'documents'
    ordering = ['-date']

class TransferDocumentCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = TransferDocument
    form_class = TransferDocumentForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'New Transfer'}
    
    def get_success_url(self):
        return reverse('documents:transfer_detail', kwargs={'pk': self.object.pk})

class TransferDocumentDetailView(LoginRequiredMixin, TenantAwareMixin, DetailView):
    model = TransferDocument
    template_name = 'documents/transfer_detail.html'
    context_object_name = 'doc'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['line_form'] = TransferDocumentLineForm()
        return context
    
    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        form = TransferDocumentLineForm(request.POST)
        if form.is_valid():
            line = form.save(commit=False)
            line.document = self.object
            line.save()
            # No header total to update for Transfer? 
            # Actually, transfers don't change 'Total Amount' in currency usually, 
            # they move generic quantity.
            messages.success(request, 'Line added.')
            return redirect('documents:transfer_detail', pk=self.object.pk)
        context = self.get_context_data()
        context['line_form'] = form
        return self.render_to_response(context)

class TransferDocumentPostView(LoginRequiredMixin, View):
    def post(self, request, pk):
        doc = get_object_or_404(TransferDocument, pk=pk, tenant=request.user.tenant)
        try:
            DocumentPostingService.post_transfer_document(doc)
            messages.success(request, f'Transfer #{doc.number} posted successfully!')
        except ValueError as e:
            messages.error(request, str(e))
        return redirect('documents:transfer_detail', pk=pk)

# --- Sales Orders ---

class SalesOrderListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = SalesOrder
    template_name = 'documents/sales_order_list.html'
    context_object_name = 'documents'
    ordering = ['-date']

class SalesOrderCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = SalesOrder
    form_class = SalesOrderForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'New Sales Order'}
    
    def get_success_url(self):
        return reverse('documents:sales_order_detail', kwargs={'pk': self.object.pk})

class SalesOrderDetailView(LoginRequiredMixin, TenantAwareMixin, DetailView):
    model = SalesOrder
    template_name = 'documents/sales_order_detail.html'
    context_object_name = 'doc'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Pass warehouse and tenant to show available qty
        context['line_form'] = SalesOrderLineForm(
            warehouse=self.object.warehouse,
            tenant=self.object.tenant
        )
        return context
    
    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        form = SalesOrderLineForm(
            request.POST,
            warehouse=self.object.warehouse,
            tenant=self.object.tenant
        )
        if form.is_valid():
            line = form.save(commit=False)
            line.order = self.object
            line.amount = line.quantity * line.price
            line.save()
            
            # Orders usually track total amount too
            # self.object.total_amount += line.amount -> Moved to model save() recalculation
            # self.object.save()
            
            messages.success(request, 'Line added.')
            return redirect('documents:sales_order_detail', pk=self.object.pk)
        
        context = self.get_context_data()
        context['line_form'] = form
        return self.render_to_response(context)

class SalesOrderPostView(LoginRequiredMixin, View):
    def post(self, request, pk):
        doc = get_object_or_404(SalesOrder, pk=pk, tenant=request.user.tenant)
        try:
            DocumentPostingService.post_sales_order(doc)
            messages.success(request, f'Order #{doc.number} posted (Stock Reserved)!')
        except ValueError as e:
            messages.error(request, str(e))
        return redirect('documents:sales_order_detail', pk=pk)

class SalesOrderUnpostView(LoginRequiredMixin, View):
    def post(self, request, pk):
        doc = get_object_or_404(SalesOrder, pk=pk, tenant=request.user.tenant)
        try:
            DocumentPostingService.unpost_sales_order(doc)
            messages.success(request, f'Order #{doc.number} unposted (Reservations Released).')
        except ValueError as e:
            messages.error(request, str(e))
        return redirect('documents:sales_order_detail', pk=pk)

class SalesOrderLineDeleteView(LoginRequiredMixin, TenantAwareMixin, View):
    def post(self, request, pk):
        line = get_object_or_404(SalesOrderLine, pk=pk, order__tenant=request.user.tenant)
        order = line.order
        if order.status != 'draft':
             messages.error(request, "Cannot delete lines from posted orders.")
             return redirect('documents:sales_order_detail', pk=order.pk)
             
        line.delete()
        # Total recalculated by signal/delete method in model
        
        messages.success(request, "Line removed.")
        return redirect('documents:sales_order_detail', pk=order.pk)


# --- Inventory Documents ---

class InventoryDocumentListView(LoginRequiredMixin, TenantAwareMixin, ListView):
    model = InventoryDocument
    template_name = 'documents/inventory_list.html'
    context_object_name = 'documents'
    ordering = ['-date']

class InventoryDocumentCreateView(LoginRequiredMixin, TenantAwareMixin, CreateView):
    model = InventoryDocument
    form_class = InventoryDocumentForm
    template_name = 'directories/form.html'
    extra_context = {'title': 'New Inventory Count'}
    
    def get_success_url(self):
        return reverse('documents:inventory_detail', kwargs={'pk': self.object.pk})

class InventoryDocumentDetailView(LoginRequiredMixin, TenantAwareMixin, DetailView):
    model = InventoryDocument
    template_name = 'documents/inventory_detail.html'
    context_object_name = 'doc'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Pass warehouse and tenant to show book qty
        context['line_form'] = InventoryDocumentLineForm(
            warehouse=self.object.warehouse,
            tenant=self.object.tenant
        )
        return context
    
    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        form = InventoryDocumentLineForm(
            request.POST,
            warehouse=self.object.warehouse,
            tenant=self.object.tenant
        )
        if form.is_valid():
            line = form.save(commit=False)
            line.document = self.object
            
            # Recalculate difference just in case
            if line.quantity_actual and line.quantity_book:
                line.difference = line.quantity_actual - line.quantity_book
                
            line.save()
            messages.success(request, 'Line added.')
            return redirect('documents:inventory_detail', pk=self.object.pk)
        
        context = self.get_context_data()
        context['line_form'] = form
        return self.render_to_response(context)

class InventoryDocumentPostView(LoginRequiredMixin, View):
    def post(self, request, pk):
        # Implementation depends on posting service having inventory support
        # We can implement basic posting or just mark as posted for now
        # messages.warning(request, "Inventory posting logic not yet fully implemented in service.")
        # Actually DocumentPostingService has post_inventory_document? 
        # Let's check service or add it. For now just placeholder logic.
        messages.info(request, "Inventory posting implemented in next step.")
        return redirect('documents:inventory_detail', pk=pk)

def get_availability(request):
    """
    API endpoint to get available quantity for an item in a warehouse.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    warehouse_id = request.GET.get('warehouse')
    item_id = request.GET.get('item')
    
    if not warehouse_id or not item_id:
        return JsonResponse({'available': 0})
        
    try:
        tenant = request.user.tenant
        warehouse = Warehouse.objects.get(pk=warehouse_id, tenant=tenant)
        item = Item.objects.get(pk=item_id, tenant=tenant)
        
        # Validate availability with 0 qty just to get current stats
        stats = ReservationService.validate_availability(tenant, warehouse, item, 0)
        
        return JsonResponse({
            'available': float(stats['available']),
            'physical': float(stats['physical_stock']),
            'reserved': float(stats['reserved'])
        })
    except (Warehouse.DoesNotExist, Item.DoesNotExist):
        return JsonResponse({'available': 0, 'physical': 0, 'reserved': 0})
