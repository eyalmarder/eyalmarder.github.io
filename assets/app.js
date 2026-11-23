(() => {
  'use strict';
  const data = window.ATLAS_CONTENT;
  if (!data) return;
  const qs = selector => document.querySelector(selector);
  const qsa = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byId = new Map(data.outputs.map(p => [p.id, p]));
  const sitePath = path => `${document.body.dataset.root || ''}${path}`;
  const state = {topic:'mountains', output:'article', filter:'all', query:''};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const outputLabels = {article:'journal article', dataset:'dataset', progress:'ongoing project'};
  const tabIds = {article:'articles-tab',dataset:'data-tab',progress:'progress-tab'};

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    qs('.theme-label').textContent = `${next[0].toUpperCase()}${next.slice(1)} appearance`;
    qs('.theme-toggle').setAttribute('aria-label', `Switch to ${next} appearance`);
    qs('meta[name="theme-color"]').content = theme === 'dark' ? '#121c25' : '#f7f9fa';
  }
  let savedTheme;
  try {savedTheme = localStorage.getItem('eyal-atlas-theme');} catch {}
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');
  qs('.theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {localStorage.setItem('eyal-atlas-theme', next);} catch {}
  });

  const menu = qs('.menu-toggle');
  const nav = qs('#navigation');
  menu.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(expanded));
    nav.classList.toggle('open', expanded);
    menu.querySelector('span').textContent = expanded ? '−' : '＋';
  });
  qsa('.navigation a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.querySelector('span').textContent='＋';
  }));

  const film=qs('#landscape-film'), movieToggle=qs('#movie-toggle');
  if(film && movieToggle){
    const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    let manuallyPaused=motionPreference.matches, pausedByPage=false, inView=true;
    film.muted=true;
    film.defaultMuted=true;
    film.autoplay=!motionPreference.matches;
    movieToggle.hidden=false;
    const syncMovie=()=>{movieToggle.textContent=film.paused?'Play animation':'Pause animation';};
    const pauseAutomatically=()=>{if(!film.paused){pausedByPage=true;film.pause();}};
    const playWhenVisible=()=>{
      if(inView && !document.hidden && !manuallyPaused) film.play().catch(syncMovie);
    };
    film.addEventListener('play',()=>{manuallyPaused=false;syncMovie();});
    film.addEventListener('pause',()=>{
      if(pausedByPage)pausedByPage=false;else manuallyPaused=true;
      syncMovie();
    });
    movieToggle.addEventListener('click',()=>{
      if(film.paused){manuallyPaused=false;film.play().catch(syncMovie);}
      else{manuallyPaused=true;film.pause();}
    });
    new IntersectionObserver(entries=>{
      inView=entries[0].isIntersecting;
      if(inView)playWhenVisible();else pauseAutomatically();
    },{threshold:.08}).observe(film);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAutomatically();else playWhenVisible();});
    motionPreference.addEventListener('change',event=>{if(event.matches){manuallyPaused=true;pauseAutomatically();}});
    film.addEventListener('error',()=>{movieToggle.hidden=true;});
    syncMovie();
  }

  qsa('.methods-nav,.cv-nav').forEach(sectionNav=>{
    const sectionLinks=[...sectionNav.querySelectorAll('a')];
    const sections=sectionLinks.map(link=>qs(link.hash)).filter(Boolean);
    if(!sections.length)return;
    const markSection=id=>sectionLinks.forEach(link=>{
      if(link.hash==='#'+id)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
    const revealSection=id=>{
      const target=sections.find(section=>section.id===id);
      if(target?.matches('details'))target.open=true;
    };
    revealSection(location.hash.slice(1));
    markSection(location.hash.slice(1)||sections[0].id);
    sectionLinks.forEach(link=>link.addEventListener('click',()=>{
      revealSection(link.hash.slice(1));
      markSection(link.hash.slice(1));
    }));
    const updateSection=()=>{
      const readingLine=sectionNav.getBoundingClientRect().bottom+80;
      const current=sections.filter(section=>section.getBoundingClientRect().top<=readingLine).pop();
      markSection((current||sections[0]).id);
    };
    let framePending=false;
    window.addEventListener('scroll',()=>{
      if(framePending)return;
      framePending=true;
      requestAnimationFrame(()=>{updateSection();framePending=false;});
    },{passive:true});
    window.addEventListener('resize',updateSection);
    window.addEventListener('load',updateSection);
    window.addEventListener('hashchange',()=>revealSection(location.hash.slice(1)));
    requestAnimationFrame(updateSection);
  });

  function figureRightsMarkup(figure) {
    if(figure?.kind==='published-background')return `<p class="figure-rights">${escape(figure.credit)} · <a href="${escape(figure.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(figure.sourceLabel)}</a> · <a href="${sitePath(`credits.html#${figure.creditAnchor}`)}">Full credit</a></p>`;
    if(!figure?.rights)return '';
    const rights=figure.rights;
    return `<p class="figure-rights">${escape(rights.copyright)} · <a href="${escape(rights.url)}" target="_blank" rel="noopener noreferrer">${escape(rights.label)}</a> · <a href="${sitePath(`credits.html#${figure.sourceId}`)}">Full credit</a></p>`;
  }

  function selectTopic(id, updateUrl = true) {
    if (!data.topics[id] || !qs('#topic-detail')) return;
    state.topic=id;
    const topic=data.topics[id];
    qsa('.atlas-node').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic === id)));
    qsa('[data-line]').forEach(path => path.classList.toggle('selected', path.dataset.line === id));
    const paper=byId.get(topic.primary);
    const project=byId.get(topic.featuredProject);
    const projectLink=project?`<a class="button primary" href="${sitePath(project.detailPath)}" target="_blank" rel="noopener noreferrer">Explore ${escape(topic.projectLinkLabel)}</a>`:'';
    const areaLink=`<a class="${project?'text-link':'button primary'}" href="${sitePath(`research/${id}.html`)}" target="_blank" rel="noopener noreferrer">${project?`${escape(topic.shortLabel)} overview`:'Explore research area'}</a>`;
    const primaryLink=paper && paper.id!==project?.id ? `<a class="text-link" href="${sitePath(paper.detailPath)}" target="_blank" rel="noopener noreferrer">${paper.type==='progress'?'Project overview':'Featured study'}</a>` : '';
    qs('#topic-detail').innerHTML = `
      <div class="topic-header"><span class="topic-label">${escape(topic.label)}</span><span class="status">${escape(topic.status)}</span></div>
      <h3>${escape(topic.title)}</h3>
      ${topic.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}
      <div class="topic-methods" aria-label="Research methods">${topic.methods.map(m=>`<span>${escape(m)}</span>`).join('')}</div>
      <div class="topic-related">${projectLink}${areaLink}${primaryLink}</div>
      <p class="topic-connection">${escape(topic.connection)}</p>
      ${topic.figure?`<figure class="topic-figure${topic.figure.scientific?' scientific':''}"><button type="button" class="expand-figure" aria-label="Enlarge research image: ${escape(topic.shortLabel)}"><img src="${sitePath(escape(topic.figure.src))}" alt="${escape(topic.figure.alt)}" loading="lazy"></button><figcaption>${topic.figure.status?`<p class="figure-source-label">${escape(topic.figure.status)}</p>`:''}${escape(topic.figure.caption)} <span>${topic.figure.guide?'Click to explore the figure.':'Click to enlarge.'}</span>${figureRightsMarkup(topic.figure)}</figcaption></figure>`:''}
`;
    qs('.expand-figure')?.addEventListener('click', () => openFigure({...topic,label:topic.figure.title||topic.label, figure:{...topic.figure,src:sitePath(topic.figure.src)}}));
    if (updateUrl) {
      const url=new URL(location.href);url.searchParams.set('topic',id);url.searchParams.delete('connection');
      try {history.replaceState(null,'',url);} catch {}
    }
    document.dispatchEvent(new CustomEvent('atlas:topic-change',{detail:{id}}));
  }
  window.ATLAS_UI={openFigure,selectTopic};
  qsa('.atlas-node').forEach(button => button.addEventListener('click', () => selectTopic(button.dataset.topic)));
  qsa('.expand-image').forEach(button => button.addEventListener('click', () => {
    const img=button.querySelector('img');
    const published=data.publishedFigures?.[button.dataset.figureId];
    const parent=button.closest('figure');
    const project=parent.hasAttribute('data-project-visual');
    const projectCaption=project?['.figure-source-label','.figure-description','.figure-interpretation','.figure-credit'].map(selector=>parent.querySelector(selector)?.textContent.trim()).filter(Boolean).join('\n\n'):'';
    openFigure({label:button.dataset.figureTitle,figure:{...(published||{}),src:img.src,alt:img.alt,caption:projectCaption||published?.caption||parent.querySelector('figcaption').innerText.replace('Click to enlarge.','').trim(),projectPreview:project,creditUrl:parent.querySelector('.project-credit-link')?.href,contextSourceUrl:parent.querySelector('.project-source-link')?.href,contextSourceLabel:parent.querySelector('.project-source-link')?.textContent}});
  }));

  function openFigure(topic) {
    let dialog=qs('#figure-dialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='figure-dialog';dialog.className='image-dialog';
      dialog.innerHTML='<div class="dialog-heading"><h2 id="figure-dialog-title"></h2><button class="dialog-close" type="button">Close</button></div><figure><img alt=""><figcaption></figcaption></figure>';
      dialog.setAttribute('aria-labelledby','figure-dialog-title');document.body.append(dialog);
      dialog.querySelector('button').addEventListener('click',()=>dialog.close());
      dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
      // Release the enlarged artwork once the viewer closes, including Escape.
      dialog.addEventListener('close',()=>{if(!dialog.open)dialog.querySelector('img').removeAttribute('src');});
    }
    dialog.querySelector('h2').textContent=topic.label;
    dialog.classList.toggle('project-preview-dialog',Boolean(topic.figure.projectPreview));
    const img=dialog.querySelector('img');img.decoding='async';img.src=topic.figure.src;img.alt=topic.figure.alt;
    const caption=dialog.querySelector('figcaption');
    caption.textContent=[topic.figure.status,topic.figure.caption].filter(Boolean).join('\n\n');
    const source=byId.get(topic.figure.sourceId);
    if(source?.url){const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.className='dialog-source';link.textContent=`${topic.figure.credit} · Published study`;caption.append(link);}
    const rightsMarkup=figureRightsMarkup(topic.figure);
    if(rightsMarkup){const rights=document.createElement('div');rights.innerHTML=rightsMarkup;caption.append(rights);}
    for(const [url,label] of [[topic.figure.contextSourceUrl,topic.figure.contextSourceLabel],[topic.figure.creditUrl,'Full credit and reuse terms']]){
      if(!url)continue;
      const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.className='dialog-source';link.textContent=label;caption.append(link);
    }
    const fullSize=document.createElement('a');fullSize.href=topic.figure.src;fullSize.target='_blank';fullSize.rel='noopener noreferrer';fullSize.className='dialog-source';fullSize.textContent='Open full-size figure';caption.append(fullSize);
    document.dispatchEvent(new CustomEvent('atlas:figure-open',{detail:{figure:topic.figure,dialog}}));
    dialog.showModal();
  }

  function authorMarkup(authors) {
    return authors.map(author=>author.startsWith('Marder,')?`<strong>${escape(author)}</strong>`:escape(author)).join('; ');
  }
  function citationText(p) {
    const venue=p.journal||p.repository||'';
    const volume=p.volume?`, ${p.volume}${p.issue?`(${p.issue})`:''}${p.pages?`, ${p.pages}`:''}`:'';
    return `${p.authors.join('; ')}${p.year?` (${p.year})`:''}. ${p.title}.${venue?` ${venue}${volume}.`:''}${p.type==='progress'?` ${p.status}.`:''}${p.doi?` https://doi.org/${p.doi}`:''}`.replace(/\.\./g,'.');
  }
  function bibtex(p) {
    const fields={title:p.title,author:p.authors.join(' and '),...(p.year?{year:p.year}:{}),...(p.journal?{journal:p.journal}:{}),...(p.repository?{publisher:p.repository}:{}),...(p.volume?{volume:p.volume}:{}),...(p.issue?{number:p.issue.replace(/–/g,'--')}:{}),...(p.pages?{pages:p.pages.replace(/–/g,'--')}:{}),...(p.doi?{doi:p.doi}:{}),...(p.url?{url:p.url}:{}),...(p.type==='progress'?{note:p.status}:{})};
    return `@${p.type==='article'?'article':'misc'}{${p.id},\n${Object.entries(fields).map(([k,v])=>`  ${k} = {${v}}`).join(',\n')}\n}`;
  }
  async function copyCitation(p,button) {
    const text=citationText(p);
    try {
      if(!navigator.clipboard)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);button.textContent='Copied';
      setTimeout(()=>{if(button.isConnected)button.textContent='Copy citation';},1800);
    } catch {
      let dialog=qs('#citation-dialog');
      if(!dialog){dialog=document.createElement('dialog');dialog.id='citation-dialog';dialog.className='citation-dialog';dialog.setAttribute('aria-labelledby','citation-dialog-title');dialog.innerHTML='<div class="dialog-heading"><h2 id="citation-dialog-title">Copy citation</h2><button class="dialog-close" type="button">Close</button></div><textarea readonly aria-label="Citation text"></textarea><p>Select and copy the citation above.</p>';document.body.append(dialog);dialog.querySelector('button').addEventListener('click',()=>dialog.close());}
      dialog.querySelector('textarea').value=text;dialog.showModal();dialog.querySelector('textarea').select();
    }
  }
  function downloadBibtex(p) {
    const url=URL.createObjectURL(new Blob([bibtex(p)],{type:'application/x-bibtex;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`${p.id}.bib`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function syncPublicationControls() {
    if (!qs('#publication-list')) return;
    qsa('.output-tab').forEach(b=>{const selected=b.dataset.output===state.output;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    qsa('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter)));
    qs('#publication-list').setAttribute('aria-labelledby',tabIds[state.output]);
  }
  function renderPublications() {
    if (!qs('#publication-list')) return;
    const query=state.query.toLocaleLowerCase().trim();
    const records=data.outputs.filter(p=>p.type===state.output&&(state.filter==='all'||p.tags.includes(state.filter))&&(!query||`${p.title} ${p.authors.join(' ')} ${p.journal||p.repository||''} ${p.year||''}`.toLocaleLowerCase().includes(query)));
    qs('#publication-result').textContent=`${records.length} ${outputLabels[state.output]}${records.length===1?'':'s'}${state.filter==='all'?'':` · ${data.topics[state.filter].shortLabel}`}${query?' matching your search':''}`;
    qs('#publication-list').innerHTML=records.map(p=>{
      const citation=p.journal||p.repository||'';
      const detail=`${p.volume?` ${escape(p.volume)}${p.issue?`(${escape(p.issue)})`:''}`:''}${p.pages?`, ${escape(p.pages)}`:''}`;
      const openLink=p.openAccessUrl?`<a href="${escape(p.openAccessUrl)}" target="_blank" rel="noopener noreferrer">Open access</a>`:p.preprint?`<a href="${escape(p.preprint.url)}" target="_blank" rel="noopener noreferrer">Open preprint</a>`:'';
      return `<article class="publication" id="${escape(p.id)}"><div class="publication-year">${p.year||'Ongoing'}</div><div>${p.type==='progress'?`<span class="publication-status">${escape(p.status)}</span>`:''}<h3><a href="${sitePath(p.detailPath)}" target="_blank" rel="noopener noreferrer">${escape(p.title)}</a></h3><p class="publication-authors">${authorMarkup(p.authors)}</p>${citation?`<p class="publication-citation"><em>${escape(citation)}</em>${detail}${p.onlineYear?` · Published online ${p.onlineYear}`:''}</p>`:''}${p.summary?`<p class="publication-summary">${escape(p.summary)}</p>`:''}<div class="publication-actions"><a href="${sitePath(p.detailPath)}" target="_blank" rel="noopener noreferrer">${p.type==='article'?'Study overview':p.type==='dataset'?'Dataset details':'Project overview'}</a>${p.url?`<a href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">${p.type==='dataset'?'Data repository':'Journal article'}</a>`:''}${openLink}${p.pdfUrl?`<a href="${escape(p.pdfUrl)}" target="_blank" rel="noopener noreferrer">PDF</a>`:''}${p.recordKind==='project'?'':`<button type="button" data-copy="${escape(p.id)}" aria-label="Copy citation for ${escape(p.title)}">Copy citation</button><button type="button" data-bib="${escape(p.id)}" aria-label="Download BibTeX for ${escape(p.title)}">BibTeX</button>`}</div></div></article>`;
    }).join('');
    if(!records.length){
      const ongoing=state.output!=='progress'&&state.filter!=='all'&&data.outputs.some(p=>p.type==='progress'&&p.tags.includes(state.filter));
      qs('#publication-list').innerHTML=`<div class="empty-results"><p>No ${outputLabels[state.output]}s match these filters.</p><button type="button" class="button secondary" id="clear-publication-filters">Clear filters</button>${ongoing?' <button type="button" class="button secondary" id="show-ongoing">Explore work in progress</button>':''}</div>`;
      qs('#clear-publication-filters').addEventListener('click',()=>{state.filter='all';state.query='';qs('#publication-search').value='';syncPublicationControls();renderPublications();});
      qs('#show-ongoing')?.addEventListener('click',()=>{state.output='progress';state.query='';qs('#publication-search').value='';syncPublicationControls();renderPublications();});
    }
    const url=new URL(location.href);
    for(const [key,value,defaultValue] of [['type',state.output,'article'],['topic',state.filter,'all'],['q',state.query,'']]) {
      if(value===defaultValue)url.searchParams.delete(key);else url.searchParams.set(key,value);
    }
    try {history.replaceState(null,'',url);} catch {}
  }
  document.addEventListener('click',event=>{
    const copy=event.target.closest('[data-copy]'),bib=event.target.closest('[data-bib]');
    if(copy&&byId.has(copy.dataset.copy))copyCitation(byId.get(copy.dataset.copy),copy);
    if(bib&&byId.has(bib.dataset.bib))downloadBibtex(byId.get(bib.dataset.bib));
  });
  qsa('.output-tab').forEach(button=>{
    button.addEventListener('click',()=>{state.output=button.dataset.output;syncPublicationControls();renderPublications();});
    button.addEventListener('keydown',event=>{
      const tabs=qsa('.output-tab'),i=tabs.indexOf(button);let next;
      if(event.key==='ArrowRight')next=tabs[(i+1)%tabs.length];
      else if(event.key==='ArrowLeft')next=tabs[(i+tabs.length-1)%tabs.length];
      else if(event.key==='Home')next=tabs[0];else if(event.key==='End')next=tabs[tabs.length-1];
      if(next){event.preventDefault();next.click();next.focus();}
    });
  });
  qsa('[data-filter]').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;syncPublicationControls();renderPublications();}));
  qs('#publication-search')?.addEventListener('input',event=>{state.query=event.target.value;renderPublications();});
  Object.entries({article:'#article-count',dataset:'#data-count',progress:'#progress-count'}).forEach(([type,selector])=>{if(qs(selector))qs(selector).textContent=data.outputs.filter(p=>p.type===type).length;});

  function makeTerrain() {
    const svg=qs('svg#terrain'),NS='http://www.w3.org/2000/svg',n=25;
    if(!svg)return;
    function elevation(x,y){const ridge=Math.exp(-Math.pow((x+.3*y-.17*Math.sin(y*6))/.22,2))*Math.exp(-Math.pow(y/.87,4));const side=.55*Math.exp(-Math.pow((x+.53+.23*Math.sin(y*5))/.23,2))*Math.exp(-Math.pow((y+.1)/.82,4));return Math.max(.01,(ridge+side)*(.7+.3*Math.sin(y*10+x*7))+.055*(Math.sin(x*29+y*17)+Math.sin(y*32-x*14)));}
    const project=(x,y,z)=>[240+(x-y)*116,244+(x+y)*46-z*132];
    function element(name,attrs){const el=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el;}
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const x=-1+i*2/n,y=-1+j*2/n,d=2/n,points=[[x,y],[x+d,y],[x+d,y+d],[x,y+d]],heights=points.map(([a,b])=>elevation(a,b)),z=heights.reduce((a,b)=>a+b,0)/4,shade=Math.min(1,Math.max(0,.47+(heights[0]-heights[1])*2.3+(heights[0]-heights[3])*1.2));
      const rgb=`rgb(${Math.round(67+shade*85+z*30)},${Math.round(97+shade*83+z*12)},${Math.round(87+shade*65+z*3)})`;
      svg.append(element('polygon',{points:points.map(([a,b],k)=>project(a,b,heights[k]).map(v=>v.toFixed(1)).join(',')).join(' '),fill:rgb,stroke:rgb,'stroke-width':.5}));
    }
    const bed=[];for(let j=0;j<=n;j++){const y=-1+j*2/n,x=.52+.08*Math.sin(y*9);bed.push(project(x,y,elevation(x,y)+.025));}
    svg.append(element('polyline',{points:bed.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' '),stroke:'#b9d9d2','stroke-width':1.6,fill:'none'}));
  }
  makeTerrain();

  function insertResearchImages(){
    [['.carbon-visual','assets/east-river.jpg','The East River watershed in Colorado'],['.biology-visual',data.topics.biology.figure.src,'Published model comparison of uplift rate and biodiversity']].forEach(([selector,src,alt])=>{
      const container=qs(selector);if(!container)return;const img=document.createElement('img');img.src=sitePath(src);img.alt=alt;img.loading='lazy';container.removeAttribute('aria-hidden');container.replaceChildren(img);if(selector.includes('biology'))container.classList.add('scientific');
    });
  }
  insertResearchImages();
  const initialTopic=new URLSearchParams(location.search).get('topic');
  selectTopic(data.topics[initialTopic]?initialTopic:'mountains',false);
  const params=new URLSearchParams(location.search);
  if(['article','dataset','progress'].includes(params.get('type')))state.output=params.get('type');
  if(data.topics[initialTopic])state.filter=initialTopic;
  state.query=params.get('q')||'';
  if(qs('#publication-search'))qs('#publication-search').value=state.query;
  syncPublicationControls();renderPublications();
})();
