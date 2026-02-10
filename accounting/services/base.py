"""
Base QueryService for read operations (CQRS-lite pattern).

This module provides the foundation for separating READ from WRITE operations.
"""
from django.db.models import QuerySet
from django.core.cache import cache
from typing import Dict, Any, Optional, Callable
from functools import wraps
import hashlib
import json


class BaseQueryService:
    """
    Base class for all QueryServices.
    
    Purpose:
    - Optimize read queries (select_related, prefetch_related, annotations)
    - Cache expensive results
    - Provide clean, testable API for views
    - Separate read logic from write logic (CQRS-lite)
    
    Usage:
        class MyQueryService(BaseQueryService):
            cache_timeout = 300
            
            @classmethod
            def get_dashboard_data(cls, tenant):
                cache_key = cls.get_cache_key('dashboard', tenant.id)
                return cls.get_cached(cache_key, cls._query_dashboard, tenant)
    """
    
    cache_timeout = 300  # 5 minutes default
    cache_prefix = 'query_service'
    
    @classmethod
    def get_cache_key(cls, *args, **kwargs) -> str:
        """
        Generate deterministic cache key from arguments.
        
        Args:
            *args: Positional arguments (converted to string)
            **kwargs: Keyword arguments (sorted for consistency)
        
        Returns:
            Cache key string (e.g., "query_service:VATQueryService:dashboard:1:2024-01")
        """
        parts = [cls.cache_prefix, cls.__name__]
        
        # Add args
        for arg in args:
            parts.append(str(arg))
        
        # Add sorted kwargs
        for k, v in sorted(kwargs.items()):
            parts.append(f"{k}={v}")
        
        key = ":".join(parts)
        
        # Hash if too long
        if len(key) > 200:
            key_hash = hashlib.md5(key.encode()).hexdigest()
            return f"{cls.cache_prefix}:{cls.__name__}:{key_hash}"
        
        return key
    
    @classmethod
    def get_cached(cls, cache_key: str, query_func: Callable, *args, **kwargs) -> Any:
        """
        Get from cache or execute query function.
        
        Args:
            cache_key: Cache key to use
            query_func: Function to execute if cache miss
            *args, **kwargs: Arguments for query_func
        
        Returns:
            Cached or freshly queried data
        """
        result = cache.get(cache_key)
        
        if result is None:
            # Cache miss - execute query
            result = query_func(*args, **kwargs)
            cache.set(cache_key, result, cls.cache_timeout)
        
        return result
    
    @classmethod
    def invalidate_cache(cls, *args, **kwargs):
        """
        Invalidate specific cache key.
        
        Args:
            *args, **kwargs: Same arguments used in get_cache_key
        """
        cache_key = cls.get_cache_key(*args, **kwargs)
        cache.delete(cache_key)
    
    @classmethod
    def invalidate_pattern(cls, pattern: str):
        """
        Invalidate all cache keys matching pattern.
        
        Note: Requires Redis backend with delete_pattern support.
        For simple cache backends, use invalidate_cache for specific keys.
        
        Args:
            pattern: Pattern to match (e.g., "query_service:VATQueryService:*")
        """
        try:
            # Try Redis-specific method
            cache.delete_pattern(pattern)
        except AttributeError:
            # Fallback: no-op (requires manual invalidation)
            pass
    
    @classmethod
    def clear_all_cache(cls):
        """Clear all cache for this QueryService"""
        cls.invalidate_pattern(f"{cls.cache_prefix}:{cls.__name__}:*")


def cached_query(timeout: Optional[int] = None):
    """
    Decorator for caching query methods.
    
    Usage:
        @cached_query(timeout=180)
        @classmethod
        def get_dashboard(cls, tenant):
            return expensive_query()
    
    Args:
        timeout: Cache timeout in seconds (None = use class default)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(cls, *args, **kwargs):
            cache_timeout = timeout or cls.cache_timeout
            cache_key = cls.get_cache_key(func.__name__, *args, **kwargs)
            
            result = cache.get(cache_key)
            if result is None:
                result = func(cls, *args, **kwargs)
                cache.set(cache_key, result, cache_timeout)
            
            return result
        return wrapper
    return decorator
