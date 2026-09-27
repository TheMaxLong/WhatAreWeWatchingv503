"""
The Mac app's icon: one film reel in tungsten gray on a graphite-black tile,
nothing else (owner 2026-09-27: "simplify, graphite theme, black and tungsten
gray"). macOS icon grid: 824 px body in a 1024 canvas, soft shadow. Cycles, on
transparent.

    blender -b -P mac/icon.py        → mac/AppIcon.png (1024 × 1024)
"""
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "AppIcon.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def mat(name, col, metal=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(col), 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*srgb(emit), 1)
        b.inputs["Emission Strength"].default_value = strength
    return m

def link(o):
    sc.collection.objects.link(o); return o

def cyl(name, r, depth, z, m, verts=128):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=depth)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me)); o.location.z = z
    if m: o.data.materials.append(m)
    return o

def cut(target, cutter):
    md = target.modifiers.new("cut", "BOOLEAN"); md.object = cutter; md.operation = "DIFFERENCE"; md.solver = "EXACT"
    cutter.hide_render = True; cutter.hide_viewport = True

def smooth(o, ang=40):
    for x in bpy.context.selected_objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(ang))

TILE = mat("graphite", "#141517", 0.35, 0.42)          # graphite: near-black with a satin metal sheen
TUNGSTEN = mat("tungsten", "#8b8d90", 1.0, 0.34)       # the reel
TUNGSTEN_DK = mat("tungsten_dk", "#5d6064", 1.0, 0.4)  # its rim and hub

# ── the tile: 0.824 square with 0.185 corners, in a 1.0 frame ───────────────
def rrect(w, h, r, seg=24):
    pts = []
    for ox, oy, a0 in ((w/2 - r, h/2 - r, 0), (-w/2 + r, h/2 - r, 90), (-w/2 + r, -h/2 + r, 180), (w/2 - r, -h/2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts
bm = bmesh.new()
face = bm.faces.new([bm.verts.new((x, y, 0.0)) for x, y in rrect(0.824, 0.824, 0.185)])
ext = bmesh.ops.extrude_face_region(bm, geom=[face])
for v in ext["geom"]:
    if isinstance(v, bmesh.types.BMVert):
        v.co.z = 0.03
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("tile"); bm.to_mesh(me); bm.free()
tile = link(bpy.data.objects.new("tile", me)); tile.data.materials.append(TILE)
soft = tile.modifiers.new("soft", "BEVEL"); soft.width = 0.008; soft.segments = 3; soft.limit_method = "ANGLE"
smooth(tile, 60)

# ── the reel, centred ──────────────────────────────────────────────────────────
RX, RY, R = 0.0, 0.0, 0.31
Z0 = 0.03
flange = cyl("flange", R, 0.012, Z0 + 0.03, TUNGSTEN); flange.location.x, flange.location.y = RX, RY
for k in range(5):                                   # five round windows onto the black
    a = math.radians(90 + k * 72)
    h = cyl(f"_hole{k}", 0.078, 0.06, Z0 + 0.03, None, 64)
    h.location.x, h.location.y = RX + math.cos(a) * 0.165, RY + math.sin(a) * 0.165
    cut(flange, h)
bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=0.009, major_segments=160, minor_segments=16,
                                 location=(RX, RY, Z0 + 0.036))
torus = bpy.context.active_object; torus.data.materials.append(TUNGSTEN_DK); smooth(torus, 80)
hub = cyl("hub", 0.058, 0.03, Z0 + 0.042, TUNGSTEN_DK); hub.location.x, hub.location.y = RX, RY
spindle = cyl("_spindle", 0.022, 0.08, Z0 + 0.042, None, 4); spindle.location.x, spindle.location.y = RX, RY
spindle.rotation_euler.z = math.radians(45)
cut(hub, spindle)                                    # the square drive hole

# ── shadow catcher under the tile, soft light from above-left ────────────────
bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, -0.001))
catcher = bpy.context.active_object; catcher.is_shadow_catcher = True
def area(loc, e, size, col="#ffffff"):
    ld = bpy.data.lights.new("a", "AREA"); ld.energy = e; ld.size = size; ld.color = srgb(col)
    lo = bpy.data.objects.new("a", ld); lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); link(lo)
area((-0.9, 1.2, 2.4), 70, 1.6, "#f4f4f2")
area((1.2, -0.8, 1.4), 14, 1.4, "#f4f4f2")
w = bpy.data.worlds.new("w"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.36, 0.36, 0.37, 1)
sc.world = w

cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"; cam.ortho_scale = 1.0
co = bpy.data.objects.new("c", cam); co.location = (0, -0.012, 3); link(co); sc.camera = co

sc.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = d.type != "CPU"
    sc.cycles.device = "GPU"
except Exception as e:
    print("GPU unavailable:", e)
sc.cycles.samples = 128
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 1024
sc.view_settings.view_transform = "AgX"
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("icon", OUT)
