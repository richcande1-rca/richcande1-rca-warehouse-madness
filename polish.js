(function(){
  const levels=[
    {name:'EASY',scale:1},
    {name:'MEDIUM',scale:.85},
    {name:'HARD',scale:.70},
    {name:'MADNESS!',scale:.55}
  ];
  let level=0;
  let nextToken=1;
  let hazardsUnlocked=false;
  let hazardsOn=false;
  let writeUps=0;
  let supervisorPresent=false;
  let activeHazard=null;
  let tripOpen=false;
  const freightTimers=new Map();
  const rawSetInterval=window.setInterval.bind(window);
  const rawClearInterval=window.clearInterval.bind(window);

  function current(){return levels[level];}
  function isFreightTimer(delay){return typeof delay==='number' && delay>=1700 && delay<=1900;}
  function spotterShufflePad(delay){return delay===1750 ? 500 : 0;}
  function scaledDelay(delay){return Math.max(650,Math.round(delay*current().scale)+spotterShufflePad(delay));}

  window.setInterval=function(fn,delay){
    const args=Array.prototype.slice.call(arguments,2);
    if(!isFreightTimer(delay)){
      return rawSetInterval.apply(window,[fn,delay].concat(args));
    }
    const token='freight-'+(nextToken++);
    const timer={fn:fn,delay:delay,args:args,realId:null};
    timer.realId=rawSetInterval.apply(window,[fn,scaledDelay(delay)].concat(args));
    freightTimers.set(token,timer);
    return token;
  };

  window.clearInterval=function(id){
    if(freightTimers.has(id)){
      const timer=freightTimers.get(id);
      rawClearInterval(timer.realId);
      freightTimers.delete(id);
      return;
    }
    rawClearInterval(id);
  };

  function retimeFreightTimers(){
    freightTimers.forEach(function(timer){
      rawClearInterval(timer.realId);
      timer.realId=rawSetInterval.apply(window,[timer.fn,scaledDelay(timer.delay)].concat(timer.args));
    });
  }

  function arcadeButton(button,accent){
    button.style.cssText='width:100%;margin-top:10px;border:0;border-radius:8px;padding:12px 4px;background:'+accent+';color:#111;font-size:14px;font-weight:1000;box-shadow:0 4px 0 rgba(0,0,0,.45);';
  }

  function easeSpotterShuffle(){
    if(typeof stagePlans==='object' && stagePlans[3]){
      stagePlans[3].shuffleEvery=3;
      stagePlans[3].intro='The spotter keeps moving trailers. Door labels shuffle every 3 successful loads. Match pallets to the current door labels.';
    }
    const detail=document.querySelector('button.shiftChoice[data-stage="3"] .shiftDetail');
    if(detail) detail.textContent='door labels shuffle every 3 loads';
  }

  function installDifficultyButton(){
    const start=document.getElementById('start');
    const msg=document.getElementById('msg');
    if(!start || document.getElementById('difficulty')) return;
    const button=document.createElement('button');
    button.id='difficulty';
    button.type='button';
    function render(){button.textContent='DIFFICULTY: '+current().name;}
    button.addEventListener('click',function(){
      level=(level+1)%levels.length;
      render();
      retimeFreightTimers();
      if(msg) msg.textContent='Difficulty changed to '+current().name+'. Floor speed updated now.';
    });
    render();
    start.insertAdjacentElement('beforebegin',button);
  }

  function showBonusUnlock(){
    const difficulty=document.getElementById('difficulty');
    const ssButton=document.querySelector('button.shiftChoice[data-stage="3"]');
    const anchor=ssButton || difficulty;
    if(!anchor) return;
    let button=document.getElementById('hazardMode');
    if(!button){
      button=document.createElement('button');
      button.id='hazardMode';
      button.type='button';
      arcadeButton(button,'#ffd21a');
      button.addEventListener('click',function(){
        if(!hazardsUnlocked) return;
        beginHazardBonus();
      });
    }
    if(button.previousElementSibling!==anchor){
      anchor.insertAdjacentElement('afterend',button);
    }
    button.disabled=!hazardsUnlocked;
    button.textContent=hazardsUnlocked?'BONUS: BEWARE HAZARDS!':'BONUS: LOCKED - WIN SPOTTER SHUFFLE';
    button.style.opacity=hazardsUnlocked?'1':'.45';
    button.style.filter=hazardsUnlocked?'none':'grayscale(1)';
    button.style.cursor=hazardsUnlocked?'pointer':'not-allowed';
  }

  function beginHazardBonus(){
    hazardsOn=true;
    resetHazardRun();
    showStageIntro(3);
    setTimeout(function(){
      title.textContent='BONUS: BEWARE HAZARDS!';
      intro.textContent='No floor-jam loss. Load Spotter Shuffle while clearing aisle hazards. Some junk is harmless until the supervisor is watching.';
      start.textContent='START BONUS';
      showBonusUnlock();
    },0);
  }

  function hazardStatus(){
    let status=document.getElementById('hazardStatus');
    const msg=document.getElementById('msg');
    if(status || !msg) return status;
    status=document.createElement('div');
    status.id='hazardStatus';
    status.style.cssText='text-align:center;font-size:11px;font-weight:1000;min-height:14px;margin:-3px 0 3px;color:#ffd21a;letter-spacing:.8px;text-transform:uppercase;';
    msg.insertAdjacentElement('afterend',status);
    return status;
  }

  function updateHazardStatus(text){
    const status=hazardStatus();
    if(status) status.textContent=text || '';
  }

  function resetHazardRun(){
    writeUps=0;
    supervisorPresent=false;
    tripOpen=false;
    clearActiveHazard();
    updateHazardStatus('');
  }

  function clearActiveHazard(){
    if(activeHazard){
      if(activeHazard.timeout) rawClearInterval(activeHazard.timeout);
      if(activeHazard.el) activeHazard.el.remove();
    }
    activeHazard=null;
  }

  function installGameHooks(){
    if(typeof spawn==='function' && !spawn.__hazardWrapped){
      const originalSpawn=spawn;
      spawn=function(){
        if(hazardsOn && running && currentStage && currentStage.timed && pallets.length>=maxFloor){
          renderPallets();
          return;
        }
        return originalSpawn.apply(this,arguments);
      };
      spawn.__hazardWrapped=true;
    }

    if(typeof showStageIntro==='function' && !showStageIntro.__polishWrapped){
      const originalShowStageIntro=showStageIntro;
      showStageIntro=function(){
        easeSpotterShuffle();
        const result=originalShowStageIntro.apply(this,arguments);
        showBonusUnlock();
        return result;
      };
      showStageIntro.__polishWrapped=true;
    }

    if(typeof startStage==='function' && !startStage.__hazardWrapped){
      const originalStartStage=startStage;
      startStage=function(){
        resetHazardRun();
        if(currentStage && currentStage.id===4){
          currentStage.shuffleEvery=3;
        }
        return originalStartStage.apply(this,arguments);
      };
      startStage.__hazardWrapped=true;
    }

    if(typeof endGame==='function' && !endGame.__hazardWrapped){
      const originalEndGame=endGame;
      endGame=function(won,text,failTitle){
        if(hazardsOn && won){
          hazardsOn=false;
          clearActiveHazard();
          updateHazardStatus('');
          const oldTitle=currentStage.completeTitle;
          const oldText=currentStage.completeText;
          currentStage.completeTitle='BONUS COMPLETE';
          currentStage.completeText='Hazards survived. No safety meeting required.';
          originalEndGame.call(this,true,currentStage.completeText);
          setTimeout(function(){
            currentStage.completeTitle=oldTitle;
            currentStage.completeText=oldText;
            showBonusUnlock();
          },900);
          return;
        }
        if(hazardsOn && !won){
          hazardsOn=false;
          clearActiveHazard();
          updateHazardStatus('');
        }
        originalEndGame.apply(this,arguments);
        if(won && currentStage && currentStage.id===4){
          hazardsUnlocked=true;
          setTimeout(showBonusUnlock,520);
        }
      };
      endGame.__hazardWrapped=true;
    }
  }

  function installForkliftPolish(){
    const fork=document.getElementById('fork');
    if(!fork) return;

    function apply(){
      if(fork.style.top==='22%'){
        fork.classList.add('docking');
      }else if(fork.style.top==='52%'){
        fork.classList.remove('docking');
      }
      watchTrip();
    }

    new MutationObserver(apply).observe(fork,{attributes:true,attributeFilter:['style']});
    apply();
  }

  function watchTrip(){
    const fork=document.getElementById('fork');
    if(!fork) return;
    const docking=fork.classList.contains('docking') && fork.style.top==='22%';
    if(hazardsOn && docking && !tripOpen){
      tripOpen=true;
      startTripHazard();
    }
    if(tripOpen && (!docking || fork.style.top==='52%')){
      tripOpen=false;
      supervisorPresent=false;
      if(!activeHazard) updateHazardStatus('');
    }
  }

  function startTripHazard(){
    if(!hazardsOn || activeHazard) return;
    supervisorPresent=Math.random()<.36;
    updateHazardStatus(supervisorPresent?'SUPERVISOR PRESENT':'');
    if(Math.random()>.72) return;
    const types=[
      {kind:'debris',label:'DEBRIS',reaction:1400,left:25+Math.random()*50,top:42+Math.random()*20},
      {kind:'phone',label:'PHONE GUY',reaction:950,left:20+Math.random()*60,top:32+Math.random()*24},
      {kind:'traffic',label:'CROSS TRAFFIC',reaction:760,left:18+Math.random()*64,top:24+Math.random()*22}
    ];
    createHazard(types[Math.floor(Math.random()*types.length)]);
  }

  function createHazard(data){
    const floor=document.getElementById('floor');
    if(!floor) return;
    const el=document.createElement('button');
    el.type='button';
    el.textContent=data.label;
    el.style.cssText='position:absolute;left:'+data.left+'%;top:'+data.top+'%;transform:translate(-50%,-50%);z-index:8;border:3px solid #111;border-radius:8px;padding:8px 7px;background:#ffdf3a;color:#111;font-size:11px;font-weight:1000;box-shadow:0 4px 0 rgba(0,0,0,.45);';
    activeHazard={data:data,el:el,cleared:false,timeout:null};
    el.addEventListener('click',function(event){
      event.stopPropagation();
      if(!activeHazard) return;
      activeHazard.cleared=true;
      const msg=document.getElementById('msg');
      if(msg) msg.textContent=data.kind==='phone'?'HONK! Pedestrian cleared.':data.kind==='traffic'?'Braked for cross traffic.':'Debris cleared.';
      clearActiveHazard();
      updateHazardStatus(supervisorPresent?'SUPERVISOR PRESENT':'');
    });
    floor.appendChild(el);
    activeHazard.timeout=rawSetInterval(function(){
      missHazard(data);
    },data.reaction);
  }

  function missHazard(data){
    if(!activeHazard || activeHazard.cleared) return;
    clearActiveHazard();
    if(data.kind==='debris' && !supervisorPresent && Math.random()>.22){
      const msg=document.getElementById('msg');
      if(msg) msg.textContent='Rolled over some junk. Probably fine.';
      updateHazardStatus('');
      return;
    }
    if(data.kind==='debris'){
      issueWriteUp('Observed operating over debris.');
    }else if(data.kind==='phone'){
      issueWriteUp('Pedestrian near miss.');
    }else{
      issueWriteUp('Cross traffic incident.');
    }
  }

  function issueWriteUp(reason){
    writeUps++;
    const msg=document.getElementById('msg');
    if(msg) msg.textContent=reason+' Write-up '+writeUps+'/3.';
    updateHazardStatus((supervisorPresent?'SUPERVISOR PRESENT · ':'')+'WRITE-UP '+writeUps+'/3');
    if(writeUps>=3){
      hazardsOn=false;
      clearActiveHazard();
      setTimeout(function(){
        endGame(false,'Three safety write-ups. Bonus failed.','BONUS FAILED');
      },350);
    }
  }

  easeSpotterShuffle();
  installDifficultyButton();
  showBonusUnlock();
  installGameHooks();
  installForkliftPolish();
})();