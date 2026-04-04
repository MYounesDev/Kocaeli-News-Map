"""
Keyword-based news classification service.

Each article is assigned exactly one category based on keyword matching.
If the source already provides a category, it is used as the primary signal.
"""

import re
from typing import Optional

# Ordered by specificity (more specific categories first)
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "polis": [
        "polis", "cinayet", "kaza", "hırsızlık", "yakalandı", "gözaltı",
        "tutuklama", "uyuşturucu", "suç", "saldırı", "kavga", "silahlı",
        "bıçaklı", "gasp", "dolandırıcılık", "savcılık", "mahkeme",
        "adliye", "cezaevi", "infaz", "soruşturma", "olay yeri",
        "trafik kazası", "yangın", "itfaiye", "arama kurtarma",
    ],
    "siyaset": [
        "belediye", "vali", "meclis", "seçim", "ak parti", "chp", "mhp",
        "iyi parti", "siyaset", "başkan", "milletvekili", "bakan",
        "cumhurbaşkanı", "hükümet", "muhalefet", "parti", "oy",
        "aday", "kabine", "tbmm", "büyükşehir", "kent konseyi",
    ],
    "ekonomi": [
        "ekonomi", "borsa", "ihracat", "ithalat", "yatırım", "enflasyon",
        "faiz", "dolar", "euro", "tl", "ticaret", "sanayi", "üretim",
        "istihdam", "işsizlik", "bütçe", "vergi", "kur", "piyasa",
        "girişim", "şirket", "fabrika", "osb", "kocaeli sanayi",
    ],
    "egitim": [
        "okul", "üniversite", "öğrenci", "sınav", "eğitim", "öğretmen",
        "müfredat", "meb", "yök", "burs", "mezuniyet", "akademik",
        "lise", "ilkokul", "ortaokul", "fakülte", "kocaeli üniversitesi",
        "gebze teknik", "kampüs",
    ],
    "saglik": [
        "hastane", "doktor", "sağlık", "tedavi", "ameliyat", "hasta",
        "koronavirüs", "covid", "aşı", "pandemi", "ilaç", "klinik",
        "acil servis", "ambulans", "hemşire", "salgın", "grip",
    ],
    "spor": [
        "maç", "futbol", "basketbol", "şampiyon", "lig", "gol",
        "stadyum", "antrenör", "transfer", "kocaelispor", "gebzespor",
        "süper lig", "tff", "spor", "turnuva", "derbi", "voleybol",
        "atletizm", "yüzme",
    ],
    "teknoloji": [
        "teknoloji", "dijital", "yazılım", "yapay zeka", "internet",
        "siber", "bilişim", "uygulama", "robot", "inovasyon",
        "teknopark", "ar-ge", "startup", "mobil",
    ],
    "yasam": [
        "yaşam", "kültür", "sanat", "festival", "sergi", "konser",
        "tiyatro", "sinema", "müze", "etkinlik", "gösteri",
        "gezi", "turizm", "doğa", "çevre",
    ],
}

# Normalized category name mapping (lowercase)
CATEGORY_ALIASES: dict[str, str] = {
    "güncel": "guncel",
    "polis-adliye": "polis",
    "polis adliye": "polis",
    "asayiş": "polis",
    "asayis": "polis",
    "eğitim": "egitim",
    "sağlık": "saglik",
    "yaşam": "yasam",
    "spor": "spor",
    "ekonomi": "ekonomi",
    "siyaset": "siyaset",
    "teknoloji": "teknoloji",
    "guncel": "guncel",
    "genel": "guncel",
    "çevre": "yasam",
    "magazin": "yasam",
    "kultur-sanat": "yasam",
    "kültür": "yasam",
}

VALID_CATEGORIES = list(CATEGORY_KEYWORDS.keys()) + ["guncel"]


def normalize_category(raw_category: str) -> str:
    """Normalize a raw category string to a valid category."""
    cleaned = raw_category.strip().lower()
    # Direct match
    if cleaned in VALID_CATEGORIES:
        return cleaned
    # Alias match
    if cleaned in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[cleaned]
    return ""


def classify_by_keywords(text: str) -> str:
    """
    Classify text into a news category using keyword matching.
    Returns the category with the highest keyword score, or 'guncel' as fallback.
    """
    text_lower = text.lower()
    scores: dict[str, int] = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            # Count occurrences of each keyword
            count = len(re.findall(re.escape(keyword), text_lower))
            score += count
        if score > 0:
            scores[category] = score

    if not scores:
        return "guncel"

    # Return the category with the highest score
    return max(scores, key=scores.get)


def classify(text: str, source_category: Optional[str] = None) -> str:
    """
    Determine the category of a news article.

    Priority:
    1. If source already provides a valid category, use it
    2. Otherwise, classify by keyword matching
    3. Fallback to 'guncel'
    """
    # Try source-provided category first
    if source_category:
        normalized = normalize_category(source_category)
        if normalized:
            return normalized

    # Keyword-based classification
    return classify_by_keywords(text)
