(function(){
  const levels=[
    {name:'EASY',scale:1},
    {name:'MEDIUM',scale:.85},
    {name:'HARD',scale:.70},
    {name:'MADNESS!',scale:.55}
  ];
  let level=0;
  const rawSetInterval=window.setInterval.bind(window);

  function current(){return levels[level];}
  function isFreightTimer(delay){return typeof delay==='number' && delay>=1700 && delay<=1900;}
  function scaledDelay(delay){return Math.max(650,Math.round(delay*current().scale));}

  window.setInterval=function(fn,delay){
    const args=Array.prototype.slice.call(arguments,2);
    return rawSetInterval.apply(window,[fn,isFreightTimer(delay)?scaledDelay(delay):delay].concat(args));
  };

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
      if(msg) msg.textContent='Difficulty set to '+current().name+'. New speed starts next shift/resume.';
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