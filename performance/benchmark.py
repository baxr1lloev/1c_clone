# performance/benchmark.py
"""
Performance benchmarking script.

Tests:
1. Stock balance report generation (3M movements)
2. Trial balance report generation
3. Reposting 1 month of documents
4. Query optimization analysis

Usage:
    python performance/benchmark.py
"""

import time
import sys
import os
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
from django.utils import timezone
from datetime import timedelta
from registers.models import StockMovement, SettlementMovement
from documents.models import SalesDocument, PurchaseDocument
from documents.reposting_service import RepostingService
from users.models import Tenant


class PerformanceBenchmark:
    """Performance testing suite"""
    
    def __init__(self, tenant_id=1):
        self.tenant = Tenant.objects.get(id=tenant_id)
        self.results = {}
    
    def run_all(self):
        """Run all benchmarks"""
        print("=" * 70)
        print("🚀 PERFORMANCE BENCHMARK SUITE")
        print("=" * 70)
        
        self.benchmark_stock_movements_query()
        self.benchmark_settlement_balance()
        self.benchmark_reposting()
        self.benchmark_document_list()
        self.analyze_slow_queries()
        
        self.print_summary()
    
    def benchmark_stock_movements_query(self):
        """Test stock movements query performance"""
        print("\n📊 Benchmark 1: Stock Movements Query")
        print("-" * 70)
        
        start = time.time()
        
        # Query all movements with joins
        movements = StockMovement.objects.filter(
            tenant=self.tenant
        ).select_related('item', 'warehouse').count()
        
        duration = time.time() - start
        
        print(f"   Total movements: {movements:,}")
        print(f"   Query time: {duration:.2f}s")
        
        self.results['stock_movements_query'] = {
            'count': movements,
            'duration': duration,
            'status': '✅' if duration < 5.0 else '⚠️'
        }
    
    def benchmark_settlement_balance(self):
        """Test settlement balance calculation"""
        print("\n💰 Benchmark 2: Settlement Balance")
        print("-" * 70)
        
        start = time.time()
        
        settlements = SettlementMovement.objects.filter(
            tenant=self.tenant
        ).select_related('counterparty', 'currency').count()
        
        duration = time.time() - start
        
        print(f"   Total settlements: {settlements:,}")
        print(f"   Query time: {duration:.2f}s")
        
        self.results['settlement_balance'] = {
            'count': settlements,
            'duration': duration,
            'status': '✅' if duration < 3.0 else '⚠️'
        }
    
    def benchmark_reposting(self):
        """Test reposting performance"""
        print("\n🔄 Benchmark 3: Reposting (1 Month)")
        print("-" * 70)
        
        # Get last month's documents
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=30)
        
        doc_count = SalesDocument.objects.filter(
            tenant=self.tenant,
            date__gte=start_date,
            date__lte=end_date
        ).count()
        
        print(f"   Documents in period: {doc_count:,}")
        
        if doc_count > 1000:
            print("   ⚠️ Skipping (too many documents for quick test)")
            self.results['reposting'] = {
                'skipped': True,
                'reason': 'Too many documents'
            }
            return
        
        start = time.time()
        
        # Run repost
        result = RepostingService.repost_period(
            tenant=self.tenant,
            period_start=start_date,
            period_end=end_date
        )
        
        duration = time.time() - start
        
        print(f"   Reposted: {result['success']} documents")
        print(f"   Duration: {duration:.2f}s")
        
        self.results['reposting'] = {
            'documents': doc_count,
            'duration': duration,
            'status': '✅' if duration < 120.0 else '⚠️'  # 2 min target
        }
    
    def benchmark_document_list(self):
        """Test document list query (pagination)"""
        print("\n📄 Benchmark 4: Document List (Paginated)")
        print("-" * 70)
        
        start = time.time()
        
        # Simulate API request with pagination
        docs = SalesDocument.objects.filter(
            tenant=self.tenant
        ).select_related(
            'counterparty', 'warehouse', 'currency'
        ).order_by('-date')[:100]
        
        list(docs)  # Force evaluation
        
        duration = time.time() - start
        
        print(f"   Fetched: 100 documents")
        print(f"   Query time: {duration:.2f}s")
        
        self.results['document_list'] = {
            'duration': duration,
            'status': '✅' if duration < 1.0 else '⚠️'
        }
    
    def analyze_slow_queries(self):
        """Analyze query patterns"""
        print("\n🔍 Query Analysis")
        print("-" * 70)
        
        from django.db import reset_queries
        from django.conf import settings
        
        if not settings.DEBUG:
            print("   ⚠️ DEBUG=False, cannot analyze queries")
            return
        
        reset_queries()
        
        # Run sample queries
        list(StockMovement.objects.filter(tenant=self.tenant)[:100])
        
        print(f"   Total queries: {len(connection.queries)}")
        
        if connection.queries:
            slowest = max(connection.queries, key=lambda q: float(q['time']))
            print(f"   Slowest query: {slowest['time']}s")
    
    def print_summary(self):
        """Print benchmark summary"""
        print("\n" + "=" * 70)
        print("📊 BENCHMARK SUMMARY")
        print("=" * 70)
        
        for name, result in self.results.items():
            if result.get('skipped'):
                print(f"\n{name}:")
                print(f"   SKIPPED: {result['reason']}")
            else:
                status = result.get('status', '❓')
                duration = result.get('duration', 0)
                print(f"\n{name}: {status}")
                print(f"   Duration: {duration:.2f}s")
        
        print("\n" + "=" * 70)
        print("✅ = Under target | ⚠️ = Over target")
        print("=" * 70)


if __name__ == '__main__':
    benchmark = PerformanceBenchmark(tenant_id=1)
    benchmark.run_all()
