"""Draws the app icons from scratch with Pillow.

Why code and not an image file: the icons need to exist at several sizes,
stay crisp at each, and be easy to tweak after seeing them on a real home
screen. Shapes are defined in fractions of the canvas, rendered at 4x and
downsampled, so any size comes out cleanly anti-aliased.

Note the icons are deliberately full-bleed squares with square corners —
iOS and Android apply their own rounding mask, and pre-rounding the corners
would show up as dark notches around the masked result.

Usage:
    python tools/make-icons.py preview    # candidates -> preview-icons/
    python tools/make-icons.py build a    # chosen concept -> icons/
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

SUPERSAMPLE = 4
ORANGE = (255, 90, 54)
ROOT = Path(__file__).resolve().parent.parent


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (size, size), top)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        draw.line(
            [(0, y), (size, y)],
            fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
        )
    return img


def bar(draw, size, center_y, width, height, color, alpha=255):
    """A horizontally-centred rounded bar — one line of teleprompter text."""
    w, h = width * size, height * size
    x0, x1 = (size - w) / 2, (size + w) / 2
    y0 = center_y * size - h / 2
    draw.rounded_rectangle([x0, y0, x1, y0 + h], radius=h / 2, fill=color + (alpha,))


def dot(draw, size, cx, cy, radius, color, alpha=255):
    r = radius * size
    draw.ellipse(
        [cx * size - r, cy * size - r, cx * size + r, cy * size + r],
        fill=color + (alpha,),
    )


def ring(draw, size, cx, cy, radius, thickness, color, alpha=255):
    r, t = radius * size, thickness * size
    draw.ellipse(
        [cx * size - r, cy * size - r, cx * size + r, cy * size + r],
        outline=color + (alpha,),
        width=round(t),
    )


def concept_a(size):
    """Script lines over a record dot, on near-black. Calm and literal."""
    base = vertical_gradient(size, (26, 26, 30), (11, 11, 12)).convert("RGBA")
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bar(draw, size, 0.27, 0.42, 0.058, (255, 255, 255), 150)
    bar(draw, size, 0.40, 0.56, 0.058, (255, 255, 255), 255)
    bar(draw, size, 0.53, 0.36, 0.058, (255, 255, 255), 200)
    dot(draw, size, 0.5, 0.745, 0.125, ORANGE)
    return Image.alpha_composite(base, layer).convert("RGB")


def concept_b(size):
    """Tapered script over a record button, on brand orange. Loud, high contrast."""
    base = vertical_gradient(size, (255, 112, 66), (240, 48, 24)).convert("RGBA")
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bar(draw, size, 0.25, 0.30, 0.055, (255, 255, 255), 160)
    bar(draw, size, 0.37, 0.44, 0.055, (255, 255, 255), 210)
    bar(draw, size, 0.49, 0.58, 0.055, (255, 255, 255), 255)
    ring(draw, size, 0.5, 0.735, 0.135, 0.028, (255, 255, 255))
    dot(draw, size, 0.5, 0.735, 0.082, (255, 255, 255))
    return Image.alpha_composite(base, layer).convert("RGB")


def concept_c(size):
    """Text falling toward the orange read-line — the app's actual idea."""
    base = vertical_gradient(size, (22, 22, 26), (10, 10, 11)).convert("RGBA")
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bar(draw, size, 0.28, 0.32, 0.05, (255, 255, 255), 80)
    bar(draw, size, 0.40, 0.46, 0.05, (255, 255, 255), 150)
    bar(draw, size, 0.52, 0.58, 0.05, (255, 255, 255), 245)
    bar(draw, size, 0.665, 0.66, 0.038, ORANGE)
    return Image.alpha_composite(base, layer).convert("RGB")


CONCEPTS = {"a": concept_a, "b": concept_b, "c": concept_c}


def render(concept, size):
    big = CONCEPTS[concept](size * SUPERSAMPLE)
    return big.resize((size, size), Image.LANCZOS)


def preview():
    out = ROOT / "preview-icons"
    out.mkdir(exist_ok=True)
    for name in CONCEPTS:
        for size in (512, 180, 32):
            render(name, size).save(out / f"{name}-{size}.png")
    print(f"wrote candidates to {out}")


def build(concept):
    icons = ROOT / "icons"
    icons.mkdir(exist_ok=True)
    for size, filename in (
        (192, "icon-192.png"),
        (512, "icon-512.png"),
        (180, "apple-touch-icon.png"),
        (32, "favicon-32.png"),
    ):
        render(concept, size).save(icons / filename)
        print(f"wrote icons/{filename}")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    if mode == "preview":
        preview()
    elif mode == "build":
        build(sys.argv[2] if len(sys.argv) > 2 else "a")
    else:
        raise SystemExit(__doc__)
