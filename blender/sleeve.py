"""
The rental case the sleeve card is made of, rendered in Cycles as two flat plates:

    blender -b -P blender/sleeve.py

  assets/clamshell.jpg  black pebbled clamshell plastic under a soft counter light,
                        with the faint sheen band a store's vinyl case carries
  assets/insert.jpg     the printed back-cover insert behind the clear sleeve:
                        coated card stock, near-black ink, fine paper tooth

Both 768×1536, straight-down orthographic, so the page can lay them behind the card
(cover-fit) at any card height. Procedural only; no photographs.
"""
import bpy, math, os, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "assets")

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def scene_setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type != "CPU"
        sc.cycles.device = "GPU"
    except Exception as e:
        print("GPU unavailable:", e)
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 768, 1536
    sc.view_settings.view_transform = "AgX"
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 84
    w = bpy.data.worlds.new("w"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.02, 0.025, 1)
    sc.world = w
    cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"; cam.ortho_scale = 2.0; cam.sensor_fit = "VERTICAL"
    co = bpy.data.objects.new("c", cam); co.location = (0, 0, 3); sc.collection.objects.link(co); sc.camera = co
    bpy.ops.mesh.primitive_plane_add(size=1)
    pl = bpy.context.active_object
    pl.scale = (1.0, 2.0, 1)       # 1 × 2 units fills the 1:2 frame (ortho 2 tall)
    return sc, pl

def area(sc, loc, energy, size, colour=(1, 1, 1)):
    ld = bpy.data.lights.new("a", "AREA"); ld.energy = energy; ld.size = size; ld.color = colour
    lo = bpy.data.objects.new("a", ld); lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(lo)

def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]

# ── clamshell: pebbled black plastic ─────────────────────────────────────────
sc, plane = scene_setup()
m, nt, b = material("clamshell")
b.inputs["Base Color"].default_value = (*srgb("#16171b"), 1)
b.inputs["Roughness"].default_value = 0.42
vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 260
noi = nt.nodes.new("ShaderNodeTexNoise"); noi.inputs["Scale"].default_value = 40; noi.inputs["Detail"].default_value = 8
mix = nt.nodes.new("ShaderNodeMath"); mix.operation = "ADD"
nt.links.new(vor.outputs["Distance"], mix.inputs[0]); nt.links.new(noi.outputs["Fac"], mix.inputs[1])
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.9; bump.inputs["Distance"].default_value = 0.006
nt.links.new(mix.outputs["Value"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
rough = nt.nodes.new("ShaderNodeMapRange")
rough.inputs["To Min"].default_value = 0.34; rough.inputs["To Max"].default_value = 0.55
nt.links.new(noi.outputs["Fac"], rough.inputs["Value"]); nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
plane.data.materials.append(m)
area(sc, (-2.6, 2.4, 0.9), 260, 1.2, srgb("#dfe8ff"))      # the store's troffer, low and raking so the pebbles cast
area(sc, (1.6, -1.8, 1.2), 10, 2.5, srgb("#ff9ccb"))       # a breath of the neon
sc.render.filepath = os.path.join(ASSETS, "clamshell.jpg")
bpy.ops.render.render(write_still=True)
print("clamshell", sc.render.filepath)

# ── insert: the printed back cover behind the clear sleeve ───────────────────
# A store-blue spine strip with a yellow pinstripe down the left edge, then dark
# ink laid as a coarse halftone that grows toward the foot (the way cheap 90s
# back covers printed a dark gradient), on coated card with visible tooth.
sc, plane = scene_setup()
m, nt, b = material("insert")
def col_in(node, name):
    return next(x for x in node.inputs if x.name == name and x.type == "RGBA")
def col_out(node):
    return next(x for x in node.outputs if x.name == "Result" and x.type == "RGBA")
uv = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
mapn = nt.nodes.new("ShaderNodeMapping"); mapn.inputs["Scale"].default_value = (1.0, 2.0, 1.0)   # plane is 1×2: square cells
nt.links.new(uv.outputs["UV"], mapn.inputs["Vector"])
vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 70
vor.voronoi_dimensions = "2D"; vor.inputs["Randomness"].default_value = 0.0      # a regular dot screen
nt.links.new(mapn.outputs["Vector"], vor.inputs["Vector"])
# dot radius grows toward the foot: 0.16 at the top, 0.46 at the bottom
rad = nt.nodes.new("ShaderNodeMapRange")
rad.inputs["From Min"].default_value = 0.0; rad.inputs["From Max"].default_value = 1.0
rad.inputs["To Min"].default_value = 0.46; rad.inputs["To Max"].default_value = 0.16
nt.links.new(sep.outputs["Y"], rad.inputs["Value"])
dot = nt.nodes.new("ShaderNodeMath"); dot.operation = "LESS_THAN"
nt.links.new(vor.outputs["Distance"], dot.inputs[0]); nt.links.new(rad.outputs["Result"], dot.inputs[1])
ink = nt.nodes.new("ShaderNodeMix"); ink.data_type = "RGBA"
col_in(ink, "A").default_value = (*srgb("#2a2d3c"), 1)       # paper showing through the screen
col_in(ink, "B").default_value = (*srgb("#0c0d12"), 1)       # the dots
nt.links.new(dot.outputs["Value"], ink.inputs["Factor"])
# the spine strip and its pinstripe
spine = nt.nodes.new("ShaderNodeMath"); spine.operation = "LESS_THAN"; spine.inputs[1].default_value = 0.075
nt.links.new(sep.outputs["X"], spine.inputs[0])
pin_lo = nt.nodes.new("ShaderNodeMath"); pin_lo.operation = "GREATER_THAN"; pin_lo.inputs[1].default_value = 0.075
pin_hi = nt.nodes.new("ShaderNodeMath"); pin_hi.operation = "LESS_THAN"; pin_hi.inputs[1].default_value = 0.083
nt.links.new(sep.outputs["X"], pin_lo.inputs[0]); nt.links.new(sep.outputs["X"], pin_hi.inputs[0])
pin = nt.nodes.new("ShaderNodeMath"); pin.operation = "MULTIPLY"
nt.links.new(pin_lo.outputs["Value"], pin.inputs[0]); nt.links.new(pin_hi.outputs["Value"], pin.inputs[1])
with_spine = nt.nodes.new("ShaderNodeMix"); with_spine.data_type = "RGBA"
col_in(with_spine, "B").default_value = (*srgb("#1537b8"), 1)
nt.links.new(col_out(ink), col_in(with_spine, "A")); nt.links.new(spine.outputs["Value"], with_spine.inputs["Factor"])
with_pin = nt.nodes.new("ShaderNodeMix"); with_pin.data_type = "RGBA"
col_in(with_pin, "B").default_value = (*srgb("#ffd21f"), 1)
nt.links.new(col_out(with_spine), col_in(with_pin, "A")); nt.links.new(pin.outputs["Value"], with_pin.inputs["Factor"])
nt.links.new(col_out(with_pin), b.inputs["Base Color"])
# paper tooth
tooth = nt.nodes.new("ShaderNodeTexNoise"); tooth.inputs["Scale"].default_value = 700; tooth.inputs["Detail"].default_value = 4
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.002
nt.links.new(tooth.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
b.inputs["Roughness"].default_value = 0.55
b.inputs["Coat Weight"].default_value = 0.25
b.inputs["Coat Roughness"].default_value = 0.25
plane.data.materials.append(m)
area(sc, (-2.2, 2.4, 1.2), 150, 1.6, srgb("#e6eeff"))
sc.render.filepath = os.path.join(ASSETS, "insert.jpg")
bpy.ops.render.render(write_still=True)
print("insert", sc.render.filepath)
