const targets=[5,5,5,5];
const counts=[0,0,0,0];
const maxFloor=8;
const doors=document.getElementById('doors');
const palletsEl=document.getElementById('pallets');
const statusEl=document.getElementById('status');
const msg=document.getElementById('msg');
const fork=document.getElementById('fork');
const load=document.getElementById('load');
const overlay=document.getElementById('overlay');
const title=document.getElementById('title');
const intro=document.getElementById('intro');
const start=document.getElementById('start');
const restart=document.getElementById('restart');
const sound=document.getElementById('sound');

let pallets=[];
let selected=null;
let busy=false;
let running=false;
let timer=null;
let nextId=1;
let soundOn=true;
let audioContext=null;
let introPlaying=false;

function getAudio(){
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  if(audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function tone(kind){
  if(!soundOn) return;
  const ctx = getAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = kind === 'bad' ? 'sawtooth' : 'square';
  osc.frequency.value = kind === 'bad' ? 130 : kind === 'move' ? 520 : kind === 'win' ? 780 : 660;
  gain.gain.value = kind === 'bad' ? 0.09 : 0.055;
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (kind === 'bad' ? 0.28 : 0.12));
  osc.stop(ctx.currentTime + (kind === 'bad' ? 0.30 : 0.14));
}

function playIntroTheme(done){
  if(introPlaying) return;
  introPlaying=true;
  title.textContent='WAREHOUSE MADNESS';
  intro.textContent='Tap a pallet, then tap its matching dock door. Fill the trailers before the floor jams.';
  start.disabled=true;
  start.textContent='SAFETY MUSIC...';

  if(soundOn){
    const ctx=getAudio();
    const now=ctx.currentTime;
    const notes=[
      [659,0.00,.09],[740,.10,.09],[784,.20,.09],[880,.30,.12],[784,.45,.08],[740,.55,.08],[659,.65,.11],
      [587,.82,.09],[659,.92,.09],[740,1.02,.09],[784,1.12,.12],[740,1.27,.08],[659,1.37,.08],[587,1.47,.11],
      [659,1.64,.08],[784,1.74,.08],[988,1.84,.10],[880,1.98,.08],[784,2.08,.08],[740,2.18,.10],
      [587,2.34,.08],[659,2.44,.08],[740,2.54,.08],[784,2.64,.08],[880,2.74,.08],[988,2.84,.14],
      [880,3.05,.10],[784,3.17,.10],[659,3.29,.18]
    ];
    const bass=[
      [196,0.00,.10],[196,.40,.10],[220,.80,.10],[220,1.20,.10],[247,1.60,.10],[247,2.00,.10],[220,2.40,.10],[196,2.80,.10],[165,3.20,.16]
    ];
    notes.forEach(function(n){scheduleNote(ctx,now,n[0],n[1],n[2],'square',0.045);});
    bass.forEach(function(n){scheduleNote(ctx,now,n[0],n[1],n[2],'triangle',0.04);});
  }

  setTimeout(function(){
    introPlaying=false;
    start.disabled=false;
    start.textContent='START SHIFT';
    done();
  },3650);
}

function scheduleNote(ctx,base,freq,delay,duration,type,volume){
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type=type;
  osc.frequency.value=freq;
  gain.gain.setValueAtTime(0.001,base+delay);
  gain.gain.exponentialRampToValueAtTime(volume,base+delay+0.01);
  gain.gain.exponentialRampToValueAtTime(0.001,base+delay+duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(base+delay);
  osc.stop(base+delay+duration+0.03);
}

function renderDoors(){
  doors.innerHTML='';
  for(let i=0;i<4;i++){
    const door=document.createElement('div');
    door.className='door';
    door.innerHTML='<button data-door="'+(i+1)+'">DOOR '+(i+1)+'<small>Trailer</small><div class="count">'+counts[i]+' / '+targets[i]+'</div></button>';
    doors.appendChild(door);
  }
}

function renderPallets(){
  palletsEl.innerHTML='';
  pallets.forEach(function(pallet){
    const button=document.createElement('button');
    button.className='pallet'+(pallet.id===selected?' sel':'');
    button.textContent=pallet.door;
    button.dataset.id=pallet.id;
    palletsEl.appendChild(button);
  });
  statusEl.textContent='Floor: '+pallets.length+'/'+maxFloor;
}

function neededDoor(){
  const open=[1,2,3,4].filter(function(num){return counts[num-1] < targets[num-1];});
  return open[Math.floor(Math.random()*open.length)] || 1;
}

function spawn(){
  if(!running || busy) return;
  if(pallets.length >= maxFloor){
    endGame(false,'Floor jammed. Shift over.');
    return;
  }
  pallets.push({id:nextId++,door:neededDoor()});
  renderPallets();
}

function checkWin(){
  if(counts.every(function(count,index){return count >= targets[index];})){
    endGame(true,'All trailers loaded. Zorktron approves.');
  }
}

function endGame(won,text){
  running=false;
  clearInterval(timer);
  msg.textContent=text;
  tone(won?'win':'bad');
  setTimeout(function(){
    overlay.style.display='flex';
    title.textContent=won?'SHIFT COMPLETE':'SHIFT FAILED';
    intro.textContent=text;
    start.textContent='PLAY AGAIN';
  },450);
}

function newGame(){
  counts.fill(0);
  pallets=[];
  selected=null;
  busy=false;
  running=true;
  nextId=1;
  overlay.style.display='none';
  msg.textContent='Tap a pallet, then its matching dock door.';
  fork.style.left='50%';
  fork.style.top='52%';
  load.style.display='none';
  renderDoors();
  renderPallets();
  for(let i=0;i<4;i++) spawn();
  clearInterval(timer);
  timer=setInterval(spawn,1850);
}

function deliver(doorNumber){
  if(!running || busy || selected===null) return;
  const pallet=pallets.find(function(item){return item.id===selected;});
  if(!pallet) return;
  if(pallet.door !== doorNumber){
    msg.textContent='Wrong door. Pallet '+pallet.door+' belongs at Door '+pallet.door+'.';
    selected=null;
    busy=true;
    tone('bad');
    renderPallets();
    setTimeout(function(){
      busy=false;
      msg.textContent='Try another pallet.';
    },650);
    return;
  }
  busy=true;
  tone('move');
  msg.textContent='Forklift loading pallet '+pallet.door+'...';
  load.textContent=pallet.door;
  load.style.display='block';
  fork.style.left=(((doorNumber-0.5)/4)*100)+'%';
  fork.style.top='22%';
  setTimeout(function(){
    pallets=pallets.filter(function(item){return item.id!==selected;});
    selected=null;
    counts[doorNumber-1]++;
    renderDoors();
    renderPallets();
    tone('ok');
    load.style.display='none';
    msg.textContent='Door '+doorNumber+' loaded.';
    fork.style.left='50%';
    fork.style.top='52%';
    setTimeout(function(){
      busy=false;
      checkWin();
      if(running && pallets.length < 4) spawn();
    },550);
  },700);
}

palletsEl.addEventListener('click',function(event){
  const button=event.target.closest('.pallet');
  if(!button || busy || !running) return;
  selected=Number(button.dataset.id);
  msg.textContent='Pallet '+button.textContent+' selected. Tap Door '+button.textContent+'.';
  tone('move');
  renderPallets();
});

doors.addEventListener('click',function(event){
  const button=event.target.closest('button[data-door]');
  if(button) deliver(Number(button.dataset.door));
});

start.addEventListener('click',function(){
  playIntroTheme(newGame);
});
restart.addEventListener('click',newGame);
sound.addEventListener('click',function(){
  soundOn=!soundOn;
  sound.textContent='SOUND: '+(soundOn?'ON':'OFF');
});

renderDoors();
