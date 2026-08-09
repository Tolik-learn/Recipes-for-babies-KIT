// ---- icons (inline SVG strings, consistent thin-line style) ----
const ICONS = {
  age: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 15c-1 1.5-1 3 0 4M16 15c1 1.5 1 3 0 4M9 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`,
  time: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  fridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M8 5v2M8 13v2"/></svg>`,
  freezer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M12 2l-2 2m2-2l2 2M12 22l-2-2m2 2l2-2M4.5 6.5l2.7-.5m-2.7.5l.5-2.7M19.5 6.5l-2.7-.5m2.7.5l-.5-2.7M4.5 17.5l2.7.5m-2.7-.5l.5 2.7M19.5 17.5l-2.7.5m2.7-.5l-.5 2.7"/></svg>`
};

const grid = document.getElementById('grid');
const filtersEl = document.getElementById('filters');
const searchInput = document.getElementById('searchInput');
const emptyState = document.getElementById('emptyState');
const overlay = document.getElementById('overlay');
const detailContent = document.getElementById('detailContent');

// ---- build age filter chips dynamically from data ----
function ageKey(ageStr){
  const m = ageStr.match(/\d+/);
  return m ? m[0] : ageStr;
}
const ages = Array.from(new Set(RECIPES_GUIDE1.map(r => ageKey(r.age)))).sort((a,b)=>Number(a)-Number(b));
let activeAge = 'all';
let activeQuery = '';

function renderFilters(){
  const chips = [{k:'all', label:'הכל'}, ...ages.map(a => ({k:a, label:`מגיל ${a} חודשים`}))];
  filtersEl.innerHTML = chips.map(c =>
    `<button class="chip ${activeAge===c.k?'active':''}" data-age="${c.k}">${c.label}</button>`
  ).join('');
  filtersEl.querySelectorAll('.chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeAge = btn.dataset.age;
      renderFilters();
      renderGrid();
    });
  });
}

function renderGrid(){
  const q = activeQuery.trim();
  const filtered = RECIPES_GUIDE1.filter(r=>{
    const matchesAge = activeAge==='all' || ageKey(r.age)===activeAge;
    const matchesQuery = !q || r.title.includes(q) || r.ingredients.some(i=>i.includes(q));
    return matchesAge && matchesQuery;
  });
  emptyState.style.display = filtered.length ? 'none' : 'block';
  grid.innerHTML = filtered.map(r => `
    <div class="card" data-page="${r.page}">
      <div class="thumb">
        <img src="${r.image}" alt="${r.title}" loading="lazy">
        <span class="age-pill">מגיל ${r.age}</span>
      </div>
      <div class="body">
        <h3>${r.title}</h3>
        <div class="meta">
          <span>${ICONS.time}${r.prep_time}</span>
          <span>${ICONS.fridge}${r.fridge}</span>
          <span>${ICONS.freezer}${r.freezer}</span>
        </div>
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('click', ()=> openDetail(Number(card.dataset.page)));
  });
}

function openDetail(page){
  const r = RECIPES_GUIDE1.find(x=>x.page===page);
  if(!r) return;
  detailContent.innerHTML = `
    <button class="detail-close" id="closeBtn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D2410" stroke-width="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
    </button>
    <div class="detail-grid">
      <div class="detail-photo"><img src="${r.image}" alt="${r.title}"></div>
      <div class="detail-content">
        <div class="detail-title-banner">
          <h2>${r.title}</h2>
          <div class="meta-row">
            <div class="m">${ICONS.age}<span class="m-label">גיל</span><span class="m-val">${r.age}</span></div>
            <div class="m">${ICONS.time}<span class="m-label">זמן הכנה</span><span class="m-val">${r.prep_time}</span></div>
            <div class="m">${ICONS.fridge}<span class="m-label">במקרר</span><span class="m-val">${r.fridge}</span></div>
            <div class="m">${ICONS.freezer}<span class="m-label">במקפיא</span><span class="m-val">${r.freezer}</span></div>
          </div>
        </div>
        <div class="block">
          <h3 class="block-title">מצרכים</h3>
          <ul class="ingredients">${r.ingredients.map(i=>`<li>${i}</li>`).join('')}</ul>
        </div>
        <div class="block">
          <h3 class="block-title">אופן הכנה</h3>
          <ol class="steps">${r.instructions.map(s=>`<li>${s}</li>`).join('')}</ol>
        </div>
        <div class="block">
          <h3 class="block-title">${r.serving_label}</h3>
          <div class="serving-tip">${r.serving}</div>
        </div>
      </div>
    </div>
  `;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('closeBtn').addEventListener('click', closeDetail);
}

function closeDetail(){
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}
overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeDetail(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeDetail(); });

searchInput.addEventListener('input', (e)=>{
  activeQuery = e.target.value;
  renderGrid();
});

renderFilters();
renderGrid();
