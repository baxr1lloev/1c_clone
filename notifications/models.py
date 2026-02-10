from django.db import models
from django.utils.translation import gettext_lazy as _
from accounts.models import User

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(_('Title'), max_length=100)
    message = models.TextField(_('Message'))
    link = models.CharField(_('Link'), max_length=255, blank=True)
    is_read = models.BooleanField(_('Read'), default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"To {self.user}: {self.title}"

    class Meta:
        verbose_name = _('Notification')
        verbose_name_plural = _('Notifications')
        ordering = ['-created_at']
