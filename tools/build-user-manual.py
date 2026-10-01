"""Build the Russian user manual PDF for Reels Teleprompter.

Rewritten for the app as it stands after the Paste / Clear (with a short
in-place Undo) controls landed above the script field. Run from the repo
root:

    python tools/build-user-manual.py
"""

from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Reels-Teleprompter-User-Manual-RU.pdf"
ICON = ROOT / "icons" / "icon-192.png"
FONT_DIR = Path(r"C:\Windows\Fonts")

W, H = A4
ML, MR = 18 * mm, 18 * mm
MT, MB = 22 * mm, 16 * mm

INK = HexColor("#1C1C1F")
MUTED = HexColor("#5C5C66")
ACCENT = HexColor("#FF5A36")
ACCENT_DEEP = HexColor("#E24A28")
PAPER = HexColor("#F6F3EE")
CARD = HexColor("#FFFFFF")
LINE = HexColor("#E3DDD4")
CREAM = HexColor("#FFF6F2")
DARK = HexColor("#121214")
DARK_2 = HexColor("#1C1C1F")
RAIL = HexColor("#FF5A36")


def register_fonts():
    files = {
        "Segoe": "segoeui.ttf",
        "Segoe-Bold": "segoeuib.ttf",
        "Segoe-Light": "segoeuil.ttf",
        "Segoe-Semibold": "seguisb.ttf",
        "Segoe-Italic": "segoeuii.ttf",
    }
    # Segoe Semibold lives under a slightly different filename on some Windows builds.
    if not (FONT_DIR / files["Segoe-Semibold"]).exists():
        files["Segoe-Semibold"] = "segoeuisb.ttf"
    for name, filename in files.items():
        path = FONT_DIR / filename
        if not path.exists():
            raise SystemExit(f"Missing font: {path}")
        pdfmetrics.registerFont(TTFont(name, str(path)))
    pdfmetrics.registerFontFamily(
        "Segoe",
        normal="Segoe",
        bold="Segoe-Bold",
        italic="Segoe-Italic",
        boldItalic="Segoe-Bold",
    )


def styles():
    s = {}
    s["kicker"] = ParagraphStyle(
        "kicker",
        fontName="Segoe-Bold",
        fontSize=8.5,
        leading=11,
        textColor=ACCENT,
        tracking=1.2,
        spaceAfter=4,
    )
    s["h1"] = ParagraphStyle(
        "h1",
        fontName="Segoe-Light",
        fontSize=26,
        leading=30,
        textColor=INK,
        spaceAfter=8,
    )
    s["lede"] = ParagraphStyle(
        "lede",
        fontName="Segoe",
        fontSize=11,
        leading=16,
        textColor=MUTED,
        spaceAfter=0,
    )
    s["body"] = ParagraphStyle(
        "body",
        fontName="Segoe",
        fontSize=10.5,
        leading=15.4,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=8,
    )
    s["body_small"] = ParagraphStyle(
        "body_small",
        parent=s["body"],
        fontSize=9.5,
        leading=13.4,
        textColor=HexColor("#3A3A40"),
    )
    s["step_title"] = ParagraphStyle(
        "step_title",
        fontName="Segoe-Bold",
        fontSize=11,
        leading=14,
        textColor=INK,
        spaceAfter=2,
    )
    s["step_body"] = ParagraphStyle(
        "step_body",
        fontName="Segoe",
        fontSize=10,
        leading=14,
        textColor=MUTED,
        spaceAfter=0,
    )
    s["card_title"] = ParagraphStyle(
        "card_title",
        fontName="Segoe-Bold",
        fontSize=10.5,
        leading=13.5,
        textColor=INK,
        spaceAfter=3,
    )
    s["card_body"] = ParagraphStyle(
        "card_body",
        fontName="Segoe",
        fontSize=9,
        leading=12.4,
        textColor=MUTED,
    )
    s["label"] = ParagraphStyle(
        "label",
        fontName="Segoe-Bold",
        fontSize=8,
        leading=10,
        textColor=ACCENT,
        spaceAfter=2,
    )
    s["toc"] = ParagraphStyle(
        "toc",
        fontName="Segoe",
        fontSize=11,
        leading=16,
        textColor=INK,
    )
    s["fine"] = ParagraphStyle(
        "fine",
        fontName="Segoe",
        fontSize=8.5,
        leading=11.5,
        textColor=MUTED,
    )
    return s


S = None  # filled in main()


class CoverPage(Flowable):
    def wrap(self, aw, ah):
        self.width = aw
        self.height = ah
        return aw, ah

    def draw(self):
        c = self.canv
        w, h = self.width, self.height

        # Orange vertical rail on the left edge of the page.
        c.setFillColor(ACCENT)
        c.rect(0, 0, 8, h, fill=1, stroke=0)

        if ICON.exists():
            c.drawImage(
                str(ICON),
                36,
                h - 118,
                width=52,
                height=52,
                mask="auto",
                preserveAspectRatio=True,
            )

        c.setFillColor(HexColor("#C8C4BE"))
        c.setFont("Segoe-Bold", 8.5)
        c.drawString(100, h - 82, "ВЕБ-ПРИЛОЖЕНИЕ  ·  IPHONE И ANDROID")

        c.setFillColor(white)
        c.setFont("Segoe-Light", 42)
        c.drawString(36, h - 200, "Reels")
        c.drawString(36, h - 248, "Teleprompter")

        c.setStrokeColor(ACCENT)
        c.setLineWidth(2)
        c.line(36, h - 272, 118, h - 272)

        c.setFillColor(HexColor("#F3E7E1"))
        # Wrapped subtitle, drawn as a paragraph so it stays inside the page.
        sub = Paragraph(
            "Записывайте вертикальное видео с суфлёром и выглядите так, "
            "будто говорите своими словами — без бумажки и без бегающих глаз.",
            ParagraphStyle(
                "cover_sub",
                fontName="Segoe",
                fontSize=13,
                leading=19,
                textColor=HexColor("#F3E7E1"),
            ),
        )
        sw, sh = sub.wrap(w - 90, 80)
        sub.drawOn(c, 36, h - 300 - sh)

        # Bottom meta block.
        c.setFillColor(HexColor("#8E8A86"))
        c.setFont("Segoe", 9)
        c.drawString(36, 78, "РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ")
        c.setFillColor(white)
        c.setFont("Segoe", 11)
        c.drawString(36, 58, "Октябрь 2026")
        c.setFillColor(HexColor("#8E8A86"))
        c.setFont("Segoe", 9)
        c.drawString(36, 40, "С кнопками «Вставить» и «Очистить» над сценарием")

        # Small phone glyph, bottom right.
        self._draw_mini_phone(c, w - 150, 46)

    def _draw_mini_phone(self, c, x, y):
        c.setFillColor(HexColor("#1A1A1C"))
        c.setStrokeColor(HexColor("#3A3A3E"))
        c.setLineWidth(1.2)
        c.roundRect(x, y, 86, 168, 14, fill=1, stroke=1)
        c.setFillColor(HexColor("#2A2A2E"))
        c.roundRect(x + 8, y + 28, 70, 112, 6, fill=1, stroke=0)
        c.setFillColor(ACCENT)
        c.rect(x + 22, y + 118, 42, 1.4, fill=1, stroke=0)
        c.setFillColor(HexColor("#E8E4DE"))
        c.setFont("Segoe", 5.5)
        for i, line in enumerate(("короткая", "фраза", "рядом", "с камерой")):
            c.drawCentredString(x + 43, y + 104 - i * 9, line)
        c.setFillColor(ACCENT)
        c.circle(x + 43, y + 46, 10, fill=1, stroke=0)
        c.setStrokeColor(white)
        c.setLineWidth(1.2)
        c.circle(x + 43, y + 46, 10, fill=0, stroke=1)
        c.setFillColor(ACCENT)
        c.roundRect(x + 74, y + 52, 3, 70, 1.5, fill=1, stroke=0)


class ChapterHeading(Flowable):
    def __init__(self, number, title, lede):
        super().__init__()
        self.number = number
        self.title = title
        self.lede = lede
        self._lede_p = None
        self._lh = 0

    def wrap(self, aw, ah):
        self.width = aw
        self._lede_p = Paragraph(self.lede, S["lede"])
        _, self._lh = self._lede_p.wrap(aw, ah)
        # Room under the lede. The paragraph's own box sits on this pad so a
        # following card never cuts the last line.
        self._pad = 16
        self.height = 26 + 36 + self._lh + self._pad
        return aw, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(ACCENT)
        c.setFont("Segoe-Bold", 8.5)
        c.drawString(0, self.height - 12, f"ГЛАВА  {self.number}")
        c.setFillColor(INK)
        c.setFont("Segoe-Light", 26)
        c.drawString(0, self.height - 46, self.title)
        self._lede_p.drawOn(c, 0, self._pad)


class Callout(Flowable):
    def __init__(self, label, text):
        super().__init__()
        self.label = label
        self.text = text
        self._p = None

    def wrap(self, aw, ah):
        self.width = aw
        self._p = Paragraph(self.text, S["body_small"])
        _, ph = self._p.wrap(aw - 28, ah)
        self.height = ph + 32
        return aw, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(CREAM)
        c.roundRect(0, 0, self.width, self.height, 8, fill=1, stroke=0)
        c.setFillColor(ACCENT)
        c.rect(0, 6, 3.5, self.height - 12, fill=1, stroke=0)
        c.setFillColor(ACCENT_DEEP)
        c.setFont("Segoe-Bold", 8)
        c.drawString(16, self.height - 16, self.label.upper())
        self._p.drawOn(c, 16, 10)


class Step(Flowable):
    def __init__(self, n, title, body):
        super().__init__()
        self.n = str(n)
        self.title = title
        self.body = body
        self._title_p = None
        self._body_p = None

    def wrap(self, aw, ah):
        self.width = aw
        inner = aw - 36
        self._title_p = Paragraph(self.title, S["step_title"])
        self._body_p = Paragraph(self.body, S["step_body"])
        _, th = self._title_p.wrap(inner, ah)
        _, bh = self._body_p.wrap(inner, ah)
        self._th = th
        self._bh = bh
        self.height = max(26, th + bh + 4) + 10
        return aw, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(ACCENT)
        c.circle(11, self.height - 16, 11, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Segoe-Bold", 9)
        c.drawCentredString(11, self.height - 19.5, self.n)
        self._title_p.drawOn(c, 32, self.height - 8 - self._th)
        self._body_p.drawOn(c, 32, self.height - 8 - self._th - self._bh)


class FeatureGrid(Flowable):
    """Two-column cards. `items` is a list of (title, body) pairs."""

    def __init__(self, items):
        super().__init__()
        self.items = items
        self._rows = []

    def wrap(self, aw, ah):
        self.width = aw
        gap = 8
        col_w = (aw - gap) / 2
        rows = []
        pair_h = []
        i = 0
        while i < len(self.items):
            pair = self.items[i : i + 2]
            built = []
            heights = []
            for title, body in pair:
                tp = Paragraph(title, S["card_title"])
                bp = Paragraph(body, S["card_body"])
                _, th = tp.wrap(col_w - 20, 200)
                _, bh = bp.wrap(col_w - 20, 400)
                built.append((tp, bp, th, bh))
                heights.append(th + bh + 22)
            row_h = max(heights) if heights else 0
            rows.append((built, row_h, col_w))
            pair_h.append(row_h)
            i += 2
        self._rows = rows
        self._gap = gap
        self.height = sum(pair_h) + gap * (len(rows) - 1 if rows else 0)
        return aw, self.height

    def draw(self):
        c = self.canv
        y = self.height
        for built, row_h, col_w in self._rows:
            y -= row_h
            for idx, (tp, bp, th, bh) in enumerate(built):
                x = idx * (col_w + self._gap)
                c.setFillColor(CARD)
                c.setStrokeColor(LINE)
                c.setLineWidth(0.6)
                c.roundRect(x, y, col_w, row_h, 8, fill=1, stroke=1)
                c.setFillColor(ACCENT)
                c.rect(x, y + row_h - 3, 28, 3, fill=1, stroke=0)
                tp.drawOn(c, x + 10, y + row_h - 12 - th)
                bp.drawOn(c, x + 10, y + 10)
            y -= self._gap


class ScriptPhones(Flowable):
    """Two phone sketches: normal script screen, and the 4-second Undo state."""

    def wrap(self, aw, ah):
        self.width = aw
        self.height = 292
        return aw, self.height

    def draw(self):
        gap = 16
        pw = (self.width - gap) / 2
        self._phone(0, 18, pw, 250, undo=False)
        self._phone(pw + gap, 18, pw, 250, undo=True)
        c = self.canv
        c.setFillColor(MUTED)
        c.setFont("Segoe", 8)
        c.drawCentredString(pw / 2, 4, "Обычное состояние")
        c.drawCentredString(pw + gap + pw / 2, 4, "Четыре секунды после «Очистить»")

    def _phone(self, x, y, w, h, undo):
        c = self.canv
        c.setFillColor(DARK)
        c.roundRect(x, y, w, h, 16, fill=1, stroke=0)
        # Screen inset
        pad = 12
        c.setFillColor(HexColor("#0E0E10"))
        c.roundRect(x + 6, y + 6, w - 12, h - 12, 12, fill=1, stroke=0)

        c.setFillColor(white)
        c.setFont("Segoe-Semibold", 9)
        c.drawString(x + pad, y + h - 28, "Сценарий")

        pill_y = y + h - 52
        pill_h = 16
        pill_w = (w - pad * 2 - 8) / 2
        # Paste pill
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1)
        c.setFillColor(HexColor("#1A1A1C"))
        c.roundRect(x + pad, pill_y, pill_w, pill_h, 8, fill=1, stroke=1)
        c.setFillColor(ACCENT)
        c.setFont("Segoe-Bold", 6)
        c.drawCentredString(x + pad + pill_w / 2, pill_y + 5, "ВСТАВИТЬ")

        # Clear / Undo pill
        cx = x + pad + pill_w + 8
        if undo:
            c.setFillColor(ACCENT)
            c.setStrokeColor(ACCENT)
            c.roundRect(cx, pill_y, pill_w, pill_h, 8, fill=1, stroke=1)
            c.setFillColor(white)
            c.setFont("Segoe-Bold", 6)
            c.drawCentredString(cx + pill_w / 2, pill_y + 5.5, "ОТМЕНИТЬ")
            # Shrinking bar
            c.setFillColor(HexColor("#FFFFFF"))
            c.rect(cx + 2, pill_y + 1.5, pill_w * 0.55, 2, fill=1, stroke=0)
        else:
            c.setStrokeColor(HexColor("#444448"))
            c.setFillColor(HexColor("#1A1A1C"))
            c.roundRect(cx, pill_y, pill_w, pill_h, 8, fill=1, stroke=1)
            c.setFillColor(HexColor("#C9C9D0"))
            c.setFont("Segoe-Bold", 6)
            c.drawCentredString(cx + pill_w / 2, pill_y + 5, "ОЧИСТИТЬ")

        # Text area
        box_top = pill_y - 8
        box_h = 78
        c.setFillColor(HexColor("#1A1A1C"))
        c.setStrokeColor(HexColor("#333338"))
        c.setLineWidth(0.8)
        c.roundRect(x + pad, box_top - box_h, w - pad * 2, box_h, 6, fill=1, stroke=1)
        c.setFillColor(HexColor("#D9D5CF") if not undo else HexColor("#6A6A72"))
        c.setFont("Segoe", 6.5)
        if undo:
            lines = ("Поле пустое.", "Текст ещё можно", "вернуть кнопкой", "«Отменить».")
        else:
            lines = ("Сегодня расскажу,", "почему этот приём", "работает. Коротко", "и по делу.")
        for i, line in enumerate(lines):
            c.drawString(x + pad + 6, box_top - 14 - i * 10, line)

        c.setFillColor(HexColor("#B7B3AD"))
        c.setFont("Segoe", 6)
        c.drawString(x + pad, box_top - box_h - 16, "Скорость: 30 px/с")
        c.drawString(x + pad, box_top - box_h - 28, "Размер шрифта: 28 px")

        btn_y = y + 16
        c.setFillColor(ACCENT)
        c.roundRect(x + pad, btn_y, w - pad * 2, 18, 6, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Segoe-Bold", 6.5)
        c.drawCentredString(x + w / 2, btn_y + 6, "Проверить суфлёр")


class RecordPhone(Flowable):
    def wrap(self, aw, ah):
        self.width = aw
        self.height = 168
        return aw, self.height

    def draw(self):
        c = self.canv
        # Wide dark stage with a phone and a legend beside it.
        phone_w, phone_h = 92, 150
        x, y = 0, 8
        c.setFillColor(DARK)
        c.roundRect(x, y, phone_w, phone_h, 12, fill=1, stroke=0)
        c.setFillColor(HexColor("#2A241F"))
        c.rect(x + 8, y + phone_h - 36, phone_w - 16, 18, fill=1, stroke=0)
        c.setFillColor(ACCENT)
        c.rect(x + 22, y + phone_h - 24, 40, 1.2, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Segoe", 4.5)
        c.drawCentredString(x + phone_w / 2, y + phone_h - 32, "короткая фраза")
        # Rail
        c.setFillColor(RAIL)
        c.roundRect(x + phone_w - 12, y + 36, 3, 70, 1.5, fill=1, stroke=0)
        # Timer
        c.setFillColor(HexColor("#000000"))
        c.roundRect(x + phone_w - 36, y + phone_h - 18, 26, 9, 2, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Segoe", 4.5)
        c.drawCentredString(x + phone_w - 23, y + phone_h - 15.5, "00:14")
        # Pause + stop
        c.setFillColor(white)
        c.circle(x + 32, y + 22, 7, fill=1, stroke=0)
        c.setFillColor(HexColor("#2B2B2B"))
        c.setStrokeColor(white)
        c.setLineWidth(1)
        c.circle(x + 58, y + 22, 9, fill=1, stroke=1)
        c.setFillColor(ACCENT)
        c.roundRect(x + 54, y + 18, 8, 8, 1.5, fill=1, stroke=0)

        notes = [
            ("1", "Таймер справа сверху. На паузе тускнеет, под ним красное «ПАУЗА»."),
            ("2", "Белая кнопка слева ставит запись на паузу. На паузе она краснеет — нажмите ещё раз, чтобы продолжить."),
            ("3", "Красный квадрат в круге по центру завершает запись."),
            ("4", "Красная полоса справа отматывает текст большим пальцем."),
        ]
        nx = phone_w + 16
        ny = y + phone_h - 8
        usable = self.width - nx
        for num, text in notes:
            p = Paragraph(f"<b>{num}.</b>  {text}", S["body_small"])
            _, ph = p.wrap(usable, 80)
            ny -= ph
            p.drawOn(c, nx, ny)
            ny -= 6


class FlowStrip(Flowable):
    def __init__(self, labels):
        super().__init__()
        self.labels = labels

    def wrap(self, aw, ah):
        self.width = aw
        self.height = 36
        return aw, self.height

    def draw(self):
        c = self.canv
        n = len(self.labels)
        gap = 14
        cell = (self.width - gap * (n - 1)) / n
        for i, label in enumerate(self.labels):
            x = i * (cell + gap)
            c.setFillColor(DARK if i == 0 else CARD)
            c.setStrokeColor(LINE)
            c.setLineWidth(0.6)
            c.roundRect(x, 6, cell, 24, 12, fill=1, stroke=0 if i == 0 else 1)
            c.setFillColor(white if i == 0 else INK)
            c.setFont("Segoe-Bold", 7)
            c.drawCentredString(x + cell / 2, 15, label)
            if i < n - 1:
                c.setFillColor(ACCENT)
                c.rect(x + cell + 4, 16.5, gap - 8, 1.6, fill=1, stroke=0)


class ManualDoc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, ChapterHeading):
            self.notify("TOCEntry", (0, f"{flowable.number}     {flowable.title}", self.page))
            key = f"ch-{flowable.number}"
            self.canv.bookmarkPage(key)
            try:
                self.canv.addOutlineEntry(f"{flowable.number}.  {flowable.title}", key, level=0, closed=False)
            except Exception:
                self.canv.addOutlineEntry(flowable.title, key, level=0, closed=0)


def draw_cover_bg(c, doc):
    c.saveState()
    c.setFillColor(DARK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # Soft orange glow, top right.
    c.setFillColor(Color(1, 0.35, 0.21, alpha=0.16))
    c.circle(W - 20, H - 30, 160, fill=1, stroke=0)
    c.setFillColor(Color(1, 0.35, 0.21, alpha=0.08))
    c.circle(W - 60, H - 80, 90, fill=1, stroke=0)
    c.restoreState()


def draw_body(c, doc):
    c.saveState()
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(0, H - 6, W, 6, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("Segoe", 8)
    c.drawString(ML, H - 16 * mm, "REELS TELEPROMPTER")
    c.drawRightString(W - MR, H - 16 * mm, "Руководство пользователя")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.line(ML, H - 18 * mm, W - MR, H - 18 * mm)
    c.setFillColor(INK)
    c.setFont("Segoe", 8.5)
    label = f"{doc.page:02d}"
    c.drawRightString(W - MR, 8 * mm, label)
    c.setStrokeColor(LINE)
    c.line(ML, 12 * mm, W - MR, 12 * mm)
    c.restoreState()


def chapter(number, title, lede):
    return ChapterHeading(number, title, lede)


def P(text, style="body"):
    return Paragraph(text, S[style])


def build_story():
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(
            name="TOCEntry",
            fontName="Segoe",
            fontSize=11.5,
            leading=22,
            textColor=INK,
            leftIndent=28,
            firstLineIndent=-28,
        )
    ]
    toc.dotsMinLevel = 0
    # TableOfContents in reportlab 5 reads tableStyle? Dots use the style's textColor.
    # Force dot color via a notify hook is unnecessary; default is black, which is fine on paper.

    story = []
    story.append(CoverPage())
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    story.append(Paragraph("СОДЕРЖАНИЕ", S["h1"]))
    story.append(Spacer(1, 4))
    story.append(
        P(
            "Пройдите главы по порядку один раз перед первой записью. Это занимает несколько минут и закрывает почти все вопросы на площадке.",
            "lede",
        )
    )
    story.append(toc)
    story.append(Spacer(1, 14))
    story.append(
        Callout(
            "Что нового",
            "С прошлого издания руководства над полем сценария появились две кнопки: "
            "<b>Вставить</b> берёт текст из буфера обмена, <b>Очистить</b> стирает поле и четыре секунды даёт вернуть его кнопкой <b>Отменить</b>. Остальные экраны работают как раньше.",
        )
    )
    story.append(PageBreak())

    # --- 1 ---
    story.append(
        chapter(
            "1",
            "О приложении",
            "Reels Teleprompter записывает вертикальное видео на фронтальную камеру и ведёт текст узкой полосой рядом с объективом. Вы читаете сценарий, а на записи смотрите в камеру.",
        )
    )
    story.append(FlowStrip(["Сценарий", "Репетиция", "3", "Запись", "Просмотр"]))
    story.append(Spacer(1, 10))
    story.append(
        Callout(
            "Суфлёр трогается не сразу",
            "И на репетиции, и на записи текст сначала стоит на месте. Двигаться вверх он начинает только через шесть секунд. Это пауза, чтобы поправить кадр, выдохнуть и посмотреть в камеру до того, как строка поедет.",
        )
    )
    story.append(Spacer(1, 10))
    story.append(
        FeatureGrid(
            [
                (
                    "Без магазина приложений",
                    "Это страница в браузере. Один раз откройте ссылку и добавьте ярлык на экран «Домой» — дальше он открывается как обычное приложение.",
                ),
                (
                    "Работает офлайн",
                    "После первого открытия сценарий и настройки остаются на телефоне. Интернет нужен только чтобы забрать обновление.",
                ),
                (
                    "Незаметное чтение",
                    "Текст идёт короткой полосой у камеры, с тонкой оранжевой линией. Глаза меньше бегают, и со стороны это не похоже на чтение с листа.",
                ),
                (
                    "Одна рука",
                    "Красная полоса вдоль правого края отматывает текст большим пальцем. Вторую руку для этого перехватывать не нужно.",
                ),
                (
                    "Три качества кадра",
                    "«Широкий кадр» — обычный угол и самый спокойный режим. HD и «Максимум» чётче, но кадр уже: камера обрезает края.",
                ),
                (
                    "Пауза и повтор",
                    "Запись можно остановить на паузе и продолжить в тот же файл. Готовый дубль сразу смотрится, сохраняется или переснимается.",
                ),
            ]
        )
    )
    story.append(Spacer(1, 10))
    story.append(
        P(
            "Адрес приложения: <b>https://reels-recorder-teleprompter.vercel.app</b>. "
            "Им можно пользоваться и просто во вкладке браузера. Ярлык на «Домой» убирает адресную строку и даёт больше места тексту."
        )
    )
    story.append(PageBreak())

    # --- 2 ---
    story.append(
        chapter(
            "2",
            "Экран «Домой»",
            "Установка не обязательна. Она убирает рамку браузера, один раз спрашивает камеру и микрофон и оставляет приложение работать без сети.",
        )
    )
    story.append(Paragraph("НА IPHONE — ТОЛЬКО SAFARI", S["label"]))
    story.append(Spacer(1, 4))
    story.append(
        Callout(
            "Важно",
            "На iPhone пункт «На экран Домой» есть только в Safari. Если ссылка открылась в Chrome или другом браузере, скопируйте адрес и вставьте его в Safari — компас на экране «Домой».",
        )
    )
    story.append(Spacer(1, 8))
    for n, title, body in (
        ("1", "Откройте ссылку в Safari", "Найдите компас, вставьте адрес приложения и дождитесь экрана «Сценарий»."),
        ("2", "Нажмите «Поделиться»", "Квадрат со стрелкой вверх: внизу по центру на iPhone, вверху справа на iPad."),
        ("3", "Выберите «На экран Домой»", "Пролистайте ряд значков, если пункта не видно сразу. По-английски он называется Add to Home Screen."),
        ("4", "Нажмите «Добавить»", "Предложенное имя ярлыка — «Суфлёр». Его можно поменять до добавления."),
        ("5", "Откройте ярлык", "При первом запуске разрешите камеру и микрофон. С установленного ярлыка это спрашивают один раз."),
    ):
        story.append(Step(n, title, body))
    story.append(Spacer(1, 8))
    story.append(Paragraph("НА ANDROID — CHROME", S["label"]))
    story.append(Spacer(1, 4))
    for n, title, body in (
        ("1", "Откройте ссылку в Chrome", "Подойдёт и другой браузер на движке Chromium: Яндекс Браузер, Edge."),
        ("2", "Откройте меню", "Три точки в правом верхнем углу. Иногда Chrome сам показывает баннер «Установить» внизу экрана."),
        ("3", "«Добавить на главный экран» или «Установить приложение»", "Название пункта зависит от версии Chrome. Подтвердите имя и значок."),
        ("4", "Запустите с главного экрана", "Ярлык называется Teleprompter. Камеру и микрофон разрешите при первом входе."),
    ):
        story.append(Step(n, title, body))
    story.append(Spacer(1, 6))
    story.append(
        Callout(
            "Если доступ спрашивают каждый раз",
            "Так ведёт себя обычная вкладка браузера. Поставьте ярлык на «Домой». Если разрешение уже отклонили: на iPhone — Настройки, Safari, Камера и Микрофон, Разрешить; на Android — Настройки, Приложения, Chrome, Разрешения. Затем откройте приложение заново.",
        )
    )
    story.append(PageBreak())

    # --- 3 ---
    story.append(
        chapter(
            "3",
            "Сценарий",
            "Стартовый экран. Здесь живёт текст и три настройки. Всё записывается на телефон само: заново вводить ничего не нужно.",
        )
    )
    story.append(ScriptPhones())
    story.append(Spacer(1, 8))
    story.append(Paragraph("ТЕКСТ", S["label"]))
    story.append(Spacer(1, 2))
    story.append(
        P(
            "Поле под кнопками — сам сценарий. Его можно набрать руками, поправить и прокрутить. Ограничения по длине нет: вставить и хранить можно текст любого размера, от пары фраз до длинного сценария на много экранов. Приложение его не обрезает. Короткие фразы при этом читаются спокойнее: длинная строка заставляет глаза ездить по полосе шире, чем нужно."
        )
    )
    story.append(Paragraph("ВСТАВИТЬ", S["step_title"]))
    story.append(
        P(
            "Оранжевая кнопка слева заменяет всё поле текстом из буфера обмена и прокручивает его в начало. Размер вставки не важен: кнопка принимает и короткую реплику, и очень длинный текст целиком. Сначала скопируйте сценарий в заметках или мессенджере, затем нажмите «Вставить». Старый текст в поле при этом не дописывается — он заменяется целиком. Если буфер пуст или телефон не отдал к нему доступ, подпись на секунду с небольшим меняется на «Буфер пуст», а поле остаётся как было. В этом случае зажмите поле и вставьте текст обычным системным меню."
        )
    )
    story.append(Paragraph("ОЧИСТИТЬ И ОТМЕНИТЬ", S["step_title"]))
    story.append(
        P(
            "Серая кнопка справа стирает поле. Четыре секунды она становится оранжевой и называется «Отменить»: по нижнему краю бежит белая полоска. Нажмите её, пока полоска не исчезла, — текст вернётся целиком. Если в эти четыре секунды начать печатать или нажать «Вставить», отмена закрывается и стёртый текст уже не вернуть. Пустое поле кнопка «Очистить» не трогает."
        )
    )
    story.append(
        Callout(
            "Четыре секунды",
            "Окно отмены короткое специально: кнопка не должна вечно выглядеть как «Отменить», когда текст уже сознательно стёрт. Не успели — вставьте сценарий ещё раз из заметок.",
        )
    )
    story.append(Spacer(1, 8))
    story.append(Paragraph("НАСТРОЙКИ ПОД ПОЛЕМ", S["label"]))
    story.append(Spacer(1, 2))
    story.append(
        P(
            "<b>Скорость.</b> Число в пикселях в секунду, по умолчанию 30. Кнопки «−» и «+» сдвигают его на 1. Ниже 10 и выше 120 приложение не ставит. Тот же темп потом меняется на репетиции кнопками «Медленнее» и «Быстрее»."
        )
    )
    story.append(
        P(
            "<b>Размер шрифта.</b> По умолчанию 28. Шаг тоже 1, границы — от 16 до 72. Крупнее удобнее на вытянутой руке, мельче помещает больше строк в полосу суфлёра."
        )
    )
    story.append(
        P(
            "<b>Качество видео.</b> Три кнопки: «Широкий кадр», «HD», «Максимум». Выбранная подсвечена оранжевым. «Широкий кадр» берёт обычный режим камеры: угол шире, картинка спокойнее, и это режим по умолчанию. HD целится в 720×1280, «Максимум» — в 1080×1920. Чем выше качество, тем сильнее телефон обрезает кадр. После записи откройте значок «i» на экране просмотра и проверьте, что у файла ширина меньше высоты."
        )
    )
    story.append(
        P(
            "<b>Проверить суфлёр.</b> Оранжевая кнопка внизу открывает репетицию. Запись в этот момент ещё не идёт."
        )
    )
    story.append(PageBreak())

    # --- 4 ---
    story.append(
        chapter(
            "4",
            "Репетиция",
            "Камера уже включена, файл ещё не пишется. Здесь подбирают темп и привыкают к полосе текста. Репетировать можно сколько угодно.",
        )
    )
    story.append(
        P(
            "Суфлёр не включается в движение сразу. Первые шесть секунд текст неподвижен, даже если скорость уже выставлена. Только когда эти секунды прошли, полоса начинает ехать вверх. Тот же запас есть и на записи."
        )
    )
    story.append(Paragraph("КАК ОТМОТАТЬ ТЕКСТ", S["label"]))
    story.append(Spacer(1, 2))
    story.append(
        P(
            "Два жеста делают одно и то же. Можно потянуть пальцем саму полосу текста наверху. Удобнее одной рукой — провести большим пальцем по толстой красной линии вдоль правого края. Палец вверх или вниз двигает текст, отпускание продолжает автопрокрутку с того места, где вы остановились. Увести текст раньше самого начала нельзя."
        )
    )
    story.append(Paragraph("КНОПКИ", S["label"]))
    story.append(Spacer(1, 2))
    story.append(
        P(
            "<b>Медленнее</b> и <b>Быстрее</b> по бокам меняют скорость на 1 px/с и запоминают её. Большой кружок по центру — это ещё не «стоп», а старт: он запускает отсчёт и затем запись. «← Настройки» в левом верхнем углу возвращает на экран сценария и выключает камеру."
        )
    )
    story.append(
        Callout(
            "Зеркало только на экране",
            "Пока вы смотрите в телефон, картинка отражена, как в зеркале: так проще поправить кадр. В сохранённом файле зеркала нет. Лево и право на готовом ролике такие, какими их видит собеседник, а не какими вы видели их на превью. Так же устроены камера iPhone и Reels.",
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        Callout(
            "Как держать телефон",
            "Поставьте его на уровне глаз, лучше на стопку книг или штатив. Красная полоса справа как раз для большого пальца той руки, которая держит корпус.",
        )
    )
    story.append(PageBreak())

    # --- 5 ---
    story.append(
        chapter(
            "5",
            "Отсчёт",
            "После круглой кнопки на репетиции экран на пару секунд становится чёрным и показывает крупные цифры.",
        )
    )
    # Big numeral block
    story.append(_CountdownBlock())
    story.append(Spacer(1, 10))
    story.append(
        P(
            "Цифры идут 3, затем 2, затем 1. Каждая держится чуть меньше секунды, весь отсчёт — около двух секунд. За это время уберите палец от кнопки и займите позу. Запись и суфлёр начинаются сами, отдельно подтверждать ничего не нужно. Камера с репетиции не выключается: это тот же поток."
        )
    )
    story.append(
        P(
            "Если браузер вообще не умеет писать видео, вместо записи откроется экран с текстом «Запись видео не поддерживается в этом браузере» и кнопкой назад в настройки. На современном iPhone в Safari и на актуальном Android в Chrome этого быть не должно."
        )
    )
    story.append(PageBreak())

    # --- 6 ---
    story.append(
        chapter(
            "6",
            "Запись",
            "Суфлёр ведёт себя так же, как на репетиции. Сначала он стоит: текст начинает двигаться только через шесть секунд после старта записи. Дальше работают красная полоса справа и жест по самому тексту. Кнопки темпа на этом экране убраны — скорость задаётся заранее.",
        )
    )
    story.append(RecordPhone())
    story.append(Spacer(1, 8))
    story.append(
        P(
            "Длину ролика приложение не ограничивает. Нет потолка в 15, 30 или 60 секунд: запись идёт, пока вы не нажмёте стоп. Единственный предел — свободная память телефона. Пока её хватает, дубль может быть длинным."
        )
    )
    story.append(
        P(
            "Пауза останавливает и файл, и текст, и таймер. Под таймером загорается красная плашка «ПАУЗА», сам таймер бледнеет, белая кнопка становится красной. Второе нажатие продолжает тот же ролик, без склейки из двух файлов. Если отмотать текст красной полосой, пока запись на паузе, автопрокрутка сама не включится — пауза останется паузой."
        )
    )
    story.append(
        P(
            "На части браузеров пауза технически недоступна. Тогда левая кнопка серая и не нажимается. Запись при этом всё равно идёт: её можно только остановить."
        )
    )
    story.append(
        P(
            "Стоп — красный квадрат в белом кольце по центру. Пока файл закрывается, кнопки гаснут. Обычно это мгновение, после длинного дубля — несколько секунд. Дальше открывается просмотр. Если завершить запись не удалось, появится сообщение «Не удалось завершить запись» и путь назад в настройки: зависший экран сам по себе не остаётся навсегда."
        )
    )
    story.append(
        Callout(
            "Не блокируйте экран",
            "Пока идёт репетиция или запись, приложение просит телефон не гасить дисплей. Просьбу браузер иногда отклоняет. Не нажимайте боковую кнопку блокировки сами: если экран погаснет, картинка может оборваться, а звук — продолжиться.",
        )
    )
    story.append(PageBreak())

    # --- 7 ---
    story.append(
        chapter(
            "7",
            "Просмотр",
            "Сразу после стопа камера выключается, и на экране готовый дубль. Решите, оставлять его или снимать заново.",
        )
    )
    story.append(
        FeatureGrid(
            [
                (
                    "Воспроизведение",
                    "Круглая кнопка по центру и нажатие по самому кадру включают и ставят ролик на паузу. Пока идёт проигрывание, кнопка превращается в две полоски.",
                ),
                (
                    "Перемотка",
                    "Полоса над кнопками действий. Потяните бегунок или коснитесь нужного места — ролик прыгнет туда.",
                ),
                (
                    "Переснять",
                    "Текущий дубль выбрасывается, камера включается снова, вы возвращаетесь на репетицию. В галерею этот файл не попадает.",
                ),
                (
                    "Оставить",
                    "На телефоне открывается системное окно «Поделиться». Выберите «Сохранить видео», чтобы ролик лёг в Фото. На компьютере файл чаще просто скачивается.",
                ),
            ]
        )
    )
    story.append(Spacer(1, 10))
    story.append(
        P(
            "Если окно «Поделиться» не открылось или в нём нет сохранения в галерею, приложение само предложит скачать файл. Имя начинается с <font face='Segoe'>reel-</font> и даты; расширение — mp4, когда браузер так записал, иначе webm. Закрыли окно «Поделиться» крестиком — вы остаётесь на просмотре и можете нажать «Оставить» ещё раз. После удачного сохранения приложение возвращается к сценарию."
        )
    )
    story.append(
        P(
            "Значок <b>i</b> в углу открывает служебную строку: размер файла, реальное разрешение и длительность. Если ролик «лежит на боку» или кадр неожиданно узкий, посмотрите эти цифры. Ширина должна быть меньше высоты. Затем в сценарии выберите «Широкий кадр» и снимите ещё раз."
        )
    )
    story.append(
        Callout(
            "Пустой дубль",
            "Если в файле не оказалось данных, вместо плеера будет текст «Запись не удалась» и кнопка «← Репетиция». Это редкий сбой, а не скрытое сохранение: в галерее такого ролика нет.",
        )
    )
    story.append(PageBreak())

    # --- 8 ---
    story.append(
        chapter(
            "8",
            "Как снять лучше",
            "Приложение не правит свет и не убирает шум. На картинку сильнее переключателя качества влияют свет, тишина, длина фразы и то, как вы держите телефон.",
        )
    )
    tips = [
        ("Свет в лицо", "Окно или лампа стоят перед вами, не за спиной. Контровой свет оставляет лицо тёмным пятном."),
        ("Упор, не рука", "Стопка книг, чехол-подставка или штатив держат кадр ровнее самой твёрдой руки."),
        ("Тишина", "Микрофон телефона тащит в файл вентилятор, телевизор и улицу. Выключите лишнее до отсчёта."),
        ("Короткие фразы", "Режьте сценарий на смысловые куски в одну строку полосы. Так взгляд остаётся у камеры."),
        ("Текст любой длины", "Поле сценария не режет вставку. Длинный текст удобнее набрать в заметках, скопировать и нажать «Вставить», чем печатать его на телефоне."),
        ("Дубль любой длины", "Секундомер не остановит запись сам. Ролик растёт, пока хватает памяти телефона и пока вы не нажмёте стоп."),
        ("Сначала широкий кадр", "Снимите пробный дубль в «Широком кадре». HD и «Максимум» включайте, только если нужна чёткость и вы уже видели в «i», что файл вертикальный."),
        ("Одна рука — по полосе", "Большой палец вдоль правого края двигает текст. К самой полосе суфлёра наверху тянуться не нужно."),
        ("Экран не гасите", "Даже если телефон обещал не засыпать, боковую кнопку во время дубля не нажимайте."),
    ]
    story.append(FeatureGrid(tips))
    story.append(PageBreak())

    # --- 9 ---
    story.append(
        chapter(
            "9",
            "Если что-то не так",
            "Сначала найдите симптом в списке. Значок «i» на просмотре показывает, что реально попало в файл: формат, размер кадра, длительность.",
        )
    )
    problems = [
        (
            "Экран полностью чёрный",
            "Закройте приложение и откройте ярлык снова. Если чернота осталась, удалите ярлык и добавьте его заново по главе 2: так сбрасывается сохранённая копия страницы.",
        ),
        (
            "Камеру спрашивают при каждом входе",
            "Вы в обычной вкладке браузера. Поставьте приложение на экран «Домой». Если доступ уже запрещён, включите камеру и микрофон в настройках системы и зайдите снова.",
        ),
        (
            "«Буфер пуст» или «Вставить» ничего не делает",
            "В буфере нет текста, либо браузер не разрешил его прочитать. Скопируйте сценарий ещё раз. На iPhone чтение буфера иногда доступно только из Safari или с установленного ярлыка. Запасной путь: зажмите поле сценария и выберите «Вставить» в системном меню.",
        ),
        (
            "Нажал «Очистить» и не успел вернуть текст",
            "Отмена живёт четыре секунды и сбрасывается, если начать печатать или вставлять новый текст. Верните сценарий из заметок кнопкой «Вставить».",
        ),
        (
            "Ролик на боку или слишком близко",
            "Сценарий → качество → «Широкий кадр». На просмотре откройте «i»: у нормального вертикального файла ширина меньше высоты.",
        ),
        (
            "Непонятно, сохранился ли файл",
            "«Оставить» само по себе в галерею не кладёт. Дождитесь окна «Поделиться» и выберите «Сохранить видео». На компьютере ищите файл в загрузках.",
        ),
        (
            "После стопа долго ничего не происходит",
            "Длинный дубль закрывается несколько секунд. Если прошло заметно больше и экран так и висит, появится сообщение об ошибке — вернитесь в настройки и снимите ещё раз. Дубль, который не открылся на просмотре, в галерею не попал.",
        ),
        (
            "Первое нажатие пропадает",
            "Нажмите ещё раз: на только что собранном экране первое касание иногда только «будит» кнопку. Если так на каждом шаге, переустановите ярлык.",
        ),
        (
            "Нет пункта установки",
            "iPhone: только Safari, не Chrome. Android: меню Chrome, «Установить приложение» или «На главный экран». Подробности в главе 2.",
        ),
        (
            "Кнопка паузы серая",
            "Этот браузер не умеет ставить запись на паузу. Сама запись при этом идёт. Остановите её стопом и, если нужно, переснимите.",
        ),
    ]
    for title, body in problems:
        story.append(Paragraph(title, S["step_title"]))
        story.append(P(body))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 6))
    story.append(
        Callout(
            "Что приложение запоминает",
            "Сценарий, скорость, размер шрифта и выбранное качество остаются на этом телефоне в этом ярлыке. Другой браузер или переустановка ярлыка начинают с пустого поля, скорости 30, шрифта 28 и «Широкого кадра».",
        )
    )
    # Avoid a lonely last line by giving the closing a little air, not a new empty page.
    story.append(Spacer(1, 14))
    story.append(
        P(
            "Дальше — сценарий, «Проверить суфлёр» и один короткий пробный дубль. Если кадр в значке «i» вертикальный, можно снимать всерьёз.",
            "lede",
        )
    )
    return story


class _CountdownBlock(Flowable):
    def wrap(self, aw, ah):
        self.width = aw
        self.height = 150
        return aw, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(DARK)
        c.roundRect(0, 0, self.width, self.height, 14, fill=1, stroke=0)
        labels = ("3", "2", "1")
        cell = self.width / 3
        for i, lab in enumerate(labels):
            cx = cell * i + cell / 2
            if i == 0:
                c.setFillColor(ACCENT)
                c.circle(cx, 78, 36, fill=1, stroke=0)
                c.setFillColor(white)
            else:
                c.setStrokeColor(HexColor("#3A3A3E"))
                c.setLineWidth(1.2)
                c.setFillColor(HexColor("#1A1A1C"))
                c.circle(cx, 78, 36, fill=1, stroke=1)
                c.setFillColor(HexColor("#C8C4BE"))
            c.setFont("Segoe-Light", 36)
            c.drawCentredString(cx, 66, lab)
        c.setFillColor(HexColor("#8E8A86"))
        c.setFont("Segoe", 8)
        c.drawCentredString(self.width / 2, 18, "Около двух секунд  ·  затем запись начинается сама")


def main():
    global S
    register_fonts()
    S = styles()
    frame = Frame(ML, MB, W - ML - MR, H - MT - MB, id="body", showBoundary=0)
    cover_frame = Frame(0, 0, W, H, id="cover", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc = ManualDoc(
        str(OUT),
        pagesize=A4,
        title="Reels Teleprompter — Руководство пользователя",
        author="Reels Teleprompter",
        subject="Руководство пользователя, октябрь 2026",
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover_bg),
            PageTemplate(id="body", frames=[frame], onPage=draw_body),
        ]
    )
    doc.multiBuild(build_story())
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
