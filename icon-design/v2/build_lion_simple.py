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

W = H = 512
head_cx, head_cy = 256, 256
mane_outer, mane_inner = 208, 150
mane_path = star_path(head_cx, head_cy, mane_outer, mane_inner, spikes=12)
face_r = 128

ear_r, inner_ear_r = 36, 17
ear_l = (head_cx - 96, head_cy - 100)
ear_r_pos = (head_cx + 96, head_cy - 100)

eye_dy, eye_dx, eye_r = -6, 48, 14
nose_y = head_cy + 62

svg = f'''<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="{W}" height="{H}" rx="115" ry="115" fill="{BG}"/>

  <circle cx="{ear_l[0]}" cy="{ear_l[1]}" r="{ear_r}" fill="{MANE_DARK}"/>
  <circle cx="{ear_l[0]}" cy="{ear_l[1]+4}" r="{inner_ear_r}" fill="{DARK}"/>
  <circle cx="{ear_r_pos[0]}" cy="{ear_r_pos[1]}" r="{ear_r}" fill="{MANE_DARK}"/>
  <circle cx="{ear_r_pos[0]}" cy="{ear_r_pos[1]+4}" r="{inner_ear_r}" fill="{DARK}"/>

  <path d="{mane_path}" fill="{MANE}"/>
  <circle cx="{head_cx}" cy="{head_cy}" r="{face_r}" fill="{FACE}"/>

  <ellipse cx="{head_cx-eye_dx}" cy="{head_cy+eye_dy}" rx="{eye_r}" ry="{eye_r+4}" fill="{DARK}"/>
  <ellipse cx="{head_cx+eye_dx}" cy="{head_cy+eye_dy}" rx="{eye_r}" ry="{eye_r+4}" fill="{DARK}"/>

  <path d="M {head_cx-22},{nose_y} L {head_cx+22},{nose_y} L {head_cx},{nose_y+22} Z" fill="{DARK}"/>
  <path d="M {head_cx},{nose_y+22} Q {head_cx-30},{nose_y+50} {head_cx-56},{nose_y+38}" stroke="{DARK}" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M {head_cx},{nose_y+22} Q {head_cx+30},{nose_y+50} {head_cx+56},{nose_y+38}" stroke="{DARK}" stroke-width="9" fill="none" stroke-linecap="round"/>
</svg>
'''

with open("icon_simple.svg", "w") as f:
    f.write(svg)
print("wrote icon_simple.svg")
