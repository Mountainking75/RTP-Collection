// Helper function to compute the broadcast date, day, and time for sorting and display
function getBroadcastInfo(entry) {
    const date = new Date(entry.date);
    const [hours, minutes] = entry.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // Determine broadcast day (6:00 AM to 5:59 AM)
    let broadcastDay = entry.day;
    let adjustedDate = new Date(date);
    
    // If time is before 6:00 AM, it belongs to previous broadcast day
    if (totalMinutes < 6 * 60) {
        adjustedDate.setDate(date.getDate() - 1);
        
        // Find the previous day name
        const dayIndex = (date.getDay() - 1 + 7) % 7; // Adjust for Sunday (0) to Saturday (6)
        const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        broadcastDay = days[dayIndex];
    }

    return {
        adjustedDate: adjustedDate,
        broadcastDay: broadcastDay,
        totalMinutes: totalMinutes
    };
}

// Compute week number and validate day from date based on broadcast day
function validateDateAgainstWeekAndDay(dateStr, week, day) {
    const date = new Date(dateStr);
    const [hours, minutes] = DOM.time.value.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const year = date.getFullYear();

    // Adjust date for broadcast day validation if time is between 00:00 and 05:59
    let adjustedDate = new Date(date);
    if (totalMinutes < 6 * 60 && day !== 'Domingo') {
        adjustedDate.setDate(date.getDate() - 1); // Shift to previous day
    } else if (day === 'Domingo' && totalMinutes < 6 * 60) {
        // For Sunday, keep the date but validate as part of Sunday's broadcast
        adjustedDate = new Date(date); // No shift
    }

    // Define the start of Semana 1 as December 30 of the previous year
    const semana1Start = new Date(year - 1, 11, 30); // December 30 of the previous year

    // Find the Monday of the adjusted date's week
    const dateMonday = new Date(adjustedDate);
    dateMonday.setDate(adjustedDate.getDate() - ((adjustedDate.getDay() + 6) % 7)); // Adjust to Monday

    // Calculate the number of days from Semana 1 start to the adjusted date's Monday
    const diffDays = Math.floor((dateMonday - semana1Start) / (1000 * 60 * 60 * 24));
    // Compute week number (Semana 1 starts on December 30 of the previous year)
    const computedWeekNumber = Math.floor(diffDays / 7) + 1;

    // Calculate the broadcast day of the week
    let dayOfWeek = adjustedDate.getDay();
    if (totalMinutes < 6 * 60 && day !== 'Domingo') {
        dayOfWeek = (dayOfWeek - 1 + 7) % 7;
    } else if (day === 'Domingo' && totalMinutes < 6 * 60) {
        dayOfWeek = 0; // Force to Sunday
    }
    const dayMapping = {
        1: 'Segunda-feira',
        2: 'Terça-feira',
        3: 'Quarta-feira',
        4: 'Quinta-feira',
        5: 'Sexta-feira',
        6: 'Sábado',
        0: 'Domingo'
    };
    const computedDay = dayMapping[dayOfWeek];

    // Validate
    const errors = [];
    const expectedWeekNumber = parseInt(week.split(' ')[1], 10);
    if (computedWeekNumber !== expectedWeekNumber) {
        errors.push(`A data (${dateStr} às ${DOM.time.value}) não corresponde à ${week}. Semana calculada: Semana ${computedWeekNumber}.`);
    }
    if (computedDay !== day) {
        errors.push(`A data (${dateStr} às ${DOM.time.value}) não corresponde ao dia (${day}). Dia calculado: ${computedDay}.`);
    }
    return errors;
}

// Compute date for a repeat day within the same broadcast week
function computeRepeatDate(primaryDateStr, primaryDay, repeatDay) {
    const primaryDate = new Date(primaryDateStr);
    const [hours, minutes] = DOM.time.value.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // Adjust primary date for broadcast day
    let adjustedPrimaryDate = new Date(primaryDate);
    if (totalMinutes < 6 * 60 && primaryDay !== 'Domingo') {
        adjustedPrimaryDate.setDate(primaryDate.getDate() - 1); // Shift to previous day
    } else if (primaryDay === 'Domingo' && totalMinutes < 6 * 60) {
        adjustedPrimaryDate = new Date(primaryDate); // Keep as is for Sunday
    }

    const dayOffsets = {
        'Segunda-feira': 0,
        'Terça-feira': 1,
        'Quarta-feira': 2,
        'Quinta-feira': 3,
        'Sexta-feira': 4,
        'Sábado': 5,
        'Domingo': 6
    };
    const primaryOffset = dayOffsets[primaryDay];
    const repeatOffset = dayOffsets[repeatDay];
    let dayDifference = (repeatOffset - primaryOffset + 7) % 7;

    // Adjust for broadcast day wrap-around
    const repeatDate = new Date(adjustedPrimaryDate);
    repeatDate.setDate(adjustedPrimaryDate.getDate() + dayDifference);

    // If the repeat time is before 06:00, adjust the date back one day to align with broadcast logic
    const repeatTimeMinutes = totalMinutes; // Assuming same time for repeat
    if (repeatTimeMinutes < 6 * 60 && repeatDay !== 'Domingo') {
        repeatDate.setDate(repeatDate.getDate() - 1);
    } else if (repeatDay === 'Domingo' && repeatTimeMinutes < 6 * 60) {
        // No adjustment for Sunday
    }

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

    // Sort entries by adjusted broadcast date and time
    entries = entries.sort((a, b) => {
        const aBroadcast = getBroadcastInfo(a);
        const bBroadcast = getBroadcastInfo(b);

        // First sort by adjusted date (broadcast day)
        const dateCompare = aBroadcast.adjustedDate - bBroadcast.adjustedDate;
        if (dateCompare !== 0) return dateCompare;

        // Then sort by time within the same broadcast day
        return aBroadcast.totalMinutes - bBroadcast.totalMinutes;
    });

    if (entries.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="10" class="no-results">Nenhuma entrada encontrada.</td></tr>`;
        return;
    }

    entries.forEach((entry, index) => {
        const broadcastInfo = getBroadcastInfo(entry);
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
            <td>${broadcastInfo.broadcastDay}</td>
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
            const aBroadcast = getBroadcastInfo(a);
            const bBroadcast = getBroadcastInfo(b);

            const dateCompare = aBroadcast.adjustedDate - bBroadcast.adjustedDate;
            if (dateCompare !== 0) return dateCompare;
            return aBroadcast.totalMinutes - bBroadcast.totalMinutes;
        });
        
        let content = '';
        entries.forEach(entry => {
            const broadcastInfo = getBroadcastInfo(entry);
            content += `**Nome do Programa**: ${entry.programName}\n`;
            content += `**Número de Processo**: ${entry.processNumber}\n`;
            content += `Semana: ${entry.week}\n`;
            content += `Dia: ${broadcastInfo.broadcastDay}\n`;
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
            const aBroadcast = getBroadcastInfo(a);
            const bBroadcast = getBroadcastInfo(b);

            const dateCompare = aBroadcast.adjustedDate - bBroadcast.adjustedDate;
            if (dateCompare !== 0) return dateCompare;
            return aBroadcast.totalMinutes - bBroadcast.totalMinutes;
        });
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.autoTable({
            head: [['Nome do Programa', 'Número de Processo', 'Semana', 'Dia', 'Data', 'Hora', 'Duração dos Direitos', 'Tipo de Programa', 'Categoria']],
            body: entries.map(entry => {
                const broadcastInfo = getBroadcastInfo(entry);
                return [
                    entry.programName,
                    entry.processNumber,
                    entry.week,
                    broadcastInfo.broadcastDay,
                    entry.date,
                    entry.time,
                    entry.rightsDuration,
                    entry.programType,
                    entry.category
                ];
            }),
            styles: { fontSize: 8, textColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
            columnStyles: {
                8: {
                    cellWidth: 20,
                    fontStyle: 'bold',
                    fillColor: entry => {
                        switch (entry.toUpperCase()) {
                            case 'NOVIDADE': return [40, 167, 69];
                            case 'ESTREIA': return [220, 53, 69];
                            case 'REPETIÇÃO': return [0, 123, 255];
                            default: return [255, 255, 255];
                        }
                    },
                    textColor: [0, 0, 0]
                }
            }
        });
        doc.save(`${collection}.pdf`);
    }
};

// Table sorting
function sortTable(collection, column, thElement) {
    const ascending = thElement.getAttribute('aria-sort') !== 'ascending';
    
    collections[collection].sort((a, b) => {
        const aBroadcast = getBroadcastInfo(a);
        const bBroadcast = getBroadcastInfo(b);

        // First sort by adjusted date (broadcast day)
        const dateCompare = aBroadcast.adjustedDate - bBroadcast.adjustedDate;
        if (dateCompare !== 0) return ascending ? dateCompare : -dateCompare;

        // Then sort by time within the same broadcast day
        return ascending 
            ? aBroadcast.totalMinutes - bBroadcast.totalMinutes
            : bBroadcast.totalMinutes - aBroadcast.totalMinutes;
    });

    document.querySelectorAll(`#${collection.replace(/ /g, '_')}Table th`).forEach(th => {
        th.setAttribute('aria-sort', 'none');
    });
    thElement.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');

    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(collection, currentFilterWeek || null);
}

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

    // Sort entries by adjusted broadcast date and time, with special handling for Sunday
    entries = entries.sort((a, b) => {
        const aBroadcast = getBroadcastInfo(a);
        const bBroadcast = getBroadcastInfo(b);

        const dateCompare = aBroadcast.adjustedDate - bBroadcast.adjustedDate;
        if (dateCompare !== 0) return dateCompare;

        // For Sunday, ensure 00:00-05:59 appears at the end
        if (a.day === 'Domingo' && b.day === 'Domingo') {
            if (aBroadcast.totalMinutes < 6 * 60 && bBroadcast.totalMinutes >= 6 * 60) return 1; // a after b
            if (aBroadcast.totalMinutes >= 6 * 60 && bBroadcast.totalMinutes < 6 * 60) return -1; // a before b
        }
        return aBroadcast.totalMinutes - bBroadcast.totalMinutes;
    });

    if (entries.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="10" class="no-results">Nenhuma entrada encontrada.</td></tr>`;
        return;
    }

    entries.forEach((entry, index) => {
        const broadcastInfo = getBroadcastInfo(entry);
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
            <td>${broadcastInfo.broadcastDay}</td>
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

// Export module
const exportModule = {
    toTxt(entries, collection) {
        entries = entries.sort((a, b) => {
            const aBroadcast = getBroadcastInfo(a);
            const bBroadcast = getBroadcastInfo(b);

            const dateCompare = aBroadcast.adjustedDate - bBroadcast.adjustedDate;
            if (dateCompare !== 0) return dateCompare;

            // For Sunday, ensure 00:00-05:59 appears at the end
            if (a.day === 'Domingo' && b.day === 'Domingo') {
                if (aBroadcast.totalMinutes < 6 * 60 && bBroadcast.totalMinutes >= 6 * 60) return 1; // a after b
                if (aBroadcast.totalMinutes >= 6 * 60 && bBroadcast.totalMinutes < 6 * 60) return -1; // a before b
            }
            return aBroadcast.totalMinutes - bBroadcast.totalMinutes;
        });
        let content = '';
        entries.forEach(entry => {
            content += `**Nome do Programa**: ${entry.programName}\n`;
            content += `**Número de Processo**: ${entry.processNumber}\n`;
            content += `Semana: ${entry.week}\n`;
            content += `Dia: ${getBroadcastInfo(entry).broadcastDay}\n`; // Use broadcast day
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
            const aBroadcast = getBroadcastInfo(a);
            const bBroadcast = getBroadcastInfo(b);

            const dateCompare = aBroadcast.adjustedDate - bBroadcast.adjustedDate;
            if (dateCompare !== 0) return dateCompare;

            // For Sunday, ensure 00:00-05:59 appears at the end
            if (a.day === 'Domingo' && b.day === 'Domingo') {
                if (aBroadcast.totalMinutes < 6 * 60 && bBroadcast.totalMinutes >= 6 * 60) return 1; // a after b
                if (aBroadcast.totalMinutes >= 6 * 60 && bBroadcast.totalMinutes < 6 * 60) return -1; // a before b
            }
            return aBroadcast.totalMinutes - bBroadcast.totalMinutes;
        });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.autoTable({
            head: [['Nome do Programa', 'Número de Processo', 'Semana', 'Dia', 'Data', 'Hora', 'Duração dos Direitos', 'Tipo de Programa', 'Categoria']],
            body: entries.map(entry => [
                entry.programName,
                entry.processNumber,
                entry.week,
                getBroadcastInfo(entry).broadcastDay, // Use broadcast day
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
        const aBroadcast = getBroadcastInfo(a);
        const bBroadcast = getBroadcastInfo(b);

        const dateCompare = aBroadcast.adjustedDate - bBroadcast.adjustedDate;
        if (dateCompare !== 0) return dateCompare;

        // For Sunday, ensure 00:00-05:59 appears at the end
        if (a.day === 'Domingo' && b.day === 'Domingo') {
            if (aBroadcast.totalMinutes < 6 * 60 && bBroadcast.totalMinutes >= 6 * 60) return 1; // a after b
            if (aBroadcast.totalMinutes >= 6 * 60 && bBroadcast.totalMinutes < 6 * 60) return -1; // a before b
        }
        return aBroadcast.totalMinutes - bBroadcast.totalMinutes;
    });

    document.querySelectorAll(`#${collection.replace(/ /g, '_')}Table th`).forEach(th => {
        th.setAttribute('aria-sort', 'none');
    });
    thElement.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');

    const currentFilterWeek = DOM.filterWeek.value;
    renderTable(collection, currentFilterWeek || null);
}

// Populate weeks dropdown
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!DOM.week || !DOM.filterWeek || !DOM.form || !DOM.isRepeat || !DOM.repeatSection) {
        console.error('Critical DOM elements missing');
        return;
    }
    populateWeeksDropdown();
    loadFromLocalStorage();
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