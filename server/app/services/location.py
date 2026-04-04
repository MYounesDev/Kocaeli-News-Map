"""
Location extraction from news article text.

Scans for known Kocaeli district, neighborhood, and landmark names
and returns the most specific location found.
"""

import re
from typing import Optional

# Kocaeli districts (ilçeler)
KOCAELI_DISTRICTS = [
    "İzmit", "Gebze", "Darıca", "Derince", "Körfez", "Gölcük",
    "Kandıra", "Kartepe", "Başiskele", "Çayırova", "Dilovası",
    "Karamürsel",
]

# Common neighborhoods/areas within Kocaeli districts
KOCAELI_NEIGHBORHOODS: dict[str, list[str]] = {
    "İzmit": [
        "Yahyakaptan", "Serdar", "Kozluk", "Arslanbey", "Kuruçeşme",
        "Çukurbağ", "Kemalpaşa", "Yenidoğan", "Topçular", "Hacıhalil",
        "Tavşantepe", "Cedit", "Karabaş", "Yenişehir", "Akmeşe",
        "Kabaoğlu", "Orhan", "Alemdar",
    ],
    "Gebze": [
        "Güzeller", "Osman Yılmaz", "Mevlana", "Mustafapaşa",
        "Pelitli", "Balçık", "Eskihisar", "Arap Çeşme", "Hacıhalil",
        "Ulus", "Kirazpınar", "Beylikbağı", "Sultan Orhan", "Tavşanlı",
    ],
    "Darıca": [
        "Bayramoğlu", "Osmangazi", "Nene Hatun", "Bağlarbaşı",
        "Fevzi Çakmak", "Abdi İpekçi", "Sırasöğütler",
    ],
    "Derince": [
        "Çenedağ", "İbn-i Sina", "Deniz", "Sırrıpaşa", "Yavuz Sultan Selim",
        "Yenikent",
    ],
    "Körfez": [
        "Hereke", "Yarımca", "Kışladüzü", "Agah Ateş", "İlimtepe",
    ],
    "Gölcük": [
        "Değirmendere", "İhsaniye", "Halıdere", "Hisareyn",
        "Ulaşlı", "Yazlık", "Saraylı",
    ],
    "Kandıra": [
        "Akçaova", "Karaağaç", "Akıncılar",
    ],
    "Kartepe": [
        "Maşukiye", "Uzuntarla", "Acısu", "Suadiye", "Eşme",
        "Arslanbey", "Balaban",
    ],
    "Başiskele": [
        "Yeniköy", "Kullar", "Damlar", "Servetiye", "Yeşilyurt",
    ],
    "Çayırova": [
        "Şekerpınar", "Akse", "Özgürlük", "Emek",
    ],
    "Dilovası": [
        "Diliskelesi", "Tavşancıl", "Köseler", "Muallimköy",
    ],
    "Karamürsel": [
        "Yalakdere", "Ereğli", "Akçat", "İnebeyli",
    ],
}

# Common landmarks and specific locations in Kocaeli
KOCAELI_LANDMARKS = [
    "Seka Park", "İzmit Körfezi", "Kocaeli Üniversitesi", "Gebze Teknik",
    "Sapanca Gölü", "Maşukiye", "Kartepe Kayak Merkezi",
    "Kocaeli Stadyumu", "İzmit Saat Kulesi", "Gebze OSB",
    "Dilovası OSB", "Tüpraş", "Ford Otosan", "Hyundai",
    "GOSB", "Kocaeli Fuar Merkezi", "Dil İskelesi",
]

# Build a flat lookup: neighborhood -> district
_NEIGHBORHOOD_TO_DISTRICT: dict[str, str] = {}
for district, neighborhoods in KOCAELI_NEIGHBORHOODS.items():
    for n in neighborhoods:
        _NEIGHBORHOOD_TO_DISTRICT[n.lower()] = district


def extract_location(text: str) -> Optional[str]:
    """
    Extract the most specific location from a news article text.

    Priority:
    1. Neighborhood/mahalle → returns "Neighborhood, District, Kocaeli"
    2. District/ilçe → returns "District, Kocaeli"
    3. Landmark → returns landmark name + ", Kocaeli"
    4. None if no location found

    Returns a location string suitable for geocoding.
    """
    if not text:
        return None

    text_lower = text.lower()

    # 1. Check neighborhoods (most specific)
    for neighborhood, district in _NEIGHBORHOOD_TO_DISTRICT.items():
        if neighborhood in text_lower:
            # Try to find the original case
            pattern = re.compile(re.escape(neighborhood), re.IGNORECASE)
            match = pattern.search(text)
            if match:
                return f"{match.group()}, {district}, Kocaeli"

    # 2. Check districts
    found_districts = []
    for district in KOCAELI_DISTRICTS:
        if district.lower() in text_lower:
            found_districts.append(district)

    if found_districts:
        # Return the first found (usually the most relevant)
        return f"{found_districts[0]}, Kocaeli"

    # 3. Check landmarks
    for landmark in KOCAELI_LANDMARKS:
        if landmark.lower() in text_lower:
            return f"{landmark}, Kocaeli"

    return None
