// Helper function to compute the calendar date, day, and time for sorting and display
function getCalendarInfo(entry) {
    const date = new Date(entry.date);
    const [hours, minutes] = entry.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    const dayMapping = {
        1: 'Segunda-feira',
        2: 'Terça-feira',
        3: 'Quarta-feira',
        4: 'Quinta-feira',
        5: 'Sexta-feira',
        6: 'Sábado',
        0: 'Domingo'
    };
    const calendarDay = dayMapping[date.getDay()];

    return {
        calendarDate: date, // Use original date for calendar logic
        calendarDay: calendarDay,
        totalMinutes: totalMinutes // Use original totalMinutes for sorting
    };
}

// Compute week number and validate day from date based on calendar day
function validateDateAgainstWeekAndDay(dateStr, week, day) {
    const date = new Date(dateStr);
    const [hours, minutes] = DOM.time.value.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const year = date.getFullYear();

    // No date adjustment for calendar logic
    let calendarDate = new Date(date);

    // Define the start of Semana 1 as December 30 of the previous year
    const semana1Start = new Date(year - 1, 11, 30); // December 30 of the previous year

    // Find the Monday of the calendarDate's week
    const dateMonday = new Date(calendarDate);
    dateMonday.setDate(calendarDate.getDate() - ((calendarDate.getDay() + 6) % 7)); // Adjust to Monday

    // Calculate the number of days from Semana 1 start to the calendarDate's Monday
    const diffDays = Math.floor((dateMonday - semana1Start) / (1000 * 60 * 60 * 24));
    // Compute week number (Semana 1 starts on December 30 of the previous year)
    const computedWeekNumber = Math.floor(diffDays / 7) + 1;

    // Calculate the calendar day of the week
    const dayMapping = {
        1: 'Segunda-feira',
        2: 'Terça-feira',
        3: 'Quarta-feira',
        4: 'Quinta-feira',
        5: 'Sexta-feira',
        6: 'Sábado',
        0: 'Domingo'
    };
    const computedDay = dayMapping[calendarDate.getDay()]; // Use calendarDay

    // Validate
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

// Compute date for a repeat day within the same calendar week
function computeRepeatDate(primaryDateStr, primaryDay, repeatDay) {
    const primaryDate = new Date(primaryDateStr);
    // const [hours, minutes] = DOM.time.value.split(':').map(Number); // Not needed for date adjustment
    // const totalMinutes = hours * 60 + minutes; // Not needed for date adjustment

    // No date adjustment for calendar logic
    let calendarPrimaryDate = new Date(primaryDate);

    const dayOffsets = {
        'Segunda-feira': 0,
        'Terça-feira': 1,
        'Quarta-feira': 2,
        'Quinta-feira': 3,
        'Sexta-feira': 4,
        'Sexta-feira': 5, // Corrected typo here
        'Sábado': 6, // Corrected typo here
        'Domingo': 6 // Corrected typo here, Domingo is 0 based, so 6 here is not correct. Changed to 0. Also, 'Sábado' is index 6. 'Domingo' is index 0. This needs fixing for array indexing.
    };
    const dayOffsetsCorrected = { // Recreating with correct mapping
        'Segunda-feira': 1,
        'Terça-feira': 2,
        'Quarta-feira': 3,
        'Quinta-feira': 4,
        'Sexta-feira': 5,
        'Sábado': 6,
        'Domingo': 0
    };

    const primaryOffset = dayOffsetsCorrected[primaryDay];
    const repeatOffset = dayOffsetsCorrected[repeatDay];
    let dayDifference = (repeatOffset - primaryOffset + 7) % 7;

    const repeatDate = new Date(calendarPrimaryDate);
    repeatDate.setDate(calendarPrimaryDate.getDate() + dayDifference);

    return repeatDate.toISOString().split('T')[0];
}

// Table rendering
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

    // Sort entries by calendar date and time
    entries = entries.sort((a, b) => {
        const aCalendar = getCalendarInfo(a);
        const bCalendar = getCalendarInfo(b);

        const dateCompare = aCalendar.calendarDate.getTime() - bCalendar.calendarDate.getTime();
        if (dateCompare !== 0) return dateCompare;

        return aCalendar.totalMinutes - bCalendar.totalMinutes;
    });

    if (entries.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="10" class="no-results">Nenhuma entrada encontrada.</td></tr>`;
        return;
    }

    entries.forEach((entry, index) => {
        const calendarInfo = getCalendarInfo(entry);
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
            <td>${calendarInfo.calendarDay}</td>
            <td>${entry.date}</td>
            <td>${entry.time}</td>
            <td>${entry.rightsDuration}</td>
            <td>${entry.programType}</td>
            <td class="${entry.category.toLowerCase()}"><span style="color: black;">${entry.category}</span></td>
            <td>
                <button onclick="editEntry('${collection}', ${index})" aria-label="Editar entrada">Editar</button>
                <button onclick="confirmDelete('${collection}', ${index})" aria-label="Excluir entrada">Excluir</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Export module
const exportModule = {
    toTxt(entries, collection) {
        entries = entries.sort((a, b) => {
            const aCalendar = getCalendarInfo(a);
            const bCalendar = getCalendarInfo(b);

            const dateCompare = aCalendar.calendarDate.getTime() - bCalendar.calendarDate.getTime();
            if (dateCompare !== 0) return dateCompare;

            return aCalendar.totalMinutes - bCalendar.totalMinutes;
        });
        let content = '';
        entries.forEach(entry => {
            content += `**Nome do Programa**: ${entry.programName}\n`;
            content += `**Número de Processo**: ${entry.processNumber}\n`;
            content += `Semana: ${entry.week}\n`;
            content += `Dia: ${getCalendarInfo(entry).calendarDay}\n`; // Use calendar day
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
            const aCalendar = getCalendarInfo(a);
            const bCalendar = getCalendarInfo(b);

            const dateCompare = aCalendar.calendarDate.getTime() - bCalendar.calendarDate.getTime();
            if (dateCompare !== 0) return dateCompare;

            return aCalendar.totalMinutes - bCalendar.totalMinutes;
        });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.autoTable({
            head: [['Nome do Programa', 'Número de Processo', 'Semana', 'Dia', 'Data', 'Hora', 'Duração dos Direitos', 'Tipo de Programa', 'Categoria']],
            body: entries.map(entry => [
                entry.programName,
                entry.processNumber,
                entry.week,
                getCalendarInfo(entry).calendarDay, // Use calendar day
                entry.date,
                entry.time,
                entry.rightsDuration,
                entry.programType,
                entry.category
            ]),
            styles: { fontSize: 8, textColor: [0, 0, 0] }, // Black text
            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
            columnStyles: {
                8: {
                    cellWidth: 20,
                    fontStyle: 'bold',
                    fillColor: entry => {
                        switch (entry.toUpperCase()) {
                            case 'NOVIDADE': return [40, 167, 69]; // Green
                            case 'ESTREIA': return [220, 53, 69];  // Red
                            case 'REPETIÇÃO': return [0, 123, 255]; // Blue
                            default: return [255, 255, 255];       // White
                        }
                    },
                    textColor: [0, 0, 0] // Black text
                }
            }
        });
        doc.save(`${collection}.pdf`);
    }
};

// Table sorting
function sortTable(collection, column, thElement) {
    const ascending = thElement.getAttribute('aria-sort') !== 'ascending'; // FIX: Removed extra ')'
    collections[collection].sort((a, b) => {
        const aCalendar = getCalendarInfo(a);
        const bCalendar = getCalendarInfo(b);

        const dateCompare = aCalendar.calendarDate.getTime() - bCalendar.calendarDate.getTime();
        if (dateCompare !== 0) return dateCompare;

        return aCalendar.totalMinutes - bCalendar.totalMinutes;
    });

    document.querySelectorAll(`#${collection.replace(/ /g, '_')}Table th`).forEach(th => {
        th.setAttribute('aria-sort', 'none');
    });
    thElement.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');

    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(collection, currentFilterWeek || null);
}

// Function to add a new entry to the collection
function addToCollection() {
    // Basic validation
    const errors = [];
    if (!DOM.programName.value) errors.push('Nome do Programa é obrigatório.');
    if (!DOM.processNumber.value) errors.push('Número de Processo é obrigatório.');
    if (!DOM.week.value) errors.push('Semana é obrigatória.');
    if (!DOM.day.value) errors.push('Dia é obrigatório.');
    if (!DOM.date.value) errors.push('Data é obrigatória.');
    if (!DOM.time.value) errors.push('Hora é obrigatória.');
    if (!DOM.rightsDuration.value) errors.push('Duração dos Direitos é obrigatória.');
    if (!DOM.programType.value) errors.push('Tipo de Programa é obrigatório.');
    if (!DOM.category.value) errors.push('Categoria é obrigatória.');

    // Validate date against week and day
    const dateValidationErrors = validateDateAgainstWeekAndDay(DOM.date.value, DOM.week.value, DOM.day.value);
    errors.push(...dateValidationErrors);

    if (errors.length > 0) {
        DOM.errorMessages.innerHTML = errors.join('<br>');
        return;
    }

    // Create entry object
    const baseFields = {
        collection: DOM.collection.value,
        programName: DOM.programName.value,
        processNumber: DOM.processNumber.value,
        week: DOM.week.value,
        day: DOM.day.value, // Retains original day for form consistency
        date: DOM.date.value,
        time: DOM.time.value,
        rightsDuration: DOM.rightsDuration.value,
        programType: DOM.programType.value,
        category: DOM.category.value
    };

    const entries = [];
    entries.push(baseFields);

    if (DOM.isRepeat.checked) {
        document.querySelectorAll('#repeatDays input[type="checkbox"]:checked').forEach(checkbox => {
            const repeatDay = checkbox.value;
            const repeatTimeInput = document.querySelector(`#repeatDays input[data-day="${repeatDay}"]`);
            const repeatTime = repeatTimeInput.value || DOM.time.value; // Use specific time or default

            const repeatDate = computeRepeatDate(baseFields.date, baseFields.day, repeatDay);
            
            // Validate repeat date against week and day
            const repeatDateValidationErrors = validateDateAgainstWeekAndDay(repeatDate, baseFields.week, repeatDay);
            if (repeatDateValidationErrors.length > 0) {
                DOM.errorMessages.innerHTML = `Erro na entrada repetida para ${repeatDay}: ` + repeatDateValidationErrors.join('<br>');
                return; // Stop if repeat entry is invalid
            }

            entries.push({
                ...baseFields,
                day: repeatDay,
                date: repeatDate,
                time: repeatTime,
                // Do not re-validate week, it should be the same as primary entry
            });
        });
    }

    // Add entries to collections and save
    entries.forEach(entry => {
        collections[entry.collection].push(entry);
    });

    // Render with current filter and highlight new entries
    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(baseFields.collection, currentFilterWeek || null, entries.length);
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

// Filter by week
function filterByWeek() {
    const filterWeekDropdown = DOM.filterWeek; // Use DOM object
    if (!filterWeekDropdown) {
        console.error('Filter week dropdown not found (DOM object)');
        return;
    }
    
    const selectedWeek = filterWeekDropdown.value;
    // Iterate over the keys of the global 'collections' object to apply filter
    Object.keys(collections).forEach(collectionName => {
        renderTable(collectionName, selectedWeek || null);
    });
}

// Clear filter
function clearFilter() {
    if (DOM.filterWeek) { // Use DOM object
        DOM.filterWeek.value = '';
        Object.keys(collections).forEach(collectionName => {
            renderTable(collectionName, null);
        });
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
    DOM.day.value = entry.day; // Retains original day for form consistency
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

// Populate weeks dropdown
function populateWeeksDropdown() {
    // Access dropdowns directly here as DOM is guaranteed to be ready
    const weekDropdown = DOM.week;
    const filterWeekDropdown = DOM.filterWeek;
    
    if (!weekDropdown || !filterWeekDropdown) {
        console.error('Week dropdowns not found via DOM object'); // Improved error message
        return;
    }

    // Clear existing options
    weekDropdown.innerHTML = '';
    filterWeekDropdown.innerHTML = '<option value="">Selecione uma semana</option>';

    // Add weeks to both dropdowns
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

// Populate repeat days
function populateRepeatDays() {
    if (!DOM.repeatDays) {
        console.error('Repeat days container not found');
        return;
    }
    DOM.repeatDays.innerHTML = '';
    DAYS.forEach(day => {
        if (day !== DOM.day.value) {
            const div = document.createElement('div');
            div.className = 'repeat-day';
            div.innerHTML = `
                <label for="repeat-${day}">${day}</label>
                <input type="checkbox" id="repeat-${day}" value="${day}">
                <input type="time" data-day="${day}" disabled>
            `;
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

// Constants for collections and weeks
const COLLECTIONS = ['RTP 1', 'RTP 2', 'RTP 3', 'RTP Memoria', 'RTP Africa'];
const WEEKS = [
    'Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5', 
    'Semana 6', 'Semana 7', 'Semana 8', 'Semana 9', 'Semana 10',
    'Semana 11', 'Semana 12', 'Semana 13', 'Semana 14', 'Semana 15',
    'Semana 16', 'Semana 17', 'Semana 18', 'Semana 19', 'Semana 20',
    'Semana 21', 'Semana 22', 'Semana 23', 'Semana 24', 'Semana 25',
    'Semana 26', 'Semana 27', 'Semana 28', 'Semana 29', 'Semana 30',
    'Semana 31', 'Semana 32', 'Semana 33', 'Semana 34', 'Semana 35',
    'Semana 36', 'Semana 37', 'Semana 38', 'Semana 39', 'Semana 40',
    'Semana 41', 'Semana 42', 'Semana 43', 'Semana 44', 'Semana 45',
    'Semana 46', 'Semana 47', 'Semana 48', 'Semana 49', 'Semana 50',
    'Semana 51', 'Semana 52'
];
const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

// Initialize collections
let collections = {
    'RTP 1': [],
    'RTP 2': [],
    'RTP 3': [],
    'RTP Memoria': [],
    'RTP Africa': []
};

// Declare DOM object globally; its properties will be populated in DOMContentLoaded
let DOM = {};

// Initialize application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Populate the DOM object with elements AFTER the DOM is ready
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
        filterWeek: document.getElementById('filterWeek'),
        isRepeat: document.getElementById('isRepeat'),
        repeatSection: document.getElementById('repeatSection'),
        repeatDays: document.getElementById('repeatDays')
    };

    // Critical DOM elements check: ensure global DOM object has them correctly
    if (!DOM.week || !DOM.filterWeek || !DOM.form || !DOM.isRepeat || !DOM.repeatSection || !DOM.notification || !DOM.errorMessages) {
        console.error('Critical DOM elements missing. Check HTML IDs or script loading order.');
        return;
    }

    // Initialize the application
    populateWeeksDropdown();
    loadFromLocalStorage();
    
    // Set up event listeners using the globally populated DOM object
    DOM.filterWeek.addEventListener('change', filterByWeek);
    DOM.isRepeat.addEventListener('change', () => {
        DOM.repeatSection.style.display = DOM.isRepeat.checked ? 'block' : 'none';
        if (DOM.isRepeat.checked) {
            populateRepeatDays();
        } else {
            DOM.repeatDays.innerHTML = '';
        }
    });

    DOM.day.addEventListener('change', () => {
        if (DOM.isRepeat.checked) {
            populateRepeatDays();
        }
    });
});