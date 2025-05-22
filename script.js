// Constants for collections and weeks
const COLLECTIONS = ['RTP 1', 'RTP 2', 'RTP 3', 'RTP Memoria', 'RTP Africa'];
const WEEKS = Array.from({ length: 52 }, (_, i) => `Semana ${i + 1}`);

// Initialize collections
let collections = {
    'RTP 1': [],
    'RTP 2': [],
    'RTP 3': [],
    'RTP Memoria': [],
    'RTP Africa': []
};

// Cache DOM elements
const DOM = {
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
    filterWeek: document.getElementById('filterWeek')
};

// Form handling
function addToCollection() {
    const fields = {
        collection: DOM.collection.value,
        programName: DOM.programName.value.trim(),
        processNumber: DOM.processNumber.value.trim(),
        week: DOM.week.value,
        day: DOM.day.value,
        date: DOM.date.value,
        time: DOM.time.value,
        rightsDuration: DOM.rightsDuration.value.trim(),
        programType: DOM.programType.value.trim(),
        category: DOM.category.value
    };

    // Validate required fields
    const requiredFields = ['programName', 'processNumber', 'date', 'time', 'rightsDuration', 'programType'];
    const errors = requiredFields.filter(field => !fields[field]).map(field => {
        const label = DOM[field].previousElementSibling.textContent;
        return `${label} é obrigatório.`;
    });

    if (errors.length > 0) {
        DOM.errorMessages.textContent = errors.join(' ');
        return;
    }

    // Add entry to collection
    collections[fields.collection].push(fields);
    // Render with current filter and highlight new entry
    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(fields.collection, currentFilterWeek || null, true);
    saveToLocalStorage();
    DOM.form.reset();
    DOM.errorMessages.textContent = '';
    showNotification('Entrada adicionada com sucesso!');
}

// Show notification
function showNotification(message) {
    DOM.notification.textContent = message;
    DOM.notification.classList.add('show');
    setTimeout(() => {
        DOM.notification.classList.remove('show');
        setTimeout(() => {
            DOM.notification.textContent = '';
        }, 500);
    }, 3000);
}

// Clear form
function clearForm() {
    DOM.form.reset();
    DOM.errorMessages.textContent = '';
}

// Table rendering
function renderAllTables(filterWeek = null) {
    COLLECTIONS.forEach(collection => renderTable(collection, filterWeek));
}

function renderTable(collection, filterWeek = null, highlightNew = false) {
    const tableBody = document.getElementById(`${collection.replace(/ /g, '_')}TableBody`);
    tableBody.innerHTML = '';

    let entries = filterWeek
        ? collections[collection].filter(entry => entry.week === filterWeek)
        : collections[collection];

    // Sort entries by date (ascending), then by time (ascending)
    entries = entries.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
    });

    if (entries.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="10" class="no-results">Nenhuma entrada encontrada.</td></tr>`;
        return;
    }

    entries.forEach((entry, index) => {
        const row = document.createElement('tr');
        if (highlightNew && index === entries.length - 1) {
            row.classList.add('highlight');
            setTimeout(() => {
                row.classList.remove('highlight');
            }, 2000);
        }
        row.innerHTML = `
            <td>${entry.programName}</td>
            <td>${entry.processNumber}</td>
            <td>${entry.week}</td>
            <td>${entry.day}</td>
            <td>${entry.date}</td>
            <td>${entry.time}</td>
            <td>${entry.rightsDuration}</td>
            <td>${entry.programType}</td>
            <td class="${entry.category.toLowerCase()}">${entry.category}</td>
            <td>
                <button onclick="editEntry('${collection}', ${index})" aria-label="Editar entrada">Editar</button>
                <button onclick="confirmDelete('${collection}', ${index})" aria-label="Excluir entrada">Excluir</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Filter by week
function filterByWeek() {
    const selectedWeek = DOM.filterWeek.value;
    renderAllTables(selectedWeek || null);
}

// Clear filter
function clearFilter() {
    DOM.filterWeek.value = '';
    renderAllTables(null);
}

// Delete entry
function confirmDelete(collection, index) {
    if (confirm('Tem certeza que deseja excluir esta entrada?')) {
        deleteEntry(collection, index);
    }
}

function deleteEntry(collection, index) {
    collections[collection].splice(index, 1);
    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(collection, currentFilterWeek || null);
    saveToLocalStorage();
}

// Edit entry
function editEntry(collection, index) {
    const entry = collections[collection][index];
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
    deleteEntry(collection, index);
}

// Local storage
function saveToLocalStorage() {
    try {
        localStorage.setItem('collections', JSON.stringify(collections));
    } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
    }
}

function loadFromLocalStorage() {
    try {
        const storedCollections = localStorage.getItem('collections');
        if (storedCollections) {
            collections = JSON.parse(storedCollections);
            renderAllTables();
        }
    } catch (e) {
        console.error('Erro ao carregar do localStorage:', e);
    }
}

// Export module
const exportModule = {
    toTxt(entries, collection) {
        // Sort entries by date, then by time for export
        entries = entries.sort((a, b) => {
            const dateCompare = new Date(a.date) - new Date(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.time.localeCompare(b.time);
        });
        let content = '';
        entries.forEach(entry => {
            content += `**Nome do Programa**: ${entry.programName}\n`;
            content += `**Número de Processo**: ${entry.processNumber}\n`;
            content += `Semana: ${entry.week}\n`;
            content += `Dia: ${entry.day}\n`;
            content += `Data: ${entry.date}\n`;
            content += `Hora: ${entry.time}\n`;
            content += `Duração dos Direitos: ${entry.rightsDuration}\n`;
            content += `Tipo de Programa: ${entry.programType}\n`;
            content += `**Categoria**: ${entry.category}\n`;
            content += `-----------------------------\n`;
        });
        const blob = new Blob([content], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${collection}.txt`;
        link.click();
    },
    toPdf(entries, collection) {
        // Sort entries by date, then by time for export
        entries = entries.sort((a, b) => {
            const dateCompare = new Date(a.date) - new Date(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.time.localeCompare(b.time);
        });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.autoTable({
            head: [['Nome do Programa', 'Número de Processo', 'Semana', 'Dia', 'Data', 'Hora', 'Duração dos Direitos', 'Tipo de Programa', 'Categoria']],
            body: entries.map(entry => [
                entry.programName,
                entry.processNumber,
                entry.week,
                entry.day,
                entry.date,
                entry.time,
                entry.rightsDuration,
                entry.programType,
                entry.category
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [200, 200, 200] },
            columnStyles: {
                8: {
                    cellWidth: 20,
                    textColor: entry => {
                        switch (entry) {
                            case 'NOVIDADE': return 'green';
                            case 'ESTREIA': return 'red';
                            case 'REPETIÇÃO': return 'blue';
                            default: return 'black';
                        }
                    }
                }
            }
        });
        doc.save(`${collection}.pdf`);
    }
};



function exportFilteredCollection(collection, filterWeek, formatId) {
    const format = document.getElementById(formatId).value;
    if (!['txt', 'pdf'].includes(format)) {
        DOM.errorMessages.textContent = 'Formato inválido selecionado.';
        return;
    }

    let entries = filterWeek
        ? collections[collection].filter(entry => entry.week === filterWeek)
        : collections[collection];

    if (entries.length === 0) {
        DOM.errorMessages.textContent = `A coleção ${collection} não possui dados para exportar.`;
        return;
    }

    // Show loader
    const exportButton = document.querySelector(`#${formatId.replace('export-format-', '')}Table button`);
    const loader = document.createElement('span');
    loader.className = 'loader';
    exportButton.appendChild(loader);
    exportButton.disabled = true;

    setTimeout(() => {
        if (format === 'txt') {
            exportModule.toTxt(entries, collection);
        } else {
            exportModule.toPdf(entries, collection);
        }
        // Remove loader
        exportButton.removeChild(loader);
        exportButton.disabled = false;
        DOM.errorMessages.textContent = '';
    }, 100);
}

// Table sorting
function sortTable(collection, column, thElement) {
    const ascending = thElement.getAttribute('aria-sort') !== 'ascending';
    collections[collection].sort((a, b) => {
        // Sort by date, then time, then selected column
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        const timeCompare = a.time.localeCompare(b.time);
        if (timeCompare !== 0) return timeCompare;
        const valA = a[column] || '';
        const valB = b[column] || '';
        return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    // Update aria-sort for accessibility
    document.querySelectorAll(`#${collection.replace(/ /g, '_')}Table th`).forEach(th => {
        th.setAttribute('aria-sort', 'none');
    });
    thElement.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');

    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(collection, currentFilterWeek || null);
}

// Populate dropdowns
function populateWeeksDropdown() {
    WEEKS.forEach(week => {
        const option1 = document.createElement('option');
        option1.value = week;
        option1.textContent = week;
        DOM.week.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = week;
        option2.textContent = week;
        DOM.filterWeek.appendChild(option2);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populateWeeksDropdown();
    loadFromLocalStorage();
});