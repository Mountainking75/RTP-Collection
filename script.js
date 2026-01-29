const COLLECTIONS = ['RTP 1', 'RTP 2', 'RTP 3', 'RTP Memoria', 'RTP Africa'];
let collections = Object.fromEntries(COLLECTIONS.map(c => [c, []]));

// Variáveis de controlo de edição
let editMode = false;
let editingId = null;
let editingCollection = null;

const dayMap = {
  'Segunda-feira': 1, 'Terça-feira': 2, 'Quarta-feira': 3, 'Quinta-feira': 4,
  'Sexta-feira': 5, 'Sábado': 6, 'Domingo': 7
};

const days = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

// --- LÓGICA DE DATAS ---
function getMondayOfFirstWeek(year) {
  const jan1 = new Date(year, 0, 1);
  const day = jan1.getDay(); 
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + diffToMonday);
  return monday;
}

function populateWeeks() {
  const weekSelect = document.getElementById('week');
  const filterSelect = document.getElementById('filterWeek');
  if (!weekSelect || !filterSelect) return;
  
  weekSelect.innerHTML = '';
  filterSelect.innerHTML = '<option value="">Todas as semanas</option>';

  for (let y = 2026; y <= 2030; y++) {
    for (let w = 1; w <= 54; w++) {
      const monday = getMondayOfFirstWeek(y);
      monday.setDate(monday.getDate() + (w - 1) * 7);
      if (monday >= getMondayOfFirstWeek(y + 1)) break;

      const value = `${w}/${y}`;
      const opt = new Option(`Semana ${value}`, value);
      weekSelect.add(opt);
      filterSelect.add(opt.cloneNode(true));
    }
  }
}

function calculateDate(weekStr, dayName) {
  const [week, year] = weekStr.split('/').map(Number);
  const firstMonday = getMondayOfFirstWeek(year);
  const offset = dayMap[dayName];
  const d = new Date(firstMonday);
  d.setDate(firstMonday.getDate() + (week - 1) * 7 + (offset - 1));
  return d.toISOString().slice(0, 10);
}

function updateDateField() {
  const week = document.getElementById('week').value;
  const day = document.getElementById('day').value;
  if (week && day) document.getElementById('date').value = calculateDate(week, day);
}

// --- GESTÃO DE ENTRADAS ---
function addToCollection() {
  const collection = document.getElementById('collection').value;
  const programName = document.getElementById('programName').value.trim();
  const processNumber = document.getElementById('processNumber').value.trim();
  const week = document.getElementById('week').value;
  const rightsDuration = document.getElementById('rightsDuration').value.trim();
  const programType = document.getElementById('programType').value.trim();
  const category = document.getElementById('category').value;
  const isRepeat = document.getElementById('isRepeat').checked;

  if (editMode) {
    // Modo Edição: Remover da coleção antiga e atualizar
    if (editingCollection !== collection) {
      collections[editingCollection] = collections[editingCollection].filter(e => e.id !== editingId);
    }

    const updatedEntry = {
      id: editingId, programName, processNumber, week,
      day: document.getElementById('day').value,
      date: document.getElementById('date').value,
      time: document.getElementById('time').value,
      rightsDuration, programType, category
    };

    if (editingCollection === collection) {
      const idx = collections[collection].findIndex(e => e.id === editingId);
      collections[collection][idx] = updatedEntry;
    } else {
      collections[collection].push(updatedEntry);
    }
    notify('Entrada atualizada!');
  } else {
    // Modo Adição Normal
    if (!isRepeat) {
      collections[collection].push({
        id: Date.now() + Math.random(), programName, processNumber, week,
        day: document.getElementById('day').value,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        rightsDuration, programType, category
      });
    } else {
      days.forEach(d => {
        const cb = document.getElementById(`repeat-${d}`);
        if (cb && cb.checked) {
          collections[collection].push({
            id: Date.now() + Math.random(), programName, processNumber, week,
            day: d, date: calculateDate(week, d),
            time: document.getElementById(`time-${d}`).value,
            rightsDuration, programType, category
          });
        }
      });
    }
    notify('Adicionado com sucesso!');
  }

  saveToLocalStorage();
  renderAllTables(document.getElementById('filterWeek').value);
  clearForm();
}

function editEntry(col, id) {
  const entry = collections[col].find(e => e.id == id);
  if (!entry) return;

  editMode = true;
  editingId = id;
  editingCollection = col;

  document.getElementById('collection').value = col;
  document.getElementById('programName').value = entry.programName;
  document.getElementById('processNumber').value = entry.processNumber;
  document.getElementById('week').value = entry.week;
  document.getElementById('day').value = entry.day;
  document.getElementById('date').value = entry.date;
  document.getElementById('time').value = entry.time;
  document.getElementById('rightsDuration').value = entry.rightsDuration;
  document.getElementById('programType').value = entry.programType;
  document.getElementById('category').value = entry.category;

  document.getElementById('submitBtn').textContent = 'Atualizar Entrada';
  document.getElementById('form-title').textContent = 'Editar Entrada';
  document.getElementById('isRepeat').checked = false;
  document.getElementById('repeatSection').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteEntryById(col, id) {
  if (confirm('Deseja apagar apenas esta entrada selecionada?')) {
    collections[col] = collections[col].filter(e => e.id != id);
    saveToLocalStorage();
    renderAllTables(document.getElementById('filterWeek').value);
    notify('Entrada removida.');
  }
}

function renderAllTables(filter = '') {
  COLLECTIONS.forEach(col => {
    const tbodyId = col.replace(/ /g, '_') + 'TableBody';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let data = [...collections[col]].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    if (filter) data = data.filter(e => e.week === filter);

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="no-results">Sem dados</td></tr>';
      return;
    }

    data.forEach(e => {
      if (!e.id) e.id = Date.now() + Math.random(); // Garante ID para dados antigos
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.programName}</td><td>${e.processNumber}</td><td>${e.week}</td>
        <td>${e.day}</td><td>${e.date}</td><td>${e.time}</td>
        <td>${e.rightsDuration}</td><td>${e.programType}</td>
        <td class="${e.category.toLowerCase()}">${e.category}</td>
        <td class="actions-cell">
          <button class="edit-btn" onclick="editEntry('${col}', ${e.id})">Editar</button>
          <button class="danger-button" onclick="deleteEntryById('${col}', ${e.id})">Apagar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// --- EXPORTAÇÃO E BACKUP ---
function exportFilteredCollection(col, week, selectId) {
  const fmt = document.getElementById(selectId).value;
  let data = [...collections[col]].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  if (week) data = data.filter(e => e.week === week);
  if (!data.length) return alert('Sem dados para exportar');
  fmt === 'pdf' ? exportPDF(col, data) : exportTXT(col, data);
}

function exportPDF(col, data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  doc.text(`Coleção: ${col}`, 14, 15);
  doc.autoTable({
    startY: 25,
    head: [['Programa','Processo','Sem.','Data','Hora','Direitos','Tipo','Categoria']],
    body: data.map(e => [e.programName, e.processNumber, e.week, e.date, e.time, e.rightsDuration, e.programType, e.category]),
    didParseCell: function(d) {
      if (d.section === 'body' && d.column.index === 7) {
        const cat = d.cell.raw.toUpperCase();
        if (cat === 'NOVIDADE') d.cell.styles.fillColor = [40, 167, 69];
        else if (cat === 'ESTREIA') d.cell.styles.fillColor = [220, 53, 69];
        else if (cat.includes('REPETI')) d.cell.styles.fillColor = [0, 123, 255];
        if (d.cell.styles.fillColor) d.cell.styles.textColor = [255, 255, 255];
      }
    }
  });
  doc.save(`${col}.pdf`);
}

function exportTXT(col, data) {
  let content = `Coleção: ${col}\nPrograma | Proc. | Sem. | Data | Hora\n` + 
    data.map(e => `${e.programName} | ${e.processNumber} | ${e.week} | ${e.date} | ${e.time}`).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type: 'text/plain'}));
  a.download = `${col}.txt`; a.click();
}

function exportBackup() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(collections, null, 2)], {type: 'application/json'}));
  a.download = `backup_rtp_${new Date().toISOString().slice(0,10)}.json`; a.click();
}

function importBackup() { document.getElementById('importFile').click(); }

function resetAllData() {
  if (confirm('CUIDADO: Apagar TODOS os dados de todos os canais?')) {
    collections = Object.fromEntries(COLLECTIONS.map(c => [c, []]));
    saveToLocalStorage(); renderAllTables(); notify('Dados limpos.');
  }
}

// --- UTILITÁRIOS ---
function clearForm() {
  editMode = false; editingId = null;
  document.getElementById('form').reset();
  document.getElementById('submitBtn').textContent = 'Adicionar';
  document.getElementById('form-title').textContent = 'Adicionar Entrada';
  document.getElementById('repeatSection').style.display = 'none';
  updateDateField();
}

function saveToLocalStorage() { localStorage.setItem('rtp_collections_vfinal', JSON.stringify(collections)); }
function loadFromLocalStorage() {
  const d = localStorage.getItem('rtp_collections_vfinal');
  if (d) collections = JSON.parse(d);
}

function notify(msg) {
  const n = document.getElementById('notification');
  n.textContent = msg; n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 3000);
}

function clearFilter() { document.getElementById('filterWeek').value = ''; renderAllTables(); }

function populateRepeatDays() {
  const container = document.getElementById('repeatDays');
  days.forEach(day => {
    const div = document.createElement('div');
    div.innerHTML = `<label><input type="checkbox" id="repeat-${day}"> ${day}</label>
                     <input type="time" id="time-${day}" disabled style="width: 80px; margin-left: 10px;">`;
    container.appendChild(div);
    div.querySelector('input[type="checkbox"]').onchange = e => div.querySelector('input[type="time"]').disabled = !e.target.checked;
  });
}

// --- INICIALIZAÇÃO ---
window.onload = () => {
  loadFromLocalStorage();
  populateWeeks();
  populateRepeatDays();
  renderAllTables();
  
  document.getElementById('week').onchange = updateDateField;
  document.getElementById('day').onchange = updateDateField;
  document.getElementById('isRepeat').onchange = e => document.getElementById('repeatSection').style.display = e.target.checked ? 'block' : 'none';
  document.getElementById('filterWeek').onchange = e => renderAllTables(e.target.value);
  document.getElementById('importFile').onchange = e => {
    const reader = new FileReader();
    reader.onload = ev => { 
      try { collections = JSON.parse(ev.target.result); saveToLocalStorage(); renderAllTables(); } catch { alert('Erro!'); }
    };
    reader.readAsText(e.target.files[0]);
  };
};