import { GAME } from './game-data.js';
import { WS_URL } from './config.js';

const $=id=>document.getElementById(id);
const boot=$('boot'),game=$('game'),status=$('status');
let started=false;

$('solo').onclick=()=>start({mode:'solo'});
$('create').onclick=()=>connect('create_room');
$('join').onclick=()=>connect('join_room',$('roomCode').value.trim().toUpperCase());

function socketUrl(){
  if(WS_URL) return WS_URL;
  const p=location.protocol==='https:'?'wss':'ws';
  return p+'://'+location.host+'/ws';
}
function connect(type,code=''){
  if(started)return;
  status.textContent='Bağlanıyor…';
  const ws=new WebSocket(socketUrl());
  const timer=setTimeout(()=>{try{ws.close()}catch{} status.textContent='Multiplayer sunucusu erişilemiyor.'},6000);
  ws.onopen=()=>ws.send(JSON.stringify({type,code,name:'Blood Knight'}));
  ws.onmessage=e=>{
    let d;try{d=JSON.parse(e.data)}catch{return}
    if(d.type==='error'){clearTimeout(timer);status.textContent=d.message||'Bağlantı hatası';return}
    if(d.type==='room_joined'){
      clearTimeout(timer);
      start({mode:'online',socket:ws,room:d.code,playerId:d.playerId,players:d.players,enemies:d.enemies,kills:d.kills||0,bossSpawned:d.bossSpawned});
    }
  };
}
function start(net){
  if(started)return; started=true; boot.classList.add('hidden'); game.classList.remove('hidden'); run(net);
}

function run(net){
  const canvas=$('renderCanvas');
  const engine=new BABYLON.Engine(canvas,true);
  const scene=new BABYLON.Scene(engine);
  scene.clearColor=new BABYLON.Color4(.015,.018,.022,1);
  scene.fogMode=BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity=.014;
  scene.fogColor=new BABYLON.Color3(.05,.055,.06);

  const camera=new BABYLON.ArcRotateCamera('cam',-Math.PI/2,1.02,24,BABYLON.Vector3.Zero(),scene);
  camera.inputs.clear();
  new BABYLON.HemisphericLight('moon',new BABYLON.Vector3(.2,1,0),scene).intensity=.55;
  const red=new BABYLON.PointLight('abyss',new BABYLON.Vector3(0,4,10),scene);
  red.diffuse=new BABYLON.Color3(.8,.05,.03); red.intensity=2;

  const ground=BABYLON.MeshBuilder.CreateGround('ground',{width:38,height:38},scene);
  const gm=new BABYLON.StandardMaterial('gm',scene);gm.diffuseColor=new BABYLON.Color3(.06,.06,.055);gm.specularColor=BABYLON.Color3.Black();ground.material=gm;
  const stone=new BABYLON.StandardMaterial('stone',scene);stone.diffuseColor=new BABYLON.Color3(.08,.08,.075);
  for(let i=0;i<42;i++){const g=BABYLON.MeshBuilder.CreateBox('grave'+i,{width:.55,height:1+Math.random(),depth:.3},scene);let a=i/42*Math.PI*2,r=11+Math.random()*6;g.position.set(Math.cos(a)*r,.6,Math.sin(a)*r);g.rotation.y=Math.random()*Math.PI;g.material=stone}
  const portal=BABYLON.MeshBuilder.CreateTorus('portal',{diameter:5,thickness:.35,tessellation:40},scene);portal.position.set(0,3,13);portal.rotation.x=Math.PI/2;
  const pm=new BABYLON.StandardMaterial('pm',scene);pm.emissiveColor=new BABYLON.Color3(.8,.02,.01);portal.material=pm;

  const player=new BABYLON.TransformNode('BloodKnight',scene);player.position.set(0,0,-7);
  const armor=new BABYLON.StandardMaterial('armor',scene);armor.diffuseColor=new BABYLON.Color3(.07,.065,.065);
  const body=BABYLON.MeshBuilder.CreateCapsule('body',{radius:.55,height:2.1},scene);body.parent=player;body.position.y=1.05;body.material=armor;
  const sword=BABYLON.MeshBuilder.CreateBox('sword',{width:.18,height:.16,depth:2.5},scene);sword.parent=player;sword.position.set(.9,1,.45);
  const sm=new BABYLON.StandardMaterial('sm',scene);sm.emissiveColor=new BABYLON.Color3(.7,.04,.03);sword.material=sm;

  const enemyMat=new BABYLON.StandardMaterial('enemy',scene);enemyMat.diffuseColor=new BABYLON.Color3(.14,.18,.12);
  const bossMat=new BABYLON.StandardMaterial('bossm',scene);bossMat.diffuseColor=new BABYLON.Color3(.22,.07,.07);
  const enemies=[],remote=new Map(),keys=new Set();
  const state={hp:GAME.player.maxHp,rage:15,kills:net.kills||0,boss:false,guardUntil:0};
  let pointer=new BABYLON.Vector3(),lastBasic=0,netTick=0;
  const cooldown={cleave:0,chain:0,rush:0,guard:0,ultimate:0,dodge:0};

  function spawnEnemy(d){
    const cfg=GAME.enemies[d.type||'corpse'];
    const r=new BABYLON.TransformNode(d.id||('E'+Math.random()),scene);
    const m=BABYLON.MeshBuilder.CreateCapsule('eb',{radius:d.type==='mourner'?.95:.48,height:d.type==='mourner'?3.2:1.8},scene);
    m.parent=r;m.position.y=d.type==='mourner'?1.6:.9;m.material=d.type==='mourner'?bossMat:enemyMat;
    r.position.set(Number(d.x)||0,0,Number(d.z)||0);
    r.metadata={id:d.id,type:d.type||'corpse',hp:Number(d.hp??cfg.hp),maxHp:Number(d.maxHp??cfg.hp),dead:false,speed:cfg.speed,damage:cfg.damage,lastHit:0};
    enemies.push(r);
    if(r.metadata.type==='mourner'){$('boss').classList.remove('hidden');$('quest').textContent='The Mourner’ı yen'}
    return r;
  }
  function byId(id){return enemies.find(e=>e.metadata?.id===id)}
  function ensureEnemy(d){let e=byId(d.id)||spawnEnemy(d);e.position.x=+d.x||0;e.position.z=+d.z||0;e.metadata.hp=+d.hp;e.metadata.maxHp=+d.maxHp;return e}

  if(net.mode==='solo'){
    [[-6,-1],[6,-1],[-7,5],[7,5],[-3,8],[3,9]].forEach((p,i)=>spawnEnemy({id:'S'+i,type:'corpse',x:p[0],z:p[1],hp:120,maxHp:120}));
  }else{
    $('roomHud').textContent=net.room;$('party').classList.remove('hidden');
    (net.enemies||[]).forEach(ensureEnemy);(net.players||[]).forEach(p=>p.id!==net.playerId&&makeRemote(p));
    bindSocket();
  }

  function makeRemote(p){
    if(remote.has(p.id))return remote.get(p.id);
    const root=new BABYLON.TransformNode('remote_'+p.id,scene);
    const b=BABYLON.MeshBuilder.CreateCapsule('rb',{radius:.5,height:2},scene);b.parent=root;b.position.y=1;
    const m=new BABYLON.StandardMaterial('rm'+p.id,scene);m.diffuseColor=new BABYLON.Color3(.17,.2,.28);b.material=m;
    root.position.set(+p.x||0,0,+p.z||-7);root.rotation.y=+p.ry||0;remote.set(p.id,root);renderParty();return root;
  }
  function renderParty(){
    if(net.mode!=='online')return;
    $('party').innerHTML='<b>PARTİ</b><br>Blood Knight (Sen)'+[...remote.keys()].map(()=>'<br>Blood Knight').join('');
  }
  function bindSocket(){
    net.socket.onmessage=e=>{
      let d;try{d=JSON.parse(e.data)}catch{return}
      if(d.type==='player_joined')makeRemote(d.player);
      if(d.type==='player_state'){const r=makeRemote(d.player);r.position.x=+d.player.x||0;r.position.z=+d.player.z||0;r.rotation.y=+d.player.ry||0}
      if(d.type==='player_left'){remote.get(d.playerId)?.dispose();remote.delete(d.playerId);renderParty()}
      if(d.type==='enemy_damage'){const en=byId(d.enemyId);if(en){en.metadata.hp=d.hp;showDamage(d.damage,d.crit)}if(d.by===net.playerId&&d.rage!=null){state.rage=d.rage;hud()}}
      if(d.type==='enemy_dead'){const en=byId(d.enemyId);if(en){en.metadata.dead=true;en.setEnabled(false)}state.kills=d.kills||state.kills;quest();if(d.enemyType==='mourner'){$('boss').classList.add('hidden');toast('THE MOURNER YENİLDİ')}}
      if(d.type==='boss_spawn')ensureEnemy(d.enemy);
      if(d.type==='player_action'&&remote.has(d.playerId)){const r=remote.get(d.playerId);if(d.action==='rush')r.position.addInPlace(new BABYLON.Vector3(Math.sin(r.rotation.y),0,Math.cos(r.rotation.y)).scale(2))}
    };
  }

  function facing(){return new BABYLON.Vector3(Math.sin(player.rotation.y),0,Math.cos(player.rotation.y))}
  function front(e,range,dot){const v=e.position.subtract(player.position),dist=v.length();return dist<=range&&BABYLON.Vector3.Dot(facing(),v.normalize())>dot}
  function localHit(action,mult,range,dot,max=99){
    const t=enemies.filter(e=>!e.metadata.dead&&front(e,range,dot)).sort((a,b)=>BABYLON.Vector3.Distance(a.position,player.position)-BABYLON.Vector3.Distance(b.position,player.position)).slice(0,max);
    t.forEach(e=>damageLocal(e,GAME.player.baseDamage*mult));
  }
  function damageLocal(e,raw){
    if(e.metadata.dead)return;const crit=Math.random()<.16,d=Math.round(raw*(crit?1.5:1));e.metadata.hp=Math.max(0,e.metadata.hp-d);state.rage=Math.min(100,state.rage+8);showDamage(d,crit);
    if(e.metadata.hp<=0){e.metadata.dead=true;e.setEnabled(false);state.kills++;quest();if(state.kills>=6&&!state.boss){state.boss=true;spawnEnemy({id:'mourner',type:'mourner',x:0,z:11,hp:1200,maxHp:1200});toast('BOSS · THE MOURNER')}}
    hud();
  }
  function sendCombat(a){if(net.mode==='online'&&net.socket.readyState===1){net.socket.send(JSON.stringify({type:'combat',action:a}));return true}return false}
  function ready(k,ms){let n=performance.now();if(n<cooldown[k])return false;cooldown[k]=n+ms;return true}
  function attack(){let n=performance.now();if(n-lastBasic<330)return;lastBasic=n;if(!sendCombat('basic'))localHit('basic',1,2.9,.42,1);sword.rotation.z=-.8;setTimeout(()=>sword.rotation.z=0,120)}
  function cleave(){if(!ready('cleave',2400))return;if(!sendCombat('cleave'))localHit('cleave',2.05,3.5,-.25)}
  function chain(){if(!ready('chain',5200))return;if(!sendCombat('chain'))localHit('chain',.75,7,.25,3)}
  function rush(){if(!ready('rush',4300))return;player.position.addInPlace(facing().scale(4));clamp();if(net.mode==='online')sendCombat('rush');else localHit('rush',1.25,5.2,-.15)}
  function guard(){if(!ready('guard',9000))return;state.guardUntil=performance.now()+4000;toast('CRIMSON GUARD')}
  function ultimate(){if(state.rage<100)return toast('Blood Rage %100 gerekli');if(!ready('ultimate',12000))return;state.rage=0;if(!sendCombat('bloodstorm'))localHit('bloodstorm',3.15,5.2,-1);toast('BLOODSTORM');hud()}
  function dodge(){if(!ready('dodge',800))return;player.position.addInPlace(facing().scale(2.5));clamp()}
  function clamp(){player.position.x=Math.max(-16,Math.min(16,player.position.x));player.position.z=Math.max(-16,Math.min(16,player.position.z))}

  function quest(){$('quest').textContent=state.kills>=6?'The Mourner’ı yen':'Rotting Corpse temizle: '+state.kills+'/6'}
  function hud(){$('hp').textContent=Math.round(state.hp)+' / '+GAME.player.maxHp;$('rage').textContent=Math.round(state.rage)+'%'}
  function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1000)}
  function showDamage(n,c){toast((c?'CRIT ':'')+Math.round(n))}
  function enemyAttack(e){let n=performance.now();if(n-e.metadata.lastHit<950)return;e.metadata.lastHit=n;let d=e.metadata.damage*(n<state.guardUntil?.45:1);state.hp=Math.max(0,state.hp-d);if(state.hp<=0){state.hp=GAME.player.maxHp;player.position.set(0,0,-7);toast('DÜŞTÜN')}hud()}

  window.addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='Digit1')cleave();if(e.code==='Digit2')chain();if(e.code==='Digit3')rush();if(e.code==='Digit4')guard();if(e.code==='KeyR')ultimate();if(e.code==='Space')dodge()});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  canvas.addEventListener('pointermove',e=>{const p=scene.pick(e.clientX,e.clientY,m=>m===ground);if(p.hit)pointer=p.pickedPoint});
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)attack()});

  scene.onBeforeRenderObservable.add(()=>{
    const dt=engine.getDeltaTime()/16.666;
    let x=0,z=0;if(keys.has('KeyW'))z++;if(keys.has('KeyS'))z--;if(keys.has('KeyA'))x--;if(keys.has('KeyD'))x++;
    if(x||z){player.position.addInPlace(new BABYLON.Vector3(x,0,z).normalize().scale(GAME.player.moveSpeed*dt));clamp()}
    const dir=pointer.subtract(player.position);if(dir.lengthSquared()>.01)player.rotation.y=Math.atan2(dir.x,dir.z);
    camera.target=BABYLON.Vector3.Lerp(camera.target,player.position.add(new BABYLON.Vector3(0,.8,0)),.08);
    if(net.mode==='online'&&net.socket.readyState===1){netTick+=engine.getDeltaTime();if(netTick>80){netTick=0;net.socket.send(JSON.stringify({type:'state',x:player.position.x,y:0,z:player.position.z,ry:player.rotation.y}))}}
    enemies.forEach(e=>{if(e.metadata.dead)return;let d=BABYLON.Vector3.Distance(e.position,player.position);if(net.mode==='solo'){if(d<9.5&&d>1.5){let v=player.position.subtract(e.position).normalize();e.position.addInPlace(v.scale(e.metadata.speed*dt));e.rotation.y=Math.atan2(v.x,v.z)}if(d<1.6)enemyAttack(e)}if(e.metadata.type==='mourner')$('bossHp').style.width=Math.max(0,e.metadata.hp/e.metadata.maxHp*100)+'%'});
  });

  quest();hud();engine.runRenderLoop(()=>scene.render());addEventListener('resize',()=>engine.resize());
}
