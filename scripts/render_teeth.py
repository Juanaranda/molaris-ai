"""
Render 8 tooth images (4 types × 2 jaws) from All_Teeth.fbx.

Upper jaw:  camera from BELOW looking up  → simulates palatine view (what dentist
            sees when patient opens mouth and looks at upper arch)
Lower jaw:  camera from ABOVE looking down → simulates occlusal view of lower arch

Run with: blender --background --python scripts/render_teeth.py

Output: frontend/public/teeth/upper_{type}.png and lower_{type}.png

Credit: "Permanent Dentition" by University of Dundee, School of Dentistry
        CC BY 4.0 — https://skfb.ly/TXyX
"""

import bpy
import mathutils
import os

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
FBX_PATH    = os.path.join(PROJECT_DIR, "frontend", "public", "teeth",
                            "permanent-dentition", "source", "All_Teeth.fbx")
OUT_DIR     = os.path.join(PROJECT_DIR, "frontend", "public", "teeth")

# mesh prefix → (output_name, camera_direction)
# "up"   = camera above looking down  (lower arch)
# "down" = camera below looking up    (upper arch — palatine view)
RENDERS = [
    ("LL1", "lower_incisor",  "up"),
    ("LL3", "lower_canine",   "up"),
    ("LL4", "lower_premolar", "up"),
    ("LL6", "lower_molar",    "up"),
    # Upper uses same direction — flip handled in the React component (palatine mirror)
    ("LL1", "upper_incisor",  "up"),
    ("LL3", "upper_canine",   "up"),
    ("LL4", "upper_premolar", "up"),
    ("LL6", "upper_molar",    "up"),
]

# ── Scene ─────────────────────────────────────────────────────────────────────
def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def setup_world():
    """Soft white environment light — removes harsh shadows, gives ivory appearance."""
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background") or world.node_tree.nodes.new("ShaderNodeBackground")
    bg.inputs[0].default_value = (0.95, 0.92, 0.88, 1.0)  # warm white
    bg.inputs[1].default_value = 0.45                       # low strength — keeps contrast


def import_fbx():
    bpy.ops.import_scene.fbx(filepath=FBX_PATH)
    names = [o.name for o in bpy.data.objects if o.type == "MESH"]
    print("\n[render_teeth] Mesh objects found:")
    for n in sorted(names):
        print(f"  {n}")
    return names


def find_object(prefix, all_names):
    if prefix in all_names:
        return bpy.data.objects[prefix]
    for n in all_names:
        if n.upper().startswith(prefix.upper()):
            return bpy.data.objects[n]
    print(f"[render_teeth] WARNING: '{prefix}' not found.")
    return None


def apply_enamel(obj):
    mat = bpy.data.materials.new(name=f"Enamel_{obj.name}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for n in list(nodes):
        nodes.remove(n)

    out  = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    bsdf.inputs["Base Color"].default_value = (0.97, 0.93, 0.85, 1.0)  # ivory
    bsdf.inputs["Roughness"].default_value  = 0.22
    bsdf.inputs["IOR"].default_value        = 1.55
    for key in ("Subsurface Weight", "Subsurface"):
        try:
            bsdf.inputs[key].default_value = 0.06
            break
        except KeyError:
            pass
    try:
        bsdf.inputs["Subsurface Color"].default_value = (0.99, 0.84, 0.62, 1.0)
    except KeyError:
        pass
    try:
        bsdf.inputs["Specular IOR Level"].default_value = 0.75
    except KeyError:
        pass

    obj.data.materials.clear()
    obj.data.materials.append(mat)


def bbox_center(obj):
    pts = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    return (
        (min(xs) + max(xs)) / 2,
        (min(ys) + max(ys)) / 2,
        min(zs), max(zs),
        max(max(xs) - min(xs), max(ys) - min(ys)),
    )


def add_camera(obj, direction):
    """
    direction="up"   → camera above, looking down  (lower arch, occlusal view)
    direction="down" → camera below, looking up    (upper arch, palatine view)
    """
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    cam.data.type = "ORTHO"

    cx, cy, zmin, zmax, size = bbox_center(obj)
    cam.data.ortho_scale = size * 1.05   # tight crop → large tooth in frame

    if direction == "up":
        cam.location       = (cx, cy, zmax + 10)
        cam.rotation_euler = (0, 0, 0)            # looking straight down
    else:
        cam.location       = (cx, cy, zmin - 10)
        # Point camera upward: rotate 180° around X so it looks in +Z direction
        import math
        cam.rotation_euler = (math.pi, 0, 0)

    bpy.context.scene.camera = cam
    return cam


def add_lights(direction):
    lights = []

    def area(loc, energy, size, rot=(0, 0, 0)):
        bpy.ops.object.light_add(type="AREA", location=loc)
        l = bpy.context.active_object
        l.data.energy = energy
        l.data.size   = size
        l.rotation_euler = rot
        lights.append(l)

    if direction == "up":
        # Lighting for downward camera (lower arch)
        area((-3, -4,  12), 900, 6, (0.3, -0.2, 0))
        area(( 4,  3,   8), 320, 8)
        area(( 0,  0,  -4), 150, 4)
    else:
        # Lighting for upward camera (upper arch — palatine view)
        area((-3, -4, -12), 900, 6, (0.3 + 3.14, -0.2, 0))
        area(( 4,  3,  -8), 320, 8)
        area(( 0,  0,   4), 150, 4)

    return lights


def setup_render(output_path, samples=192):
    sc = bpy.context.scene
    sc.render.engine                         = "CYCLES"
    sc.render.film_transparent               = True
    sc.render.image_settings.file_format     = "PNG"
    sc.render.image_settings.color_mode      = "RGBA"
    sc.render.resolution_x                   = 512
    sc.render.resolution_y                   = 512
    sc.render.filepath                       = output_path
    sc.cycles.samples                        = samples


def render_one(mesh_prefix, out_name, direction, all_names):
    for ob in bpy.data.objects:
        ob.hide_render   = True
        ob.hide_viewport = True

    obj = find_object(mesh_prefix, all_names)
    if obj is None:
        return

    obj.hide_render   = False
    obj.hide_viewport = False
    apply_enamel(obj)

    cam    = add_camera(obj, direction)
    lights = add_lights(direction)

    output_path = os.path.join(OUT_DIR, f"{out_name}.png")
    setup_render(output_path)
    bpy.ops.render.render(write_still=True)
    print(f"[render_teeth] Saved: {output_path}")

    bpy.data.objects.remove(cam, do_unlink=True)
    for l in lights:
        bpy.data.objects.remove(l, do_unlink=True)


# ── Main ─────────────────────────────────────────────────────────────────────
clear_scene()
setup_world()
all_names = import_fbx()

for mesh_prefix, out_name, direction in RENDERS:
    render_one(mesh_prefix, out_name, direction, all_names)

print("\n[render_teeth] Done.")
