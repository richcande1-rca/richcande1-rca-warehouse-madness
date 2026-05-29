(function(){
  const levels=[
    {name:'EASY',scale:1},
    {name:'MEDIUM',scale:.85},
    {name:'HARD',scale:.70},
    {name:'MADNESS!',scale:.55}
  ];
  let level=0;
  let nextToken=1;
  const freightTimers=new Map();
  const rawSetInterval=window.setInterval.bind(window);
  const rawClearInterval=window.clearInterval.bind(window);

  function current(){return levels[level];}
  function isFreightTimer(delay){return typeof delay==='number' && delay>=1700 && delay<=1900;}
  function scaledDelay(delay){return Math.max(650,Math.round(delay*current().scale));}

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

  function installDifficultyButton(){
    const pause=document.getElementById('pauseShift');
    const msg=document.getElementById('msg');
    if(!pause || document.getElementById('difficulty')) return;
    const button=document.createElement('button');
    button.id='difficulty';
    button.type='button';
    function render(){button.textContent='DIFF: '+current().name;}
    button.addEventListener('click',function(){
      level=(level+1)%levels.length;
      render();
      retimeFreightTimers();
      if(msg) msg.textContent='Difficulty changed to '+current().name+'. Floor speed updated now.';
    });
    render();
    pause.insertAdjacentElement('afterend',button);
  }

  function installForkliftPolish(){
    const fork=document.getElementById('fork');
    if(!fork) return;
    let correcting=false;
    function apply(){
      if(correcting) return;
      const top=fork.style.top;
      if(top==='22%'){
        correcting=true;
        fork.classList.add('docking');
        fork.style.top='8%';
        correcting=false;
      }else if(top==='52%'){
        fork.classList.remove('docking');
      }
    }
    new MutationObserver(apply).observe(fork,{attributes:true,attributeFilter:['style']});
    apply();
  }

  installDifficultyButton();
  installForkliftPolish();
})();