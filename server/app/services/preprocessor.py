"""
Text preprocessing service for cleaning scraped news content.
"""

import re
import unicodedata
from bs4 import BeautifulSoup


# Common ad/boilerplate patterns in Turkish news sites
AD_PATTERNS = [
    r"reklam\s*alanı",
    r"sponsored\s*content",
    r"advertisement",
    r"google_ad",
    r"adsbygoogle",
    r"haberin devamı için tıklayınız",
    r"sosyal medyada paylaş",
    r"haberi paylaş",
    r"yorum yap",
    r"ilgili haberler",
    r"etiketler\s*:",
    r"kaynak\s*:",
    r"editör\s*:",
    r"foto\s*:",
    r"fotoğraf\s*:",
]

AD_REGEX = re.compile("|".join(AD_PATTERNS), re.IGNORECASE)

# ── Boilerplate lines/phrases to strip from extracted content ──
# These come from the news site templates and should never appear in article text.
BOILERPLATE_PATTERNS = [
    # Subscription buttons / image captions
    r"(?:\d+\s+)?(?:Haber\s+albümü\s+için\s+)?(?:Büyütmek\s+için\s+)?resme\s+tıklayın\s*",
    r"^ABONE\s+OL\s*",  # standalone "ABONE OL" at start
    r"\bABONE\s+OL\b",  # "ABONE OL" anywhere
    # Stock ticker data (yenikocaeli header leak)
    r"(?:Dolar|Euro|Sterlin|Altın|Gümüş)\s*[\d.,]+\s*%?\s*[+-]?\s*[\d.,]*",
    r"\$\s*[\d.,]+\s*%\s*[+-]?\s*[\d.,]*",
    # Reporter bylines that leak
    r"^Haber:\s*\w+\s+\w+\s*",
    # Comment section warnings (yenikocaeli / cagdas)
    r"UYARI\s*:\s*Bu içeriğe yorum yazarak.*?tutulamaz\.?",
    # Footer / copyright
    r"Sitemizde yayımlanan haber ve görseller kaynak gösterilmeden\s*kullanılamaz\.?",
    r"\d{4}\s*Yeni Kocaeli Gazetesi\s*-\s*Tüm hakları saklıdır\.?",
    # "Devamını Oku" links
    r"Devamını\s+Oku\s*$",
]

BOILERPLATE_REGEX = re.compile("|".join(BOILERPLATE_PATTERNS), re.IGNORECASE | re.MULTILINE)

# Tags at the end of articles (comma-separated short words like keywords)
# e.g. "sağlık , olay , sevk , Polis , bir , Kocaeli , yeni , tüm"
TRAILING_TAGS_REGEX = re.compile(
    r"(?:\s*,\s*(?:\w{1,15})){3,}\s*$",
    re.UNICODE,
)


def clean_html(raw_html: str) -> str:
    """Strip all HTML tags and return plain text."""
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "lxml")

    # Remove script, style, and nav elements entirely
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    return soup.get_text(separator=" ", strip=True)


def normalize_whitespace(text: str) -> str:
    """Collapse multiple spaces, tabs, newlines into a single space."""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def remove_special_characters(text: str) -> str:
    """Remove special characters but keep Turkish letters and common punctuation."""
    # Keep: Turkish chars, alphanumeric, spaces, basic punctuation
    text = re.sub(r"[^\w\sçÇğĞıİöÖşŞüÜ.,;:!?'\"\-()/%&]", "", text)
    return text


def normalize_unicode(text: str) -> str:
    """Apply NFC Unicode normalization."""
    return unicodedata.normalize("NFC", text)


def remove_ads(text: str) -> str:
    """Remove common ad/boilerplate sections from text."""
    lines = text.split(".")
    cleaned_lines = []
    for line in lines:
        if not AD_REGEX.search(line):
            cleaned_lines.append(line)
    return ".".join(cleaned_lines)


def remove_boilerplate(text: str) -> str:
    """
    Remove known boilerplate phrases from article text.

    This handles subscription buttons, stock tickers, comment warnings,
    footer text, and other template artifacts that leak into content.
    """
    # Remove boilerplate patterns
    text = BOILERPLATE_REGEX.sub("", text)

    # Remove trailing keyword tags (e.g. "sağlık , olay , sevk , Polis")
    text = TRAILING_TAGS_REGEX.sub("", text)

    return text


def preprocess(raw_html: str) -> str:
    """
    Full preprocessing pipeline:
    1. Strip HTML tags
    2. Remove ad/boilerplate content
    3. Remove known boilerplate phrases
    4. Remove special characters
    5. Unicode normalization
    6. Collapse whitespace
    """
    text = clean_html(raw_html)
    text = remove_ads(text)
    text = remove_boilerplate(text)
    text = remove_special_characters(text)
    text = normalize_unicode(text)
    text = normalize_whitespace(text)
    return text


def extract_article_content(html: str) -> str:
    """
    Extract the main article content from a news page.
    Tries common article content selectors.
    """
    soup = BeautifulSoup(html, "lxml")

    # Remove elements that should never be part of article content
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()

    # Remove comment sections
    for el in soup.select(".comment-area, .comments, .yorum, #comments, #yorumlar"):
        el.decompose()

    # Remove related news / sidebar widgets
    for el in soup.select(
        ".related-news, .ilgili-haberler, .sidebar, .widget, "
        ".popular-news, .social-share, .share-buttons, "
        ".cookie-consent, .newsletter, .abone-ol"
    ):
        el.decompose()

    # Remove stock ticker / döviz bar (yenikocaeli)
    for el in soup.select(".doviz, .kur, .stock-bar, .ticker, .currency-bar"):
        el.decompose()

    # Common content selectors for Turkish news sites
    selectors = [
        ".article-content",
        ".news-content",
        ".post-content",
        ".entry-content",
        ".haber-detay",
        ".news-detail",
        "article .content",
        ".detail-text",
        "[itemprop='articleBody']",
        "article",
    ]

    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            # Remove nested unwanted elements that might still exist
            for tag in element.find_all(["script", "style", "aside", "nav", "iframe"]):
                tag.decompose()
            text = element.get_text(separator=" ", strip=True)
            if len(text) > 50:  # Minimum viable content
                return preprocess(text)

    # Fallback: get all paragraph text
    paragraphs = soup.find_all("p")
    text = " ".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20)
    return preprocess(text) if text else ""
