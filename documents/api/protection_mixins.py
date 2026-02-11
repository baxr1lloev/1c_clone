from rest_framework.exceptions import ValidationError

class PostedDocumentProtectionMixin:
    """
    Mixin to prevent editing or deleting posted documents.
    
    1C Logic:
    - Posted documents are IMMUTABLE.
    - To edit: Unpost first (if allowed).
    - To delete: Mark for deletion (future) or Unpost then Delete.
    """
    
    def perform_update(self, serializer):
        """
        Prevent updates to posted documents.
        """
        instance = serializer.instance
        
        # Check if document is posted
        if getattr(instance, 'status', None) == 'posted':
            raise ValidationError(
                {"detail": "Cannot edit a posted document. Unpost it first."}
            )
            
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        """
        Prevent deletion of posted documents.
        """
        # Check if document is posted
        if getattr(instance, 'status', None) == 'posted':
            raise ValidationError(
                {"detail": "Cannot delete a posted document. Unpost it first."}
            )
            
        super().perform_destroy(instance)
