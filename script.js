// Constants for collections and weeks
const COLLECTIONS = ['RTP 1', 'RTP 2', 'RTP 3', 'RTP Memoria', 'RTP Africa'];
const WEEKS = Array.from({ length: 52 }, (_, i) => `Semana ${i + 1}`);
const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

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
    filterWeek: document.getElementById('filterWeek'),
    isRepeat: document.getElementById('isRepeat'),
    repeatSection: document.getElementById('repeatSection'),
    repeatDays: document.getElementById('repeatDays')
};

// Calculate date for a given week and day
function calculateDate(week, day) {
    // Parse week number (e.g., "Semana 19" -> 19)
    const weekNumber = parseInt(week.split(' ')[1], 10);
    // Assume year is 2025 (adjustable)
    const year = 2025;
    // Calculate the first day of the year
    const firstDay = new Date(year, 0, 1);
    // Calculate the first Monday of the year
    const firstMonday = new Date(firstDay);
    firstMonday.setDate(firstDay.getDate() + ((1 - firstDay.getDay() + 7) % 7));
    // Calculate the Monday of the target week
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    // Map day to offset (Segunda-feira = 0, Terça-feira = 1, etc.)
    const dayOffsets = {
        'Segunda-feira': 0,
        'Terça-feira': 1,
        'Quarta-feira': 2,
        'Quinta-feira': 3,
        'Sexta-feira': 4,
        'Sábado': 5,
        'Domingo': 6
    };
    const targetDate = new Date(targetMonday);
    targetDate.setDate(targetMonday.getDate() + dayOffsets[day]);
    // Format as YYYY-MM-DD
    return targetDate.toISOString().split('T')[0];
}

// Form handling
function addToCollection() {
    const baseFields = {
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
    const requiredFields = ['programName', 'processNumber', 'week', 'day', 'date', 'time', 'rightsDuration', 'programType', 'category'];
    const errors = requiredFields.filter(field => !baseFields[field]).map(field => {
        const label = DOM[field].previousElementSibling.textContent;
        return `${label} é obrigatório.`;
    });

    // Validate date matches week and day
    const expectedDate = calculateDate(baseFields.week, baseFields.day);
    if (baseFields.date !== expectedDate) {
        errors.push(`Data (${baseFields.date}) não corresponde ao dia (${baseFields.day}) na ${baseFields.week}.`);
    }

    if (errors.length > 0) {
        DOM.errorMessages.textContent = errors.join(' ');
        return;
    }

    const entries = [baseFields];

    // Handle repeats
    if (DOM.isRepeat.checked) {
        const repeatCheckboxes = DOM.repeatDays.querySelectorAll('input[type="checkbox"]:checked');
        repeatCheckboxes.forEach(checkbox => {
            const repeatDay = checkbox.value;
            const timeInput = DOM.repeatDays.querySelector(`input[data-day="${repeatDay}"]`);
            if (timeInput && timeInput.value) {
                entries.push({
                    ...baseFields,
                    day: repeatDay,
                    date: calculateDate(baseFields.week, repeatDay),
                    time: timeInput.value
                });
            }
        });
    }

    // Add entries to collection
    entries.forEach(entry => {
        collections[entry.collection].push(entry);
    });

    // Render with current filter and highlight new entries
    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(baseFields.collection, currentFilterWeek || null, true);
    saveToLocalStorage();
    DOM.form.reset();
    DOM.errorMessages.textContent = '';
    DOM.isRepeat.checked = false;
    DOM.repeatSection.style.display = 'none';
    showNotification(`Adicionadas ${entries.length} entrada(s) com sucesso!`);
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
    DOM.isRepeat.checked = false;
    DOM.repeatSection.style.display = 'none';
}

// Table rendering
function renderAllTables(filterWeek = null) {
    COLLECTIONS.forEach(collection => renderTable(collection, filterWeek));
}

function renderTable(collection, filterWeek = null, highlightNew = false) {
    const tableBody = document.getElementById(`${collection.replace(/ /g, '_')}TableBody`);
    if (!tableBody) {
        console.error(`Table body not found for ${collection}`);
        return;
    }
    tableBody.innerHTML = '';

    let entries = filterWeek
        ? collections[collection].filter(entry => entry.week === filterWeek)
        : collections[collection];

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
        if (highlightNew && index >= entries.length - (highlightNew === true ? 1 : highlightNew)) {
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
    if (!DOM.filterWeek) {
        console.error('Filter week dropdown not found');
        return;
    }
    const selectedWeek = DOM.filterWeek.value;
    renderAllTables(selectedWeek || null);
}

// Clear filter
function clearFilter() {
    if (DOM.filterWeek) {
        DOM.filterWeek.value = '';
        renderAllTables(null);
    }
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
    DOM.isRepeat.checked = false;
    DOM.repeatSection.style.display = 'none';
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
                    fontStyle: 'bold',
                    fillColor: entry => {
                        switch (entry) {
                            case 'NOVIDADE': return [40, 167, 69];
                            case 'ESTREIA': return [220, 53, 69];
                            case 'REPETIÇÃO': return [0, 123, 255];
                            default: return [255, 255, 255];
                        }
                    },
                    textColor: [255, 255, 255]
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
        exportButton.removeChild(loader);
        exportButton.disabled = false;
        DOM.errorMessages.textContent = '';
    }, 100);
}

// Table sorting
function sortTable(collection, column, thElement) {
    const ascending = thElement.getAttribute('aria-sort') !== 'ascending';
    collections[collection].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        const timeCompare = a.time.localeCompare(b.time);
        if (timeCompare !== 0) return timeCompare;
        const valA = a[column] || '';
        const valB = b[column] || '';
        return ascending ? valA.localeCompare(valB) : valB.localeCompare(valB);
    });

    document.querySelectorAll(`#${collection.replace(/ /g, '_')}Table th`).forEach(th => {
        th.setAttribute('aria-sort', 'none');
    });
    thElement.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');

    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(collection, currentFilterWeek || null);
}

// Populate dropdowns
function populateWeeksDropdown() {
    if (!DOM.week || !DOM.filterWeek) {
        console.error('Week dropdowns not found');
        return;
    }

    DOM.week.innerHTML = '';
    DOM.filterWeek.innerHTML = '<option value="">Selecione uma semana</option>';

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

// Populate repeat days
function populateRepeatDays() {
    if (!DOM.repeatDays) {
        console.error('Repeat days container not found');
        return;
    }
    DOM.repeatDays.innerHTML = '';
    DAYS.forEach(day => {
        if (day !== DOM.day.value) { // Exclude the primary day
            const div = document.createElement('div');
            div.className = 'repeat-day';
            div.innerHTML = `
                <label for="repeat-${day}">${day}</label>
                <input type="checkbox" id="repeat-${day}" value="${day}">
                <input type="time" data-day="${day}" disabled>
            `;
            DOM.repeatDays.appendChild(div);

            // Enable/disable time input based on checkbox
            const checkbox = div.querySelector(`#repeat-${day}`);
            const timeInput = div.querySelector(`input[data-day="${day}"]`);
            checkbox.addEventListener('change', () => {
                timeInput.disabled = !checkbox.checked;
                if (!checkbox.checked) timeInput.value = '';
            });
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!DOM.week || !DOM.filterWeek || !DOM.form || !DOM.isRepeat || !DOM.repeatSection) {
        console.error('Critical DOM elements missing');
        return;
    }
    populateWeeksDropdown();
    loadFromLocalStorage();
    DOM.filterWeek.addEventListener('change', filterByWeek);

    // Handle repeat section visibility
    DOM.isRepeat.addEventListener('change', () => {
        DOM.repeatSection.style.display = DOM.isRepeat.checked ? 'block' : 'none';
        if (DOM.isRepeat.checked) {
            populateRepeatDays();
        } else {
            DOM.repeatDays.innerHTML = '';
        }
    });

    // Update repeat days when primary day changes
    DOM.day.addEventListener('change', () => {
        if (DOM.isRepeat.checked) {
            populateRepeatDays();
        }
    });
});