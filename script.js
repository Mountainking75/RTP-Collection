const COLLECTIONS = ['RTP 1', 'RTP 2', 'RTP 3', 'RTP Memoria', 'RTP Africa'];
let collections = Object.fromEntries(COLLECTIONS.map(c => [c, []]));

const dayMap = {
  'Segunda-feira': 1,
  'Terça-feira': 2,
  'Quarta-feira': 3,
  'Quinta-feira': 4,
  'Sexta-feira': 5,
  'Sábado': 6,
  'Domingo': 7
};

const days = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

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
  weekSelect.innerHTML = '';
  filterSelect.innerHTML = '<option value="">Selecione uma semana</option>';

  const startYear = 2026;
  const endYear = 2030;

  for (let y = startYear; y <= endYear; y++) {
    for (let w = 1; w <= 54; w++) {
      const monday = getMondayOfFirstWeek(y);
      monday.setDate(monday.getDate() + (w - 1) * 7);

      const nextYearFirstMonday = getMondayOfFirstWeek(y + 1);
      if (monday >= nextYearFirstMonday) break;

      const value = `${w}/${y}`;
      const label = `Semana ${w}/${y}`;

      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      weekSelect.appendChild(opt);

      const optFilter = opt.cloneNode(true);
      filterSelect.appendChild(optFilter);
    }
  }
}

function populateRepeatDays() {
  const container = document.getElementById('repeatDays');
  container.innerHTML = '';
  days.forEach(day => {
    const div = document.createElement('div');
    div.className = 'repeat-day';
    div.innerHTML = `
      <label>${day}:</label>
      <input type="checkbox" id="repeat-${day}">
      <input type="time" id="time-${day}" disabled>
    `;
    container.appendChild(div);
    div.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      div.querySelector('input[type="time"]').disabled = !e.target.checked;
    });
  });
}

function updateDateField() {
  const week = document.getElementById('week').value;
  const day = document.getElementById('day').value;
  const dateInput = document.getElementById('date');
  if (week && day) {
    dateInput.value = calculateDate(week, day);
  } else {
    dateInput.value = '';
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

function addToCollection() {
  const error = document.getElementById('errorMessages');
  error.innerHTML = '';

  const collection = document.getElementById('collection').value;
  const programName = document.getElementById('programName').value.trim();
  const processNumber = document.getElementById('processNumber').value.trim();
  const week = document.getElementById('week').value;
  const rightsDuration = document.getElementById('rightsDuration').value.trim();
  const programType = document.getElementById('programType').value.trim();
  const category = document.getElementById('category').value;
  const isRepeat = document.getElementById('isRepeat').checked;

  if (!programName || !processNumber || !week || !rightsDuration || !programType) {
    error.innerHTML = 'Preencha todos os campos obrigatórios.';
    return;
  }

  const entries = [];

  if (!isRepeat) {
    const day = document.getElementById('day').value;
    const time = document.getElementById('time').value;
    const date = document.getElementById('date').value;
    if (!time || !date) {
      error.innerHTML = 'Preencha a hora e verifique a data.';
      return;
    }
    entries.push({ id: Date.now() + Math.random(), programName, processNumber, week, day, date, time, rightsDuration, programType, category });
  } else {
    let hasOne = false;
    let errMsg = '';
    days.forEach(day => {
      const cb = document.getElementById(`repeat-${day}`);
      if (cb.checked) {
        const timeVal = document.getElementById(`time-${day}`).value;
        if (!timeVal) {
          errMsg += `Hora obrigatória para ${day}.<br>`;
        } else {
          const date = calculateDate(week, day);
          entries.push({ id: Date.now() + Math.random(), programName, processNumber, week, day, date, time: timeVal, rightsDuration, programType, category });
          hasOne = true;
        }
      }
    });
    if (errMsg) {
      error.innerHTML = errMsg;
      return;
    }
    if (!hasOne) {
      error.innerHTML = 'Selecione pelo menos um dia.';
      return;
    }
  }

  entries.forEach(e => collections[collection].push(e));
  saveToLocalStorage();
  renderAllTables(document.getElementById('filterWeek').value);
  clearForm();
  notify('Adicionado com sucesso!');
}

function clearForm() {
  document.getElementById('form').reset();
  document.getElementById('repeatSection').style.display = 'none';
  document.getElementById('date').value = '';
  document.querySelectorAll('#repeatDays input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
  });
}

function renderAllTables(filter = '') {
  COLLECTIONS.forEach(col => {
    const tbody = document.getElementById(col.replace(/ /g, '_') + 'TableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let data = [...collections[col]];
    
    data.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(a.date) - new Date(b.date);
      }
      return a.time.localeCompare(b.time);
    });

    if (filter) data = data.filter(e => e.week === filter);

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="no-results">Sem resultados</td></tr>';
      return;
    }

    data.forEach((e) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.programName}</td>
        <td>${e.processNumber}</td>
        <td>${e.week}</td>
        <td>${e.day}</td>
        <td>${e.date}</td>
        <td>${e.time}</td>
        <td>${e.rightsDuration}</td>
        <td>${e.programType}</td>
        <td class="${e.category.toLowerCase()}">${e.category}</td>
        <td><button onclick="deleteEntryById('${col}', ${e.id})">Apagar</button></td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function deleteEntryById(col, id) {
  if (confirm('Apagar esta entrada?')) {
    collections[col] = collections[col].filter(e => e.id !== id);
    saveToLocalStorage();
    renderAllTables(document.getElementById('filterWeek').value);
    notify('Apagado');
  }
}

function clearFilter() {
  document.getElementById('filterWeek').value = '';
  renderAllTables();
}

function exportFilteredCollection(col, week, id) {
  const fmt = document.getElementById(id).value;
  let data = [...collections[col]];
  
  data.sort((a, b) => {
    if (a.date !== b.date) return new Date(a.date) - new Date(b.date);
    return a.time.localeCompare(b.time);
  });
  
  if (week) data = data.filter(e => e.week === week);
  if (!data.length) return alert('Nada para exportar');
  
  fmt === 'pdf' ? exportPDF(col, data) : exportTXT(col, data);
}

function exportTXT(col, data) {
  let txt = `Coleção: ${col}\n`;
  txt += `Gerado em: ${new Date().toLocaleString()}\n`;
  txt += `--------------------------------------------------\n`;
  txt += `Programa | Proc. | Sem. | Data | Hora | Direitos | Tipo\n`;
  txt += `--------------------------------------------------\n`;
  
  data.forEach(e => {
    txt += `${e.programName} | ${e.processNumber} | ${e.week} | ${e.date} | ${e.time} | ${e.rightsDuration} | ${e.programType}\n`;
  });
  
  download(txt, `${col}.txt`, 'text/plain');
}

function exportPDF(col, data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape'); // Landscape para caberem todas as colunas
  
  doc.setFontSize(16);
  doc.text(`Coleção: ${col}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Filtro: ${document.getElementById('filterWeek').value || 'Todas as semanas'}`, 14, 22);

  doc.autoTable({ 
    startY: 30, 
    head: [['Programa','Processo','Semana','Data','Hora','Direitos','Tipo','Categoria']], 
    body: data.map(e => [
      e.programName, 
      e.processNumber, 
      e.week, 
      e.date, 
      e.time, 
      e.rightsDuration, 
      e.programType,
      e.category
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 123, 255] }
  });
  
  doc.save(`${col}.pdf`);
}

function download(content, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type}));
  a.download = name;
  a.click();
}

function saveToLocalStorage() { localStorage.setItem('collections', JSON.stringify(collections)); }

function loadFromLocalStorage() {
  const d = localStorage.getItem('collections');
  if (d) collections = JSON.parse(d);
}

function resetAllData() {
  if (confirm('Apagar TODOS os dados? Irreversível!')) {
    collections = Object.fromEntries(COLLECTIONS.map(c => [c, []]));
    localStorage.removeItem('collections');
    renderAllTables();
    notify('Dados apagados');
  }
}

function exportBackup() {
  download(JSON.stringify(collections, null, 2), `backup_rtp_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
  notify('Backup exportado');
}

function importBackup() { document.getElementById('importFile').click(); }

function notify(msg) {
  const n = document.getElementById('notification');
  n.textContent = msg;
  n.classList.add('show');
  setTimeout(() => { n.classList.remove('show'); n.textContent = ''; }, 4000);
}

document.getElementById('week').addEventListener('change', updateDateField);
document.getElementById('day').addEventListener('change', updateDateField);
document.getElementById('isRepeat').addEventListener('change', function() {
  document.getElementById('repeatSection').style.display = this.checked ? 'block' : 'none';
});
document.getElementById('filterWeek').addEventListener('change', e => renderAllTables(e.target.value));
document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file || !confirm('Substituir todos os dados?')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      collections = JSON.parse(ev.target.result);
      saveToLocalStorage();
      renderAllTables();
      notify('Backup importado');
    } catch { alert('Ficheiro inválido'); }
  };
  reader.readAsText(file);
});

loadFromLocalStorage();
populateWeeks();
populateRepeatDays();
renderAllTables();