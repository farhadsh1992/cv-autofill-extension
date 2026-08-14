BG = "#9E230B"
BADGE_DARK = "#7A1A08"
CREAM = "#FBF3E8"
GRAY = "#C9C2B8"
DARK = "#2B1608"
WHITE = "#FFFFFF"

W = H = 512


def f_glyph(cx, cy, scale, color):
    s = scale
    x0, y0 = cx - 45 * s, cy - 55 * s
    return (
        f'<g fill="{color}">'
        f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{20*s:.1f}" height="{110*s:.1f}" rx="{5*s:.1f}"/>'
        f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{75*s:.1f}" height="{25*s:.1f}" rx="{5*s:.1f}"/>'
        f'<rect x="{x0:.1f}" y="{y0+44*s:.1f}" width="{61*s:.1f}" height="{23*s:.1f}" rx="{5*s:.1f}"/>'
        f'</g>'
    )


def cv_paper(tx, ty, rot, include_lines=True):
    lines = ""
    if include_lines:
        ys = [-28, -3, 22, 47]
        widths = [130, 118, 122, 96]
        colors = [BG, GRAY, GRAY, GRAY]
        for y, wd, c in zip(ys, widths, colors):
            lines += f'<rect x="-82" y="{y}" width="{wd}" height="12" rx="6" fill="{c}"/>'
    return f'''<g transform="translate({tx},{ty}) rotate({rot})">
    <rect x="-95" y="-125" width="190" height="250" rx="16" fill="{WHITE}"/>
    <circle cx="-58" cy="-85" r="22" fill="{BG}"/>
    <circle cx="-58" cy="-92" r="7" fill="{WHITE}"/>
    <path d="M -71,-73 Q -58,-92 -45,-73 Z" fill="{WHITE}"/>
    <text x="-24" y="-76" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" fill="{DARK}">CV</text>
    {lines}
    </g>'''


def sync_badge(cx, cy, r):
    return f'''<g>
    <circle cx="{cx}" cy="{cy}" r="{r}" fill="{BADGE_DARK}"/>
    <path d="M {cx-r*0.42:.0f},{cy-r*0.05:.0f} A {r*0.5:.0f},{r*0.5:.0f} 0 1 1 {cx-r*0.15:.0f},{cy+r*0.42:.0f}"
          stroke="{WHITE}" stroke-width="{r*0.16:.0f}" fill="none" stroke-linecap="round"/>
    <path d="M {cx+r*0.42:.0f},{cy+r*0.05:.0f} A {r*0.5:.0f},{r*0.5:.0f} 0 1 1 {cx+r*0.15:.0f},{cy-r*0.42:.0f}"
          stroke="{WHITE}" stroke-width="{r*0.16:.0f}" fill="none" stroke-linecap="round"/>
    <path d="M {cx-r*0.5:.0f},{cy-r*0.28:.0f} L {cx-r*0.28:.0f},{cy-r*0.05:.0f} L {cx-r*0.58:.0f},{cy+r*0.02:.0f} Z" fill="{WHITE}"/>
    <path d="M {cx+r*0.5:.0f},{cy+r*0.28:.0f} L {cx+r*0.28:.0f},{cy+r*0.05:.0f} L {cx+r*0.58:.0f},{cy-r*0.02:.0f} Z" fill="{WHITE}"/>
    </g>'''


def txt_badge(tx, ty, rot):
    return f'''<g transform="translate({tx},{ty}) rotate({rot})">
    <rect x="-55" y="-45" width="110" height="90" rx="12" fill="{WHITE}"/>
    <text x="0" y="-8" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="{DARK}">TXT</text>
    <rect x="-35" y="6" width="70" height="8" rx="4" fill="{GRAY}"/>
    <rect x="-35" y="22" width="50" height="8" rx="4" fill="{GRAY}"/>
    </g>'''


def folder(cx, cy, w, h):
    x0, y0 = cx - w / 2, cy - h / 2
    tab_w, tab_h = w * 0.42, h * 0.16
    return f'''<g>
    <rect x="{x0:.0f}" y="{y0-tab_h:.0f}" width="{tab_w:.0f}" height="{tab_h+18:.0f}" rx="12" fill="{CREAM}"/>
    <rect x="{x0:.0f}" y="{y0:.0f}" width="{w:.0f}" height="{h:.0f}" rx="20" fill="{CREAM}"/>
    </g>'''


def motion_lines(x, y):
    bars = [(0, 100, 0), (18, 72, 1), (36, 46, 2)]
    out = ""
    for dy, wd, i in bars:
        out += f'<rect x="{x:.0f}" y="{y+dy*1.0:.0f}" width="{wd}" height="11" rx="5.5" fill="{WHITE}" opacity="{0.9 - i*0.18:.2f}"/>'
    return out


def build(include_pdfword_replacements=False, simple=False, out_name="icon.svg"):
    parts = [f'<rect x="0" y="0" width="{W}" height="{H}" rx="115" ry="115" fill="{BG}"/>']

    if not simple:
        parts.append(motion_lines(30, 400))
        parts.append(txt_badge(392, 350, 12))
        parts.append(sync_badge(392, 150, 46))
        parts.append(cv_paper(268, 195, -6, include_lines=True))
        parts.append(folder(246, 410, 236, 150))
        parts.append(f_glyph(246, 405, 0.62, BG))
    else:
        parts.append(sync_badge(372, 150, 44))
        parts.append(cv_paper(248, 210, -6, include_lines=True))
        parts.append(folder(236, 400, 250, 150))
        parts.append(f_glyph(236, 396, 0.68, BG))

    svg = f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">\n' + "\n".join(parts) + "\n</svg>\n"
    with open(out_name, "w") as f:
        f.write(svg)
    print("wrote", out_name)


build(simple=False, out_name="icon_hero_v3.svg")
build(simple=True, out_name="icon_simple_v3.svg")
