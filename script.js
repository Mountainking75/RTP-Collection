const COLLECTIONS = ['RTP 1', 'RTP 2', 'RTP 3', 'RTP Memoria', 'RTP Africa'];
let collections = Object.fromEntries(COLLECTIONS.map(c => [c, []]));

let editMode = false;
let editingId = null;
let editingCollection = null;

const dayMap = {'Segunda-feira': 1, 'Terça-feira': 2, 'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6, 'Domingo': 7};
const daysList = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

// --- TEMA E SEPARADORES ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode'));
}

function openTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelectorAll('.tab-link').forEach(tl => tl.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// --- DASHBOARD ---
function updateDashboard() {
    const filter = document.getElementById('filterWeek').value;
    let total = 0, novidade = 0, estreia = 0, repeticao = 0;

    COLLECTIONS.forEach(col => {
        let data = collections[col];
        if (filter) data = data.filter(e => e.week === filter);
        
        total += data.length;
        data.forEach(e => {
            const cat = e.category.toUpperCase();
            if (cat === 'NOVIDADE') novidade++;
            else if (cat === 'ESTREIA') estreia++;
            else if (cat.includes('REPETI')) repeticao++;
        });
    });

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-novidade').textContent = novidade;
    document.getElementById('stat-estreia').textContent = estreia;
    document.getElementById('stat-repeticao').textContent = repeticao;
}

// --- LÓGICA DE DATAS ---
function getMonday(year) {
    const jan4 = new Date(year, 0, 4);
    const day = jan4.getDay() || 7;
    const mon = new Date(jan4);
    mon.setDate(jan4.getDate() - (day - 1));
    return mon;
}

function populateWeeks() {
    const ws = document.getElementById('week'), fs = document.getElementById('filterWeek');
    ws.innerHTML = '';
    fs.innerHTML = '<option value="">Todas as Semanas</option>';
    for (let y = 2026; y <= 2030; y++) {
        for (let w = 1; w <= 53; w++) {
            const base = getMonday(y);
            const m = new Date(base);
            m.setDate(base.getDate() + (w - 1) * 7);
            if (m.getFullYear() > y && w > 1) break;
            const v = `${w}/${y}`;
            const opt = new Option(`Semana ${v}`, v);
            ws.add(opt); fs.add(opt.cloneNode(true));
        }
    }
}

function updateDateField() {
    const w = document.getElementById('week').value, d = document.getElementById('day').value;
    if (w && d) {
        const [wk, yr] = w.split('/').map(Number);
        const date = getMonday(yr);
        date.setDate(date.getDate() + (wk - 1) * 7 + (dayMap[d] - 1));
        document.getElementById('date').value = date.toISOString().slice(0, 10);
    }
}

// --- CORE ---
function addToCollection() {
    const col = document.getElementById('collection').value;
    const common = {
        programName: document.getElementById('programName').value.trim(),
        processNumber: document.getElementById('processNumber').value.trim(),
        week: document.getElementById('week').value,
        rightsDuration: document.getElementById('rightsDuration').value.trim(),
        programType: document.getElementById('programType').value.trim(),
        category: document.getElementById('category').value
    };

    if (editMode) {
        if (editingCollection !== col) collections[editingCollection] = collections[editingCollection].filter(e => e.id !== editingId);
        const updated = { ...common, id: editingId, day: document.getElementById('day').value, date: document.getElementById('date').value, time: document.getElementById('time').value };
        if (editingCollection === col) {
            const idx = collections[col].findIndex(e => e.id === editingId);
            collections[col][idx] = updated;
        } else collections[col].push(updated);
        notify("Entrada atualizada!");
    } else {
        if (!document.getElementById('isRepeat').checked) {
            collections[col].push({ ...common, id: Date.now() + Math.random(), day: document.getElementById('day').value, date: document.getElementById('date').value, time: document.getElementById('time').value });
        } else {
            daysList.forEach(d => {
                const cb = document.getElementById(`repeat-${d}`);
                if (cb && cb.checked) {
                    const [wk, yr] = common.week.split('/').map(Number);
                    const date = getMonday(yr);
                    date.setDate(date.getDate() + (wk - 1) * 7 + (dayMap[d] - 1));
                    collections[col].push({ ...common, id: Date.now() + Math.random(), day: d, date: date.toISOString().slice(0, 10), time: document.getElementById(`time-${d}`).value });
                }
            });
        }
        notify("Adicionado com sucesso!");
    }
    saveData(); renderAllTables(document.getElementById('filterWeek').value); clearForm();
}

function editEntry(col, id) {
    const e = collections[col].find(x => x.id == id);
    if (!e) return;
    editMode = true; editingId = id; editingCollection = col;
    document.getElementById('collection').value = col;
    document.getElementById('programName').value = e.programName;
    document.getElementById('processNumber').value = e.processNumber;
    document.getElementById('week').value = e.week;
    document.getElementById('day').value = e.day;
    document.getElementById('date').value = e.date;
    document.getElementById('time').value = e.time;
    document.getElementById('rightsDuration').value = e.rightsDuration;
    document.getElementById('programType').value = e.programType;
    document.getElementById('category').value = e.category;
    document.getElementById('submitBtn').textContent = "Atualizar";
    document.getElementById('form-title').textContent = "Editar Entrada";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteEntryById(col, id) {
    if (confirm("Apagar esta linha?")) {
        collections[col] = collections[col].filter(e => e.id != id);
        saveData(); renderAllTables(document.getElementById('filterWeek').value);
    }
}

function renderAllTables(filter = '') {
    COLLECTIONS.forEach(col => {
        const tbody = document.getElementById(col.replace(/ /g, '_') + 'TableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        let data = [...collections[col]].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        if (filter) data = data.filter(e => e.week === filter);

        data.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${e.programName}</td><td>${e.processNumber}</td><td>${e.week}</td>
                <td>${e.day}</td><td>${e.date}</td><td>${e.time}</td>
                <td>${e.rightsDuration}</td><td>${e.programType}</td>
                <td class="${e.category.toLowerCase()}">${e.category}</td>
                <td class="actions-cell">
                    <button class="edit-btn" onclick="editEntry('${col}', ${e.id})">✎</button>
                    <button class="danger-button" onclick="deleteEntryById('${col}', ${e.id})">✖</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
    updateDashboard();
}

// --- EXPORT/BACKUP ---
function exportCol(col, selId) {
    const fmt = document.getElementById(selId).value;
    const filter = document.getElementById('filterWeek').value;
    let data = [...collections[col]].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    if (filter) data = data.filter(e => e.week === filter);
    if (!data.length) return alert("Sem dados.");
    
    if (fmt === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l');
        doc.text(`Canais RTP - ${col} (${filter || 'Todas'})`, 14, 15);
        doc.autoTable({
            startY: 20,
            head: [['Programa','Processo','Sem.','Data','Hora','Direitos','Tipo','Categoria']],
            body: data.map(e => [e.programName, e.processNumber, e.week, e.date, e.time, e.rightsDuration, e.programType, e.category]),
            didParseCell: (d) => {
                if (d.section === 'body' && d.column.index === 7) {
                    const c = d.cell.raw.toUpperCase();
                    if (c === 'NOVIDADE') d.cell.styles.fillColor = [40, 167, 69];
                    else if (c === 'ESTREIA') d.cell.styles.fillColor = [220, 53, 69];
                    else if (c.includes('REPETI')) d.cell.styles.fillColor = [0, 123, 255];
                    if (d.cell.styles.fillColor) d.cell.styles.textColor = 255;
                }
            }
        });
        doc.save(`${col}.pdf`);
    } else {
        const txt = data.map(e => `${e.date} | ${e.time} | ${e.programName}`).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain'}));
        a.download = `${col}.txt`; a.click();
    }
}

function saveData() { localStorage.setItem('rtp_v4', JSON.stringify(collections)); }
function exportBackup() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(collections)], {type:'application/json'}));
    a.download = `backup_rtp.json`; a.click();
}
function importBackup() { document.getElementById('importFile').click(); }

function clearForm() {
    editMode = false; editingId = null; document.getElementById('form').reset();
    document.getElementById('submitBtn').textContent = "Adicionar";
    document.getElementById('form-title').textContent = "Adicionar Entrada";
    document.getElementById('repeatSection').style.display = 'none';
    updateDateField();
}

function notify(m) {
    const n = document.getElementById('notification'); n.textContent = m; n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 3000);
}

function clearFilter() { document.getElementById('filterWeek').value = ''; renderAllTables(); }

window.onload = () => {
    if (localStorage.getItem('dark-mode') === 'true') document.body.classList.add('dark-mode');
    const d = localStorage.getItem('rtp_v4'); if (d) collections = JSON.parse(d);
    populateWeeks(); renderAllTables();
    document.getElementById('week').onchange = updateDateField;
    document.getElementById('day').onchange = updateDateField;
    document.getElementById('isRepeat').onchange = e => document.getElementById('repeatSection').style.display = e.target.checked ? 'block' : 'none';
    document.getElementById('filterWeek').onchange = e => renderAllTables(e.target.value);
    
    // Iniciar grelha de repetição
    const grid = document.getElementById('repeatDays');
    daysList.forEach(day => {
        const div = document.createElement('div');
        div.innerHTML = `<label><input type="checkbox" id="repeat-${day}"> ${day}</label><input type="time" id="time-${day}" disabled>`;
        grid.appendChild(div);
        div.querySelector('input[type="checkbox"]').onchange = e => div.querySelector('input[type="time"]').disabled = !e.target.checked;
    });

    document.getElementById('importFile').onchange = e => {
        const reader = new FileReader();
        reader.onload = ev => { collections = JSON.parse(ev.target.result); saveData(); renderAllTables(); };
        reader.readAsText(e.target.files[0]);
    };
};