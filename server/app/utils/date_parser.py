"""
Date extraction from news article HTML pages.
Adapted from news_date.py — supports Turkish date formats and multiple extraction strategies.
"""

import json
import re
from datetime import datetime
from typing import Optional

from bs4 import BeautifulSoup
from dateutil import parser as dateutil_parser

# Turkish month name mapping
TR_MONTHS = {
    "ocak": "january", "şubat": "february", "mart": "march",
    "nisan": "april", "mayıs": "may", "haziran": "june",
    "temmuz": "july", "ağustos": "august", "eylül": "september",
    "ekim": "october", "kasım": "november", "aralık": "december",
}


def normalize_turkish(text: str) -> str:
    """Replace Turkish month names with English equivalents."""
    t = text.lower()
    for tr, en in TR_MONTHS.items():
        t = t.replace(tr, en)
    return t


def try_parse(raw: str) -> Optional[datetime]:
    """Try to parse a date string, returning a timezone-naive datetime or None."""
    try:
        normalized = normalize_turkish(raw.strip())
        dt = dateutil_parser.parse(normalized, dayfirst=True)
        # Strip timezone info — the project uses naive datetimes throughout
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except Exception:
        return None


def extract_publish_date(html: str, url: str) -> Optional[datetime]:
    """
    Extract the publish date from a news article's HTML.

    Tries multiple strategies in order:
    1. JSON-LD structured data
    2. Meta tags (article:published_time, og:published_time, etc.)
    3. <time datetime="..."> elements
    4. CSS class patterns (publish-date, post-date, etc.)
    5. URL path (e.g., /2026/04/01/)

    Returns a datetime object or None if no date could be found.
    """
    soup = BeautifulSoup(html, "lxml")

    # 1. JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if isinstance(item, dict) and item.get("datePublished"):
                    dt = try_parse(item["datePublished"])
                    if dt:
                        return dt
        except Exception:
            continue

    # 2. Meta tags
    meta_properties = [
        "article:published_time", "og:published_time",
        "datePublished", "publish_date",
    ]
    for meta in soup.find_all("meta"):
        prop = meta.get("property") or meta.get("name") or meta.get("itemprop") or ""
        content = meta.get("content", "")
        if prop in meta_properties and content:
            dt = try_parse(content)
            if dt:
                return dt

    # 3. <time datetime="...">
    for tag in soup.find_all(True, attrs={"datetime": True}):
        dt = try_parse(tag["datetime"])
        if dt:
            return dt

    # 4. CSS class patterns
    for tag in soup.find_all(True, attrs={"class": True}):
        classes = " ".join(tag.get("class", []))
        if re.search(
            r"(publish|post|article|entry|news).?(date|time)|date.?(publish|creat|post)|\bdate\b",
            classes, re.I
        ):
            text = tag.get_text(strip=True)
            if 3 < len(text) < 60:
                dt = try_parse(text)
                if dt:
                    return dt

    # 5. URL pattern
    m = re.search(r"/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})/", url)
    if m:
        y, mo, d = m.groups()
        try:
            return datetime(int(y), int(mo), int(d))
        except Exception:
            pass

    return None
