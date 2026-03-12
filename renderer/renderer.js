// ── State ──────────────────────────────────────────────
let activeDates = new Set();   // dates that have updates
let holidayDates = new Set();  // dates marked as holidays
let selectedDate = todayStr();
let viewYear, viewMonth;       // currently displayed calendar month
let editingId = null;          // id of update being edited
let pickerYear = new Date().getFullYear(); // year shown in month picker
let autoSaveTimer = null;      // debounce timer for autosave
let savingPromise = null;      // tracks in-flight save to prevent race with manual save
let knownPeople = [];          // people loaded from DB
let selectedPeople = [];       // names currently tagged in who field
let knownRepos = [];           // repos loaded from DB
let selectedRepos = [];        // repos currently tagged in repos field
let searchActive = false;      // whether search/filter is active
let searchMatchDates = new Set(); // dates matching current search
let searchFilterPeople = [];   // people filter pills
let searchFilterRepos = [];    // repo filter pills
let searchDebounceTimer = null;

// ── DOM refs ───────────────────────────────────────────
const calDays       = document.getElementById('cal-days');
const calMonthLabel = document.getElementById('cal-month-label');
const btnPrev           = document.getElementById('btn-prev');
const btnNext           = document.getElementById('btn-next');
const calMonthPicker    = document.getElementById('cal-month-picker');
const btnPickerToday    = document.getElementById('btn-picker-today');
const btnPickerYearPrev = document.getElementById('btn-picker-year-prev');
const btnPickerYearNext = document.getElementById('btn-picker-year-next');
const calPickerYear     = document.getElementById('cal-picker-year');
const calPickerMonths   = document.getElementById('cal-picker-months');
const detailLabel     = document.getElementById('detail-date-label');
const btnDetailPrev   = document.getElementById('btn-detail-prev');
const btnDetailNext   = document.getElementById('btn-detail-next');
const updatesList     = document.getElementById('updates-list');
const detailHeaderRight = document.getElementById('detail-header-right');
const headerActions   = document.getElementById('header-actions');
const btnAddUpdate    = document.getElementById('btn-add-update');
const btnEditUpdate   = document.getElementById('btn-edit-update');
const btnDeleteUpdate = document.getElementById('btn-delete-update');
const holidayBadge    = document.getElementById('holiday-badge');
const holidayNameLabel = document.getElementById('holiday-name-label');
const btnRemoveHoliday = document.getElementById('btn-remove-holiday');
const btnMarkHoliday  = document.getElementById('btn-mark-holiday');
const holidayComposer = document.getElementById('holiday-composer');
const fHolidayName      = document.getElementById('f-holiday-name');
const fHolidayStart     = document.getElementById('f-holiday-start');
const fHolidayEnd       = document.getElementById('f-holiday-end');
const btnHolidaySave    = document.getElementById('btn-holiday-save');
const btnHolidayCancel  = document.getElementById('btn-holiday-cancel');
const btnModeSingle     = document.getElementById('btn-mode-single');
const btnModeRange      = document.getElementById('btn-mode-range');
const holidayEndField   = document.getElementById('holiday-end-field');
const holidayStartLabel = document.getElementById('holiday-date-label-start');
let holidayRangeMode = false;
const composer      = document.getElementById('composer');
const btnSave       = document.getElementById('btn-save');
const btnCancel     = document.getElementById('btn-cancel');
const fWhat         = document.getElementById('f-what');
const fmtBtns       = document.querySelectorAll('.fmt-btn');
const reposField     = document.getElementById('repos-field');
const reposWrap      = document.getElementById('repos-wrap');
const reposTagsEl    = document.getElementById('repos-tags');
const reposInput     = document.getElementById('f-repos-input');
const reposDropdown  = document.getElementById('repos-dropdown');
const fWhy          = document.getElementById('f-why');
const fImpact       = document.getElementById('f-impact');
const fImpediments  = document.getElementById('f-impediments');
const fTicketLink   = document.getElementById('f-ticket-link');
const whoField      = document.getElementById('who-field');
const whoWrap       = document.getElementById('who-wrap');
const whoTagsEl     = document.getElementById('who-tags');
const whoInput      = document.getElementById('f-who-input');
const peopleDropdown = document.getElementById('people-dropdown');
const btnCopyRange      = document.getElementById('btn-copy-range');
const copyRangeComposer = document.getElementById('copy-range-composer');
const fCopyStart        = document.getElementById('f-copy-start');
const fCopyEnd          = document.getElementById('f-copy-end');
const btnCopySave       = document.getElementById('btn-copy-save');
const btnCopyCancel     = document.getElementById('btn-copy-cancel');
let copySourceUpdate    = null; // the update being copied
const searchInput           = document.getElementById('search-input');
const searchCount           = document.getElementById('search-count');
const searchClear           = document.getElementById('search-clear');
const searchFilterTagsEl    = document.getElementById('search-filter-tags');
const searchPeopleBtn       = document.getElementById('search-filter-people-btn');
const searchReposBtn        = document.getElementById('search-filter-repos-btn');
const searchPeopleDropdown  = document.getElementById('search-people-dropdown');
const searchReposDropdown   = document.getElementById('search-repos-dropdown');
const btnSync           = document.getElementById('btn-sync');
const syncPeerCount     = document.getElementById('sync-peer-count');
const btnSettings       = document.getElementById('btn-settings');
const settingsDropdown  = document.getElementById('settings-dropdown');
const btnExportJson     = document.getElementById('btn-export-json');
const btnPeopleSubmenu   = document.getElementById('btn-people-submenu');
const peopleSubmenu      = document.getElementById('people-submenu');
const btnProjectsSubmenu = document.getElementById('btn-projects-submenu');
const projectsSubmenu    = document.getElementById('projects-submenu');
const toastEl           = document.getElementById('toast');
const autoSaveStatus    = document.getElementById('autosave-status');

// ── Helpers ────────────────────────────────────────────
function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return localDateStr(new Date());
}

function formatDateLabel(dateStr) {
  const today = todayStr();
  const yDate = new Date();
  yDate.setDate(yDate.getDate() - 1);
  const yesterday = localDateStr(yDate);
  const shortDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric'
  });
  if (dateStr === today) return `Today, ${shortDate}`;
  if (dateStr === yesterday) return `Yesterday, ${shortDate}`;
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

function formatTime(createdAt) {
  return new Date(createdAt + 'Z').toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  });
}

function formatDateTime(str) {
  return new Date(str + 'Z').toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Calendar ───────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function renderCalendar(year, month) {
  viewYear = year;
  viewMonth = month;
  calMonthLabel.textContent = `${MONTH_NAMES[month]} ${year}`;

  calDays.innerHTML = '';
  // Render 3 months: newest (viewMonth) at top, going back
  for (let i = 0; i < 4; i++) {
    const d = new Date(year, month - i, 1);
    calDays.appendChild(createMonthBlock(d.getFullYear(), d.getMonth()));
  }
}

function createMonthBlock(year, month) {
  const block = document.createElement('div');
  block.className = 'month-block';

  // Month label
  const label = document.createElement('div');
  label.className = 'month-block-label';
  label.textContent = `${MONTH_NAMES[month]} ${year}`;
  block.appendChild(label);

  // Day-of-week header
  const dowRow = document.createElement('div');
  dowRow.className = 'cal-grid';
  DOW.forEach(name => {
    const cell = document.createElement('div');
    cell.className = 'cal-dow';
    cell.textContent = name;
    dowRow.appendChild(cell);
  });
  block.appendChild(dowRow);

  // Day cells
  const grid = document.createElement('div');
  grid.className = 'cal-days';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = todayStr();

  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrev - firstDay + 1 + i;
    grid.appendChild(dayCell(d, formatDateStr(year, month - 1, d), true));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateStr(year, month, d);
    grid.appendChild(dayCell(d, dateStr, false, dateStr === today));
  }
  const total = firstDay + daysInMonth;
  const remainder = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remainder; d++) {
    grid.appendChild(dayCell(d, formatDateStr(year, month + 1, d), true));
  }

  block.appendChild(grid);
  return block;
}

function formatDateStr(year, month, day) {
  // Handles month overflow/underflow using local time
  return localDateStr(new Date(year, month, day));
}

function dayCell(dayNum, dateStr, otherMonth, isToday = false) {
  const cell = document.createElement('div');
  const classes = ['cal-day'];
  if (otherMonth) classes.push('other-month');
  if (isToday) classes.push('today');
  if (dateStr === selectedDate) classes.push('selected');
  if (holidayDates.has(dateStr)) classes.push('holiday');

  const isDisabled = searchActive && !otherMonth && !searchMatchDates.has(dateStr);
  if (isDisabled) classes.push('search-disabled');

  cell.className = classes.join(' ');
  cell.dataset.date = dateStr;

  cell.innerHTML = `<span class="day-num">${dayNum}</span>`;

  if (activeDates.has(dateStr)) {
    const dot = document.createElement('div');
    dot.className = 'day-dot';
    cell.appendChild(dot);
  }

  if (!isDisabled) {
    cell.addEventListener('click', () => selectDate(dateStr));
  }
  return cell;
}

// ── Day selection ──────────────────────────────────────
async function selectDate(dateStr) {
  selectedDate = dateStr;
  detailLabel.textContent = formatDateLabel(dateStr);
  detailHeaderRight.style.display = '';
  btnDetailPrev.style.display = '';
  btnDetailNext.style.display = '';
  hideComposer();
  hideHolidayComposer();
  hideCopyRangeComposer();

  // Re-render calendar to update selected highlight
  renderCalendar(viewYear, viewMonth);

  const [updates, holiday] = await Promise.all([
    searchActive
      ? window.api.searchByDate(dateStr, { keyword: searchInput.value.trim(), people: searchFilterPeople, repos: searchFilterRepos })
      : window.api.getByDate(dateStr),
    window.api.getHoliday(dateStr),
  ]);

  renderHolidayState(holiday);
  renderUpdates(updates);
}

// ── Updates list ───────────────────────────────────────
function renderUpdates(updates) {
  updatesList.innerHTML = '';

  if (!updates.length) {
    btnAddUpdate.style.display = '';
    btnEditUpdate.style.display = 'none';
    btnCopyRange.style.display = 'none';
    btnDeleteUpdate.style.display = 'none';
    updatesList.innerHTML = `<div class="empty-state">No updates logged for this day.<br>Hit <strong>+ Add Update</strong> to log your work.</div>`;
    return;
  }

  btnAddUpdate.style.display = 'none';
  btnEditUpdate.style.display = '';
  btnCopyRange.style.display = '';
  btnDeleteUpdate.style.display = '';

  // Wire header buttons to the existing update
  const u = updates[0];
  btnEditUpdate.onclick = () => openComposerForEdit(u);
  btnCopyRange.onclick  = () => { hideComposer(); showCopyRangeComposer(u); };
  btnDeleteUpdate.onclick = () => deleteUpdate(u.id);

  for (const update of updates) {
    updatesList.appendChild(createCard(update));
  }
}

// ── Holiday state ──────────────────────────────────────
function renderHolidayState(holiday) {
  if (holiday) {
    holidayBadge.style.display = '';
    holidayNameLabel.textContent = holiday.name;
    btnMarkHoliday.style.display = 'none';
  } else {
    holidayBadge.style.display = 'none';
    btnMarkHoliday.style.display = '';
  }
}

function setHolidayMode(rangeMode) {
  holidayRangeMode = rangeMode;
  btnModeSingle.classList.toggle('active', !rangeMode);
  btnModeRange.classList.toggle('active', rangeMode);
  holidayEndField.style.display = rangeMode ? '' : 'none';
  holidayStartLabel.textContent = rangeMode ? 'From' : 'Date';
}

function showHolidayComposer() {
  fHolidayName.value = '';
  fHolidayStart.value = selectedDate;
  fHolidayEnd.value = selectedDate;
  setHolidayMode(false);
  holidayComposer.style.display = '';
  fHolidayName.focus();
}

function hideHolidayComposer() {
  holidayComposer.style.display = 'none';
  fHolidayName.value = '';
  fHolidayStart.value = '';
  fHolidayEnd.value = '';
}

async function saveHoliday() {
  const name = fHolidayName.value.trim() || 'Holiday';
  const start = fHolidayStart.value;
  const end = holidayRangeMode ? fHolidayEnd.value : start;
  if (!start || !end || end < start) return;

  const cur = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      const dateStr = localDateStr(cur);
      await window.api.setHoliday(dateStr, name);
      holidayDates.add(dateStr);
    }
    cur.setDate(cur.getDate() + 1);
  }

  hideHolidayComposer();
  renderCalendar(viewYear, viewMonth);
  const holiday = await window.api.getHoliday(selectedDate);
  renderHolidayState(holiday);
}

async function removeHoliday() {
  await window.api.removeHoliday(selectedDate);
  holidayDates.delete(selectedDate);
  renderCalendar(viewYear, viewMonth);
  renderHolidayState(null);
}

// ── Copy to range ───────────────────────────────────────
function showCopyRangeComposer(u) {
  copySourceUpdate = u;
  fCopyStart.value = selectedDate;
  fCopyEnd.value   = selectedDate;
  copyRangeComposer.style.display = '';
  fCopyStart.focus();
}

function hideCopyRangeComposer() {
  copyRangeComposer.style.display = 'none';
  copySourceUpdate = null;
}

async function saveCopyRange() {
  if (!copySourceUpdate) return;
  const start = fCopyStart.value;
  const end   = fCopyEnd.value;
  if (!start || !end || end < start) return;

  const cur  = new Date(start + 'T12:00:00');
  const last = new Date(end   + 'T12:00:00');
  while (cur <= last) {
    const dow     = cur.getDay();
    const dateStr = localDateStr(cur);
    if (dow !== 0 && dow !== 6 && dateStr !== selectedDate) {
      await window.api.create({
        date:        dateStr,
        what:        copySourceUpdate.what        || '',
        repos:       copySourceUpdate.repos       || '',
        why:         copySourceUpdate.why         || '',
        impact:      copySourceUpdate.impact      || '',
        who:         copySourceUpdate.who         || '',
        impediments: copySourceUpdate.impediments || '',
        ticket_link: copySourceUpdate.ticket_link || '',
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  hideCopyRangeComposer();
  await refreshDay();
}

function createCard(u) {
  const card = document.createElement('div');
  card.className = 'update-card';
  card.dataset.id = u.id;

  const fields = [
    { key: 'what',        label: 'What I did today',      value: u.what,        raw: true },
    { key: 'repos',       label: 'Repos / projects',      value: u.repos        },
    { key: 'why',         label: 'Why',                   value: u.why,         raw: true },
    { key: 'impact',      label: 'Impact',                value: u.impact,      raw: true },
    { key: 'who',         label: 'Who I worked with',     value: u.who          },
    { key: 'impediments', label: 'Impediments',           value: u.impediments, raw: true },
    { key: 'ticket_link', label: 'Ticket',                value: u.ticket_link  },
  ].filter(f => f.value && f.value.trim());

  const fieldsHtml = fields.map(f => `
    <div class="card-field">
      <label>${f.label}</label>
      <div class="card-field-body ${f.raw ? 'rich-content' : ''}">${f.raw ? f.value : escapeHtml(f.value)}</div>
    </div>
  `).join('');

  const editedHtml = u.updated_at
    ? `<span class="card-timestamp-item">Edited ${formatDateTime(u.updated_at)}</span>`
    : '';

  card.innerHTML = `
    <div class="card-fields">${fieldsHtml}</div>
    <div class="card-footer">
      <span class="card-timestamp-item">Created ${formatDateTime(u.created_at)}</span>
      ${editedHtml}
    </div>
  `;

  return card;
}

// ── People picker ──────────────────────────────────────
function getWhoValue() {
  return selectedPeople.join(', ');
}

function setWhoValue(str) {
  selectedPeople = str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
  renderWhoTags();
}

function clearWho() {
  selectedPeople = [];
  whoInput.value = '';
  renderWhoTags();
  hidePeopleDropdown();
}

function renderWhoTags() {
  whoTagsEl.innerHTML = '';
  selectedPeople.forEach(name => {
    const tag = document.createElement('span');
    tag.className = 'who-tag';
    tag.innerHTML = `${escapeHtml(name)}<button class="who-tag-remove" type="button">&#x2715;</button>`;
    tag.querySelector('.who-tag-remove').addEventListener('click', () => {
      selectedPeople = selectedPeople.filter(n => n !== name);
      renderWhoTags();
      scheduleAutoSave();
    });
    whoTagsEl.appendChild(tag);
  });
  whoInput.placeholder = selectedPeople.length ? '' : 'Type to add someone...';
}

function addWhoTag(name) {
  if (!selectedPeople.includes(name)) selectedPeople.push(name);
  whoInput.value = '';
  renderWhoTags();
  hidePeopleDropdown();
  whoInput.focus();
  scheduleAutoSave();
}

function hidePeopleDropdown() {
  peopleDropdown.style.display = 'none';
  peopleDropdown.innerHTML = '';
}

function showPeopleDropdown(query) {
  const filtered = knownPeople.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) &&
    !selectedPeople.includes(p.name)
  );
  peopleDropdown.innerHTML = '';

  filtered.forEach(person => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'people-dropdown-item';
    btn.textContent = person.name;
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); addWhoTag(person.name); });
    peopleDropdown.appendChild(btn);
  });

  const exactMatch = knownPeople.some(p => p.name.toLowerCase() === query.toLowerCase());
  if (query && !exactMatch) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'people-dropdown-item create-new';
    btn.textContent = `+ Add "${query}"`;
    btn.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      hidePeopleDropdown(); // close immediately to prevent duplicate submissions
      const person = await window.api.createPerson(query);
      knownPeople.push(person);
      knownPeople.sort((a, b) => a.name.localeCompare(b.name));
      addWhoTag(person.name);
    });
    peopleDropdown.appendChild(btn);
  }

  peopleDropdown.style.display = peopleDropdown.children.length ? '' : 'none';
}

whoWrap.addEventListener('click', () => whoInput.focus());

whoInput.addEventListener('input', () => {
  const val = whoInput.value.trim();
  if (val) {
    showPeopleDropdown(val);
  } else {
    hidePeopleDropdown();
  }
});

whoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { hidePeopleDropdown(); return; }
  if (e.key === 'Backspace' && whoInput.value === '' && selectedPeople.length) {
    selectedPeople.pop();
    renderWhoTags();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#who-field')) hidePeopleDropdown();
});

// ── Repos picker ────────────────────────────────────────
function getReposValue() {
  return selectedRepos.join(', ');
}

function setReposValue(str) {
  selectedRepos = str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
  renderReposTags();
}

function clearRepos() {
  selectedRepos = [];
  reposInput.value = '';
  renderReposTags();
  hideReposDropdown();
}

function renderReposTags() {
  reposTagsEl.innerHTML = '';
  selectedRepos.forEach(name => {
    const tag = document.createElement('span');
    tag.className = 'who-tag repo-tag';
    tag.innerHTML = `${escapeHtml(name)}<button class="who-tag-remove" type="button">&#x2715;</button>`;
    tag.querySelector('.who-tag-remove').addEventListener('click', () => {
      selectedRepos = selectedRepos.filter(n => n !== name);
      renderReposTags();
      scheduleAutoSave();
    });
    reposTagsEl.appendChild(tag);
  });
  reposInput.placeholder = selectedRepos.length ? '' : 'Type to add repo...';
}

function addRepoTag(name) {
  if (!selectedRepos.includes(name)) selectedRepos.push(name);
  reposInput.value = '';
  renderReposTags();
  hideReposDropdown();
  reposInput.focus();
  scheduleAutoSave();
}

function hideReposDropdown() {
  reposDropdown.style.display = 'none';
  reposDropdown.innerHTML = '';
}

function showReposDropdown(query) {
  const filtered = knownRepos.filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase()) &&
    !selectedRepos.includes(r.name)
  );
  reposDropdown.innerHTML = '';

  filtered.forEach(repo => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'people-dropdown-item';
    btn.textContent = repo.name;
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); addRepoTag(repo.name); });
    reposDropdown.appendChild(btn);
  });

  const normalized = query.replace(/^@+/, '');
  const exactMatch = knownRepos.some(r => r.name.toLowerCase() === normalized.toLowerCase());
  if (normalized && !exactMatch) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'people-dropdown-item create-new';
    btn.textContent = `+ Add "${normalized}"`;
    btn.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      hideReposDropdown(); // close immediately to prevent duplicate submissions
      const repo = await window.api.createRepo(normalized);
      knownRepos.push(repo);
      knownRepos.sort((a, b) => a.name.localeCompare(b.name));
      addRepoTag(repo.name);
    });
    reposDropdown.appendChild(btn);
  }

  reposDropdown.style.display = reposDropdown.children.length ? '' : 'none';
}

reposWrap.addEventListener('click', () => reposInput.focus());

reposInput.addEventListener('input', () => {
  const val = reposInput.value.trim();
  if (val) {
    showReposDropdown(val);
  } else {
    hideReposDropdown();
  }
});

reposInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { hideReposDropdown(); return; }
  if (e.key === 'Backspace' && reposInput.value === '' && selectedRepos.length) {
    selectedRepos.pop();
    renderReposTags();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#repos-field')) hideReposDropdown();
});

// ── Composer ───────────────────────────────────────────
function openComposerForAdd() {
  editingId = null;
  clearComposer();
  updatesList.style.display = 'none';
  composer.style.display = '';
  fWhat.focus();
  updateFmtButtons();
}

function openComposerForEdit(u) {
  editingId = u.id;
  fWhat.innerHTML    = u.what        || '';
  setReposValue(u.repos || '');
  fWhy.innerHTML     = u.why         || '';
  fImpact.innerHTML  = u.impact      || '';
  setWhoValue(u.who  || '');
  fImpediments.innerHTML = u.impediments || '';
  fTicketLink.value  = u.ticket_link || '';
  updatesList.style.display = 'none';
  composer.style.display = '';
  fWhat.focus();
  updateFmtButtons();
  // Scroll composer into view
  composer.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function hideComposer() {
  clearTimeout(autoSaveTimer);
  composer.style.display = 'none';
  updatesList.style.display = '';
  clearComposer();
  editingId = null;
  autoSaveStatus.textContent = '';
  autoSaveStatus.classList.remove('autosave-status--visible');
}

function clearComposer() {
  fWhat.innerHTML = '';
  fWhy.innerHTML = fImpact.innerHTML = fImpediments.innerHTML = '';
  fTicketLink.value = '';
  clearRepos();
  clearWho();
}

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSaveComposer, 500);
}

async function autoSaveComposer() {
  if (!fWhat.innerText.trim() || savingPromise) return;

  savingPromise = (async () => {
    const fields = {
      date:        selectedDate,
      what:        fWhat.innerHTML.trim(),
      repos:       getReposValue(),
      why:         fWhy.innerHTML.trim(),
      impact:      fImpact.innerHTML.trim(),
      who:         getWhoValue(),
      impediments: fImpediments.innerHTML.trim(),
      ticket_link: fTicketLink.value.trim(),
    };
    if (editingId) {
      await window.api.edit(editingId, fields);
    } else {
      const created = await window.api.create(fields);
      editingId = created.id;
      const dates = await window.api.getDatesWithUpdates();
      activeDates = new Set(dates);
      if (!searchActive) renderCalendar(viewYear, viewMonth);
    }
  })();

  try {
    await savingPromise;
    autoSaveStatus.textContent = 'Autosaved';
    autoSaveStatus.classList.add('autosave-status--visible');
    setTimeout(() => autoSaveStatus.classList.remove('autosave-status--visible'), 2000);
  } finally {
    savingPromise = null;
  }
}

async function saveComposer() {
  if (!fWhat.innerText.trim()) { fWhat.focus(); return; }
  clearTimeout(autoSaveTimer);

  // Wait for any in-flight autosave to finish so editingId is set before we proceed
  if (savingPromise) {
    try { await savingPromise; } catch (_) {}
  }

  // Capture fields after awaiting so all values (including fWhat) are consistent
  if (!fWhat.innerText.trim()) { fWhat.focus(); return; }
  const fields = {
    date:        selectedDate,
    what:        fWhat.innerHTML.trim(),
    repos:       getReposValue(),
    why:         fWhy.innerHTML.trim(),
    impact:      fImpact.innerHTML.trim(),
    who:         getWhoValue(),
    impediments: fImpediments.innerHTML.trim(),
    ticket_link: fTicketLink.value.trim(),
  };

  if (editingId) {
    await window.api.edit(editingId, fields);
  } else {
    await window.api.create(fields);
  }

  hideComposer();
  await refreshDay();
}

async function deleteUpdate(id) {
  await window.api.delete(id);
  await refreshDay();
}

async function refreshDay() {
  const dates = await window.api.getDatesWithUpdates();
  activeDates = new Set(dates);
  if (searchActive) {
    await runSearch();
  } else {
    const updates = await window.api.getByDate(selectedDate);
    renderCalendar(viewYear, viewMonth);
    renderUpdates(updates);
  }
}

// ── Search ─────────────────────────────────────────────
function getSearchFilters() {
  return { keyword: searchInput.value.trim(), people: searchFilterPeople, repos: searchFilterRepos };
}

async function runSearch() {
  const { keyword, people, repos } = getSearchFilters();
  if (!keyword && !people.length && !repos.length) {
    clearSearch();
    return;
  }

  const result = await window.api.search({ keyword, people, repos });
  searchActive = true;
  searchMatchDates = new Set(result.dates);

  const d = result.dates.length;
  const t = result.total;
  searchCount.textContent = `${t} result${t !== 1 ? 's' : ''} across ${d} day${d !== 1 ? 's' : ''}`;
  searchCount.style.display = '';
  searchClear.style.display = '';

  renderCalendar(viewYear, viewMonth);

  if (searchMatchDates.has(selectedDate)) {
    const updates = await window.api.searchByDate(selectedDate, { keyword, people, repos });
    renderUpdates(updates);
  } else {
    updatesList.innerHTML = `<div class="empty-state">No results on this day.<br>Select a highlighted date to see matching updates.</div>`;
    btnAddUpdate.style.display = 'none';
    btnEditUpdate.style.display = 'none';
    btnCopyRange.style.display = 'none';
    btnDeleteUpdate.style.display = 'none';
  }
}

function clearSearch() {
  searchActive = false;
  searchMatchDates = new Set();
  searchFilterPeople = [];
  searchFilterRepos = [];
  searchInput.value = '';
  searchCount.style.display = 'none';
  searchClear.style.display = 'none';
  renderSearchFilterTags();
  renderCalendar(viewYear, viewMonth);
  selectDate(selectedDate);
}

function renderSearchFilterTags() {
  searchFilterTagsEl.innerHTML = '';

  searchFilterPeople.forEach(name => {
    const tag = document.createElement('span');
    tag.className = 'search-filter-tag search-filter-tag--people';
    tag.innerHTML = `${escapeHtml(name)}<button class="search-filter-tag-remove" type="button">&#x2715;</button>`;
    tag.querySelector('.search-filter-tag-remove').addEventListener('click', () => {
      searchFilterPeople = searchFilterPeople.filter(n => n !== name);
      renderSearchFilterTags();
      runSearch();
    });
    searchFilterTagsEl.appendChild(tag);
  });

  searchFilterRepos.forEach(name => {
    const tag = document.createElement('span');
    tag.className = 'search-filter-tag search-filter-tag--repo';
    tag.innerHTML = `${escapeHtml(name)}<button class="search-filter-tag-remove" type="button">&#x2715;</button>`;
    tag.querySelector('.search-filter-tag-remove').addEventListener('click', () => {
      searchFilterRepos = searchFilterRepos.filter(n => n !== name);
      renderSearchFilterTags();
      runSearch();
    });
    searchFilterTagsEl.appendChild(tag);
  });

  searchPeopleBtn.classList.toggle('active', searchFilterPeople.length > 0);
  searchReposBtn.classList.toggle('active', searchFilterRepos.length > 0);
}

function renderSearchPeopleDropdown() {
  searchPeopleDropdown.innerHTML = '';
  if (!knownPeople.length) {
    searchPeopleDropdown.innerHTML = '<div class="search-filter-dropdown-empty">No people added yet</div>';
    return;
  }
  knownPeople.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const selected = searchFilterPeople.includes(p.name);
    btn.className = 'search-filter-dropdown-item' + (selected ? ' selected' : '');
    btn.textContent = (selected ? '✓  ' : '    ') + p.name;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (searchFilterPeople.includes(p.name)) {
        searchFilterPeople = searchFilterPeople.filter(n => n !== p.name);
      } else {
        searchFilterPeople.push(p.name);
      }
      renderSearchFilterTags();
      renderSearchPeopleDropdown();
      runSearch();
    });
    searchPeopleDropdown.appendChild(btn);
  });
}

function renderSearchReposDropdown() {
  searchReposDropdown.innerHTML = '';
  if (!knownRepos.length) {
    searchReposDropdown.innerHTML = '<div class="search-filter-dropdown-empty">No projects added yet</div>';
    return;
  }
  knownRepos.forEach(r => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const selected = searchFilterRepos.includes(r.name);
    btn.className = 'search-filter-dropdown-item' + (selected ? ' selected' : '');
    btn.textContent = (selected ? '✓  ' : '    ') + r.name;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (searchFilterRepos.includes(r.name)) {
        searchFilterRepos = searchFilterRepos.filter(n => n !== r.name);
      } else {
        searchFilterRepos.push(r.name);
      }
      renderSearchFilterTags();
      renderSearchReposDropdown();
      runSearch();
    });
    searchReposDropdown.appendChild(btn);
  });
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(runSearch, 300);
});

searchClear.addEventListener('click', () => {
  searchPeopleDropdown.style.display = 'none';
  searchReposDropdown.style.display = 'none';
  clearSearch();
});

searchPeopleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = searchPeopleDropdown.style.display !== 'none';
  searchReposDropdown.style.display = 'none';
  if (isOpen) {
    searchPeopleDropdown.style.display = 'none';
  } else {
    renderSearchPeopleDropdown();
    searchPeopleDropdown.style.display = '';
  }
});

searchReposBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = searchReposDropdown.style.display !== 'none';
  searchPeopleDropdown.style.display = 'none';
  if (isOpen) {
    searchReposDropdown.style.display = 'none';
  } else {
    renderSearchReposDropdown();
    searchReposDropdown.style.display = '';
  }
});

// ── Events ─────────────────────────────────────────────
btnDetailPrev.addEventListener('click', () => {
  const d = new Date(selectedDate + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const next = localDateStr(d);
  if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) {
    renderCalendar(d.getFullYear(), d.getMonth());
  }
  selectDate(next);
});

btnDetailNext.addEventListener('click', () => {
  const d = new Date(selectedDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const next = localDateStr(d);
  if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) {
    renderCalendar(d.getFullYear(), d.getMonth());
  }
  selectDate(next);
});

btnPrev.addEventListener('click', () => {
  const d = new Date(viewYear, viewMonth - 1, 1);
  renderCalendar(d.getFullYear(), d.getMonth());
});

btnNext.addEventListener('click', () => {
  const d = new Date(viewYear, viewMonth + 1, 1);
  renderCalendar(d.getFullYear(), d.getMonth());
});

// ── Month/year picker ───────────────────────────────────
function openMonthPicker() {
  pickerYear = viewYear;
  renderMonthPicker();
  calMonthPicker.style.display = '';
}

function closeMonthPicker() {
  calMonthPicker.style.display = 'none';
}

function renderMonthPicker() {
  calPickerYear.textContent = pickerYear;
  calPickerMonths.innerHTML = '';
  MONTH_NAMES.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-picker-month-btn' + (i === viewMonth && pickerYear === viewYear ? ' active' : '');
    btn.textContent = name.slice(0, 3);
    btn.addEventListener('click', () => {
      renderCalendar(pickerYear, i);
      closeMonthPicker();
    });
    calPickerMonths.appendChild(btn);
  });
}

calMonthLabel.addEventListener('click', (e) => {
  e.stopPropagation();
  calMonthPicker.style.display !== 'none' ? closeMonthPicker() : openMonthPicker();
});

btnPickerToday.addEventListener('click', () => {
  const now = new Date();
  renderCalendar(now.getFullYear(), now.getMonth());
  selectDate(todayStr());
  closeMonthPicker();
});

btnPickerYearPrev.addEventListener('click', (e) => {
  e.stopPropagation();
  pickerYear--;
  renderMonthPicker();
});

btnPickerYearNext.addEventListener('click', (e) => {
  e.stopPropagation();
  pickerYear++;
  renderMonthPicker();
});

btnAddUpdate.addEventListener('click', openComposerForAdd);
// btnEditUpdate and btnDeleteUpdate are wired dynamically in renderUpdates

btnMarkHoliday.addEventListener('click', showHolidayComposer);
btnRemoveHoliday.addEventListener('click', removeHoliday);
btnHolidaySave.addEventListener('click', saveHoliday);
btnHolidayCancel.addEventListener('click', hideHolidayComposer);
btnCopySave.addEventListener('click', saveCopyRange);
btnCopyCancel.addEventListener('click', hideCopyRangeComposer);
btnModeSingle.addEventListener('click', () => setHolidayMode(false));
btnModeRange.addEventListener('click', () => setHolidayMode(true));
fHolidayName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveHoliday();
  if (e.key === 'Escape') hideHolidayComposer();
});
btnSave.addEventListener('click', saveComposer);
btnCancel.addEventListener('click', hideComposer);

// ── Rich text toolbar ───────────────────────────────────
function updateFmtButtons() {
  fmtBtns.forEach(btn => {
    const cmd = btn.dataset.cmd;
    btn.classList.toggle('active', document.queryCommandState(cmd));
  });
}

fmtBtns.forEach(btn => {
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // keep focus in editor
    document.execCommand(btn.dataset.cmd, false, null);
    updateFmtButtons();
  });
});

[fWhat, fWhy, fImpact, fImpediments].forEach(el => {
  el.addEventListener('keyup', updateFmtButtons);
  el.addEventListener('mouseup', updateFmtButtons);
});

// ── Autosave triggers ──────────────────────────────────
fWhat.addEventListener('input', scheduleAutoSave);
fWhy.addEventListener('input', scheduleAutoSave);
fImpact.addEventListener('input', scheduleAutoSave);
fImpediments.addEventListener('input', scheduleAutoSave);
fTicketLink.addEventListener('input', scheduleAutoSave);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideComposer();
    settingsDropdown.style.display = 'none';
    searchPeopleDropdown.style.display = 'none';
    searchReposDropdown.style.display = 'none';
    closeMonthPicker();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveComposer();
});

// ── Toast ───────────────────────────────────────────────
let toastTimer = null;
function showToast(message, type = 'info') {
  toastEl.textContent = message;
  toastEl.className = `toast toast--${type} toast--visible`;
  toastEl.style.display = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('toast--visible');
    setTimeout(() => { toastEl.style.display = 'none'; }, 300);
  }, 3500);
}

// ── Sync ────────────────────────────────────────────────
function updatePeerBadge(count) {
  if (count > 0) {
    syncPeerCount.textContent = count;
    syncPeerCount.style.display = '';
  } else {
    syncPeerCount.style.display = 'none';
  }
}

btnSync.addEventListener('click', async () => {
  if (btnSync.classList.contains('syncing')) return;
  btnSync.classList.add('syncing');
  showToast('Looking for peers…', 'info');

  const result = await window.api.sync();

  btnSync.classList.remove('syncing');

  if (!result.success) {
    showToast(result.message, 'error');
    return;
  }

  // Reload all state from DB after merge
  const [dates, hDates, people, repos] = await Promise.all([
    window.api.getDatesWithUpdates(),
    window.api.getAllHolidayDates(),
    window.api.getAllPeople(),
    window.api.getAllRepos(),
  ]);
  activeDates = new Set(dates);
  holidayDates = new Set(hDates);
  knownPeople = people;
  knownRepos = repos;
  renderCalendar(viewYear, viewMonth);
  await selectDate(selectedDate);

  updatePeerBadge(result.count);
  if (result.changed > 0) {
    const label = result.count === 1 ? '1 peer' : `${result.count} peers`;
    showToast(`Synced with ${label}`, 'success');
  }
});

// ── Settings dropdown ───────────────────────────────────
btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = settingsDropdown.style.display !== 'none';
  settingsDropdown.style.display = isOpen ? 'none' : '';
});

document.addEventListener('click', (e) => {
  settingsDropdown.style.display = 'none';
  peopleSubmenu.style.display = 'none';
  btnPeopleSubmenu.querySelector('.submenu-chevron').classList.remove('open');
  projectsSubmenu.style.display = 'none';
  btnProjectsSubmenu.querySelector('.submenu-chevron').classList.remove('open');
  if (!e.target.closest('.search-filter-btn-wrap')) {
    searchPeopleDropdown.style.display = 'none';
    searchReposDropdown.style.display = 'none';
  }
  if (!e.target.closest('#cal-label-wrap')) closeMonthPicker();
});

btnExportJson.addEventListener('click', async () => {
  settingsDropdown.style.display = 'none';
  await window.api.exportJson();
});

btnPeopleSubmenu.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = peopleSubmenu.style.display !== 'none';
  if (!isOpen) {
    peopleSubmenu.innerHTML = knownPeople.length
      ? knownPeople.map(p => `<span class="settings-submenu-item">${p.name}</span>`).join('')
      : '<span class="settings-submenu-empty">No people added yet</span>';
  }
  peopleSubmenu.style.display = isOpen ? 'none' : '';
  btnPeopleSubmenu.querySelector('.submenu-chevron').classList.toggle('open', !isOpen);
});

function renderProjectsSubmenu() {
  projectsSubmenu.innerHTML = '';
  if (!knownRepos.length) {
    projectsSubmenu.innerHTML = '<span class="settings-submenu-empty">No projects added yet</span>';
    return;
  }
  knownRepos.forEach(r => {
    const row = document.createElement('span');
    row.className = 'settings-submenu-item';
    const label = document.createElement('span');
    label.textContent = r.name;
    const del = document.createElement('button');
    del.className = 'submenu-item-delete';
    del.title = 'Delete';
    del.innerHTML = '&times;';
    del.addEventListener('mousedown', async (e) => {
      e.stopPropagation();
      await window.api.deleteRepo(r.id);
      knownRepos = knownRepos.filter(x => x.id !== r.id);
      renderProjectsSubmenu();
    });
    row.appendChild(label);
    row.appendChild(del);
    projectsSubmenu.appendChild(row);
  });
}

btnProjectsSubmenu.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = projectsSubmenu.style.display !== 'none';
  if (!isOpen) renderProjectsSubmenu();
  projectsSubmenu.style.display = isOpen ? 'none' : '';
  btnProjectsSubmenu.querySelector('.submenu-chevron').classList.toggle('open', !isOpen);
});

// ── Init ───────────────────────────────────────────────
(async () => {
  const [dates, hDates, people, repos] = await Promise.all([
    window.api.getDatesWithUpdates(),
    window.api.getAllHolidayDates(),
    window.api.getAllPeople(),
    window.api.getAllRepos(),
  ]);
  activeDates = new Set(dates);
  holidayDates = new Set(hDates);
  knownPeople = people;
  knownRepos = repos;

  const now = new Date();
  renderCalendar(now.getFullYear(), now.getMonth());
  await selectDate(todayStr());

  window.api.onSyncDone(async ({ count, changed }) => {
    updatePeerBadge(count);
    if (changed > 0) {
      const label = count === 1 ? '1 peer' : `${count} peers`;
      showToast(`Synced with ${label}`, 'success');
    }
    const [dates, hDates, people, repos] = await Promise.all([
      window.api.getDatesWithUpdates(),
      window.api.getAllHolidayDates(),
      window.api.getAllPeople(),
      window.api.getAllRepos(),
    ]);
    activeDates = new Set(dates);
    holidayDates = new Set(hDates);
    knownPeople = people;
    knownRepos = repos;
    renderCalendar(viewYear, viewMonth);
    // Don't interrupt the composer or copy-range panel if the user is currently editing
    if (composer.style.display === 'none' && copyRangeComposer.style.display === 'none') {
      await selectDate(selectedDate);
    }
  });
})();
