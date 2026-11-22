(() => {
  'use strict';
  const data = window.ATLAS_CONTENT, ui = window.ATLAS_UI;
  if (!data || !ui) return;
  const outputs = new Map(data.outputs.map(p => [p.id, p]));
  const root = document.body.dataset.root || '';
  const connections = data.atlasConnections || [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function link(text, href, external = false) {
    const node = element('a', 'text-link', text);
    node.href = href;
    if (external) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    return node;
  }
  function launchFigure(id) {
    const figure = data.publishedFigures[id];
    if (!figure?.guide || outputs.get(figure.sourceId)?.status !== 'Published') return;
    ui.openFigure({label:figure.title, figure:{...figure, src:root + figure.src}});
  }

  // The guide surrounds the original artwork; it never changes the figure asset.
  document.addEventListener('atlas:figure-open', event => {
    const {figure, dialog} = event.detail;
    const container = dialog.querySelector('figure');
    const img = container.querySelector('img'), caption = container.querySelector('figcaption');
    container.replaceChildren(img, caption);
    const guide = figure.guide;
    dialog.classList.toggle('has-figure-guide', Boolean(guide));
    if (!guide) return;

    const layout = element('div', 'figure-guide-layout');
    const artwork = element('div', 'guide-artwork');
    artwork.style.setProperty('--figure-ratio', String(figure.width / figure.height));
    artwork.append(img);
    const ns = 'http://www.w3.org/2000/svg';
    const overlay = document.createElementNS(ns, 'svg');
    overlay.setAttribute('viewBox', '0 0 100 100');
    overlay.setAttribute('preserveAspectRatio', 'none');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.add('guide-overlay');
    const frames = ['guide-focus-halo', 'guide-focus-frame'].map(className => {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('class', className);
      rect.setAttribute('fill', 'none');
      rect.setAttribute('vector-effect', 'non-scaling-stroke');
      overlay.append(rect);
      return rect;
    });
    artwork.append(overlay);

    const aside = element('aside', 'figure-guide');
    aside.setAttribute('aria-label', 'Guide to the published figure');
    aside.append(element('p', 'eyebrow', 'Read the figure'));
    aside.append(element('p', 'guide-question', guide.question));
    const choices = element('div', 'guide-choices');
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', 'Choose a figure focus');
    const explanation = element('div', 'guide-explanation');
    explanation.setAttribute('aria-live', 'polite');
    explanation.setAttribute('aria-atomic', 'true');
    const heading = element('h3'), text = element('p');
    explanation.append(heading, text);
    const buttons = [];
    const setFocus = index => {
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i - 1 === index)));
      overlay.toggleAttribute('hidden', index === -1);
      explanation.hidden = index === -1;
      if (index !== -1) {
        const step = guide.steps[index];
        heading.textContent = step.title;
        text.textContent = step.text;
        frames.forEach(rect => ['x','y','width','height'].forEach((attr, i) => rect.setAttribute(attr, String(step.focus[i]))));
      }
    };
    ['Whole figure', ...guide.steps.map(step => step.label)].forEach((label, i) => {
      const button = element('button', 'guide-choice', label);
      button.type = 'button';
      button.addEventListener('click', () => setFocus(i - 1));
      choices.append(button);
      buttons.push(button);
    });
    aside.append(choices, explanation);
    layout.append(artwork, aside);
    container.replaceChildren(layout, caption);
    setFocus(0);
  });

  const diagram = document.querySelector('.atlas-diagram');
  const panel = document.querySelector('#atlas-connections');
  const detail = document.querySelector('#topic-detail');
  if (!diagram || !panel || !detail) return;
  let currentTopic = document.querySelector('.atlas-node[aria-pressed="true"]')?.dataset.topic || 'mountains';
  let currentConnection = null;
  const svg = diagram.querySelector('.atlas-lines');
  const ns = 'http://www.w3.org/2000/svg';
  const paths = document.createElementNS(ns, 'g');
  paths.setAttribute('class', 'connection-paths');
  paths.setAttribute('fill', 'none');
  svg.append(paths);

  function updateDiagram() {
    const related = connections.filter(c => c.topics.includes(currentTopic));
    const connectedTopics = new Set(related.flatMap(c => c.topics));
    document.querySelectorAll('.atlas-node').forEach(node => {
      node.classList.toggle('is-connected', connectedTopics.has(node.dataset.topic) && node.dataset.topic !== currentTopic);
      node.classList.toggle('is-context', node.dataset.topic === 'mars');
    });
    paths.replaceChildren();
    const bounds = diagram.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const position = id => {
      const rect = diagram.querySelector('[data-topic="' + id + '"]').getBoundingClientRect();
      return [(rect.left + rect.width / 2 - bounds.left) / bounds.width * 600, (rect.top + rect.height / 2 - bounds.top) / bounds.height * 480];
    };
    related.forEach(connection => {
      const [a,b] = connection.topics.map(position);
      let cx = (a[0]+b[0])/2, cy = (a[1]+b[1])/2;
      cx += (cx-300)*0.65; cy += (cy-240)*0.65;
      if (connection.id === 'mountain-soils') { cx = 370; cy = 65; }
      if (connection.id === 'earth-mars') { cx = 275; cy = 410; }
      const path = document.createElementNS(ns,'path');
      path.setAttribute('d','M'+a.join(' ')+' Q'+cx+' '+cy+' '+b.join(' '));
      path.setAttribute('class','connection-path'+(connection.contextOnly?' context-path':'')+(currentConnection===connection.id?' is-active':''));
      path.dataset.connectionPath = connection.id;
      paths.append(path);
    });
  }

  function renderConnections(topicId) {
    currentTopic = topicId; currentConnection = null;
    panel.replaceChildren();
    const related = connections.filter(c => c.topics.includes(topicId));
    const heading = element('h3', 'connection-list-heading', 'Connections from ' + data.topics[topicId].shortLabel);
    panel.append(heading);
    related.forEach(connection => {
      const other = connection.topics.find(id => id !== topicId);
      const button = element('button', 'connection-choice');
      button.type = 'button'; button.dataset.connection = connection.id;
      button.setAttribute('aria-controls', 'topic-detail');
      button.setAttribute('aria-pressed','false');
      button.append(element('span','connection-destination',data.topics[other].shortLabel),element('span','connection-label',connection.label));
      if (connection.contextOnly) button.append(element('span','connection-context','Published Earth context'));
      button.addEventListener('click', () => selectConnection(connection, true));
      panel.append(button);
    });
    updateDiagram();
  }

  function figureCaption(figure) {
    const caption = element('figcaption');
    caption.append(element('p','',figure.caption));
    const source = outputs.get(figure.sourceId);
    caption.append(link(figure.credit + ' · ' + source.journal, source.url, true));
    const rights = element('p','figure-rights',figure.rights.copyright + ' · ');
    const license = link(figure.rights.label, figure.rights.url, true);
    license.className = '';
    const fullCredit = link('Full credit',root + 'credits.html#' + figure.sourceId);
    fullCredit.className = '';
    rights.append(license,document.createTextNode(' · '),fullCredit);
    caption.append(rights);
    return caption;
  }

  function selectConnection(connection, updateUrl) {
    if (!connection.topics.includes(currentTopic)) return;
    currentConnection = connection.id;
    panel.querySelectorAll('[data-connection]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.connection === connection.id)));
    updateDiagram();
    detail.replaceChildren();
    detail.classList.add('showing-connection');
    const back = element('button','connection-back','Back to ' + data.topics[currentTopic].shortLabel + ' overview');
    back.type = 'button';
    back.addEventListener('click',() => {
      ui.selectTopic(currentTopic);
      const overviewTitle=detail.querySelector('h3');
      overviewTitle.tabIndex=-1;
      overviewTitle.focus({preventScroll:true});
    });
    const header = element('div','topic-header');
    header.append(element('span','topic-label',connection.topics.map(id=>data.topics[id].shortLabel).join(' & ')),element('span','status',connection.contextOnly?'Earth context':'Published research'));
    const title = element('h3','',connection.title);
    title.tabIndex = -1;
    detail.append(back,header,title,element('p','connection-evidence-kind',connection.kind),element('p','',connection.text));
    const figure = data.publishedFigures[connection.figureId];
    const view = element('figure','topic-figure scientific connection-figure');
    view.dataset.publishedSource = figure.sourceId;
    const expand = element('button','connection-figure-open');
    expand.type = 'button';
    expand.setAttribute('aria-label','Explore figure: '+figure.title);
    const img = element('img'); img.src = root + figure.src; img.alt = figure.alt; img.width = figure.width; img.height = figure.height;
    expand.append(img,element('span','figure-enlarge','Explore figure'));
    expand.addEventListener('click',()=>launchFigure(connection.figureId));
    view.append(expand,figureCaption(figure));
    detail.append(view);
    const sources = element('div','connection-sources');
    sources.append(element('p','eyebrow',connection.sourceIds.length>1?'The published studies':'The published study'));
    connection.sourceIds.forEach(id => {
      const paper = outputs.get(id);
      sources.append(link(paper.title,root+paper.detailPath,true));
    });
    detail.append(sources);
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('topic',currentTopic); url.searchParams.set('connection',connection.id);
      try {history.replaceState(null,'',url);} catch {}
      if (matchMedia('(max-width: 900px)').matches) {
        title.focus({preventScroll:true});
        detail.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});
      }
    }
  }

  document.addEventListener('atlas:topic-change',event => {
    detail.classList.remove('showing-connection');
    renderConnections(event.detail.id);
  });
  renderConnections(currentTopic);
  const initial = connections.find(c => c.id === new URLSearchParams(location.search).get('connection') && c.topics.includes(currentTopic));
  if (initial) selectConnection(initial,false);
  if ('ResizeObserver' in window) new ResizeObserver(updateDiagram).observe(diagram);
})();
