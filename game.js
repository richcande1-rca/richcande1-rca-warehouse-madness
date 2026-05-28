const stagePlans=[
  {
    id:1,
    name:'TRAINING SHIFT',
    targets:[2,2,2,2],
    maxFloor:8,
    timed:false,
    button:'START TRAINING',
    intro:'Load 2 pallets per dock. No time limit. Match each pallet number to the same dock door.',
    completeTitle:'TRAINING COMPLETE',
    completeText:'Congratulations! Welcome to the team! You are now certified for basic dock freight.'
  },
  {
    id:2,
    name:'PRODUCTION SHIFT',
    targets:[5,5,5,5],
    maxFloor:8,
    timed:true,
    spawnMs:1850,
    button:'START PRODUCTION',
    intro:'The line is live. Pallets keep arriving. Fill the trailers before the staging floor jams.',
    completeTitle:'SHIFT COMPLETE',
    completeText:'Congratulations. You made it through production. Get some rest. Have a beer. You earned it.'
  },
  {
    id:3,
    name:'DISPATCH CHAOS',
    targets:[1,2,3,4],
    randomTargets:true,
    minTarget:1,
    maxTarget:5,
    maxFloor:8,
    timed:true,
    spawnMs:1800,
    returnOverage:true,
    button:'START DISPATCH',
    intro:'Each dock has a different target count. Extra freight comes back around instead of disappearing.',
    completeTitle:'DISPATCH COMPLETE',
    completeText:'All dispatch doors loaded. Door Dash complete.'
  },
  {
    id:4,
    name:'SPOTTER SHUFFLE',
    targets:[1,2,3,4],
    randomTargets:true,
    minTarget:1,
    maxTarget:5,
    maxFloor:8,
    timed:true,
    spawnMs:1750,
    returnOverage:true,
    shuffleDoors:true,
    shuffleEvery:2,
    button:'START SHUFFLE',
    intro:'The spotter keeps moving trailers. Door labels shuffle every 2 successful loads. Match pallets to the current door labels.',
    completeTitle:'SHUFFLE COMPLETE',
    completeText:'All shuffled trailers loaded. Spotter Shuffle complete.'
  }
];

let stageIndex=0;
let currentStage=stagePlans[0];
let targets=currentStage.targets.slice();
let counts=[0,0,0,0];
let maxFloor=currentStage.maxFloor;
let doorLabels=[1,2,3,4];
let successfulLoads=0;

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
const altStart=document.createElement('button');
altStart.id='altStart';
altStart.type='button';
start.insertAdjacentElement('afterend',altStart);
const shiftDetails=[
  '2 pallets per door · no timer',
  '5 per door · live floor pressure',
  'random targets · overage freight returns',
  'door labels shuffle every 2 loads'
];
const shiftButtons=[];
let lastShiftButton=altStart;
stagePlans.forEach(function(plan,index){
  const button=document.createElement('button');
  button.type='button';
  button.className='shiftChoice'+(index>=2?' shiftDanger':'');
  button.innerHTML='<span class="shiftNo">STAGE '+plan.id+'</span><span class="shiftName">'+plan.name+'</span><span class="shiftDetail">'+shiftDetails[index]+'</span>';
  button.dataset.stage=index;
  button.style.display='none';
  lastShiftButton.insertAdjacentElement('afterend',button);
  shiftButtons.push(button);
  lastShiftButton=button;
});
const pauseShift=document.createElement('button');
pauseShift.id='pauseShift';
pauseShift.type='button';
pauseShift.textContent='PAUSE';
sound.insertAdjacentElement('afterend',pauseShift);
restart.textContent='SHIFTS';

let pallets=[];
let selected=null;
let busy=false;
let running=false;
let paused=false;
let timer=null;
let nextId=1;
let soundOn=true;
let audioContext=null;
let introPlaying=false;
let overlayAction='stage';
let trainingWrongDocks=0;

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
  start.disabled=true;
  altStart.style.display='none';
  hideShiftButtons();
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
    start.textContent=currentStage.button;
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

function playWinJingle(){
  if(!soundOn) return;
  const ctx=getAudio();
  const now=ctx.currentTime;
  const notes=[
    [523,0.00,.10],[659,.12,.10],[784,.24,.12],[1046,.40,.18],
    [784,.66,.10],[1046,.80,.26]
  ];
  const bass=[[262,0.00,.18],[392,.40,.18],[523,.80,.26]];
  notes.forEach(function(n){scheduleNote(ctx,now,n[0],n[1],n[2],'square',0.055);});
  bass.forEach(function(n){scheduleNote(ctx,now,n[0],n[1],n[2],'triangle',0.035);});
}

function playLoseJingle(){
  if(!soundOn) return;
  const ctx=getAudio();
  const now=ctx.currentTime;
  const notes=[
    [392,0.00,.18],[349,.20,.18],[294,.40,.22],[196,.68,.34]
  ];
  const bass=[[130,0.68,.36]];
  notes.forEach(function(n){scheduleNote(ctx,now,n[0],n[1],n[2],'sawtooth',0.055);});
  bass.forEach(function(n){scheduleNote(ctx,now,n[0],n[1],n[2],'triangle',0.045);});
}

function hideShiftButtons(){
  shiftButtons.forEach(function(button){
    button.style.display='none';
  });
}

function showShiftSelect(){
  running=false;
  paused=false;
  busy=false;
  selected=null;
  clearInterval(timer);
  pauseShift.textContent='PAUSE';
  overlayAction='select';
  overlay.style.display='flex';
  title.textContent='CHOOSE SHIFT';
  intro.textContent='Pick a shift to start.';
  start.style.display='none';
  altStart.style.display='none';
  shiftButtons.forEach(function(button){
    button.style.display='block';
  });
  msg.textContent='Choose a shift.';
}

function buildTargets(plan){
  if(!plan.randomTargets) return plan.targets.slice();
  const min=plan.minTarget || 1;
  const max=plan.maxTarget || 5;
  return [0,1,2,3].map(function(){
    return min + Math.floor(Math.random()*(max-min+1));
  });
}

function targetSummary(){
  return 'Targets: Door 1 '+targets[0]+', Door 2 '+targets[1]+', Door 3 '+targets[2]+', Door 4 '+targets[3]+'.';
}

function doorLabelForPosition(position){
  return doorLabels[position-1] || position;
}

function resetDoorLabels(){
  doorLabels=[1,2,3,4];
}

function sameLabels(a,b){
  return a.every(function(value,index){return value===b[index];});
}

function shuffleDoorLabels(){
  const oldLabels=doorLabels.slice();
  let shuffled=oldLabels.slice();
  let guard=0;
  do{
    shuffled=[1,2,3,4].sort(function(){return Math.random()-.5;});
    guard++;
  }while(sameLabels(shuffled,oldLabels) && guard<12);
  doorLabels=shuffled;
}

function targetsComplete(){
  return counts.every(function(count,index){return count >= targets[index];});
}

function showStageIntro(index){
  stageIndex=index;
  currentStage=stagePlans[stageIndex];
  targets=buildTargets(currentStage);
  maxFloor=currentStage.maxFloor;
  counts=[0,0,0,0];
  pallets=[];
  selected=null;
  busy=false;
  running=false;
  paused=false;
  trainingWrongDocks=0;
  successfulLoads=0;
  resetDoorLabels();
  clearInterval(timer);
  pauseShift.textContent='PAUSE';
  hideShiftButtons();
  overlayAction='stage';
  overlay.style.display='flex';
  title.textContent='STAGE '+currentStage.id+' - '+currentStage.name;
  intro.textContent=currentStage.intro+(currentStage.randomTargets?' '+targetSummary():'');
  start.style.display='block';
  start.textContent=currentStage.button;
  start.disabled=false;
  altStart.textContent='SELECT SHIFT';
  altStart.style.display='block';
  msg.textContent='Tap a pallet, then its matching dock door.';
  renderDoors();
  renderPallets();
}

function showTrainingAward(){
  overlayAction='award';
  overlay.style.display='flex';
  hideShiftButtons();
  title.textContent=currentStage.completeTitle;
  intro.textContent=currentStage.completeText;
  start.style.display='block';
  start.textContent='BEGIN PRODUCTION SHIFT';
  start.disabled=false;
  altStart.textContent='REPLAY TRAINING';
  altStart.style.display='block';
  playWinJingle();
}

function showStageAdvance(){
  const nextStage=stagePlans[stageIndex+1];
  overlayAction='advance';
  overlay.style.display='flex';
  hideShiftButtons();
  title.textContent=currentStage.completeTitle;
  intro.textContent=currentStage.completeText;
  start.style.display='block';
  start.textContent='BEGIN '+nextStage.name;
  start.disabled=false;
  altStart.textContent='REPLAY SHIFT';
  altStart.style.display='block';
  playWinJingle();
}

function showPause(){
  if(!running || paused) return;
  if(busy){
    msg.textContent='Pause available after the forklift clears.';
    return;
  }
  paused=true;
  clearInterval(timer);
  pauseShift.textContent='PAUSED';
  overlayAction='pause';
  overlay.style.display='flex';
  hideShiftButtons();
  title.textContent='SHIFT PAUSED';
  intro.textContent='Production is temporarily stopped.';
  start.style.display='block';
  start.textContent='RESUME SHIFT';
  start.disabled=false;
  altStart.textContent='SHIFT SELECT';
  altStart.style.display='block';
}

function resumePause(){
  if(!paused) return;
  paused=false;
  overlay.style.display='none';
  altStart.style.display='none';
  hideShiftButtons();
  pauseShift.textContent='PAUSE';
  msg.textContent='Shift resumed.';
  clearInterval(timer);
  if(currentStage.timed && running){
    timer=setInterval(spawn,currentStage.spawnMs);
  }
}

function renderDoors(){
  doors.innerHTML='';
  for(let i=0;i<4;i++){
    const label=doorLabelForPosition(i+1);
    const door=document.createElement('div');
    door.className='door';
    door.innerHTML='<button data-door="'+(i+1)+'"><span>DOOR '+label+'</span><small>Bay '+(i+1)+'</small><div class="count">'+counts[label-1]+' / '+targets[label-1]+'</div></button>';
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
  if(currentStage.timed){
    statusEl.textContent='Stage '+currentStage.id+' | Floor: '+pallets.length+'/'+maxFloor;
  }else{
    statusEl.textContent='Stage '+currentStage.id+' | Loaded: '+loadedTotal()+'/'+targetTotal();
  }
}

function loadedTotal(){
  return counts.reduce(function(total,count){return total+count;},0);
}

function targetTotal(){
  return targets.reduce(function(total,count){return total+count;},0);
}

function neededDoor(){
  const open=[1,2,3,4].filter(function(num){return counts[num-1] < targets[num-1];});
  return open[Math.floor(Math.random()*open.length)] || null;
}

function clearCompletedDoorPallets(doorNumber){
  if(counts[doorNumber-1] < targets[doorNumber-1]) return false;
  const before=pallets.length;
  pallets=pallets.filter(function(item){return item.door!==doorNumber;});
  if(selected && !pallets.some(function(item){return item.id===selected;})) selected=null;
  return pallets.length !== before;
}

function spawn(){
  if(!running || busy || paused) return;
  const door=neededDoor();
  if(!door) return;
  if(currentStage.timed && pallets.length >= maxFloor){
    endGame(false,'You have not met expectations. This is your first warning.','EXPECTATIONS NOT MET');
    return;
  }
  if(!currentStage.timed && pallets.length >= 4) return;
  pallets.push({id:nextId++,door:door});
  renderPallets();
}

function refillTraining(){
  if(currentStage.timed) return;
  while(running && !paused && pallets.length < 4 && neededDoor()){
    spawn();
  }
}

function checkWin(){
  if(targetsComplete()){
    if(currentStage.id===1){
      running=false;
      clearInterval(timer);
      setTimeout(showTrainingAward,450);
    }else if(stageIndex < stagePlans.length-1){
      running=false;
      clearInterval(timer);
      setTimeout(showStageAdvance,450);
    }else{
      endGame(true,currentStage.completeText);
    }
  }
}

function endGame(won,text,failTitle){
  running=false;
  paused=false;
  clearInterval(timer);
  pauseShift.textContent='PAUSE';
  msg.textContent=text;
  if(won){
    playWinJingle();
  }else{
    playLoseJingle();
  }
  setTimeout(function(){
    overlay.style.display='flex';
    hideShiftButtons();
    title.textContent=won?currentStage.completeTitle:(failTitle || 'SHIFT FAILED');
    intro.textContent=text;
    start.style.display='block';
    start.textContent=won?'REPLAY SHIFT':(currentStage.id===1?'RETRY TRAINING':'RETRY SHIFT');
    altStart.textContent='SHIFT SELECT';
    altStart.style.display='block';
    overlayAction='replay';
  },450);
}

function startStage(){
  counts=[0,0,0,0];
  pallets=[];
  selected=null;
  busy=false;
  running=true;
  paused=false;
  nextId=1;
  trainingWrongDocks=0;
  successfulLoads=0;
  resetDoorLabels();
  overlay.style.display='none';
  altStart.style.display='none';
  hideShiftButtons();
  pauseShift.textContent='PAUSE';
  msg.textContent=currentStage.shuffleDoors?'Spotter Shuffle is live. Watch the door labels.':currentStage.timed?'Production line is live.':'Training shift: accuracy first.';
  fork.style.left='50%';
  fork.style.top='52%';
  load.style.display='none';
  renderDoors();
  renderPallets();
  for(let i=0;i<4;i++) spawn();
  clearInterval(timer);
  if(currentStage.timed){
    timer=setInterval(spawn,currentStage.spawnMs);
  }
}

function deliver(doorNumber){
  if(!running || paused || busy || selected===null) return;
  const assignedDoor=doorLabelForPosition(doorNumber);
  const pallet=pallets.find(function(item){return item.id===selected;});
  if(!pallet) return;
  if(pallet.door !== assignedDoor){
    selected=null;
    tone('bad');
    if(currentStage.id===1){
      trainingWrongDocks++;
      renderPallets();
      if(trainingWrongDocks >= 2){
        endGame(false,"Sorry, we don't think you fit this position.",'TRAINING FAILED');
        return;
      }
      msg.textContent='Accuracy coaching: that pallet belongs at Door '+pallet.door+'. One more wrong dock ends training.';
      return;
    }
    msg.textContent='Wrong dock. Pallet '+pallet.door+' belongs at Door '+pallet.door+'.';
    renderPallets();
    return;
  }
  if(counts[assignedDoor-1] >= targets[assignedDoor-1]){
    if(currentStage.returnOverage){
      selected=null;
      tone('bad');
      msg.textContent='Door '+assignedDoor+' is full. Overage pallet returns to the floor.';
      renderDoors();
      renderPallets();
      return;
    }
    clearCompletedDoorPallets(assignedDoor);
    tone('ok');
    msg.textContent='Door '+assignedDoor+' is already full. Extra pallets cleared.';
    renderDoors();
    renderPallets();
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
    counts[assignedDoor-1]=Math.min(counts[assignedDoor-1]+1,targets[assignedDoor-1]);
    successfulLoads++;
    const doorNowFull=counts[assignedDoor-1] >= targets[assignedDoor-1];
    const returnOverage=!!currentStage.returnOverage;
    pallets=pallets.filter(function(item){
      if(item.id===selected) return false;
      if(doorNowFull && item.door===assignedDoor && !returnOverage) return false;
      return true;
    });
    selected=null;
    let shuffled=false;
    if(currentStage.shuffleDoors && successfulLoads % (currentStage.shuffleEvery || 2)===0 && !targetsComplete()){
      shuffleDoorLabels();
      shuffled=true;
    }
    renderDoors();
    renderPallets();
    tone('ok');
    load.style.display='none';
    msg.textContent=shuffled?'Spotter moved trailers. Read the door labels.':doorNowFull && returnOverage?'Door '+assignedDoor+' full. Extra freight stays in rotation.':doorNowFull?'Door '+assignedDoor+' full. Extra pallets cleared.':'Door '+assignedDoor+' loaded.';
    fork.style.left='50%';
    fork.style.top='52%';
    setTimeout(function(){
      busy=false;
      checkWin();
      if(running && !paused){
        if(currentStage.timed){
          if(pallets.length < 4) spawn();
        }else{
          refillTraining();
        }
      }
    },550);
  },700);
}

palletsEl.addEventListener('click',function(event){
  const button=event.target.closest('.pallet');
  if(!button || paused || busy || !running) return;
  selected=Number(button.dataset.id);
  msg.textContent='Pallet '+button.textContent+' selected. Match the current Door '+button.textContent+' label.';
  tone('move');
  renderPallets();
});

doors.addEventListener('click',function(event){
  const button=event.target.closest('button[data-door]');
  if(button) deliver(Number(button.dataset.door));
});

start.addEventListener('click',function(){
  if(overlayAction==='pause'){
    resumePause();
    return;
  }
  if(overlayAction==='award'){
    showStageIntro(1);
    return;
  }
  if(overlayAction==='advance'){
    showStageIntro(stageIndex+1);
    return;
  }
  if(overlayAction==='replay'){
    showStageIntro(stageIndex);
    return;
  }
  playIntroTheme(startStage);
});

altStart.addEventListener('click',function(){
  if(overlayAction==='award'){
    showStageIntro(0);
    return;
  }
  if(overlayAction==='advance'){
    showStageIntro(stageIndex);
    return;
  }
  showShiftSelect();
});

shiftButtons.forEach(function(button){
  button.addEventListener('click',function(){
    showStageIntro(Number(button.dataset.stage));
  });
});

restart.addEventListener('click',function(){
  showShiftSelect();
});

pauseShift.addEventListener('click',function(){
  showPause();
});

sound.addEventListener('click',function(){
  soundOn=!soundOn;
  sound.textContent='SOUND: '+(soundOn?'ON':'OFF');
});

showStageIntro(0);
