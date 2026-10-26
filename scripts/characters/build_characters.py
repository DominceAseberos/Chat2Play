"""Reproducible Chat2Play character authoring. Blender 5.2, no external assets.
Run with Blender --background --python this_file -- --character female [--render].
Coordinates: Z up, face toward -Y. Export converts to glTF Y up / +Z forward.
"""
import bpy, math, random, json, sys, argparse
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--character',choices=['female','male'],default='female')
parser.add_argument('--render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
name=args.character
random.seed(19)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
V=[]; F=[]; C=[]; W=[]; tags={}
palette=dict(skin='#FFD0AC',skinShade='#EBA489',pink='#F779B3',pinkLight='#FFACD2',
 cream='#FFF0EC',purple='#8250BE',purpleDark='#644094',gold='#FFCD52',goldDark='#D9952E',
 hair='#94425F' if name=='female' else '#403046',hairLight='#B95579' if name=='female' else '#56394D',
 blue='#5486FF',blueDark='#6541CC',ink='#302339',mouth='#862342',tongue='#F57C9D',white='#FFF9F2')
def rgb(s):
    h=palette.get(s,s).lstrip('#'); v=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v)
def vert(p,w,tag=None):
    i=len(V);V.append(tuple(p));W.append({w:1.} if isinstance(w,str) else w)
    if tag: tags.setdefault(tag,[]).append(i)
    return i
def face(ids,color,jitter=.035):
    F.append(tuple(ids));base=rgb(color);j=1+random.uniform(-jitter,jitter)
    C.append(tuple(min(1,max(0,c*j)) for c in base)+(1,))
def surface(x,z):
    return -.515*math.sqrt(max(.08,1-(x/.675)**2-((z-2.40)/.65)**2))
def ellipsoid(label,center,scale,color,bone='head',segments=16,rings=10,tag=None):
    # Explicit latitude loops give stable authored topology, no runtime primitives.
    cx,cy,cz=center;sx,sy,sz=scale; rows=[]
    top=vert((cx,cy,cz+sz),bone,tag)
    for j in range(1,rings):
        p=math.pi*j/rings;row=[]
        for i in range(segments):
            t=2*math.pi*(i+(j%2)*.19)/segments
            row.append(vert((cx+sx*math.sin(p)*math.sin(t),cy-sy*math.sin(p)*math.cos(t),cz+sz*math.cos(p)),bone,tag))
        rows.append(row)
    bot=vert((cx,cy,cz-sz),bone,tag)
    for i in range(segments): face((top,rows[0][i],rows[0][(i+1)%segments]),color)
    for j in range(len(rows)-1):
        for i in range(segments):
            a,b,c,d=rows[j][i],rows[j][(i+1)%segments],rows[j+1][(i+1)%segments],rows[j+1][i]
            if (i+j)%2: face((a,b,d),color);face((b,c,d),color)
            else: face((a,b,c),color);face((a,c,d),color)
    for i in range(segments):face((rows[-1][i],bot,rows[-1][(i+1)%segments]),color)
def tube(points,radii,color,weights,segments=10,tag=None):
    pts=[Vector(p) for p in points];rows=[]
    for k,p in enumerate(pts):
        tangent=(pts[min(k+1,len(pts)-1)]-pts[max(0,k-1)]).normalized()
        ref=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
        u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
        r=radii[k];r=(r,r) if isinstance(r,(float,int)) else r
        weight=weights[k] if isinstance(weights,list) else weights
        rows.append([vert(p+u*(r[0]*math.cos(i*math.tau/segments))+v*(r[1]*math.sin(i*math.tau/segments)),weight,tag) for i in range(segments)])
    # clockwise caps viewed from exterior
    face(tuple(reversed(rows[0])),color)
    for k in range(len(rows)-1):
        for i in range(segments):
            a,b,c,d=rows[k][i],rows[k][(i+1)%segments],rows[k+1][(i+1)%segments],rows[k+1][i]
            face((a,b,c),color);face((a,c,d),color)
    face(rows[-1],color)
def panel(points,color,bone='chest',thickness=.025,tag=None):
    front=[vert(p,bone,tag) for p in points];back=[vert((p[0],p[1]+thickness,p[2]),bone,tag) for p in points]
    face(tuple(reversed(front)),color);face(back,color)
    for i in range(len(points)):face((front[i],front[(i+1)%len(points)],back[(i+1)%len(points)],back[i]),color)
def star(cx,cy,cz,r,bone):
    pts=[(cx+math.sin(i*math.pi/5)*(r if i%2==0 else r*.49),cy,cz+math.cos(i*math.pi/5)*(r if i%2==0 else r*.49)) for i in range(10)]
    center=vert((cx,cy-.035,cz),bone)
    ids=[vert(p,bone) for p in pts]
    for i in range(10):face((center,ids[(i+1)%10],ids[i]),'gold' if i%2 else 'goldDark')
def stroke(points,r,color,bone='head',tag=None):tube(points,[r]*len(points),color,bone,6,tag)

# Broad cheeks, flattened facial plane, small ears and a subtle nose.
ellipsoid('head',(0,0,2.40),(.675,.515,.65),'skin',segments=28,rings=18)
for s in [-1,1]:
    ellipsoid('ear',(s*.655,.005,2.28),(.115,.087,.155),'skin',segments=12,rings=8)
    ellipsoid('earInner',(s*.711,-.059,2.28),(.043,.027,.085),'skinShade',segments=8,rings=6)
ellipsoid('nose',(0,-.522,2.30),(.052,.038,.042),'skin',segments=10,rings=6)

# Wrapped hair shell: close cropped front, deep occipital volume at the back.
hair_start=len(V)
rows=[];n=28
top=vert((0,.045,3.145),'head')
for j in range(1,10):
    row=[]
    for i in range(n):
        t=math.tau*i/n; back=(1-math.cos(t))/2
        bottom=1.16+1.10*back
        p=bottom*j/9
        row.append(vert((.744*math.sin(p)*math.sin(t),.055-.585*math.sin(p)*math.cos(t),2.43+.715*math.cos(p)),'head'))
    rows.append(row)
for i in range(n):face((top,rows[0][i],rows[0][(i+1)%n]),'hairLight')
for j in range(8):
    for i in range(n):
        a,b,c,d=rows[j][i],rows[j][(i+1)%n],rows[j+1][(i+1)%n],rows[j+1][i]
        color='hairLight' if j<3 and i%4!=0 else 'hair'
        face((a,b,c),color,.09);face((a,c,d),color,.09)
# Sculpted tapered fringe locks, each with a low ridge instead of spherical tufts.
for x,z,w,tip in [(-.51,2.91,.25,2.55),(-.30,3.00,.29,2.68),(-.06,3.04,.32,2.66),(.19,3.01,.30,2.79),(.42,2.95,.25,2.62),(.60,2.80,.17,2.43)]:
    def hair_front(xx,zz):return .055-.585*math.sqrt(max(.045,1-(xx/.744)**2-((zz-2.43)/.715)**2))-.018
    outline=[(x-w/2,z),(x+w/2,z-.015),(x+w*.40,tip+.10),(x-w*.12,tip),(x-w*.48,tip+.11)]
    points=[(xx,hair_front(xx,zz),zz) for xx,zz in outline]
    midz=(z+tip)/2+.04
    ids=[vert(p,'head') for p in points];mid=vert((x,hair_front(x,midz)-.025,midz),'head')
    for i in range(5):face((ids[i],mid,ids[(i+1)%5]),'hairLight' if i==0 else 'hair',.085)
    face(tuple(reversed(ids)),'hair')
if name=='female':
    for s in [-1,1]:
        for j in range(4):
            ellipsoid('braid',(s*(.61+j*.043),.28-j*.018,2.13-j*.18),(.175-j*.013,.17-j*.013,.155),'hairLight' if j%2 else 'hair',segments=10,rings=6)
        tube([(s*.718,.24,1.79),(s*.735,.235,1.73)], [.14,.14],'gold','head',10)
        ellipsoid('braidTip',(s*.77,.24,1.59),(.14,.14,.17),'hair',segments=10,rings=6)
    # Enamel clip laid on the front-right hair surface.
    panel([(.40,-.48,2.93),(.60,-.36,2.77),(.67,-.345,2.86),(.48,-.47,3.02)],'gold','head',.045)
else:
    # Tuck the upper hair under the baseball cap to prevent crown intersections.
    for i in range(hair_start,len(V)):
        x,y,z=V[i]
        if z>2.65:V[i]=(x,y,2.65+(z-2.65)*.60)
    # Low crown, broad curved bill, rear adjuster, gold badge.
    cap=[];topc=vert((0,.045,3.23),'head');seg=24
    for j in range(1,7):
        p=1.50*j/6
        cap.append([vert((.78*math.sin(p)*math.sin(i*math.tau/seg),.03-.63*math.sin(p)*math.cos(i*math.tau/seg),2.71+.51*math.cos(p)),'head') for i in range(seg)])
    for i in range(seg):face((topc,cap[0][i],cap[0][(i+1)%seg]),'blueDark')
    for j in range(5):
        for i in range(seg):face((cap[j][i],cap[j+1][i],cap[j+1][(i+1)%seg],cap[j][(i+1)%seg]),'blueDark' if j<3 else 'blue')
    # Solid visor with a curved silhouette and a thickness edge.
    outline=[(-.66,-.31,2.76),(-.62,-.64,2.75),(-.43,-.85,2.73),(0,-.94,2.72),(.43,-.85,2.73),(.62,-.64,2.75),(.66,-.31,2.76)]
    panel(outline,'blueDark','head',.045)
    panel([(-.18,-.614,2.85),(.18,-.614,2.85),(.17,-.556,3.05),(-.17,-.556,3.05)],'gold','head',.03)
    panel([(-.20,.653,2.72),(.20,.653,2.72),(.20,.645,2.78),(-.20,.645,2.78)],'blueDark','head')

# Eyes and eyebrows sit on the curved face. All pieces share morph keys.
for s in [-1,1]:
    x=s*.245;z=2.40;y=surface(x,z)-.024
    ellipsoid('eye',(x,y,z),(.078,.026,.115),'ink',segments=16,rings=10,tag='eye'+str(s))
    ellipsoid('eyeGlint',(x-.022,y-.026,z+.044),(.024,.008,.028),'white',segments=8,rings=6,tag='glint'+str(s))
    ellipsoid('eyeGlintSmall',(x+.027,y-.026,z-.027),(.009,.006,.011),'white',segments=6,rings=4,tag='glint'+str(s))
    bx=s*.255;bz=2.595;by=surface(bx,bz)-.035
    stroke([(bx-.070,by+.015,bz-.008),(bx,by-.008,bz+.017),(bx+.066,by+.015,bz-.004)],.019,'hair',tag='brow'+str(s))
    x=s*.437;z=2.235;y=surface(x,z)-.018
    ellipsoid('blush',(x,y,z),(.116,.023,.055),'pink',segments=12,rings=6)
# Shared mouth topology, with individually authored contours for every emotion.
# The neutral face has a small closed smile rather than a permanent open grin.
mx,mz=0,2.188
mouth_states={key:{} for key in ['Basis','Happy','Sad','Surprised']}
def mouth_point(state,u,v,outer=False):
    if state=='Happy':
        x=.165*u
        z=mz+(.036+.020*u*u if v>=0 else .04+.18*v+.012*u*u)
    elif state=='Sad':x=.120*u;z=mz+.028*(1-u*u)-.035+.005*v
    elif state=='Surprised':x=.063*u;z=mz+.005+.088*v
    else:x=.120*u;z=mz+.030*u*u-.018+.005*v
    if outer:x+=.009*u;z+=.009*v
    return (x,-.552 if outer else -.553,z)
inner=[];outer=[]
for j in range(20):
    theta=-math.pi/2+j*math.tau/20;u,v=math.sin(theta),math.cos(theta)
    for ring,is_outer in [(inner,False),(outer,True)]:
        idx=vert(mouth_point('Basis',u,v,is_outer),'head','mouth');ring.append(idx)
        for state in mouth_states:mouth_states[state][idx]=mouth_point(state,u,v,is_outer)
center=vert((0,-.553,mz-.018),'head','mouth')
for state in mouth_states:
    dz={'Basis':-.018,'Happy':-.035,'Sad':-.015,'Surprised':.005}[state]
    mouth_states[state][center]=(0,-.553,mz+dz)
for j in range(20):
    k=(j+1)%20
    face((outer[j],outer[k],inner[k],inner[j]),'ink',0)
# Fill matched upper/lower contour columns. A center fan in the narrow rest
# smile produced inverted triangles and wrong inherited normals when opened.
for j in range(10):
    a,b=inner[j],inner[j+1]
    c,d=inner[(20-j-1)%20],inner[(20-j)%20]
    ids=[d,c,b,a]
    ids=list(dict.fromkeys(ids))
    face(ids,'mouth',0)
start_tongue=len(V)
ellipsoid('tongue',(0,-.574,mz-.10),(.078,.010,.032),'tongue',segments=12,rings=6,tag='tongue')
for i in range(start_tongue,len(V)):
    p=V[i]
    for state in mouth_states:
        mouth_states[state][i]=p if state=='Happy' else (p[0]*.01,p[1]+.12,mz-.02+(p[2]-(mz-.10))*.01)
    V[i]=mouth_states['Basis'][i]

# Shirt and puffed trousers are shaped ring meshes with interpolated skin weights.
topcolor='pink' if name=='female' else 'blue'
tube([(0,0,.82),(0,0,1.02),(0,0,1.34),(0,.01,1.61),(0,0,1.73)],[(.35,.25),(.43,.29),(.45,.29),(.42,.25),(.24,.21)],topcolor,
     ['hips',{'hips':.6,'spine':.4},'spine','chest','chest'],20)
tube([(0,0,1.66),(0,0,1.96)],[.16,.16],'skin','neck',12)
# Bib, pocket, cross-back straps, brass clasps, central enamel star.
panel([(-.33,-.292,1.03),(.33,-.292,1.03),(.31,-.303,1.53),(-.31,-.303,1.53)],'cream')
panel([(-.18,-.324,1.085),(.18,-.324,1.085),(.18,-.324,1.32),(-.18,-.324,1.32)],'pinkLight' if name=='female' else '#C4BAF4')
star(0,-.365,1.21,.095,'chest')
for s in [-1,1]:
    tube([(s*.274,-.295,1.41),(s*.275,-.258,1.67),(s*.272,.01,1.737),(s*.27,.26,1.57),(s*.16,.292,1.26)],[(.063,.027)]*5,'cream','chest',6)
    ellipsoid('button',(s*.274,-.335,1.43),(.057,.029,.057),'gold','chest',10,6)
    stroke([(s*.14,.304,1.27),(-s*.26,.274,1.65)],.044,'cream','chest')
tube([(0,0,.74),(0,0,.94),(0,0,1.04)],[(.37,.265),(.43,.29),(.40,.27)],'purple','hips',18)

bones=[('root',(0,0,0),(0,0,.24),None),('hips',(0,0,.88),(0,0,1.08),'root'),('spine',(0,0,1.08),(0,0,1.39),'hips'),('chest',(0,0,1.39),(0,0,1.73),'spine'),('neck',(0,0,1.73),(0,0,1.95),'chest'),('head',(0,0,1.95),(0,0,2.73),'neck')]
for s,suffix in [(-1,'R'),(1,'L')]:
    shoulder=(s*.40,0,1.60);elbow=(s*.66,-.015,1.32);wrist=(s*.79,-.065,1.09)
    bones += [('upper_arm.'+suffix,shoulder,elbow,'chest'),('forearm.'+suffix,elbow,wrist,'upper_arm.'+suffix),('hand.'+suffix,wrist,(s*.83,-.075,.94),'forearm.'+suffix)]
    arm='upper_arm.'+suffix;fore='forearm.'+suffix;hand='hand.'+suffix
    tube([shoulder,(s*.53,0,1.50),(s*.61,-.01,1.39)],[.194,.205,.16],topcolor,arm,12)
    tube([(s*.60,-.01,1.41),elbow,(s*.73,-.044,1.20),wrist],[.139,.138,.118,.099],'skin',[arm,{arm:.5,fore:.5},fore,fore],12)
    tube([(s*.59,-.01,1.40),(s*.625,-.01,1.365)],[.157,.153],'pinkLight' if name=='female' else 'cream',arm,12)
    # Palm surface and five articulated digits; two phalanges per digit.
    ellipsoid('palm',(s*.813,-.071,1.018),(.115,.067,.123),'skin',hand,12,8)
    for i,finger in enumerate(['index','middle','ring','pinky']):
        x=s*(.743+i*.052);z= .950+(.015 if i==3 else 0);length=[.145,.167,.154,.12][i]
        p0=(x,-.077,z);p1=(x+s*(i-1.5)*.011,-.087,z-length*.52);p2=(x+s*(i-1.5)*.019,-.075,z-length)
        bn=finger+'.01.'+suffix;bn2=finger+'.02.'+suffix
        bones += [(bn,p0,p1,hand),(bn2,p1,p2,bn)]
        tube([p0,p1,p2], [.031,.029,.013],'skin',[bn,{bn:.45,bn2:.55},bn2],8)
    p0=(s*.724,-.077,1.043);p1=(s*.675,-.12,1.005);p2=(s*.650,-.15,.961)
    b1='thumb.01.'+suffix;b2='thumb.02.'+suffix
    bones += [(b1,p0,p1,hand),(b2,p1,p2,b1)]
    tube([p0,p1,p2],[.044,.037,.019],'skin',[b1,{b1:.45,b2:.55},b2],8)
    thigh='thigh.'+suffix;shin='shin.'+suffix;foot='foot.'+suffix
    bones += [(thigh,(s*.237,0,.88),(s*.26,0,.51),'hips'),(shin,(s*.26,0,.51),(s*.26,0,.20),thigh),(foot,(s*.26,0,.20),(s*.26,-.27,.12),shin)]
    tube([(s*.24,0,.92),(s*.26,0,.78),(s*.27,0,.60),(s*.26,0,.48),(s*.26,0,.30)],[(.22,.245),(.257,.264),(.244,.24),(.185,.185),(.147,.157)],'purple',[thigh,thigh,{thigh:.8,shin:.2},{thigh:.35,shin:.65},shin],14)
    tube([(s*.26,0,.34),(s*.26,0,.275)], [.158,.157],'purpleDark',shin,12)
    tube([(s*.26,0,.28),(s*.26,0,.17)],[.125,.128],'cream',foot,12)
    ellipsoid('shoe',(s*.26,-.12,.16),(.248,.35,.14),'pink' if name=='female' else 'cream',foot,16,8)
    tube([(s*.26,-.12,.005),(s*.26,-.12,.065)],[(.244,.344),(.254,.35)],'purpleDark' if name=='female' else '#BDB0EC',foot,16)
    panel([(s*.26-.18,-.01,.19),(s*.26-.18,-.12,.19),(s*.26-.10,-.18,.22)],'gold',foot)
    for yy,zz in [(-.17,.255),(-.24,.222)]:stroke([(s*.26-.10,yy,zz),(s*.26+.10,yy,zz)],.018,'white',foot)

mesh=bpy.data.meshes.new('Chat2Play_'+name+'_topology');mesh.from_pydata(V,[],F);mesh.update()
obj=bpy.data.objects.new('Character_'+name,mesh);bpy.context.collection.objects.link(obj)
colors=mesh.color_attributes.new(name='Palette',type='FLOAT_COLOR',domain='CORNER')
for p,c in zip(mesh.polygons,C):
    for li in p.loop_indices:colors.data[li].color=c
mat=bpy.data.materials.new('Chat2Play_vertex_palette');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.83
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Palette';mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color']);obj.data.materials.append(mat)
# Recalculate normals once, preserving deliberately flat triangles.
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
obj.shape_key_add(name='Basis')
for key in ['Blink','Happy','Sad','Surprised']:
    sk=obj.shape_key_add(name=key)
    for s in [-1,1]:
        cx=s*.245
        for tag in ['eye'+str(s),'glint'+str(s)]:
            for i in tags[tag]:
                x,y,z=V[i]
                if key=='Blink': z=2.40+(z-2.40)*.07
                elif key=='Happy': z=2.42+(z-2.40)*.18+.035*(1-((x-cx)/.09)**2)
                elif key=='Sad': z=2.375+(z-2.40)*.80-s*(x-cx)*.30;x=cx+(x-cx)*.94
                else:z=2.40+(z-2.40)*1.12
                if tag.startswith('glint') and key in ['Happy','Blink']:y+=.06
                sk.data[i].co=(x,y,z)
        for i in tags['brow'+str(s)]:
            x,y,z=V[i]
            if key=='Sad':z+=.035-s*(x-cx)*.55
            elif key in ['Happy','Surprised']:z+=.045 if key=='Happy' else .08
            sk.data[i].co=(x,y,z)
    for i,p in mouth_states.get(key,mouth_states['Basis']).items():sk.data[i].co=p

armature=bpy.data.armatures.new('Chat2Play_shared_skeleton');rig=bpy.data.objects.new('Rig_'+name,armature);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;obj.select_set(False);rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for bn,h,t,parent in bones:
    b=armature.edit_bones.new(bn);b.head=h;b.tail=t
    if parent:b.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
for bn,*_ in bones:obj.vertex_groups.new(name=bn)
for i,weights in enumerate(W):
    for bn,w in weights.items():obj.vertex_groups[bn].add([i],w,'REPLACE')
modifier=obj.modifiers.new('Weighted deformation','ARMATURE');modifier.object=rig
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
rig['conventions']='Z-up Blender / +Z-forward glTF; matching female/male skeleton; two joints per digit'
obj['design_reference']='Chibi Character Turnaround Sheet.png supplied by the user'

# Actions include real bone and morph animation, sampled at intentional key poses.
scene=bpy.context.scene;scene.render.fps=30
rig.animation_data_create();obj.data.shape_keys.animation_data_create()
action_names=['Idle','Walk','Blink','Happy','Sad','Surprised','Celebrate','VictoryDance','NodYes','ShakeNo','LookLeft','LookRight','Sit','Stand','RaiseArms','LowerArms','RPSAnticipation','RPSPump','Rock','Paper','Scissors','Throw','Lose','POVReady','POVPump','POVThrow','POVRock','POVPaper','POVScissors']
def reset():
    for p in rig.pose.bones:p.location=(0,0,0);p.rotation_euler=(0,0,0);p.scale=(1,1,1)
    for sk in obj.data.shape_keys.key_blocks:sk.value=0
def rot(b,x=0,y=0,z=0):rig.pose.bones[b].rotation_euler=(x,y,z)
def aim(bone,target):
    # Aim in armature space to avoid mirrored-bone Euler sign mistakes.
    bpy.context.view_layer.update();p=rig.pose.bones[bone]
    rest=p.bone.matrix_local.to_quaternion()
    direction=(Vector(target)-p.head).normalized()
    q=(rest@Vector((0,1,0))).rotation_difference(direction)@rest
    p.matrix=Matrix.Translation(p.head)@q.to_matrix().to_4x4()
    bpy.context.view_layer.update()
def aim_stable(bone,direction):
    # Keep the front of the limb oriented consistently as its long axis moves.
    # A direction-only shortest arc can abruptly twist near the opposite axis.
    bpy.context.view_layer.update();p=rig.pose.bones[bone]
    rest=p.bone.matrix_local.to_quaternion();front=Vector((0,-1,0))
    def frame(e):
        e=e.normalized();r=front.cross(e).normalized();n=e.cross(r).normalized()
        return Matrix((r,n,e)).transposed()
    q=(frame(Vector(direction))@frame(rest@Vector((0,1,0))).inverted()).to_quaternion()@rest
    p.matrix=Matrix.Translation(p.head)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
def seated(f=1):
    rig.pose.bones['hips'].location.y=-.30*f # bone local Y is world +Z
    for s in ['L','R']:rot('thigh.'+s,-1.35*f);rot('shin.'+s,1.35*f)
def palm_forward(direction=(0,-.12,1),side='R',normal=(0,-1,0)):
    bpy.context.view_layer.update();p=rig.pose.bones['hand.'+side]
    def frame(e,n):
        e=e.normalized();r=n.cross(e).normalized();n=e.cross(r).normalized()
        return Matrix((r,n,e)).transposed()
    rest=p.bone.matrix_local.to_quaternion()
    original=frame(rest@Vector((0,1,0)),Vector((0,-1,0)))
    desired=frame(Vector(direction),Vector(normal))
    q=(desired@original.inverted()).to_quaternion()@rest
    p.matrix=Matrix.Translation(p.head)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
def fingers(choice,side='R'):
    # Target the digits in the palm's rest frame, then carry them with the wrist.
    # This makes the thumb cross the folded fingers instead of protruding as a stub.
    bpy.context.view_layer.update();hand=rig.pose.bones['hand.'+side]
    mirror=1 if side=='R' else -1
    transform=hand.matrix@hand.bone.matrix_local.inverted()
    def digit_aim(bone,direction=None,target=None):
        bpy.context.view_layer.update();p=rig.pose.bones[bone]
        carried=transform.to_quaternion()@p.bone.matrix_local.to_quaternion()
        d=(target-p.head).normalized() if target is not None else (transform.to_3x3()@direction).normalized()
        q=(carried@Vector((0,1,0))).rotation_difference(d)@carried
        p.matrix=Matrix.Translation(p.head)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
    for f,fan in [('index',.30),('middle',.05),('ring',-.13),('pinky',-.36)]:
        extended=choice=='paper' or (choice=='scissors' and f in ['index','middle'])
        if choice=='scissors':fan=.32 if f=='index' else -.22
        for joint in ['01','02']:
            bn=f+'.'+joint+'.'+side;p=rig.pose.bones[bn]
            if extended:direction=Vector((mirror*fan,0,-1))
            else:direction=Vector((0,-.95,.12)) if joint=='01' else Vector((0,.35,1))
            digit_aim(bn,direction=direction)
    if choice=='paper':
        for j in ['01','02']:
            digit_aim('thumb.'+j+'.'+side,direction=Vector((mirror,-.05,-.45)))
    else:
        for joint,target in [('01',(-.790,-.158,.994)),('02',(-.880,-.150,.985))]:
            digit_aim('thumb.'+joint+'.'+side,target=transform@Vector((mirror*target[0],target[1],target[2])))
def support(lean=0,twist=0,side=0,drop=.012):
    rig.pose.bones['hips'].location=(side,-drop,.008*lean)
    rot('hips',lean*.18,-twist*.20,-side*.45)
    rot('spine',lean*.42,twist*.40,-side*.40)
    rot('chest',lean*.58,twist*.60,side*.25)
def plant_feet(targets=None):
    # Bake a two-bone leg solve into the exported animation. Feet keep their
    # position and orientation while the pelvis shifts and the knees absorb it.
    for side,s in [('L',1),('R',-1)]:
        bpy.context.view_layer.update();thigh=rig.pose.bones['thigh.'+side]
        ankle=Vector(targets[side] if targets else (s*.26,0,.20));hip=thigh.head.copy()
        l1=thigh.bone.length;l2=rig.pose.bones['shin.'+side].bone.length
        axis=ankle-hip;distance=min(axis.length,l1+l2-.00001);axis.normalize()
        a=(l1*l1-l2*l2+distance*distance)/(2*distance)
        height=math.sqrt(max(0,l1*l1-a*a));pole=Vector((0,-1,0));pole=(pole-axis*pole.dot(axis)).normalized()
        knee=hip+axis*a+pole*height
        aim('thigh.'+side,knee);aim('shin.'+side,ankle)
        p=rig.pose.bones['foot.'+side]
        p.matrix=Matrix.Translation(p.head)@p.bone.matrix_local.to_quaternion().to_matrix().to_4x4()
    bpy.context.view_layer.update()

def reach_arm(side,target):
    # A two-bone arm solve keeps the wrist in front of the eye camera without
    # moving detached hands or stretching the skinned character's limbs.
    bpy.context.view_layer.update();upper=rig.pose.bones['upper_arm.'+side]
    shoulder=upper.head.copy();axis=Vector(target)-shoulder
    l1=upper.bone.length;l2=rig.pose.bones['forearm.'+side].bone.length
    distance=min(axis.length,l1+l2-.012);axis.normalize();wrist=shoulder+axis*distance
    a=(l1*l1-l2*l2+distance*distance)/(2*distance)
    h=math.sqrt(max(0,l1*l1-a*a));pole=Vector((-1 if side=='R' else 1,.05,-.35))
    pole=(pole-axis*pole.dot(axis)).normalized();elbow=shoulder+axis*a+pole*h
    aim_stable('upper_arm.'+side,elbow-shoulder)
    bpy.context.view_layer.update();aim_stable('forearm.'+side,wrist-rig.pose.bones['forearm.'+side].head)
def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)
def timeline(keys,u):
    for i in range(1,len(keys)):
        if u<=keys[i][0]:
            a,x=keys[i-1];b,y=keys[i];return x+(y-x)*smooth((u-a)/(b-a))
    return keys[-1][1]

def flowing(keys,u):
    # Shape-preserving Hermite curves carry momentum through intermediate keys.
    # Tangents flatten only at a reversal, rather than stopping on every pose.
    u=max(keys[0][0],min(keys[-1][0],u))
    slopes=[(b[1]-a[1])/(b[0]-a[0]) for a,b in zip(keys,keys[1:])]
    tangents=[0.]
    for a,b in zip(slopes,slopes[1:]):
        tangents.append(2*a*b/(a+b) if a*b>0 else 0.)
    tangents.append(0.)
    for i in range(1,len(keys)):
        if u<=keys[i][0]:
            x0,y0=keys[i-1];x1,y1=keys[i];h=x1-x0;t=(u-x0)/h
            return (2*t**3-3*t*t+1)*y0+(t**3-2*t*t+t)*h*tangents[i-1]+(-2*t**3+3*t*t)*y1+(t**3-t*t)*h*tangents[i]
    return keys[-1][1]

def lift_envelope(t,start,peak,end):
    # Zero velocity and acceleration when a foot leaves or meets the floor.
    v=(t-start)/(peak-start) if t<=peak else (end-t)/(end-peak)
    v=max(0.,min(1.,v));return v*v*v*(v*(v*6-15)+10)
def pose(action,u):
    wave=math.sin(math.tau*u);pulse=math.sin(math.pi*u);breath=(1-math.cos(math.tau*u))*.5
    foot_targets=None
    if action=='Idle':
        support(.008*wave,.018*wave,.006*wave,.008+.003*breath)
        rig.pose.bones['chest'].scale=(1+wave*.009,1+wave*.012,1+wave*.009)
        rot('head',-.005+wave*.012,-wave*.008,0)
    elif action=='Walk':
        # One 1.2-second cycle travels 1.08 units at the runtime's 0.9 units/s.
        # The planted foot moves back by exactly that distance relative to the
        # pelvis; the opposite foot swings forward with a smooth ground clearance.
        foot_targets={}
        for side,sign,offset in [('L',1,0),('R',-1,.5)]:
            phase=(u+offset)%1
            if phase<.5:forward=-.27+1.08*phase;lift=0
            else:
                t=(phase-.5)*2
                forward=(2*t**3-3*t*t+1)*.27+(t**3-2*t*t+t)*.54+(-2*t**3+3*t*t)*(-.27)+(t**3-t*t)*.54
                lift=.10*math.sin(math.pi*t)**2
            foot_targets[side]=(sign*.26,forward,.20+lift)
        support(.028,.055*wave,.020*math.cos(math.tau*u),.075+.012*(1-math.cos(math.tau*2*u))*.5)
        for side,sign in [('L',1),('R',-1)]:
            swing=sign*math.cos(math.tau*u)
            aim_stable('upper_arm.'+side,(sign*.16,.14*swing,-.29))
            aim_stable('forearm.'+side,(sign*.07,.11*swing,-.24))
            rot('hand.'+side,.035*swing,0,sign*.025)
        rot('head',-.012+.006*math.sin(math.tau*2*u),-.024*wave,-.008*wave)
    elif action=='Blink':
        support(drop=.008);obj.data.shape_keys.key_blocks['Blink'].value=max(0,1-abs(u-.5)*5)
    elif action=='Happy':
        obj.data.shape_keys.key_blocks['Happy'].value=1
        support(-.022+.008*wave,.025*wave,.009*wave,.012+.006*breath)
        rot('head',-.035+.012*math.sin(math.tau*u-.25),-.012*wave,0)
    elif action in ['Sad','Lose']:
        obj.data.shape_keys.key_blocks['Sad'].value=1
        strong=1 if action=='Lose' else .65
        support((.14+.007*wave)*strong,.025,-.009,.026+.012*strong)
        rot('head',.23*strong+.009*wave,0,.055*strong)
        for side,sign in [('R',-1),('L',1)]:
            aim('upper_arm.'+side,(sign*.57,-.035,1.27))
            aim('forearm.'+side,(sign*.65,-.075,1.03))
    elif action=='Surprised':
        obj.data.shape_keys.key_blocks['Surprised'].value=1
        support(-.065-.01*wave,.015,-.008,.023+.005*breath)
        rot('head',-.10+.008*wave)
        for side,sign in [('L',1),('R',-1)]:
            aim('upper_arm.'+side,(sign*.69,-.03,1.47))
            aim('forearm.'+side,(sign*.84,-.12,1.58))
    elif action=='Celebrate':
        obj.data.shape_keys.key_blocks['Happy'].value=1
        support(-.035+.018*wave,.05*wave,.025*wave,.015+.040*breath)
        for side,sign in [('L',1),('R',-1)]:
            aim('upper_arm.'+side,(sign*.74,-.05,1.88+.02*wave))
            aim('forearm.'+side,(sign*.99,-.12,2.10+.025*math.sin(math.tau*u-.2)))
        rot('head',-.055+.018*math.sin(math.tau*u-.3),-.025*wave,.035*wave)
    elif action=='VictoryDance':
        # Adapt the supplied gesture sketches to the short limbs / large heads:
        # load the supporting leg, knee-up with a diagonal fist, gather, hop,
        # then absorb the landing. Mirror the phrase for a four-second loop.
        phrase=min(1,int(u*2));t=u*2-phrase;side=1 if phrase==0 else -1
        knee=lift_envelope(t,.12,.25,.43)
        hop=.095*lift_envelope(t,.68,.775,.87)
        weight=side*flowing([(0,0),(.08,-.09),(.17,-.135),(.31,-.13),(.46,0),(.60,0),(.90,0),(1,0)],t)
        drop=flowing([(0,.065),(.07,.105),(.20,.065),(.34,.055),(.46,.105),(.55,.055),(.64,.140),(.72,.045),(.84,.045),(.91,.125),(1,.065)],t)
        lean=flowing([(0,.015),(.08,.055),(.25,-.020),(.46,.045),(.64,.100),(.77,-.055),(.91,.060),(1,.015)],t)
        twist=side*flowing([(0,0),(.12,-.045),(.29,.105),(.48,.025),(.63,-.045),(.79,.045),(1,0)],t)
        support(lean,twist,weight,drop-hop)
        rot('hips',lean*.22,-twist*.30,-weight*.25)
        rot('chest',lean*.45,twist*.65,weight*.22)
        foot_targets={}
        for limb,sign in [('L',1),('R',-1)]:
            moving=sign==side;k=knee if moving else 0
            foot_targets[limb]=(sign*(.26+.055*k),-.22*k,.20+.225*k+hop)
            # Shoulder leads the reach; elbow and wrist settle a little later.
            reach=lift_envelope(t,.09,.27,.51) if moving else .18*lift_envelope(t,.14,.30,.52)
            open_up=lift_envelope(t,.61,.78,.97)
            gather=lift_envelope(t,.49,.63,.72)
            arm_up=max(reach,.72*open_up)
            elbow_up=max(lift_envelope(t,.12,.30,.55) if moving else .12*reach,.83*lift_envelope(t,.64,.81,.99))
            aim_stable('upper_arm.'+limb,(sign*(.23+.08*open_up-.045*gather),-.075-.055*gather,-.22+.50*arm_up))
            aim_stable('forearm.'+limb,(sign*(.075+.025*open_up),-.20+.14*elbow_up,.025+.26*elbow_up+.095*gather))
            rot('hand.'+limb,-.06-.055*elbow_up,sign*.045*open_up,0)
            fingers('rock',limb)
        head_follow=side*flowing([(0,0),(.16,-.015),(.34,-.055),(.54,.015),(.68,.025),(.86,-.035),(1,0)],t)
        rot('head',flowing([(0,-.025),(.12,.005),(.32,-.065),(.52,-.010),(.68,.030),(.83,-.060),(.94,-.005),(1,-.025)],t),head_follow,-weight*.15)
        obj.data.shape_keys.key_blocks['Happy'].value=1
    elif action=='NodYes':
        gesture=math.sin(math.tau*u*2)*pulse
        support(.045*gesture,0,0,.01+.012*pulse)
        rot('head',gesture*.26)
    elif action=='ShakeNo':
        gesture=math.sin(math.tau*u*2)*pulse
        support(0,.07*gesture,-.006*gesture,.01+.007*pulse)
        rot('head',.018*pulse,gesture*.33,0)
    elif action in ['LookLeft','LookRight']:
        sign=1 if action=='LookLeft' else -1
        support(.005*wave,sign*.10,.008*sign,.012+.003*breath)
        rot('head',-.01,sign*.38,0)
    elif action=='Sit':
        seated();rot('spine',.008*wave);rot('head',-.005*wave)
    elif action=='Stand':pass
    elif action in ['RaiseArms','LowerArms']:
        amount=smooth(u/.80);amount=amount if action=='RaiseArms' else 1-amount
        support(-.045*amount,.012*pulse,.006*pulse,.01+.016*amount)
        for side,sign in [('L',1),('R',-1)]:
            aim('upper_arm.'+side,(sign*(.66+.08*amount),-.015-.035*amount,1.32+.56*amount))
            aim('forearm.'+side,(sign*(.79+.20*amount),-.065-.055*amount,1.09+1.01*amount))
        rot('head',-.035*amount)
    elif action=='RPSAnticipation':
        support(.025+.025*wave,.085*wave,.017*wave,.020+.016*breath)
        aim('upper_arm.R',(-.64,-.08,1.43+.015*wave))
        aim('forearm.R',(-.70,-.31+.065*wave,1.57+.08*wave))
        palm_forward();fingers('rock')
        aim('forearm.L',(.78,.035+.025*wave,1.10))
        rot('head',-.015+.020*math.sin(math.tau*u-.35),-.030*math.sin(math.tau*u-.25),0)
    elif action=='RPSPump':
        drive=flowing([(0,-.45),(.10,-.40),(.43,1.2),(.55,1.22),(.87,-.42),(1,-.45)],u)
        support(.035*drive,-.055*drive,-.012*drive,.018)
        aim('upper_arm.R',(-.65,-.10-.07*drive,1.45))
        aim('forearm.R',(-.73,-.26-.20*drive,1.63-.18*drive))
        palm_forward();fingers('rock')
        aim('forearm.L',(.78,.025,1.10))
        rot('head',-.02*drive,-.025,0)
    elif action in ['Rock','Paper','Scissors']:
        support(.025+.004*wave,-.10-.008*wave,-.016,.020+.004*breath)
        aim('upper_arm.R',(-.67,-.10,1.48))
        aim('forearm.R',(-.74,-.37,1.70))
        palm_forward();fingers(action.lower())
        aim('forearm.L',(.77,.05,1.10+.006*wave))
        rot('head',-.015,-.035,.008)
    elif action=='Throw':
        drive=timeline([(0,-.25),(.26,-1),(.56,1),(.76,1.10),(1,.75)],u)
        support(.085*drive,-.16*drive,-.020*drive,.020+.012*pulse)
        aim('upper_arm.R',(-.65,-.10-.10*drive,1.44))
        aim('forearm.R',(-.73,-.32-.18*drive,1.59+.05*drive))
        palm_forward();fingers('rock')
        aim('forearm.L',(.78,.025+.065*drive,1.08+.015*pulse))
        delayed=timeline([(0,0),(.35,-.5),(.65,1),(1,.7)],u)
        rot('head',-.030*delayed,-.045*delayed,.012*delayed)
    elif action.startswith('POV'):
        if action=='POVReady':
            drive=-.08+.10*wave
        elif action=='POVPump':
            drive=flowing([(0,-.55),(.12,-.48),(.43,1.18),(.56,1.25),(.86,-.50),(1,-.55)],u)
        elif action=='POVThrow':
            drive=flowing([(0,0),(.24,-.60),(.42,-.45),(.70,1.04),(.86,1.015),(1,1)],u)
        else:drive=1+.006*wave
        support(.018+.024*max(0,drive),-.028*drive,-.008*drive,.030+.010*max(0,drive))
        # Keep the resting left hand low at the side of the POV frame.
        # The right forearm reaches toward the center as the wrist carries the
        # chosen sign forward; the fingers follow that line instead of folding
        # sharply upward at the wrist.
        reach_arm('L',(.45,-.48,1.45))
        palm_forward((-.55,-.83,.05),'L',(0,0,-1));fingers('paper','L')
        reach_arm('R',(-.20+(.10 if action=='POVPump' else .07)*drive,
                        -.56-(.18 if action=='POVPump' else .10)*drive,
                        1.83-(.22 if action=='POVPump' else .07)*drive))
        palm_forward((.55,-.83,.10),'R',(0,0,-1));fingers({'POVPaper':'paper','POVScissors':'scissors'}.get(action,'rock'))
        rot('head',-.035-.015*drive,.012*drive,0)
    if action!='Sit':plant_feet(foot_targets)
for an in action_names:
    reset();a=bpy.data.actions.new(an);a.use_fake_user=True;rig.animation_data.action=a
    # Matching NLA strip names merge the facial tracks into the same glTF clip.
    fa=bpy.data.actions.new(an+'_Face');fa.use_fake_user=True;obj.data.shape_keys.animation_data.action=fa
    length={'Idle':90,'Walk':37,'Blink':12,'Happy':90,'Sad':90,'Surprised':90,'Celebrate':60,'VictoryDance':121,'NodYes':36,'ShakeNo':36,'LookLeft':90,'LookRight':90,'Sit':30,'Stand':30,'RaiseArms':45,'LowerArms':45,'RPSAnticipation':30,'RPSPump':21,'Rock':90,'Paper':90,'Scissors':90,'Throw':24,'Lose':75,'POVReady':31,'POVPump':21,'POVThrow':25,'POVRock':61,'POVPaper':61,'POVScissors':61}.get(an,30)
    frames=sorted(set([1,length]+[1+round((length-1)*i/12) for i in range(1,12)]))
    if an=='VictoryDance':frames=list(range(121))
    if an=='Walk':frames=list(range(37))
    if an.startswith('POV'):frames=list(range(1,length+1))
    if an=='RPSPump':frames=list(range(1,length+1))
    previous_rotations={}
    for frame in frames:
        reset();pose(an,frame/120 if an=='VictoryDance' else frame/36 if an=='Walk' else (frame-1)/(length-1))
        for p in rig.pose.bones:
            if an in ['VictoryDance','Walk','RPSPump'] or an.startswith('POV'):
                # Keep solved Euler angles on a continuous branch so Blender's
                # interpolation never turns a small arm accent into a full spin.
                if p.name in previous_rotations:p.rotation_euler.make_compatible(previous_rotations[p.name])
                previous_rotations[p.name]=p.rotation_euler.copy()
            p.keyframe_insert('rotation_euler',frame=frame,group=p.name);p.keyframe_insert('location',frame=frame,group=p.name);p.keyframe_insert('scale',frame=frame,group=p.name)
        for sk in obj.data.shape_keys.key_blocks:
            if sk.name!='Basis':sk.keyframe_insert('value',frame=frame)
    for owner,action in [(rig,a),(obj.data.shape_keys,fa)]:
        owner.animation_data.action=None;track=owner.animation_data.nla_tracks.new();track.name=an
        strip=track.strips.new(an,0 if an in ['VictoryDance','Walk'] else 1,action);strip.name=an;strip.extrapolation='NOTHING';track.mute=True
reset();scene.frame_set(1)
source=ROOT/'assets/characters/source'/f'{name}.blend'
out=ROOT/'public/models/characters'/f'{name}.glb'
for p in [source.parent,out.parent]:p.mkdir(parents=True,exist_ok=True)
# Export only the reusable rig and mesh; staging stays in the editable .blend.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);obj.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,
 export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,
 export_skins=True,export_morph=True,export_morph_normal=False,export_yup=True,
 export_materials='EXPORT',export_all_vertex_colors=True,export_cameras=False,export_lights=False)
mesh.calc_loop_triangles()
report=dict(character=name,vertices=len(mesh.vertices),triangles=len(mesh.loop_triangles),bones=len(bones),materials=1,morphs=['Blink','Happy','Sad','Surprised'],actions=action_names,glbBytes=out.stat().st_size,unweightedVertices=sum(not bool(w) for w in W))
(ROOT/'assets/characters/validation'/f'{name}-source.json').write_text(json.dumps(report,indent=2))
print('CHARACTER_REPORT',json.dumps(report))
for owner in [rig,obj.data.shape_keys]:
    owner.animation_data.action=None
    for track in owner.animation_data.nla_tracks:track.mute=True
reset();bpy.context.view_layer.update()

# Neutral review studio; shadows and lighting are previews only, never exported.
world=bpy.data.worlds.new('Lavender studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.035,.13,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
def plainmat(label,color,metal=0):
    m=bpy.data.materials.new(label);m.diffuse_color=(*rgb(color),1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=m.diffuse_color;m.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=metal;return m
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object;floor.name='Preview_floor';floor.data.materials.append(plainmat('Studio','#29213D'))
for loc,power,size,color in [((-3,-4,7),550,5,(1,.82,.75)),((4,-2,4),400,4,(.72,.80,1)),((1,3,5),700,3,(.91,.55,1))]:
    bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.data.color=color;l.rotation_euler=(Vector((0,0,1.6))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(4,-7,3.5));camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=3.72
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
def view(loc,target=(0,0,1.60)):
    camera.location=loc;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
view((4,-7,3.1))
bpy.ops.wm.save_as_mainfile(filepath=str(source))
if args.render:
    for label,loc in [('front',(0,-8,2.65)),('side',(8,0,2.65)),('three-quarter',(4,-7,3.1)),('back',(0,8,2.65))]:
        view(loc);scene.render.filepath=str(ROOT/'assets/characters/previews'/f'{name}-{label}.png');bpy.ops.render.render(write_still=True)
print('COMPLETE',name,flush=True)
