// Constantes Globais
const COLLECTIONS = ['RTP 1', 'RTP 2', 'RTP 3', 'RTP Memoria', 'RTP Africa'];
const WEEKS = [
    'Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5', 'Semana 6', 'Semana 7', 'Semana 8', 'Semana 9', 'Semana 10',
    'Semana 11', 'Semana 12', 'Semana 13', 'Semana 14', 'Semana 15', 'Semana 16', 'Semana 17', 'Semana 18', 'Semana 19', 'Semana 20',
    'Semana 21', 'Semana 22', 'Semana 23', 'Semana 24', 'Semana 25', 'Semana 26', 'Semana 27', 'Semana 28', 'Semana 29', 'Semana 30',
    'Semana 31', 'Semana 32', 'Semana 33', 'Semana 34', 'Semana 35', 'Semana 36', 'Semana 37', 'Semana 38', 'Semana 39', 'Semana 40',
    'Semana 41', 'Semana 42', 'Semana 43', 'Semana 44', 'Semana 45', 'Semana 46', 'Semana 47', 'Semana 48', 'Semana 49', 'Semana 50',
    'Semana 51', 'Semana 52'
];
const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

// Variáveis Globais
let collections = {};
let DOM = {};

// Função para inicializar as coleções vazias
function initializeCollections() {
    collections = {
        'RTP 1': [],
        'RTP 2': [],
        'RTP 3': [],
        'RTP Memoria': [],
        'RTP Africa': []
    };
}

// Funções de Ajuda (Cálculo de Datas)
function getCalendarInfo(entry) {
    const date = new Date(entry.date);
    const [hours, minutes] = entry.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    const dayMapping = { 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado', 0: 'Domingo' };
    const calendarDay = dayMapping[date.getDay()];

    return { calendarDate: date, calendarDay: calendarDay, totalMinutes: totalMinutes };
}

function validateDateAgainstWeekAndDay(dateStr, week, day) {
    if (!dateStr || !week || !day) return [];
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const semana1Start = new Date(year - 1, 11, 30);
    const dateMonday = new Date(date);
    dateMonday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const diffDays = Math.floor((dateMonday - semana1Start) / (1000 * 60 * 60 * 24));
    const computedWeekNumber = Math.floor(diffDays / 7) + 1;

    const dayMapping = { 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado', 0: 'Domingo' };
    const computedDay = dayMapping[date.getDay()];

    const errors = [];
    const expectedWeekNumber = parseInt(week.split(' ')[1], 10);
    if (computedWeekNumber !== expectedWeekNumber) {
        errors.push(`A data (${dateStr}) não corresponde à ${week}. Semana calculada: Semana ${computedWeekNumber}.`);
    }
    if (computedDay !== day) {
        errors.push(`A data (${dateStr}) não corresponde ao dia (${day}). Dia calculado: ${computedDay}.`);
    }
    return errors;
}

function computeRepeatDate(primaryDateStr, primaryDay, repeatDay) {
    const primaryDate = new Date(primaryDateStr);
    const dayOffsets = { 'Segunda-feira': 1, 'Terça-feira': 2, 'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6, 'Domingo': 0 };
    const primaryOffset = dayOffsets[primaryDay];
    const repeatOffset = dayOffsets[repeatDay];
    const dayDifference = (repeatOffset - primaryOffset + 7) % 7 || 7;

    const repeatDate = new Date(primaryDate);
    repeatDate.setDate(primaryDate.getDate() + dayDifference);
    return repeatDate.toISOString().split('T')[0];
}


// Renderização e UI
function renderTable(collection, entriesToRender) {
    const tableBody = document.getElementById(`${collection.replace(/ /g, '_')}TableBody`);
    tableBody.innerHTML = '';

    if (entriesToRender.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="12" class="no-results">Nenhuma entrada encontrada.</td></tr>`;
        return;
    }

    entriesToRender.forEach(entry => {
        const calendarInfo = getCalendarInfo(entry);
        const row = document.createElement('tr');
        row.setAttribute('data-id', entry.id); // Corrigido para usar ID

        row.innerHTML = `
            <td>${entry.programName}</td>
            <td>${entry.processNumber}</td>
            <td>${entry.week}</td>
            <td>${calendarInfo.calendarDay}</td>
            <td>${entry.date}</td>
            <td>${entry.time}</td>
            <td>${entry.rightsDuration}</td>
            <td>${entry.programType}</td>
            <td class="${entry.category.toLowerCase()}">${entry.category}</td>
            <td>${entry.episodes || ''}</td>
            <td>
                <button onclick="editEntry('${collection}', ${entry.id})" aria-label="Editar entrada">Editar</button>
                <button onclick="confirmDelete('${collection}', ${entry.id})" aria-label="Excluir entrada">Excluir</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updateView() {
    const filterWeek = DOM.filterWeek.value;
    const searchTerm = DOM.searchInput.value.toLowerCase();

    COLLECTIONS.forEach(collection => {
        let filteredEntries = collections[collection] || [];

        if (filterWeek) {
            filteredEntries = filteredEntries.filter(entry => entry.week === filterWeek);
        }

        if (searchTerm) {
            filteredEntries = filteredEntries.filter(entry =>
                (entry.programName && entry.programName.toLowerCase().includes(searchTerm)) ||
                (entry.processNumber && entry.processNumber.toLowerCase().includes(searchTerm))
            );
        }
        
        filteredEntries.sort((a, b) => {
             const aCalendar = getCalendarInfo(a);
             const bCalendar = getCalendarInfo(b);
             const dateCompare = aCalendar.calendarDate.getTime() - bCalendar.calendarDate.getTime();
             if (dateCompare !== 0) return dateCompare;
             return aCalendar.totalMinutes - bCalendar.totalMinutes;
        });

        renderTable(collection, filteredEntries);
    });
}

function showNotification(message) {
    DOM.notification.textContent = message;
    DOM.notification.classList.add('show');
    setTimeout(() => {
        DOM.notification.classList.remove('show');
    }, 3000);
}

function clearForm() {
    DOM.form.reset();
    DOM.errorMessages.textContent = '';
    if (DOM.isRepeat) {
        DOM.isRepeat.checked = false;
        DOM.repeatSection.style.display = 'none';
    }
}

function clearFilter() {
    DOM.filterWeek.value = '';
    DOM.searchInput.value = '';
    updateView();
}


// Manipulação de Dados (Adicionar, Editar, Apagar)
function addToCollection() {
    DOM.errorMessages.innerHTML = '';
    const requiredFields = ['programName', 'processNumber', 'week', 'day', 'date', 'time', 'rightsDuration', 'programType', 'category'];
    let errors = [];
    requiredFields.forEach(field => {
        if (!DOM[field].value) {
            errors.push(`O campo ${DOM[field].previousElementSibling.textContent} é obrigatório.`);
        }
    });
    
    const dateValidationErrors = validateDateAgainstWeekAndDay(DOM.date.value, DOM.week.value, DOM.day.value);
    errors.push(...dateValidationErrors);

    if (errors.length > 0) {
        DOM.errorMessages.innerHTML = errors.join('<br>');
        return;
    }

    const baseFields = {
        id: Date.now(),
        collection: DOM.collection.value,
        programName: DOM.programName.value.trim(),
        processNumber: DOM.processNumber.value.trim(),
        week: DOM.week.value,
        day: DOM.day.value,
        date: DOM.date.value,
        time: DOM.time.value,
        rightsDuration: DOM.rightsDuration.value.trim(),
        programType: DOM.programType.value.trim(),
        category: DOM.category.value,
        episodes: DOM.episodes.value.trim()
    };

    const entriesToAdd = [baseFields];

    if (DOM.isRepeat.checked) {
        document.querySelectorAll('#repeatDays input[type="checkbox"]:checked').forEach(checkbox => {
            const repeatDay = checkbox.value;
            const repeatTimeInput = document.querySelector(`#repeatDays input[data-day="${repeatDay}"]`);
            const repeatTime = repeatTimeInput.value || DOM.time.value;
            const repeatDate = computeRepeatDate(baseFields.date, baseFields.day, repeatDay);
            
            entriesToAdd.push({
                ...baseFields,
                id: Date.now() + Math.random(),
                day: repeatDay,
                date: repeatDate,
                time: repeatTime,
            });
        });
    }

    entriesToAdd.forEach(entry => {
        if (!collections[entry.collection]) {
            collections[entry.collection] = [];
        }
        collections[entry.collection].push(entry);
    });

    saveToLocalStorage();
    updateView();
    
    entriesToAdd.forEach(entry => {
        const row = document.querySelector(`tr[data-id='${entry.id}']`);
        if (row) {
            row.classList.add('highlight');
            setTimeout(() => row.classList.remove('highlight'), 2000);
        }
    });
    
    clearForm();
    showNotification(`Adicionadas ${entriesToAdd.length} entrada(s) com sucesso!`);
}

function confirmDelete(collection, id) {
    if (confirm('Tem certeza que deseja excluir esta entrada?')) {
        deleteEntry(collection, id);
    }
}

function deleteEntry(collection, id) {
    const indexToDelete = collections[collection].findIndex(entry => entry.id === id);
    if (indexToDelete > -1) {
        collections[collection].splice(indexToDelete, 1);
        saveToLocalStorage();
        updateView();
        showNotification('Entrada excluída com sucesso!');
    }
}

function editEntry(collection, id) {
    const indexToEdit = collections[collection].findIndex(entry => entry.id === id);
    if (indexToEdit > -1) {
        const entry = collections[collection][indexToEdit];
        
        DOM.collection.value = collection;
        DOM.programName.value = entry.programName;
        DOM.processNumber.value = entry.processNumber;
        DOM.week.value = entry.week;
        DOM.day.value = entry.day;
        DOM.date.value = entry.date;
        DOM.time.value = entry.time;
        DOM.rightsDuration.value = entry.rightsDuration;
        DOM.programType.value = entry.programType;
        DOM.category.value = entry.category;
        DOM.episodes.value = entry.episodes || '';
        DOM.isRepeat.checked = false;
        DOM.repeatSection.style.display = 'none';

        collections[collection].splice(indexToEdit, 1);
        saveToLocalStorage();
        updateView();
        
        DOM.programName.focus();
    }
}


// Local Storage & Export
function saveToLocalStorage() {
    localStorage.setItem('collectionsRTP', JSON.stringify(collections));
}

function loadFromLocalStorage() {
    const storedCollections = localStorage.getItem('collectionsRTP');
    if (storedCollections) {
        collections = JSON.parse(storedCollections);
    } else {
        initializeCollections();
    }
}

function exportFilteredCollection(collection, filterWeek, formatId) {
    const format = document.getElementById(formatId).value;
    let entries = collections[collection] || [];
    if (filterWeek) {
        entries = entries.filter(entry => entry.week === filterWeek);
    }

    if (entries.length === 0) {
        showNotification(`A coleção ${collection} não possui dados para exportar.`, 'error');
        return;
    }

    if (format === 'txt') {
        exportModule.toTxt(entries, collection);
    } else {
        exportModule.toPdf(entries, collection);
    }
}

const exportModule = {
    toTxt(entries, collection) {
        let content = `Coleção: ${collection}\n======================\n\n`;
        entries.forEach(entry => {
            content += `**Nome do Programa**: ${entry.programName}\n`;
            content += `**Número de Processo**: ${entry.processNumber}\n`;
            content += `Semana: ${entry.week}\n`;
            content += `Dia: ${getCalendarInfo(entry).calendarDay}\n`;
            content += `Data: ${entry.date}\n`;
            content += `Hora: ${entry.time}\n`;
            content += `Duração dos Direitos: ${entry.rightsDuration}\n`;
            content += `Tipo de Programa: ${entry.programType}\n`;
            content += `**Categoria**: ${entry.category}\n`;
            if (entry.episodes) content += `Episódios: ${entry.episodes}\n`;
            content += `-----------------------------\n`;
        });
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${collection}.txt`;
        link.click();
    },
    toPdf(entries, collection) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.autoTable({
            head: [['Programa', 'Processo', 'Semana', 'Dia', 'Data', 'Hora', 'Direitos', 'Tipo', 'Categoria', 'Episódios']],
            body: entries.map(entry => [
                entry.programName, entry.processNumber, entry.week, getCalendarInfo(entry).calendarDay,
                entry.date, entry.time, entry.rightsDuration, entry.programType, entry.category, entry.episodes || ''
            ]),
            styles: { fontSize: 8 },
        });
        doc.save(`${collection}.pdf`);
    }
};

// Inicialização da Aplicação
function populateWeeksDropdown() {
    const weekDropdown = DOM.week;
    const filterWeekDropdown = DOM.filterWeek;
    
    if (!weekDropdown || !filterWeekDropdown) return;

    weekDropdown.innerHTML = '';
    filterWeekDropdown.innerHTML = '<option value="">Selecione uma semana</option>';

    WEEKS.forEach(week => {
        const option1 = document.createElement('option');
        option1.value = week;
        option1.textContent = week;
        weekDropdown.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = week;
        option2.textContent = week;
        filterWeekDropdown.appendChild(option2);
    });
}

function populateRepeatDays() {
    if (!DOM.repeatDays) return;
    DOM.repeatDays.innerHTML = '';
    const currentDay = DOM.day.value;
    DAYS.forEach(day => {
        if (day !== currentDay) {
            const div = document.createElement('div');
            div.className = 'repeat-day';
            div.innerHTML = `
                <input type="checkbox" id="repeat-${day}" value="${day}">
                <label for="repeat-${day}">${day}</label>
                <input type="time" data-day="${day}" disabled>`;
            DOM.repeatDays.appendChild(div);

            const checkbox = div.querySelector(`#repeat-${day}`);
            const timeInput = div.querySelector(`input[data-day="${day}"]`);
            checkbox.addEventListener('change', () => {
                timeInput.disabled = !checkbox.checked;
                if (!checkbox.checked) timeInput.value = '';
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    DOM = {
        form: document.getElementById('form'),
        errorMessages: document.getElementById('errorMessages'),
        notification: document.getElementById('notification'),
        collection: document.getElementById('collection'),
        programName: document.getElementById('programName'),
        processNumber: document.getElementById('processNumber'),
        week: document.getElementById('week'),
        day: document.getElementById('day'),
        date: document.getElementById('date'),
        time: document.getElementById('time'),
        rightsDuration: document.getElementById('rightsDuration'),
        programType: document.getElementById('programType'),
        category: document.getElementById('category'),
        episodes: document.getElementById('episodes'),
        isRepeat: document.getElementById('isRepeat'),
        repeatSection: document.getElementById('repeatSection'),
        repeatDays: document.getElementById('repeatDays'),
        filterWeek: document.getElementById('filterWeek'),
        searchInput: document.getElementById('searchInput')
    };

    populateWeeksDropdown();
    loadFromLocalStorage();
    updateView();
    
    DOM.filterWeek.addEventListener('change', updateView);
    DOM.searchInput.addEventListener('input', updateView);
    
    DOM.isRepeat.addEventListener('change', () => {
        DOM.repeatSection.style.display = DOM.isRepeat.checked ? 'block' : 'none';
        if (DOM.isRepeat.checked) populateRepeatDays();
    });

    DOM.day.addEventListener('change', () => {
        if (DOM.isRepeat.checked) populateRepeatDays();
    });
});