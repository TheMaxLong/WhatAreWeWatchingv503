"""
The store behind the counter, rendered once in Cycles as an out-of-focus plate.

    blender -b -P blender/store.py -- [--size 2560] [--samples 192]

Writes assets/store.jpg: a square, level, very wide view (20 mm on a 36 mm
sensor = 84 degrees across) from the three.js camera's position, focused on
the TV one metre and a bit away, so the shelves fall into bokeh. The page
stands this image on a plane at PLATE_DIST and sizes it to this exact frustum;
every layout (phone portrait, desktop wide) is then a crop of the one plate,
which keeps the perspective honest.

A 90s rental floor at night: tapes face-out on white shelving, blue section
headers with yellow lettering, fluorescent troffers, a pink neon VIDEO sign.
Evokes the era only. No real store's name or mark.
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "assets", "store.jpg")
if "--out" in sys.argv:
    OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1])

def arg(name, default):
    if name in sys.argv:
        return type(default)(sys.argv[sys.argv.index(name) + 1])
    return default
SIZE = arg("--size", 2560)
SAMPLES = arg("--samples", 192)

# must match src/scene.js
CAM = (-0.075, -1.45, 0.26)         # Blender coords of the three.js camera
LENS_MM, SENSOR_MM = 20.0, 36.0
FOCUS = 1.30                        # camera → TV front

random.seed(1987)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def mat(name, color, rough=0.5, metallic=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m

def link(o):
    scene.collection.objects.link(o)
    return o

def box_into(bm, x0, x1, y0, y1, z0, z1):
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r["verts"]:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    return r["verts"]

def mesh_obj(name, bm, m):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m)
    return link(bpy.data.objects.new(name, me))

def box(name, x0, x1, y0, y1, z0, z1, m):
    bm = bmesh.new()
    box_into(bm, x0, x1, y0, y1, z0, z1)
    return mesh_obj(name, bm, m)

FLOOR = -1.07
CEIL = 2.75
WALL_Y = 3.35

M_WALL    = mat("wall",    srgb("#1b2f8a"), 0.8)          # rental blue paint
M_WALLLOW = mat("walllow", srgb("#d9d6cc"), 0.8)
M_CARPET  = mat("carpet",  srgb("#232a4a"), 0.95)
M_CEIL    = mat("ceil",    srgb("#cfccc4"), 0.9)
M_SHELF   = mat("shelf",   srgb("#e8e6df"), 0.45)
M_HEADER  = mat("header",  srgb("#1537b8"), 0.4)
M_YELLOW  = mat("yellow",  srgb("#ffd21f"), 0.35, emit=srgb("#ffd21f"), strength=0.6)
M_TUBE    = mat("tube",    srgb("#ffffff"), 0.2, emit=srgb("#eef6ff"), strength=13.0)
M_NEON    = mat("neon",    srgb("#ff2a8a"), 0.2, emit=srgb("#ff2a8a"), strength=55.0)
M_NEON2   = mat("neon2",   srgb("#2ad4ff"), 0.2, emit=srgb("#2ad4ff"), strength=30.0)
M_TAG     = mat("tag",     srgb("#ffd21f"), 0.4, emit=srgb("#ffd21f"), strength=1.2)

# tape covers: one mesh, colour per box from a colour attribute
M_COVER = bpy.data.materials.new("cover")
M_COVER.use_nodes = True
nt = M_COVER.node_tree
bsdf = nt.nodes["Principled BSDF"]
attr = nt.nodes.new("ShaderNodeVertexColor")
attr.layer_name = "cover"
nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.28      # shrink-wrapped sleeves catch the tubes
COVER_PALETTE = [srgb(h) for h in (
    "#b3202a", "#111111", "#1947c2", "#f2c230", "#e0407a", "#1a8c8c", "#e8702a",
    "#5b2a86", "#eeeeee", "#2f8f3a", "#0d0d0d", "#c7c9cc", "#8a1414", "#f5e6c8")]

# ── room ─────────────────────────────────────────────────────────────────────
box("floor", -9, 9, -3, WALL_Y + 1, FLOOR - 0.05, FLOOR, M_CARPET)
box("ceiling", -9, 9, -3, WALL_Y + 1, CEIL, CEIL + 0.05, M_CEIL)
box("wall_hi", -9, 9, WALL_Y, WALL_Y + 0.1, FLOOR + 2.35, CEIL, M_WALL)
box("wall_lo", -9, 9, WALL_Y, WALL_Y + 0.1, FLOOR, FLOOR + 2.35, M_WALLLOW)

# fluorescent troffers in rows
tubes = bmesh.new()
for y in (0.9, 2.3):
    for x in (-4.2, -2.1, 0.0, 2.1, 4.2):
        box_into(tubes, x - 0.62, x + 0.62, y - 0.16, y + 0.16, CEIL - 0.012, CEIL)
mesh_obj("tubes", tubes, M_TUBE)

# ── shelving: face-out tapes on the back wall and two aisle gondolas ────────
covers = bmesh.new()
col_layer = covers.loops.layers.color.new("cover")
def tape_row(x_from, x_to, y_face, z_shelf, facing=-1, axis="x"):
    """Face-out VHS boxes standing on a shelf, leaning back a touch."""
    w, h, t = 0.106, 0.19, 0.03
    gap = random.uniform(0.004, 0.012)
    pos = x_from + random.uniform(0.0, 0.03)
    while pos + w < x_to:
        if random.random() < 0.07:           # a gap where a tape is out on rental
            pos += w + gap
            continue
        c = random.choice(COVER_PALETTE)
        band = random.choice(COVER_PALETTE)
        lean = 0.012
        if axis == "x":
            vs = box_into(covers, pos, pos + w, y_face, y_face + t, z_shelf, z_shelf + h)
        else:
            vs = box_into(covers, y_face, y_face + t, pos, pos + w, z_shelf, z_shelf + h)
        for v in vs:
            if v.co.z > z_shelf + h / 2:
                if axis == "x":
                    v.co.y += lean
                else:
                    v.co.x += lean * -facing
        faces = {f for v in vs for f in v.link_faces}
        for f in faces:
            for l in f.loops:
                # a title band across the top third of each cover
                tint = band if l.vert.co.z > z_shelf + h * 0.72 else c
                l[col_layer] = (*tint, 1.0)
        pos += w + gap

shelf = bmesh.new()
tags = bmesh.new()
SHELF_LEVELS = [FLOOR + 0.22 + i * 0.30 for i in range(6)]   # top shelf ≈ 0.65

# back wall units, 1.2 m modules
for mx in range(-5, 5):
    x0 = mx * 1.2 + 0.02
    x1 = x0 + 1.16
    box_into(shelf, x0, x1, WALL_Y - 0.36, WALL_Y, FLOOR, FLOOR + 0.12)          # kick
    box_into(shelf, x0 - 0.02, x0 + 0.02, WALL_Y - 0.36, WALL_Y, FLOOR, FLOOR + 1.98)  # upright
    for z in SHELF_LEVELS:
        box_into(shelf, x0, x1, WALL_Y - 0.34, WALL_Y, z - 0.02, z)
        box_into(tags, x0 + 0.1, x0 + 0.14, WALL_Y - 0.345, WALL_Y - 0.34, z - 0.02, z - 0.0)
        tape_row(x0 + 0.02, x1 - 0.02, WALL_Y - 0.22, z)
mesh_obj("wallshelf", shelf, M_SHELF)

# aisle gondolas running away from the counter, left and right
gond = bmesh.new()
for gx, face in ((-2.35, 1), (2.25, -1)):
    box_into(gond, gx - 0.3, gx + 0.3, 0.55, 2.75, FLOOR, FLOOR + 0.1)
    box_into(gond, gx - 0.02, gx + 0.02, 0.55, 2.75, FLOOR, FLOOR + 1.62)
    for z in SHELF_LEVELS[:5]:
        box_into(gond, gx - 0.3, gx + 0.3, 0.55, 2.75, z - 0.02, z)
        yface = gx + 0.08 if face > 0 else gx - 0.11
        tape_row(0.6, 2.7, yface, z, facing=face, axis="y")
        tape_row(0.6, 2.7, gx - 0.11 if face > 0 else gx + 0.08, z, facing=-face, axis="y")
    # end-cap header
    box_into(gond, gx - 0.34, gx + 0.34, 0.5, 0.56, FLOOR + 1.66, FLOOR + 1.96)
mesh_obj("gondolas", gond, M_SHELF)
mesh_obj("covers", covers, M_COVER)
mesh_obj("pricetags", tags, M_TAG)

# ── section headers: blue panels, yellow lettering ──────────────────────────
def text(body, x, y, z, size, m, rot_z=0.0, extrude=0.004):
    cu = bpy.data.curves.new(body, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    o = bpy.data.objects.new(body, cu)
    o.location = (x, y, z)
    o.rotation_euler = (math.pi / 2, 0, rot_z)
    o.data.materials.append(m)
    return link(o)

SECTIONS = ["DRAMA", "COMEDY", "NEW RELEASES", "ACTION", "CLASSICS",
            "HORROR", "CULT", "DOCUMENTARY", "SCI-FI", "FOREIGN"]
for i, name in enumerate(SECTIONS):
    cx = (i - 5) * 1.2 + 0.62
    zc = FLOOR + 2.16
    box(f"hdr{i}", cx - 0.54, cx + 0.54, WALL_Y - 0.08, WALL_Y - 0.02, zc - 0.15, zc + 0.15, M_HEADER)
    text(name, cx, WALL_Y - 0.085, zc, 0.13 if len(name) < 10 else 0.1, M_YELLOW)
for gx, face, name in ((-2.35, 1, "FAMILY"), (2.25, -1, "THRILLER")):
    text(name, gx, 0.495, FLOOR + 1.81, 0.14, M_YELLOW)

# neon: a pink VIDEO and a cyan underline, just above where the TV sits in frame
text("VIDEO", 0.8, WALL_Y - 0.05, 1.42, 0.36, M_NEON, extrude=0.012)
box("neonbar", 0.34, 1.26, WALL_Y - 0.06, WALL_Y - 0.04, 1.25, 1.27, M_NEON2)
# and a smaller OPEN LATE on the left
text("OPEN LATE", -0.52, WALL_Y - 0.05, 1.42, 0.2, M_NEON2, extrude=0.01)

# a soft cool fill so the shadows are not black
fill = bpy.data.lights.new("fill", "AREA")
fill.energy = 110
fill.size = 6
fill.color = srgb("#c9d8ff")
fo = bpy.data.objects.new("fill", fill)
fo.location = (0, -1.0, CEIL - 0.1)
fo.rotation_euler = (math.radians(20), 0, 0)
link(fo)

world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.005, 0.01, 1)
scene.world = world

# ── camera: level, wide, focused on the TV ──────────────────────────────────
cam = bpy.data.cameras.new("cam")
cam.lens = LENS_MM
cam.sensor_width = SENSOR_MM
cam.sensor_fit = "HORIZONTAL"
cam.dof.use_dof = True
cam.dof.focus_distance = FOCUS
cam.dof.aperture_fstop = 0.35
cam.dof.aperture_blades = 6
cam.clip_end = 50
co = bpy.data.objects.new("cam", cam)
co.location = CAM
co.rotation_euler = (math.pi / 2, 0, 0)       # level, looking down +Y
link(co)
scene.camera = co

scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type != "CPU"          # GPU alone: CPU+GPU together stalled on this Mac
    scene.cycles.device = "GPU"
    print("cycles devices:", [(d.name, d.type, d.use) for d in prefs.devices])
except Exception as e:
    print("GPU unavailable:", e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = 0.35
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 82
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("plate", OUT)
