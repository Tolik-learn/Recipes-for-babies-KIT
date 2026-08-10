// ---- icons (inline SVG strings, consistent thin-line style) ----
const ICONS = {
  age: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 15c-1 1.5-1 3 0 4M16 15c1 1.5 1 3 0 4M9 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`,
  time: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  fridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M8 5v2M8 13v2"/></svg>`,
  freezer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M12 2l-2 2m2-2l2 2M12 22l-2-2m2 2l2-2M4.5 6.5l2.7-.5m-2.7.5l.5-2.7M19.5 6.5l-2.7-.5m2.7.5l-.5-2.7M4.5 17.5l2.7.5m-2.7-.5l.5 2.7M19.5 17.5l-2.7.5m2.7-.5l-.5 2.7"/></svg>`
};

// ---- copyright / access-request gate ----
const GOOGLE_FORM_ID = '1FAIpQLSfrmL7lcHIaeVbgpDeFC_uHeLgDZ4_1IuaLyuJI6XAkeD6KjQ';
const GOOGLE_FORM_ENTRY_NAME = 'entry.1840627390';
const GOOGLE_FORM_ENTRY_EMAIL = 'entry.265476505';
const SHEET_ID = '1FEFSWQnKZcx3FgboSilJggYhVJhp99aIeLNg-GsGIKQ';
const SHEET_TAB = '1'; // first tab, by index
const APPROVED_KEY = 'yafit_recipe_site_approved_email_v1';
const PENDING_KEY = 'yafit_recipe_site_pending_email_v1';
const AGREED_KEY = 'yafit_recipe_site_agreed_terms_v1';

const gateOverlay = document.getElementById('gateOverlay');
const gateStateForm = document.getElementById('gateStateForm');
const gateStatePending = document.getElementById('gateStatePending');
const gateStateAgree = document.getElementById('gateStateAgree');
const gateRequestForm = document.getElementById('gateRequestForm');
const gateNameInput = document.getElementById('gateNameInput');
const gateEmailInput = document.getElementById('gateEmailInput');
const gateCheckBtn = document.getElementById('gateCheckBtn');
const gateStatusMsg = document.getElementById('gateStatusMsg');
const gateAgreeCheckbox = document.getElementById('gateAgreeCheckbox');
const gateAgreeBtn = document.getElementById('gateAgreeBtn');
const gateAgreeMsg = document.getElementById('gateAgreeMsg');

function unlockSite(){
  gateOverlay.classList.remove('open');
  document.body.classList.remove('gate-locked');
}
function lockSite(){
  gateOverlay.classList.add('open');
  document.body.classList.add('gate-locked');
}
function showPendingState(){
  gateStateForm.style.display = 'none';
  gateStatePending.style.display = 'block';
  gateStateAgree.style.display = 'none';
}
function showFormState(){
  gateStateForm.style.display = 'block';
  gateStatePending.style.display = 'none';
  gateStateAgree.style.display = 'none';
}
function showAgreeState(){
  gateStateForm.style.display = 'none';
  gateStatePending.style.display = 'none';
  gateStateAgree.style.display = 'block';
}
// after approval is confirmed: show terms once, or unlock straight away if already agreed
function proceedAfterApproval(){
  if(localStorage.getItem(AGREED_KEY)){
    unlockSite();
  } else {
    showAgreeState();
  }
}

async function checkApproval(email){
  const res = await fetch(`https://opensheet.elk.sh/${SHEET_ID}/${SHEET_TAB}`, {cache:'no-store'});
  if(!res.ok) throw new Error('sheet fetch failed');
  const rows = await res.json();
  const norm = email.trim().toLowerCase();
  return rows.some(row => {
    const rowEmail = (row['Email Address'] || row['Email'] || '').trim().toLowerCase();
    const approved = (row['Approved'] || '').trim().toUpperCase();
    return rowEmail === norm && approved === 'TRUE';
  });
}

function submitToGoogleForm(name, email){
  const form = document.createElement('form');
  form.action = `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`;
  form.method = 'POST';
  form.target = 'gateHiddenFrame';
  form.style.display = 'none';
  const f1 = document.createElement('input');
  f1.name = GOOGLE_FORM_ENTRY_NAME; f1.value = name;
  const f2 = document.createElement('input');
  f2.name = GOOGLE_FORM_ENTRY_EMAIL; f2.value = email;
  form.appendChild(f1); form.appendChild(f2);
  document.body.appendChild(form);
  form.submit();
  setTimeout(()=> form.remove(), 1000);
}

gateRequestForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = gateNameInput.value.trim();
  const email = gateEmailInput.value.trim();
  if(!name || !email) return;
  submitToGoogleForm(name, email);
  localStorage.setItem(PENDING_KEY, email);
  showPendingState();
  gateStatusMsg.textContent = '';
});

gateCheckBtn.addEventListener('click', async ()=>{
  const email = localStorage.getItem(PENDING_KEY);
  if(!email) return;
  gateStatusMsg.className = 'gate-status pending';
  gateStatusMsg.textContent = 'בודק מול רשימת האישורים...';
  try{
    const approved = await checkApproval(email);
    if(approved){
      localStorage.setItem(APPROVED_KEY, email);
      localStorage.removeItem(PENDING_KEY);
      proceedAfterApproval();
    } else {
      gateStatusMsg.className = 'gate-status pending';
      gateStatusMsg.textContent = 'עדיין לא אושר — נסו שוב בעוד כמה דקות.';
    }
  }catch(err){
    gateStatusMsg.className = 'gate-status denied';
    gateStatusMsg.textContent = 'שגיאה בבדיקה, נסו שוב.';
  }
});

gateAgreeBtn.addEventListener('click', ()=>{
  if(!gateAgreeCheckbox.checked){
    gateAgreeMsg.className = 'gate-status denied';
    gateAgreeMsg.textContent = 'יש לסמן את התיבה כדי להמשיך.';
    return;
  }
  localStorage.setItem(AGREED_KEY, '1');
  unlockSite();
});

async function initGate(){
  const approvedEmail = localStorage.getItem(APPROVED_KEY);
  if(approvedEmail){
    // re-validate periodically could go here; for now trust local approval
    lockSite();
    proceedAfterApproval();
    return;
  }
  lockSite();
  const pendingEmail = localStorage.getItem(PENDING_KEY);
  if(pendingEmail){
    showPendingState();
    // auto-check once on load
    try{
      const approved = await checkApproval(pendingEmail);
      if(approved){
        localStorage.setItem(APPROVED_KEY, pendingEmail);
        localStorage.removeItem(PENDING_KEY);
        proceedAfterApproval();
      }
    }catch(err){ /* silent - user can press check button */ }
  } else {
    showFormState();
  }
}
initGate();

const grid = document.getElementById('grid');
const filtersEl = document.getElementById('filters');
const guideFiltersEl = document.getElementById('guideFilters');
const searchInput = document.getElementById('searchInput');
const emptyState = document.getElementById('emptyState');
const overlay = document.getElementById('overlay');
const detailContent = document.getElementById('detailContent');

// ---- build age filter chips dynamically from data ----
function ageKey(ageStr){
  const m = ageStr.match(/\d+/);
  return m ? m[0] : ageStr;
}
const ages = Array.from(new Set(RECIPES_ALL.map(r => ageKey(r.age)))).sort((a,b)=>Number(a)-Number(b));
let activeAge = 'all';
let activeGuide = 'all';
let activeQuery = '';

function renderGuideFilters(){
  const chips = [{k:'all', label:'כל המדריכים'}, ...GUIDES.map(g => ({k:String(g.id), label:`${g.name} · ${g.subtitle}`}))];
  guideFiltersEl.innerHTML = chips.map(c =>
    `<button class="chip ${activeGuide===c.k?'active':''}" data-guide="${c.k}">${c.label}</button>`
  ).join('');
  guideFiltersEl.querySelectorAll('.chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeGuide = btn.dataset.guide;
      renderGuideFilters();
      renderGrid();
    });
  });
}

function renderFilters(){
  const chips = [{k:'all', label:'כל הגילאים'}, ...ages.map(a => ({k:a, label:`מגיל ${a} חודשים`}))];
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
  const filtered = RECIPES_ALL.filter(r=>{
    const matchesAge = activeAge==='all' || ageKey(r.age)===activeAge;
    const matchesGuide = activeGuide==='all' || String(r.guide)===activeGuide;
    const matchesQuery = !q || r.title.includes(q) || r.ingredients.some(i=>i.includes(q));
    return matchesAge && matchesGuide && matchesQuery;
  });
  emptyState.style.display = filtered.length ? 'none' : 'block';
  grid.innerHTML = filtered.map(r => `
    <div class="card" data-id="${r.id}">
      <div class="thumb">
        <img src="${r.image}" alt="${r.title}" loading="lazy">
        <span class="age-pill">מגיל ${r.age}</span>
        <span class="guide-pill">מדריך ${r.guide}</span>
        <span class="credit-tag">@yafit.shw</span>
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
    card.addEventListener('click', ()=> openDetail(card.dataset.id));
  });
}

function openDetail(id){
  const r = RECIPES_ALL.find(x=>x.id===id);
  if(!r) return;
  detailContent.innerHTML = `
    <button class="detail-close" id="closeBtn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D2410" stroke-width="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
    </button>
    <div class="detail-grid">
      <div class="detail-photo"><img src="${r.image}" alt="${r.title}"><span class="credit-tag detail-credit">@yafit.shw</span></div>
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

renderGuideFilters();
renderFilters();
renderGrid();
