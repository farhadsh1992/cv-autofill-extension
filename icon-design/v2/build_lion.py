import math

def star_path(cx, cy, outer_r, inner_r, spikes, rotation_deg=-90):
    pts = []
    step = math.pi / spikes
    start = math.radians(rotation_deg)
    for i in range(spikes * 2):
        r = outer_r if i % 2 == 0 else inner_r
        a = start + i * step
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d = f"M {pts[0][0]:.1f},{pts[0][1]:.1f} "
    for (x, y) in pts[1:]:
        d += f"L {x:.1f},{y:.1f} "
    d += "Z"
    return d

BG = "#9E230B"
MANE = "#D97D2B"
MANE_DARK = "#B85E1A"
FACE = "#F5E1C0"
DARK = "#2B1608"
WHITE = "#FFFFFF"

W = H = 512
head_cx, head_cy = 256, 190
mane_outer, mane_inner = 168, 122
mane_path = star_path(head_cx, head_cy, mane_outer, mane_inner, spikes=14)
face_r = 104

ear_r, inner_ear_r = 29, 14
ear_l = (head_cx - 78, head_cy - 82)
ear_r_pos = (head_cx + 78, head_cy - 82)

eye_dy, eye_dx, eye_r, brow_w = -8, 39, 11, 30

nose_y = head_cy + 50
mouth_top_y = head_cy + 78
mouth_bottom_y = head_cy + 130
mouth_half_w = 96

globe_cx = head_cx
globe_cy = mouth_top_y + 92
globe_r = 82

assert globe_cy + globe_r < 500, f"globe bottom {globe_cy+globe_r} would clip the canvas"
assert head_cy - mane_outer > 12, f"mane top {head_cy-mane_outer} too close to canvas edge"

svg = f'''<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="{W}" height="{H}" rx="115" ry="115" fill="{BG}"/>

  <circle cx="{ear_l[0]}" cy="{ear_l[1]}" r="{ear_r}" fill="{MANE_DARK}"/>
  <circle cx="{ear_l[0]}" cy="{ear_l[1]+3}" r="{inner_ear_r}" fill="{DARK}"/>
  <circle cx="{ear_r_pos[0]}" cy="{ear_r_pos[1]}" r="{ear_r}" fill="{MANE_DARK}"/>
  <circle cx="{ear_r_pos[0]}" cy="{ear_r_pos[1]+3}" r="{inner_ear_r}" fill="{DARK}"/>

  <path d="{mane_path}" fill="{MANE}"/>
  <circle cx="{head_cx}" cy="{head_cy}" r="{face_r}" fill="{FACE}"/>

  <ellipse cx="{head_cx-eye_dx}" cy="{head_cy+eye_dy}" rx="{eye_r}" ry="{eye_r+3}" fill="{DARK}"/>
  <ellipse cx="{head_cx+eye_dx}" cy="{head_cy+eye_dy}" rx="{eye_r}" ry="{eye_r+3}" fill="{DARK}"/>

  <path d="M {head_cx-eye_dx-brow_w/2:.0f},{head_cy+eye_dy-22} Q {head_cx-eye_dx},{head_cy+eye_dy-34} {head_cx-eye_dx+brow_w/2:.0f},{head_cy+eye_dy-20}"
        stroke="{DARK}" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M {head_cx+eye_dx-brow_w/2:.0f},{head_cy+eye_dy-20} Q {head_cx+eye_dx},{head_cy+eye_dy-34} {head_cx+eye_dx+brow_w/2:.0f},{head_cy+eye_dy-22}"
        stroke="{DARK}" stroke-width="8" fill="none" stroke-linecap="round"/>

  <path d="M {head_cx-19},{nose_y} L {head_cx+19},{nose_y} L {head_cx},{nose_y+19} Z" fill="{DARK}"/>
  <line x1="{head_cx}" y1="{nose_y+19}" x2="{head_cx}" y2="{mouth_top_y+4}" stroke="{DARK}" stroke-width="6" stroke-linecap="round"/>

  <path id="mouth" d="M {head_cx-mouth_half_w},{mouth_top_y}
           Q {head_cx},{mouth_bottom_y+40} {head_cx+mouth_half_w},{mouth_top_y}
           Q {head_cx},{mouth_top_y+30} {head_cx-mouth_half_w},{mouth_top_y} Z" fill="{DARK}"/>

  <path d="M {head_cx-mouth_half_w+16},{mouth_top_y+6} L {head_cx-mouth_half_w+35},{mouth_top_y+6} L {head_cx-mouth_half_w+25},{mouth_top_y+30} Z" fill="{WHITE}"/>
  <path d="M {head_cx+mouth_half_w-16},{mouth_top_y+6} L {head_cx+mouth_half_w-35},{mouth_top_y+6} L {head_cx+mouth_half_w-25},{mouth_top_y+30} Z" fill="{WHITE}"/>
  <path d="M {head_cx-22},{mouth_top_y+26} L {head_cx-6},{mouth_top_y+26} L {head_cx-14},{mouth_top_y+46} Z" fill="{WHITE}"/>
  <path d="M {head_cx+22},{mouth_top_y+26} L {head_cx+6},{mouth_top_y+26} L {head_cx+14},{mouth_top_y+46} Z" fill="{WHITE}"/>

  <circle cx="{globe_cx}" cy="{globe_cy}" r="{globe_r}" fill="{FACE}" stroke="{DARK}" stroke-width="5"/>
  <ellipse cx="{globe_cx}" cy="{globe_cy}" rx="{globe_r*0.4:.0f}" ry="{globe_r}" fill="none" stroke="{DARK}" stroke-width="4"/>
  <line x1="{globe_cx-globe_r}" y1="{globe_cy}" x2="{globe_cx+globe_r}" y2="{globe_cy}" stroke="{DARK}" stroke-width="4"/>
  <line x1="{globe_cx-globe_r*0.87:.0f}" y1="{globe_cy-globe_r*0.5:.0f}" x2="{globe_cx+globe_r*0.87:.0f}" y2="{globe_cy-globe_r*0.5:.0f}" stroke="{DARK}" stroke-width="3" opacity="0.5"/>
  <line x1="{globe_cx-globe_r*0.87:.0f}" y1="{globe_cy+globe_r*0.5:.0f}" x2="{globe_cx+globe_r*0.87:.0f}" y2="{globe_cy+globe_r*0.5:.0f}" stroke="{DARK}" stroke-width="3" opacity="0.5"/>
  <text x="{globe_cx}" y="{globe_cy+16}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="46" font-weight="900" fill="{DARK}">CV</text>

  <use href="#mouth" fill="{DARK}"/>
  <path d="M {head_cx-mouth_half_w+16},{mouth_top_y+6} L {head_cx-mouth_half_w+35},{mouth_top_y+6} L {head_cx-mouth_half_w+25},{mouth_top_y+30} Z" fill="{WHITE}"/>
  <path d="M {head_cx+mouth_half_w-16},{mouth_top_y+6} L {head_cx+mouth_half_w-35},{mouth_top_y+6} L {head_cx+mouth_half_w-25},{mouth_top_y+30} Z" fill="{WHITE}"/>
</svg>
'''

with open("icon_hero.svg", "w") as f:
    f.write(svg)
print("wrote icon_hero.svg")
print(f"globe spans y {globe_cy-globe_r} to {globe_cy+globe_r}; mane spans y {head_cy-mane_outer} to head")
