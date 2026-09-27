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
b.inputs["Base Color"].default_value = (*srgb("#101114"), 1)
b.inputs["Roughness"].default_value = 0.42
vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 260
noi = nt.nodes.new("ShaderNodeTexNoise"); noi.inputs["Scale"].default_value = 40; noi.inputs["Detail"].default_value = 8
mix = nt.nodes.new("ShaderNodeMath"); mix.operation = "ADD"
nt.links.new(vor.outputs["Distance"], mix.inputs[0]); nt.links.new(noi.outputs["Fac"], mix.inputs[1])
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.55; bump.inputs["Distance"].default_value = 0.004
nt.links.new(mix.outputs["Value"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
rough = nt.nodes.new("ShaderNodeMapRange")
rough.inputs["To Min"].default_value = 0.34; rough.inputs["To Max"].default_value = 0.55
nt.links.new(noi.outputs["Fac"], rough.inputs["Value"]); nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
plane.data.materials.append(m)
area(sc, (-1.4, 2.2, 1.6), 55, 1.6, srgb("#dfe8ff"))       # the store's troffer, off the top-left
area(sc, (1.6, -1.8, 1.2), 10, 2.5, srgb("#ff9ccb"))       # a breath of the neon
sc.render.filepath = os.path.join(ASSETS, "clamshell.jpg")
bpy.ops.render.render(write_still=True)
print("clamshell", sc.render.filepath)

# ── insert: coated card, near-black ink, paper tooth ────────────────────────
sc, plane = scene_setup()
m, nt, b = material("insert")
noi = nt.nodes.new("ShaderNodeTexNoise"); noi.inputs["Scale"].default_value = 900; noi.inputs["Detail"].default_value = 3
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (*srgb("#0f1015"), 1)
ramp.color_ramp.elements[1].color = (*srgb("#1b1d25"), 1)
nt.links.new(noi.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
fib = nt.nodes.new("ShaderNodeTexWave"); fib.inputs["Scale"].default_value = 120; fib.inputs["Distortion"].default_value = 30
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08
nt.links.new(fib.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
b.inputs["Roughness"].default_value = 0.5
b.inputs["Coat Weight"].default_value = 0.35
b.inputs["Coat Roughness"].default_value = 0.2
plane.data.materials.append(m)
area(sc, (-1.2, 2.4, 1.8), 40, 2.2, srgb("#e6eeff"))
sc.render.filepath = os.path.join(ASSETS, "insert.jpg")
bpy.ops.render.render(write_still=True)
print("insert", sc.render.filepath)
