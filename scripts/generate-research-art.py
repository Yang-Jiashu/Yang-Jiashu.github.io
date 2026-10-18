"""Draw original, deterministic research illustrations as lightweight SVGs."""
from pathlib import Path
import math
import random

ROOT = Path(__file__).resolve().parents[1]
INK = '#27483f'
SOFT = '#87978b'
PALE = '#e7ece5'
ACCENT = '#b24b38'


def path(points, stroke=INK, width=.7, opacity=1, **attrs):
    data = 'M' + 'L'.join(f'{x:.2f} {y:.2f}' for x,y in points)
    extra = ' '.join(f'{k.replace("_", "-")}="{v}"' for k,v in attrs.items())
    return f'<path d="{data}" fill="none" stroke="{stroke}" stroke-width="{width}" opacity="{opacity}" {extra}/>'


def dot(x,y,r=.8,fill=INK,opacity=1):
    return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}" opacity="{opacity}"/>'


def frame(name, title, desc, number, body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 330" fill="none" role="img" aria-labelledby="{name}-title {name}-desc">
<title id="{name}-title">{title}</title><desc id="{name}-desc">{desc}</desc>
<g stroke="{SOFT}" stroke-width=".7"><path d="M24 43V25H42M478 305h18v-18"/><path d="M24 298h7M27.5 294.5v7M484 28h7M487.5 24.5v7"/></g>
<g fill="{SOFT}" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="8" letter-spacing="1.5"><text x="48" y="28">{number}</text><text x="470" y="306" text-anchor="end">{name.upper()} / {number}</text></g>
<g stroke-linecap="round" stroke-linejoin="round">{body}</g></svg>'''


def worlds():
    rng=random.Random(108)
    radius=126
    def height(u,v):
        edge=max(0,1-(u*u+v*v)/radius**2)
        peaks=(106*math.exp(-((u+32)**2/3400+(v-12)**2/2100))
             +69*math.exp(-((u-48)**2/1900+(v+34)**2/2600))
             +18*math.exp(-((u+55)**2/1700+(v+61)**2/1500)))
        return peaks*edge**.35
    def project(u,v,z=None):
        return (258+.99*(u-v),216+.32*(u+v)-(height(u,v) if z is None else z))
    def ring(depth):
        return [project(radius*math.cos(t),radius*math.sin(t),-depth) for t in [i*math.tau/180 for i in range(181)]]
    # A small depth buffer removes lines hidden behind a nearer slope.
    depth_buffer={}
    sample_step=1.25
    for row in range(int(2*radius/sample_step)+1):
        u=-radius+row*sample_step
        bound=math.sqrt(max(0,radius*radius-u*u))
        for col in range(int(2*bound/sample_step)+1):
            v=-bound+col*sample_step
            x,y=project(u,v)
            depth=u+v+.64*height(u,v)
            xi,yi=round(x*2),round(y*2)
            for dx in range(-2,3):
                for dy in range(-2,3):
                    key=(xi+dx,yi+dy)
                    if depth>depth_buffer.get(key,-10000): depth_buffer[key]=depth
    def visible(u,v):
        x,y=project(u,v)
        return u+v+.64*height(u,v)+3.2>=depth_buffer.get((round(x*2),round(y*2)),-10000)
    body=[]
    # A precise, floating sample boundary gives the landscape its scale.
    body.append(path(ring(10),SOFT,.65,.34))
    envelope={}
    for xi,yi in depth_buffer:
        if xi not in envelope or yi<envelope[xi]: envelope[xi]=yi
    cols=sorted(envelope)
    edge=[]
    for i in range(0,len(cols),4):
        nearby=cols[max(0,i-3):min(len(cols),i+4)]
        edge.append((cols[i]/2,sum(envelope[k] for k in nearby)/len(nearby)/2))
    body.append(path(edge,INK,.72,.68))
    # Etched profile lines form the terrain, without an ornamental grid.
    for index in range(58):
        u=-radius+2*radius*index/57
        bound=math.sqrt(max(0,radius*radius-u*u))
        segment=[]
        for j in range(151):
            v=-bound+2*bound*j/150
            if visible(u,v): segment.append(project(u,v))
            else:
                if len(segment)>2: body.append(path(segment,INK,.52 if index%5 else .82,.50 if index%5 else .78))
                segment=[]
        if len(segment)>2: body.append(path(segment,INK,.52 if index%5 else .82,.50 if index%5 else .78))
    # Tiny samples become denser on the near-facing slopes, like an ink print.
    for _ in range(760):
        u=rng.uniform(-radius,radius); v=rng.uniform(-radius,radius)
        if u*u+v*v>radius**2: continue
        if rng.random() > (.75 if u+v>0 else .3): continue
        if not visible(u,v): continue
        x,y=project(u,v)
        body.append(dot(x+rng.uniform(-.4,.4),y+rng.uniform(-.4,.4),rng.uniform(.37,.72),INK,rng.uniform(.2,.58)))
    # Three intentional sight lines connect the field to perception.
    sample=project(29,-5)
    camera=(68,225)
    for target, opacity in [(project(-9,39),.28),(project(62,-39),.28),(sample,.7)]:
        body.append(path([camera,target],ACCENT,.65,opacity,stroke_dasharray='2 4' if opacity>.5 else 'none'))
    body.append(f'<path d="M47 216h18v18H47ZM65 219l10-6v24l-10-6Z" fill="{PALE}" stroke="{INK}" stroke-width="1.2"/>')
    body.append(dot(*sample,3.2,ACCENT))
    body.append(f'<circle cx="{sample[0]:.2f}" cy="{sample[1]:.2f}" r="8" stroke="{ACCENT}" stroke-width=".65"/>')
    body.append(path([(409,253),(435,253),(435,231)],SOFT,.8,.8))
    body.append(dot(409,253,1.4,INK))
    return frame('worlds','A world taking shape','An original engraved landscape of curved spatial profiles and point samples, connected to a camera viewpoint.','02',''.join(body))


def knowledge():
    rng=random.Random(207)
    body=[]
    # An open folio, drawn with curved sections rather than a flat document icon.
    body.append(f'<path d="M58 120Q108 104 182 144Q245 104 286 121L279 247Q232 235 182 267Q119 236 65 247Z" fill="{PALE}" fill-opacity=".34"/>')
    for i in range(20):
        t=i/19
        y0=117+t*119
        mid=143+t*112
        right=119+t*119
        body.append(f'<path d="M59 {y0:.2f}C103 {y0-15:.2f} 141 {mid-17:.2f} 182 {mid:.2f}C223 {mid-23:.2f} 258 {right-14:.2f} 286 {right:.2f}" stroke="{INK}" stroke-width="{.9 if i in (0,19) else .48}" opacity="{.85 if i in (0,19) else .36}"/>')
    body.append(f'<path d="M58 117 65 246Q117 236 182 267Q234 236 279 247L286 119M182 143V267M65 251Q121 240 182 274Q234 244 278 253" stroke="{INK}" stroke-width=".95"/>')
    # One original outlined glyph refers to the Chinese-culture research thread.
    body.append(f'<g stroke="{INK}" stroke-width="2.5"><path d="m111 139 5 8M94 155l45 9M104 161q4 24 31 43M132 166q-7 19-37 30"/></g>')
    # Curving fibers leave the page and resolve into a small conceptual structure.
    for i in range(17):
        t=i/16
        x=205+62*t; y=154-25*math.sin(t*math.pi)
        end_x=350+58*t; end_y=73+30*t
        body.append(f'<path d="M{x:.2f} {y:.2f}C{245+30*t:.2f} {95-10*t:.2f} {292+36*t:.2f} {55+29*t:.2f} {end_x:.2f} {end_y:.2f}" stroke="{INK}" stroke-width=".48" opacity="{.25+.25*t:.2f}"/>')
    links=[((370,86),(429,130)),((370,86),(334,157)),((334,157),(391,204)),((429,130),(391,204)),((429,130),(464,207)),((391,204),(416,259)),((334,157),(309,234))]
    for index,(a,b) in enumerate(links):
        cx=(a[0]+b[0])/2+12
        cy=(a[1]+b[1])/2-8
        body.append(f'<path d="M{a[0]} {a[1]}Q{cx} {cy} {b[0]} {b[1]}" stroke="{SOFT}" stroke-width=".8" opacity=".68"/>')
    for x,y,r in [(370,86,11),(429,130,8),(334,157,7),(391,204,10),(464,207,5),(416,259,4),(309,234,5)]:
        body.append(f'<circle cx="{x}" cy="{y}" r="{r+4}" fill="{PALE}" fill-opacity=".55"/>')
        body.append(f'<circle cx="{x}" cy="{y}" r="{r}" stroke="{INK}" stroke-width=".85"/>')
        body.append(dot(x,y,1.5,ACCENT if x==391 else INK))
        for k in range(10):
            angle=rng.random()*math.tau; rad=rng.uniform(2,r-1)
            body.append(dot(x+math.cos(angle)*rad,y+math.sin(angle)*rad,.4,INK,.5))
    for _ in range(90):
        t=rng.random(); x=269+86*t; y=126-39*t+rng.gauss(0,4)
        body.append(dot(x,y,rng.uniform(.3,.65),INK,.25))
    body.append(f'<path d="M145 232q17 5 28 10" stroke="{ACCENT}" stroke-width="1.3"/>')
    return frame('knowledge','From a page to a constellation of ideas','An original open folio rendered in fine curved lines, with knowledge fibers becoming a structured constellation.','01',''.join(body))


if __name__=='__main__':
    for name,draw in [('worlds',worlds),('knowledge',knowledge)]:
        target=ROOT/'images'/f'research-{name}.svg'
        target.write_text(draw())
        print(f'{target.name}: {target.stat().st_size:,} bytes')
