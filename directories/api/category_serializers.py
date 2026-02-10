from rest_framework import serializers
from directories.models import ItemCategory

class ItemCategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    
    class Meta:
        model = ItemCategory
        fields = ['id', 'name', 'code', 'parent', 'children']
        
    def get_children(self, obj):
        children = obj.children.all()
        return ItemCategorySerializer(children, many=True).data
