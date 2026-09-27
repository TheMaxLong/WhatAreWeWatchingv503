"""
The counter set: a late-70s silver portable TV on a 90s VCR, on a rental-store
counter, with a stack of returned tapes. Modelled from the owner's reference
photo (silver cabinet, screen left, VHF/UHF dials + grid strip + pull-on volume
top right, woodgrain speaker bottom right). No real brand anywhere.

    blender -b -P blender/tv.py -- [--preview]

Writes assets/set.glb and assets/set-ao.png (ambient occlusion baked in Cycles
onto the second UV set, applied in three.js as aoMap on uv channel 1).
--preview also renders blender/preview-set.png for a geometry check.

Units are metres. Blender is Z-up with the TV facing -Y; the glTF exporter
turns that into Y-up facing +Z, which is where the three.js camera stands.
Materials are named; the page paints the printed parts (dial numbers, grid
strip, woodgrain, badge, VFD, tape labels) from canvases by material name, and
drives the Screen with its CRT shader.
"""
import bpy, bmesh, math, sys, os, time
T0 = time.time()
def mark(what): print(f"[{time.time()-T0:6.1f}s] {what}", flush=True)
from mathutils import Vector, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")
os.makedirs(ASSETS, exist_ok=True)
PREVIEW = "--preview" in sys.argv

# ── scene reset ──────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"

MATS = {}
def mat(name, color, metallic=0.0, rough=0.5, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = False
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1.0)
        b.inputs["Emission Strength"].default_value = 1.0
    MATS[name] = m
    return m

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

# the palette of the set, from the reference photo and a 90s store counter
SILVER      = mat("M_Silver",      srgb("#b8babd"), 0.75, 0.38)   # painted cabinet shell
BEZEL       = mat("M_Bezel",       srgb("#c9cbce"), 0.85, 0.26)   # brushed screen surround
BLACK       = mat("M_Black",       srgb("#141416"), 0.0,  0.55)   # front plate
GLOSSBLACK  = mat("M_GlossBlack",  srgb("#0c0c0e"), 0.0,  0.18)   # dial plates, knobs
CHROME      = mat("M_Chrome",      srgb("#e6e8ea"), 1.0,  0.12)
BACKPLASTIC = mat("M_BackPlastic", srgb("#2a2826"), 0.0,  0.6)
SCREEN      = mat("M_Screen",      srgb("#101410"), 0.0,  0.1)
GRID        = mat("M_Grid",        srgb("#e9e9e4"), 0.0,  0.5)
DIAL_VHF    = mat("M_DialVHF",     srgb("#101012"), 0.0,  0.3)
DIAL_UHF    = mat("M_DialUHF",     srgb("#101012"), 0.0,  0.3)
WOOD        = mat("M_Wood",        srgb("#6b4a2e"), 0.0,  0.55)
CLOTH       = mat("M_Cloth",       srgb("#1a1512"), 0.0,  0.9)
BADGE       = mat("M_Badge",       srgb("#d0d2d4"), 0.8,  0.3)
VCR         = mat("M_VCR",         srgb("#1d1e21"), 0.0,  0.42)
VCRTRIM     = mat("M_VCRTrim",     srgb("#8d9096"), 0.7,  0.35)
VFD         = mat("M_VFD",         srgb("#050807"), 0.0,  0.08)
DOOR        = mat("M_Door",        srgb("#0e0e10"), 0.0,  0.3)
BUTTON      = mat("M_Button",      srgb("#2c2d31"), 0.0,  0.35)
LAMINATE    = mat("M_Laminate",    srgb("#3b4a66"), 0.0,  0.42)   # counter top, blue-grey fleck
EDGE        = mat("M_Edge",        srgb("#a7abb0"), 0.9,  0.3)    # aluminium T-moulding
FRONT       = mat("M_CounterFront", srgb("#0f2f8f"), 0.0, 0.5)    # rental-store blue
SLEEVE      = [mat(f"M_Sleeve{i}", srgb("#222222"), 0.0, 0.35) for i in range(3)]
CASSETTE    = mat("M_Cassette",    srgb("#0b0b0c"), 0.0,  0.4)
CAS_TOP     = mat("M_CassetteTop", srgb("#111111"), 0.0,  0.35)  # label + reel windows, painted by the page


def link(obj):
    scene.collection.objects.link(obj)
    return obj

def new_obj(name, bm, material_list):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in material_list:
        me.materials.append(m)
    return link(bpy.data.objects.new(name, me))

def box(name, x0, x1, y0, y1, z0, z1, material, bevel=0.0, segs=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    o = new_obj(name, bm, [material])
    if bevel > 0:
        md = o.modifiers.new("bevel", "BEVEL")
        md.width = bevel
        md.segments = segs
        md.limit_method = "ANGLE"
    return o

def cyl(name, x, y, z, r, depth, material, axis="Y", verts=48, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r, radius2=r, depth=depth)
    rot = {"Y": (math.pi / 2, 0, 0), "Z": (0, 0, 0), "X": (0, math.pi / 2, 0)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                     matrix=Euler(rot).to_matrix())
    o = new_obj(name, bm, [material])
    o.location = (x, y, z)
    if bevel > 0:
        md = o.modifiers.new("bevel", "BEVEL")
        md.width = bevel
        md.segments = 2
        md.limit_method = "ANGLE"
    return o

def plane_xz(name, x0, x1, z0, z1, y, material, nx=1, nz=1):
    """A front-facing plane (normal -Y) with clean 0-1 UVs, u along +X, v along +Z."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    grid = [[bm.verts.new((x0 + (x1 - x0) * i / nx, y, z0 + (z1 - z0) * j / nz))
             for j in range(nz + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(nz):
            f = bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
            for l in f.loops:
                l[uv].uv = ((l.vert.co.x - x0) / (x1 - x0), (l.vert.co.z - z0) / (z1 - z0))
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    return new_obj(name, bm, [material])

def rrect(cx, cz, w, h, r, seg=10):
    pts = []
    for ox, oz, a0 in ((cx + w / 2 - r, cz + h / 2 - r, 0), (cx - w / 2 + r, cz + h / 2 - r, 90),
                       (cx - w / 2 + r, cz - h / 2 + r, 180), (cx + w / 2 - r, cz - h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((ox + r * math.cos(a), oz + r * math.sin(a)))
    return pts

def bridge(bm, a, b):
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))

def smooth(o, angle=35):
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.selected_objects:
        ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))


# ── the TV ───────────────────────────────────────────────────────────────────
# cabinet: x -0.32..0.32, z 0..0.44, front face at y = -0.16
CAB_X, CAB_Z0, CAB_Z1, CAB_FRONT, CAB_BACK = 0.32, 0.0, 0.44, -0.16, 0.14

cab = box("TV_Cabinet", -CAB_X, CAB_X, CAB_FRONT, CAB_BACK, CAB_Z0, CAB_Z1, SILVER)
# recess for the black front plate
cut = box("_cut", -0.305, 0.305, CAB_FRONT - 0.05, CAB_FRONT + 0.012, 0.015, 0.425, BLACK)
bo = cab.modifiers.new("recess", "BOOLEAN")
bo.object = cut
bo.operation = "DIFFERENCE"
bo.solver = "EXACT"
bv = cab.modifiers.new("bevel", "BEVEL")
bv.width = 0.01
bv.segments = 4
bv.limit_method = "ANGLE"
cut.hide_render = True
cut.hide_viewport = True

box("TV_FrontPlate", -0.305, 0.305, CAB_FRONT + 0.008, CAB_FRONT + 0.03, 0.015, 0.425, BLACK)
FP = CAB_FRONT + 0.008     # front plate face

# screen bezel: a brushed frame with a lip that slopes back to the glass
SCR_CX, SCR_CZ = -0.075, 0.2375
SCR_W, SCR_H = 0.36, 0.27
BZ_FRONT = FP - 0.035          # the silver surround stands proud of the black plate, as on the reference
SEG = 12
bm = bmesh.new()
def loop(pts, y):
    return [bm.verts.new((x, y, z)) for x, z in pts]
outer_back  = loop(rrect(SCR_CX, SCR_CZ, 0.43, 0.35, 0.012, SEG), FP)
outer_front = loop(rrect(SCR_CX, SCR_CZ, 0.43, 0.35, 0.012, SEG), BZ_FRONT)
inner_front = loop(rrect(SCR_CX, SCR_CZ, 0.392, 0.302, 0.034, SEG), BZ_FRONT)
inner_mid   = loop(rrect(SCR_CX, SCR_CZ, 0.374, 0.284, 0.030, SEG), BZ_FRONT + 0.012)
inner_back  = loop(rrect(SCR_CX, SCR_CZ, SCR_W, SCR_H, 0.026, SEG), BZ_FRONT + 0.026)
bridge(bm, outer_back, outer_front)
bridge(bm, outer_front, inner_front)
bridge(bm, inner_front, inner_mid)
bridge(bm, inner_mid, inner_back)
bezel = new_obj("TV_Bezel", bm, [BEZEL])
smooth(bezel, 50)

# the tube face: slightly convex, clean 0-1 UVs for the CRT shader
SCREEN_Y = BZ_FRONT + 0.026 + 0.004    # just behind the lip, bulging forward
bm = bmesh.new()
uv = bm.loops.layers.uv.new("UVMap")
NX, NZ = 48, 36
sw, sh = SCR_W + 0.012, SCR_H + 0.012
vs = []
for i in range(NX + 1):
    col = []
    for j in range(NZ + 1):
        u, v = i / NX, j / NZ
        x = SCR_CX - sw / 2 + sw * u
        z = SCR_CZ - sh / 2 + sh * v
        dx, dz = (u - 0.5) * 2, (v - 0.5) * 2
        bulge = 0.014 * (1 - 0.55 * dx * dx - 0.55 * dz * dz)
        col.append(bm.verts.new((x, SCREEN_Y - bulge, z)))
    vs.append(col)
for i in range(NX):
    for j in range(NZ):
        f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
        for l in f.loops:
            l[uv].uv = ((l.vert.co.x - (SCR_CX - sw / 2)) / sw, (l.vert.co.z - (SCR_CZ - sh / 2)) / sh)
bm.normal_update()
for f in bm.faces:
    if f.normal.y > 0:
        f.normal_flip()
screen = new_obj("TV_Screen", bm, [SCREEN])
for p in screen.data.polygons:
    p.use_smooth = True

# right-hand control panel
PX0, PX1 = 0.158, 0.296
grid = plane_xz("TV_Grid", 0.162, 0.190, 0.300, 0.402, FP - 0.0015, GRID)
box("TV_AFC", 0.170, 0.182, FP - 0.006, FP, 0.278, 0.287, GLOSSBLACK, bevel=0.0015)
cyl("TV_VolumeSkirt", 0.176, FP - 0.004, 0.238, 0.011, 0.008, CHROME, bevel=0.001)
cyl("TV_Volume", 0.176, FP - 0.012, 0.238, 0.0075, 0.012, CHROME, bevel=0.0012)

for name, cz, dial_mat in (("VHF", 0.357, DIAL_VHF), ("UHF", 0.259, DIAL_UHF)):
    # black gloss plate behind each dial
    box(f"TV_{name}Plate", 0.200, 0.294, FP - 0.004, FP, cz - 0.047, cz + 0.047, GLOSSBLACK, bevel=0.003)
    # printed dial face: a disc with planar UVs
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    ring = []
    R = 0.037
    c = bm.verts.new((0.247, FP - 0.0045, cz))
    for k in range(64):
        a = 2 * math.pi * k / 64
        ring.append(bm.verts.new((0.247 + R * math.cos(a), FP - 0.0045, cz + R * math.sin(a))))
    for k in range(64):
        f = bm.faces.new((c, ring[k], ring[(k + 1) % 64]))
        for l in f.loops:
            l[uvl].uv = (0.5 + (l.vert.co.x - 0.247) / (2 * R), 0.5 + (l.vert.co.z - cz) / (2 * R))
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    new_obj(f"TV_{name}Face", bm, [dial_mat])
    # chrome ring around the dial
    bpy.ops.mesh.primitive_torus_add(major_radius=0.0395, minor_radius=0.0028,
                                     major_segments=64, minor_segments=10,
                                     location=(0.247, FP - 0.005, cz), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.active_object
    t.name = f"TV_{name}Ring"
    t.data.materials.append(CHROME)
    smooth(t, 80)
    # the knob that turns: a black body with a chrome bar pointer, pivot at its centre
    knob = cyl(f"Knob_{name}", 0.247, FP - 0.014, cz, 0.020, 0.018, GLOSSBLACK, bevel=0.002)
    bar = box(f"Knob_{name}_Bar", -0.0035, 0.0035, -0.012, 0.012, -0.030, 0.030, CHROME, bevel=0.0015)
    bar.location = (0.247, FP - 0.018, cz)
    bar.parent = knob
    bar.location = (0, -0.004, 0)
    smooth(knob, 40)

# woodgrain speaker: cloth backing and horizontal slats
plane_xz("TV_SpeakerCloth", 0.160, 0.294, 0.064, 0.198, FP - 0.0008, CLOTH)
for k in range(12):
    z0 = 0.068 + k * 0.0108
    box(f"TV_Slat{k:02d}", 0.160, 0.294, FP - 0.007, FP - 0.001, z0, z0 + 0.0072, WOOD, bevel=0.0012, segs=2)

# badge on the bottom strip
plane_xz("TV_Badge", -0.285, -0.205, 0.028, 0.044, FP - 0.0012, BADGE)

# the tube housing behind, tapering back
bm = bmesh.new()
f0 = loop(rrect(0, 0.225, 0.54, 0.38, 0.03, 4), CAB_BACK - 0.01)
f1 = loop(rrect(0, 0.235, 0.34, 0.24, 0.03, 4), CAB_BACK + 0.17)
bridge(bm, f0, f1)
bm.faces.new(list(reversed(f1)))
link_back = new_obj("TV_Back", bm, [BACKPLASTIC])

# ── the VCR under it ─────────────────────────────────────────────────────────
VCR_Z0, VCR_Z1, VCR_FRONT = -0.092, -0.004, -0.175
box("VCR_Body", -0.215, 0.215, VCR_FRONT, 0.15, VCR_Z0, VCR_Z1, VCR, bevel=0.004)
box("VCR_Trim", -0.215, 0.215, VCR_FRONT - 0.001, VCR_FRONT + 0.01, VCR_Z0, VCR_Z0 + 0.012, VCRTRIM, bevel=0.002)
box("VCR_Door", -0.192, -0.004, VCR_FRONT - 0.0015, VCR_FRONT + 0.004, -0.058, -0.030, DOOR, bevel=0.0015)
plane_xz("VCR_VFD", 0.022, 0.138, -0.066, -0.032, VCR_FRONT - 0.0012, VFD)
for k in range(5):
    x0 = 0.150 + k * 0.0125
    box(f"VCR_Btn{k}", x0, x0 + 0.0095, VCR_FRONT - 0.004, VCR_FRONT, -0.058, -0.050, BUTTON, bevel=0.0015)
box("VCR_Power", -0.200, -0.178, VCR_FRONT - 0.004, VCR_FRONT, -0.078, -0.070, BUTTON, bevel=0.0015)
# small feet
for x in (-0.19, 0.19):
    for y in (VCR_FRONT + 0.02, 0.13):
        cyl("VCR_Foot", x, y, VCR_Z0 - 0.003, 0.009, 0.006, BACKPLASTIC, axis="Z", verts=16)

# ── the counter ──────────────────────────────────────────────────────────────
TOP = VCR_Z0 - 0.006
box("Counter_Top", -1.8, 1.8, -0.46, 0.6, TOP - 0.035, TOP, LAMINATE)
box("Counter_Edge", -1.8, 1.8, -0.472, -0.456, TOP - 0.04, TOP + 0.003, EDGE, bevel=0.003)
box("Counter_Front", -1.8, 1.8, -0.45, -0.40, TOP - 1.1, TOP - 0.04, FRONT)

# ── returned tapes, stacked on the counter to the left ──────────────────────
def sleeve(name, x, y, z, rotz, material):
    # a VHS sleeve lying flat: 0.105 wide, 0.19 long, 0.026 thick
    o = box(name, -0.0525, 0.0525, -0.095, 0.095, 0.0, 0.026, material, bevel=0.0012, segs=2)
    o.location = (x, y, z)
    o.rotation_euler = (0, 0, math.radians(rotz))
    return o
# two returns dropped on top of the set
sleeve("Tape_0", 0.16, -0.02, CAB_Z1, 7, SLEEVE[0])
sleeve("Tape_1", 0.15, -0.03, CAB_Z1 + 0.026, -5, SLEEVE[1])
# a bare cassette lying on the counter in front of the VCR
cas = box("Cassette", -0.094, 0.094, -0.0515, 0.0515, 0.0, 0.025, CASSETTE, bevel=0.002)
cas.location = (0.2, -0.36, TOP)
cas.rotation_euler = (0, 0, math.radians(-16))
# its top face as a decal with clean UVs: the page paints the label and the reels
bm = bmesh.new()
uvl = bm.loops.layers.uv.new("UVMap")
corners = [(-0.091, -0.0485), (0.091, -0.0485), (0.091, 0.0485), (-0.091, 0.0485)]
vs = [bm.verts.new((x, y, 0.0254)) for x, y in corners]
f = bm.faces.new(vs)
for l in f.loops:
    # u runs along the tape's length, v from the front edge (label side) back
    l[uvl].uv = ((l.vert.co.x + 0.091) / 0.182, (l.vert.co.y + 0.0485) / 0.097)
top = new_obj("Cassette_Top", bm, [CAS_TOP])
top.parent = cas

mark("modelled")
# ── apply modifiers, give every mesh UVMap (0) + AO (1) ─────────────────────
bpy.ops.object.select_all(action="DESELECT")
meshes = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
for o in meshes:
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
    o.select_set(False)
bpy.data.objects.remove(bpy.data.objects["_cut"], do_unlink=True)
meshes = [o for o in scene.objects if o.type == "MESH"]

for o in meshes:
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
        # a box projection so textures on boxes (woodgrain slats, sleeves) land sensibly
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.cube_project(cube_size=0.2)
        bpy.ops.object.mode_set(mode="OBJECT")
        o.select_set(False)
    ao = me.uv_layers.new(name="AO")
    me.uv_layers.active = ao

# one shared AO atlas for everything
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
# the counter is 3.6 m of flat laminate; at true scale it would take most of the
# atlas and leave the TV blurry. Its islands shrink before packing so the detail
# goes where the eye goes.
for o in meshes:
    if o.name.startswith("Counter_"):
        for d in o.data.uv_layers["AO"].data:
            d.uv = d.uv * 0.12
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.pack_islands(margin=0.003, rotate=True)
bpy.ops.object.mode_set(mode="OBJECT")

# ── bake ambient occlusion in Cycles ────────────────────────────────────────
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
    print("cycles devices:", [(d.name, d.type, d.use) for d in prefs.devices])
except Exception as e:
    print("GPU unavailable, baking on CPU:", e)
scene.cycles.samples = 128
scene.world = bpy.data.worlds.new("World")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)

AO_SIZE = 2048
img = bpy.data.images.new("AO", AO_SIZE, AO_SIZE, alpha=False, float_buffer=False)
img.colorspace_settings.name = "Non-Color"
for m in bpy.data.materials:
    n = m.node_tree.nodes.new("ShaderNodeTexImage")
    n.image = img
    n.name = "AO_BAKE"
    m.node_tree.nodes.active = n
scene.render.bake.margin = 6
scene.cycles.bake_type = "AO"
scene.world.light_settings.distance = 0.25
# Cycles bakes one selected object at a time and rebuilds the scene for each,
# which made 60 parts take ten minutes. Bake one merged copy instead (same AO
# UVs, since it is copied after packing), with the originals hidden so no
# surface sits on top of its own twin.
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.duplicate()
dups = list(bpy.context.selected_objects)
bpy.context.view_layer.objects.active = dups[0]
bpy.ops.object.join()
merged = bpy.context.active_object
merged.name = "_bake"
for o in meshes:
    o.hide_render = True
bpy.ops.object.select_all(action="DESELECT")
merged.select_set(True)
bpy.context.view_layer.objects.active = merged
merged.data.uv_layers.active = merged.data.uv_layers["AO"]
mark("bake start")
bpy.ops.object.bake(type="AO", use_clear=True, margin=6)
mark("bake done")
bpy.data.objects.remove(merged, do_unlink=True)
for o in meshes:
    o.hide_render = False
# the page embeds it, so it ships small: 1024 px JPEG (AO is soft; JPEG loses nothing visible)
img.scale(1024, 1024)
img.filepath_raw = os.path.join(ASSETS, "set-ao.jpg")
img.file_format = "JPEG"
img.save()
print("baked", img.filepath_raw)

# keep UVMap as the active/render UV for export; drop the bake nodes
for o in meshes:
    o.data.uv_layers.active = o.data.uv_layers["UVMap"]
    o.data.uv_layers["UVMap"].active_render = True
for m in bpy.data.materials:
    m.node_tree.nodes.remove(m.node_tree.nodes["AO_BAKE"])

# ── export ───────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=os.path.join(ASSETS, "set.glb"),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
print("exported", os.path.join(ASSETS, "set.glb"))

# ── optional geometry preview ────────────────────────────────────────────────
if PREVIEW:
    cam = bpy.data.cameras.new("cam")
    cam.lens = 35
    co = bpy.data.objects.new("cam", cam)
    link(co)
    co.location = (0.05, -1.35, 0.28)
    co.rotation_euler = (math.radians(86), 0, 0)
    scene.camera = co
    for loc, e, size in (((-1.0, -1.4, 1.4), 400, 1.5), ((1.2, -0.8, 0.9), 150, 1.0), ((0, 1.0, 1.5), 200, 1.2)):
        ld = bpy.data.lights.new("l", "AREA")
        ld.energy = e
        ld.size = size
        lo = bpy.data.objects.new("l", ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0.2)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        link(lo)
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.05, 0.07, 1)
    scene.cycles.samples = 64
    scene.render.resolution_x, scene.render.resolution_y = 1400, 900
    scene.render.filepath = os.path.join(ROOT, "blender", "preview-set.png")
    bpy.ops.render.render(write_still=True)
    print("preview", scene.render.filepath)
