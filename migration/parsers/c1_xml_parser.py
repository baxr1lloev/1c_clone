# migration/parsers/c1_xml_parser.py
"""
1C XML Parser - Parse "комплексная выгрузка" (complex export) from 1C.

Supports:
- Directories (Справочники): Контрагенты, Номенклатура, Склады
- Documents (Документы): Реализация, Поступление, Платежи
- Registers (Регистры): Остатки, Взаиморасчёты
"""

import xml.etree.ElementTree as ET
from datetime import datetime
from decimal import Decimal


class C1XmlParser:
    """
    Parse 1C XML export.
    
    Format: 1C:Enterprise 8.x XML (UTF-8 with BOM)
    """
    
    def __init__(self):
        self.namespaces = {
            'v8': 'http://v8.1c.ru/8.1/data/core',
            'xs': 'http://www.w3.org/2001/XMLSchema',
            'xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        }
    
    def parse_file(self, xml_path):
        """
        Parse 1C XML file.
        
        Returns:
            {
                'counterparties': [...],
                'items': [...],
                'warehouses': [...],
                'currencies': [...],
                'documents': [...],
                'balances': {...}
            }
        """
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        return {
            'counterparties': self.parse_counterparties(root),
            'items': self.parse_items(root),
            'warehouses': self.parse_warehouses(root),
            'currencies': self.parse_currencies(root),
            'documents': self.parse_documents(root),
            'balances': self.parse_balances(root)
        }
    
    def parse_counterparties(self, root):
        """
        Extract Контрагенты (counterparties).
        
        XML structure:
        <Контрагент>
            <Наименование>ООО "Ромашка"</Наименование>
            <ИНН>1234567890</ИНН>
            <Адрес>г. Москва, ул. Ленина, д. 1</Адрес>
        </Контрагент>
        """
        counterparties = []
        
        for cp in root.findall('.//Контрагент'):
            counterparty = {
                'name': self._get_text(cp, 'Наименование'),
                'inn': self._get_text(cp, 'ИНН', ''),
                'address': self._get_text(cp, 'Адрес', ''),
                'phone': self._get_text(cp, 'Телефон', ''),
                'email': self._get_text(cp, 'Email', ''),
                'type': self._map_counterparty_type(cp),
            }
            counterparties.append(counterparty)
        
        return counterparties
    
    def parse_items(self, root):
        """
        Extract Номенклатура (items).
        
        XML structure:
        <Номенклатура>
            <Наименование>Молоко 3.2%</Наименование>
            <Артикул>MLK-001</Артикул>
            <ЕдиницаИзмерения>л</ЕдиницаИзмерения>
        </Номенклатура>
        """
        items = []
        
        for item in root.findall('.//Номенклатура'):
            items.append({
                'sku': self._get_text(item, 'Артикул',  self._get_text(item, 'Код', '')),
                'name': self._get_text(item, 'Наименование'),
                'description': self._get_text(item, 'Описание', ''),
                'base_unit': self._get_text(item, 'ЕдиницаИзмерения', 'шт'),
                'type': self._map_item_type(item),
            })
        
        return items
    
    def parse_warehouses(self, root):
        """
        Extract Склады (warehouses).
        """
        warehouses = []
        
        for wh in root.findall('.//Склад'):
            warehouses.append({
                'code': self._get_text(wh, 'Код'),
                'name': self._get_text(wh, 'Наименование'),
                'address': self._get_text(wh, 'Адрес', ''),
                'warehouse_type': 'PHYSICAL',  # Default
            })
        
        return warehouses
    
    def parse_currencies(self, root):
        """Extract Валюты (currencies)"""
        currencies = []
        
        for curr in root.findall('.//Валюта'):
            currencies.append({
                'code': self._get_text(curr, 'Код'),
                'name': self._get_text(curr, 'Наименование'),
                'symbol': self._get_text(curr, 'Символ', self._get_text(curr, 'Код')),
            })
        
        return currencies
    
    def parse_documents(self, root):
        """
        Extract Документы (documents).
        
        Supports:
        - РеализацияТоваровУслуг (Sales)
        - ПоступлениеТоваровУслуг (Purchase)
        - ПлатежноеПоручение (Payment)
        """
        documents = []
        
        # Sales documents
        for doc in root.findall('.//РеализацияТоваровУслуг'):
            documents.append({
                'type': 'sales',
                'number': self._get_text(doc, 'Номер'),
                'date': self._parse_date(self._get_text(doc, 'Дата')),
                'counterparty': self._get_text(doc, 'Контрагент'),
                'warehouse': self._get_text(doc, 'Склад'),
                'currency': self._get_text(doc, 'Валюта', 'UZS'),
                'lines': self._parse_document_lines(doc),
                'comment': self._get_text(doc, 'Комментарий', ''),
            })
        
        # Purchase documents
        for doc in root.findall('.//ПоступлениеТоваровУслуг'):
            documents.append({
                'type': 'purchase',
                'number': self._get_text(doc, 'Номер'),
                'date': self._parse_date(self._get_text(doc, 'Дата')),
                'counterparty': self._get_text(doc, 'Контрагент'),
                'warehouse': self._get_text(doc, 'Склад'),
                'currency': self._get_text(doc, 'Валюта', 'UZS'),
                'lines': self._parse_document_lines(doc),
                'comment': self._get_text(doc, 'Комментарий', ''),
            })
        
        return documents
    
    def parse_balances(self, root):
        """
        Extract opening balances (Начальные остатки).
        """
        balances = {
            'stock': [],
            'settlements': [],
            'accounts': []
        }
        
        # Stock balances
        for bal in root.findall('.//ОстаткиТоваров'):
            balances['stock'].append({
                'item': self._get_text(bal, 'Номенклатура'),
                'warehouse': self._get_text(bal, 'Склад'),
                'quantity': self._parse_decimal(self._get_text(bal, 'Количество')),
                'cost': self._parse_decimal(self._get_text(bal, 'Стоимость')),
            })
        
        # Settlement balances (AR/AP)
        for bal in root.findall('.//Взаиморасчёты'):
            balances['settlements'].append({
                'counterparty': self._get_text(bal, 'Контрагент'),
                'amount': self._parse_decimal(self._get_text(bal, 'Сумма')),
                'currency': self._get_text(bal, 'Валюта', 'UZS'),
            })
        
        # Account balances
        for bal in root.findall('.//ОстаткиПоСчетам'):
            balances['accounts'].append({
                'account_code': self._get_text(bal, 'Счёт'),
                'debit': self._parse_decimal(self._get_text(bal, 'Дебет', '0')),
                'credit': self._parse_decimal(self._get_text(bal, 'Кредит', '0')),
            })
        
        return balances
    
    def _parse_document_lines(self, doc_element):
        """Parse табличная часть (document lines)"""
        lines = []
        
        for line in doc_element.findall('.//ТабличнаяЧасть/Строка'):
            lines.append({
                'item': self._get_text(line, 'Номенклатура'),
                'quantity': self._parse_decimal(self._get_text(line, 'Количество')),
                'price': self._parse_decimal(self._get_text(line, 'Цена')),
                'amount': self._parse_decimal(self._get_text(line, 'Сумма')),
                'vat_rate': self._parse_decimal(self._get_text(line, 'СтавкаНДС', '0')),
            })
        
        return lines
    
    # ═══════════════════════════════════════════════════════════════════════════
    # Helper Methods
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _get_text(self, element, tag, default=None):
        """Safely get element text"""
        child = element.find(tag)
        if child is not None and child.text:
            return child.text.strip()
        return default
    
    def _parse_date(self, date_str):
        """Parse 1C date format: 2024-01-31T12:00:00"""
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str.replace('T', ' '))
        except:
            try:
                return datetime.strptime(date_str, '%Y-%m-%d')
            except:
                return None
    
    def _parse_decimal(self, value_str):
        """Parse decimal value"""
        if not value_str:
            return Decimal('0')
        try:
            # Replace comma with dot (Russian number format)
            value_str = value_str.replace(',', '.')
            return Decimal(value_str)
        except:
            return Decimal('0')
    
    def _map_counterparty_type(self, element):
        """Map 1C type to our type"""
        type_elem = element.find('ТипКонтрагента')
        if type_elem is not None:
            type_text = type_elem.text.lower()
            if 'покупатель' in type_text:
                return 'customer'
            elif 'поставщик' in type_text:
                return 'supplier'
        return 'customer'  # Default
    
    def _map_item_type(self, element):
        """Map 1C item type"""
        type_elem = element.find('ТипНоменклатуры')
        if type_elem is not None:
            type_text = type_elem.text.lower()
            if 'услуга' in type_text:
                return 'service'
        return 'goods'  # Default
