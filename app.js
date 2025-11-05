(function(){
  const $ = (q)=>document.querySelector(q);
  const $$ = (q)=>Array.from(document.querySelectorAll(q));

  // Utils
  function escUser(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function rangeChunk(min,max){
    if(min>max) return '';
    if(min===max) return `${min}`;
    if(min===0 && max===9) return "\\d";
    const seg=[];
    if(min<=9){seg.push(min===0 && max>=9?"\\d":`[${min}-${Math.min(max,9)}]`)}
    const tMin=Math.max(10,min),tMax=max; if(tMin<=tMax){
      const a=Math.floor(tMin/10), b=Math.floor(tMax/10);
      if(a===b){seg.push(`${a}[${tMin%10}-${tMax%10}]`)} else {
        if(tMin%10!==0) seg.push(`${a}[${tMin%10}-9]`); else seg.push(`${a}\\d`);
        if(b>a+1) seg.push(`[${a+1}-${b-1}]\\d`);
        if(tMax%10===0) seg.push(`${b}0`); else seg.push(`${b}[0-${tMax%10}]`);
      }
    }
    return seg.length===1?seg[0]:(`(?:${seg.join("|")})`);
  }
  function levelRx(prefix,min,max,defMax=99){
    if((min|0)===0 && (max|0)===0) return null;
    if(max>0 && min>max) return null;
    const eMax=max===0?defMax:max;
    if(min===0 && eMax===defMax) return `${prefix}(\\d{1,2})\\b`;
    if(min===eMax) return `${prefix}(${min})\\b`;
    return `${prefix}(${rangeChunk(min,eMax)})\\b`;
  }

  function rarityType({rare,magic,normal}){
    const t=[rare?'r':null,magic?'m':null,normal?'n':null].filter(Boolean);
    if(t.length===0||t.length===3) return null;
    return t.length>1?`y: (${t.join('|')})`:`y: ${t[0]}`;
  }
  function itemClass(slot){
    const map={bow:'bow',quiver:'qui',boots:'boo',rings:'ri',amulet:'am',gloves:'gl',helmet:'he',body:'bod'};
    const key=map[slot];
    return key?`s: ${key}`:null;
  }
  function resist({fi,co,li,ch}){
    const arr=[co?'co':null,fi?'fi':null,li?'li':null,ch?'ch':null].filter(Boolean);
    if(arr.length===0) return null; if(arr.length===4) return 'resi';
    return `(${arr.join('|')}).+res`;
  }
  function movement({m10,m15,m20,m25,m30}){
    const z=[m10?'1':null,m20?'2':null,m30?'3':null].filter(Boolean);
    const f=[m15?'1':null,m25?'2':null].filter(Boolean);
    const c=z.length+f.length; if(c===0) return null; if(c===5) return `\\d+% i.+mov`;
    if(c===1){const s=m10?'10':m15?'15':m20?'20':m25?'25':'30'; return `${s}% i.+mov`;}
    const Z=z.length>1?`[${z.join('')}]0`:(z.length?`${z[0]}0`:``);
    const F=f.length>1?`[${f.join('')}]5`:(f.length?`${f[0]}5`:``);
    return `(?:${[Z,F].filter(Boolean).join('|')})% i.+mov`;
  }
  function damages({phys,elem,cold,fire,light}){
    const out=[]; if(phys) out.push('ph.*da');
    if(elem) out.push('\\d (c|f|l).+da'); else {
      const p=[cold?'co':null,fire?'f':null,light?'l':null].filter(Boolean);
      if(p.length) out.push(`\\d ${p.length>1?`(${p.join('|')})`:p[0]}.+da`);
    }
    return out;
  }
  function utility({as,cs,life,mana,spirit,rarity,skills}){
    return [as?'ck spe':null,cs?'st spe':null,life?'\\d.+life':null,mana?'\\d.+mana':null,spirit?'spiri':null,rarity?'d rar':null,skills?'^\\+.*ills$':null].filter(Boolean);
  }

  function combineAND(terms){const t=terms.filter(Boolean); if(!t.length) return ''; if(t.length===1) return `"${t[0]}"`; return `"${t.map(x=>`(?=.*${x})`).join('')}.*"`;}
  function combineOR(groups){const t=groups.filter(Boolean); if(!t.length) return ''; return `"${t.length===1?t[0]:(`(?:${t.join('|')})`)}"`;}
  function compress(expr){ if(!expr) return ''; if(expr.length<=50) return expr; let e=expr.replace(/\s+/g,' '); e=e.replace(/\(\?:/g,'('); e=e.replace(/\b/g,''); return e; }

  const state={
    slot:'bow',
    types:{rare:true,magic:false,normal:false},
    props:{quality:false,sockets:false},
    il:{min:83,max:99},
    cl:{min:1,max:99},
    res:{fi:false,co:false,li:false,ch:false},
    mov:{m10:false,m15:false,m20:false,m25:false,m30:false},
    dmg:{phys:false,elem:false,cold:false,fire:false,light:false},
    uti:{as:false,cs:false,life:false,mana:false,spirit:false,rarity:false,skills:false},
    compose:'and',
    custom:''
  };

  function build(){
    const terms=[];
    terms.push(rarityType(state.types));
    terms.push(itemClass(state.slot));
    terms.push(levelRx('m level: ',state.il.min,state.il.max));
    terms.push(levelRx('s: level ',state.cl.min,state.cl.max));
    if(state.props.quality) terms.push('y: \\+');
    if(state.props.sockets) terms.push('ts: S');
    const r=resist(state.res); if(r) terms.push(r);
    const m=movement(state.mov); if(m) terms.push(m);
    terms.push(...damages({phys:state.dmg.phys,elem:state.dmg.elem,cold:state.dmg.cold,fire:state.dmg.fire,light:state.dmg.light}));
    terms.push(...utility({as:state.uti.as,cs:state.uti.cs,life:state.uti.life,mana:state.uti.mana,spirit:state.uti.spirit,rarity:state.uti.rarity,skills:state.uti.skills}));
    if(state.custom.trim()) terms.push(escUser(state.custom.trim()));

    const expr=state.compose==='and'?combineAND(terms):combineOR(terms);
    const out=compress(expr);
    $('#out').value=out;
    const n=out.length; $('#chars').textContent=`${n}/50`;
    $('#warn').textContent= n>50? 'Over 50 chars — consider toggling fewer filters' : (n>=45? 'Approaching 50-char limit' : '');
  }

  function syncSliders(){ $('#ilOut').textContent=`${state.il.min}-${state.il.max}`; $('#clOut').textContent=`${state.cl.min}-${state.cl.max}`; }

  // Wire inputs
  $('#slot').addEventListener('change',e=>{state.slot=e.target.value; build()});
  ['rare','magic','normal'].forEach(id=>$('#'+id).addEventListener('change',e=>{state.types[id]=e.target.checked; build()}));
  ['quality','sockets'].forEach(id=>$('#'+id).addEventListener('change',e=>{state.props[id]=e.target.checked; build()}));
  ['ilMin','ilMax'].forEach(id=>$('#'+id).addEventListener('input',e=>{state.il[id==='ilMin'?'min':'max']=+e.target.value; syncSliders(); build()}));
  ['clMin','clMax'].forEach(id=>$('#'+id).addEventListener('input',e=>{state.cl[id==='clMin'?'min':'max']=+e.target.value; syncSliders(); build()}));
  [['resFire','fi'],['resCold','co'],['resLight','li'],['resChaos','ch']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{state.res[k]=e.target.checked; build()}));
  [['m10','m10'],['m15','m15'],['m20','m20'],['m25','m25'],['m30','m30']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{state.mov[k]=e.target.checked; build()}));
  [['dPhys','phys'],['dElem','elem'],['dCold','cold'],['dFire','fire'],['dLight','light']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{state.dmg[k]=e.target.checked; build()}));
  [['uAS','as'],['uCS','cs'],['uLife','life'],['uMana','mana'],['uSpirit','spirit'],['uRarity','rarity'],['uSkills','skills']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{state.uti[k]=e.target.checked; build()}));
  $$('input[name="compose"]').forEach(r=>r.addEventListener('change',e=>{state.compose=e.target.value; build()}));
  $('#custom').addEventListener('input',e=>{state.custom=e.target.value; build()});

  // Reset
  $('#reset').addEventListener('click',()=>{
    Object.assign(state,{slot:'bow',types:{rare:true,magic:false,normal:false},props:{quality:false,sockets:false},il:{min:83,max:99},cl:{min:1,max:99},res:{fi:false,co:false,li:false,ch:false},mov:{m10:false,m15:false,m20:false,m25:false,m30:false},dmg:{phys:false,elem:false,cold:false,fire:false,light:false},uti:{as:false,cs:false,life:false,mana:false,spirit:false,rarity:false,skills:false},compose:'and',custom:''});
    $$('input[type=checkbox]').forEach(c=>c.checked=false); $('#rare').checked=true;
    $('#slot').value='bow'; $('#ilMin').value=83; $('#ilMax').value=99; $('#clMin').value=1; $('#clMax').value=99; syncSliders(); build();
  });

  // Quick reference clicks
  $('#quick').addEventListener('click',e=>{
    const li=e.target.closest('li'); if(!li) return; const p=li.getAttribute('data-p');
    const cur=$('#custom').value.trim();
    $('#custom').value = cur ? (cur+ '|' + p) : p; state.custom=$('#custom').value; build();
  });

  // Copy
  $('#copy').addEventListener('click',async()=>{
    const text=$('#out').value; if(!text) return; await navigator.clipboard.writeText(text); $('#warn').textContent='Copied!'; setTimeout(()=>{$('#warn').textContent='';},1000);
  });

  // Templates
  const T={
    la:()=>{ Object.assign(state,{slot:'bow',types:{rare:true,magic:false,normal:false},dmg:{phys:true,elem:false,cold:false,fire:false,light:true},uti:{as:true,cs:false,life:true,mana:false,spirit:false,rarity:false,skills:false},res:{fi:false,co:true,li:true,ch:false},il:{min:83,max:99}});
      // check UI
      $('#rare').checked=true; $('#magic').checked=false; $('#normal').checked=false; $('#slot').value='bow';
      $('#uAS').checked=true; $('#uLife').checked=true; $('#dPhys').checked=true; $('#dLight').checked=true; $('#resCold').checked=true; $('#resLight').checked=true; $('#ilMin').value=83; $('#ilMax').value=99; syncSliders(); build(); },
    ice:()=>{ Object.assign(state,{slot:'bow',types:{rare:true,magic:false,normal:false},dmg:{phys:true,elem:false,cold:true,fire:false,light:false},uti:{as:true,cs:false,life:true,mana:false,spirit:false,rarity:false,skills:false},res:{fi:false,co:true,li:false,ch:false},il:{min:83,max:99}});
      $('#rare').checked=true; $('#slot').value='bow'; $('#uAS').checked=true; $('#uLife').checked=true; $('#dPhys').checked=true; $('#dCold').checked=true; $('#resCold').checked=true; $('#ilMin').value=83; $('#ilMax').value=99; syncSliders(); build(); },
    phys:()=>{ Object.assign(state,{types:{rare:true,magic:true,normal:false},dmg:{phys:true,elem:false,cold:false,fire:false,light:false},uti:{as:true,cs:false,life:false,mana:false,spirit:true,rarity:false,skills:false}});
      $('#rare').checked=true; $('#magic').checked=true; $('#dPhys').checked=true; $('#uAS').checked=true; $('#uSpirit').checked=true; build(); },
    arch:()=>{ Object.assign(state,{types:{rare:true,magic:true,normal:false},uti:{as:false,cs:false,life:false,mana:true,spirit:true,rarity:false,skills:true}});
      $('#rare').checked=true; $('#magic').checked=true; $('#uMana').checked=true; $('#uSpirit').checked=true; $('#uSkills').checked=true; build(); }
  };
  $$('.templates button').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.template; T[k]&&T[k](); }));

  syncSliders(); build();
})();
