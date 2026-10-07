import json, math, os, random, secrets, time
from pathlib import Path
from aiohttp import web, WSMsgType

ROOT=Path(__file__).parent.resolve()
rooms={}
CFG={'corpse':{'hp':120,'damage':8},'mourner':{'hp':1200,'damage':24}}
SPAWNS=[(-6,-1),(6,-1),(-7,5),(7,5),(-3,8),(3,9)]
ABILITY={
 'basic':{'range':2.9,'dot':.42,'mult':1,'cooldown':.33,'max':1},
 'cleave':{'range':3.5,'dot':-.25,'mult':2.05,'cooldown':2.4,'max':99},
 'chain':{'range':7,'dot':.25,'mult':.75,'cooldown':5.2,'max':3},
 'rush':{'range':5.2,'dot':-.15,'mult':1.25,'cooldown':4.3,'max':8},
 'bloodstorm':{'range':5.2,'dot':-1,'mult':3.15,'cooldown':12,'max':99},
}

def code():
    alpha='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        c='ABY-'+''.join(secrets.choice(alpha) for _ in range(4))
        if c not in rooms:return c

def enemy(kind,x,z):
    return {'id':'E'+secrets.token_hex(3),'type':kind,'x':float(x),'z':float(z),'hp':CFG[kind]['hp'],'maxHp':CFG[kind]['hp'],'dead':False}

def make_room(pid):
    r={'host':pid,'players':{},'sockets':{},'enemies':{},'kills':0,'bossSpawned':False}
    for x,z in SPAWNS:
        e=enemy('corpse',x,z);r['enemies'][e['id']]=e
    return r

def ep(e):return {k:e[k] for k in ('id','type','x','z','hp','maxHp','dead')}

async def broadcast(r,payload,skip=None):
    data=json.dumps(payload,ensure_ascii=False)
    for pid,ws in list(r['sockets'].items()):
        if pid==skip:continue
        try:await ws.send_str(data)
        except:pass

def valid_target(p,e,cfg):
    dx=e['x']-p['x'];dz=e['z']-p['z'];dist=math.hypot(dx,dz)
    if not dist:return True,0
    dot=math.sin(p['ry'])*(dx/dist)+math.cos(p['ry'])*(dz/dist)
    return dot>cfg['dot'] and dist<=cfg['range'],dist

async def combat(r,pid,action):
    p=r['players'].get(pid);cfg=ABILITY.get(action)
    if not p or not cfg:return
    now=time.monotonic()
    if now-p['cd'].get(action,0)<cfg['cooldown']:return
    if action=='bloodstorm' and p['rage']<100:return
    p['cd'][action]=now
    if action=='bloodstorm':p['rage']=0
    arr=[]
    for e in r['enemies'].values():
        if e['dead']:continue
        ok,dist=valid_target(p,e,cfg)
        if ok:arr.append((dist,e))
    arr.sort(key=lambda v:v[0])
    for _,e in arr[:cfg['max']]:
        crit=random.random()<.16
        dmg=round(42*cfg['mult']*(1.5 if crit else 1))
        e['hp']=max(0,e['hp']-dmg);p['rage']=min(100,p['rage']+(4 if action=='basic' else 11))
        await broadcast(r,{'type':'enemy_damage','enemyId':e['id'],'hp':e['hp'],'maxHp':e['maxHp'],'damage':dmg,'crit':crit,'by':pid,'rage':p['rage']})
        if e['hp']<=0 and not e['dead']:
            e['dead']=True;r['kills']+=1
            await broadcast(r,{'type':'enemy_dead','enemyId':e['id'],'enemyType':e['type'],'kills':r['kills']})
            if e['type']=='mourner':
                await broadcast(r,{'type':'boss_defeated'})
            elif r['kills']>=6 and not r['bossSpawned']:
                r['bossSpawned']=True;b=enemy('mourner',0,11);r['enemies'][b['id']]=b
                await broadcast(r,{'type':'boss_spawn','enemy':ep(b)})

async def ws_handler(request):
    ws=web.WebSocketResponse(heartbeat=20);await ws.prepare(request)
    pid=secrets.token_hex(4);room_id=None
    async for msg in ws:
        if msg.type!=WSMsgType.TEXT:continue
        try:d=json.loads(msg.data)
        except:continue
        t=d.get('type')
        if t in ('create_room','join_room'):
            if room_id:continue
            if t=='create_room':
                room_id=code();rooms[room_id]=make_room(pid)
            else:
                room_id=str(d.get('code','')).upper().strip()
                if room_id not in rooms:
                    await ws.send_json({'type':'error','message':'Oda bulunamadı.'});room_id=None;continue
                if len(rooms[room_id]['players'])>=4:
                    await ws.send_json({'type':'error','message':'Oda dolu.'});room_id=None;continue
            r=rooms[room_id];r['sockets'][pid]=ws
            r['players'][pid]={'id':pid,'name':'Blood Knight','x':0.0,'y':0.0,'z':-7.0,'ry':0.0,'rage':15,'cd':{}}
            await ws.send_json({'type':'room_joined','code':room_id,'playerId':pid,'players':[{k:v for k,v in p.items() if k!='cd'} for p in r['players'].values()],'enemies':[ep(e) for e in r['enemies'].values() if not e['dead']],'kills':r['kills'],'bossSpawned':r['bossSpawned']})
            await broadcast(r,{'type':'player_joined','player':{k:v for k,v in r['players'][pid].items() if k!='cd'}},pid)
        elif not room_id or room_id not in rooms:continue
        elif t=='state':
            p=rooms[room_id]['players'].get(pid)
            if not p:continue
            for k in ('x','y','z','ry'):
                try:p[k]=float(d.get(k,p[k]))
                except:pass
            await broadcast(rooms[room_id],{'type':'player_state','player':{k:v for k,v in p.items() if k!='cd'}},pid)
        elif t=='combat':
            a=str(d.get('action',''))[:32]
            await broadcast(rooms[room_id],{'type':'player_action','playerId':pid,'action':a},pid)
            await combat(rooms[room_id],pid,a)
    if room_id in rooms:
        r=rooms[room_id];r['players'].pop(pid,None);r['sockets'].pop(pid,None)
        await broadcast(r,{'type':'player_left','playerId':pid})
        if not r['players']:rooms.pop(room_id,None)
    return ws

async def index(request):return web.Response(text='ABYSSBOUND multiplayer backend online')
app=web.Application();app.router.add_get('/ws',ws_handler);app.router.add_get('/',index);app.router.add_get('/health',index)
if __name__=='__main__':
    web.run_app(app,host='0.0.0.0',port=int(os.environ.get('PORT','4173')),print=None)
