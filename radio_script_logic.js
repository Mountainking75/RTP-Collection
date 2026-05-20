// ===== CONSTANTS & STATE =====
const showDuration = 3600; // 1 hour in seconds
const MAX_HISTORY = 50;
const STORAGE_PREFIX = 'radioscript_v1__';

let totalSeconds = 0;
let editingRowIndex = null;
let previousDuration = 0;
let historyStack = [];
let redoStack = [];
let dragStartIndex = null;

const jingleDurations = {
    'jingle_entrada':  { duration: '0:58', content: 'Jingle de Entrada' },
    'jingle_fecho':    { duration: '0:23', content: 'Jingle de Fecho' },
    'jingle_3':        { duration: '0:03', content: 'Jingle 3' },
    'jingle_4':        { duration: '0:03', content: 'Jingle 4' },
    'separador_3':     { duration: '0:20', content: 'Separador 3' },
    'separador_6':     { duration: '0:15', content: 'Separador 6' },
    'voice-over_promo': {
        duration: '0:30',
        content: 'Dúvidas e sugestões enviem email para jorge.botas@rtp.pt. Podem passar por metalglobal.pt. Podem-me seguir no Twitter e Instagram em @Mountainking. Podem fazer like na página de Facebook do Metal Global e podem também seguir o Metal Global podcast em Apple Podcasts, Spotify e YouTube Music.'
    },
    'voice-over': { duration: '0:30', content: 'Custom voice-over content' }
};

// ===== UTILITY FUNCTIONS =====

function formatTime(seconds) {
    const hrs  = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Derive the content type stored in data-content-type attribute
function getBaseType(contentTypeValue) {
    const isJingle = contentTypeValue.startsWith('jingle_') || contentTypeValue.startsWith('separador_');
    if (isJingle) return 'jingle';
    if (contentTypeValue === 'voice-over_promo') return 'voice-over';
    return contentTypeValue;
}

// ===== ROW FACTORY — single source of truth for building table rows =====

/**
 * Creates a fully-formed <tr> element.
 * @param {object} opts
 * @param {number}  opts.index          - Row index (0-based)
 * @param {string}  opts.contentType    - Full content type key (e.g. 'voice-over_promo')
 * @param {string}  opts.content        - Text content
 * @param {string}  opts.duration       - Duration string (e.g. '0:30')
 * @param {string}  [opts.accumulated]  - Accumulated time string (optional)
 */
function createTableRow({ index, contentType, content, duration, accumulated = '' }) {
    const baseType = getBaseType(contentType);

    const row = document.createElement('tr');
    row.className = baseType;
    row.tabIndex = 0;
    row.draggable = true;
    row.dataset.contentType = contentType; // store exact type — no fragile content-matching
    row.ondragstart = dragStart;
    row.ondragover  = dragOver;
    row.ondrop      = drop;
    row.onkeydown   = handleRowKeydown;

    // Cell 0: row number
    const numCell = row.insertCell(0);
    numCell.textContent = index + 1;

    // Cell 1: display type label
    const typeCell = row.insertCell(1);
    typeCell.textContent = baseType.replace('-', ' ').toUpperCase();

    // Cell 2: content
    const contentCell = row.insertCell(2);
    if (contentType === 'voice-over' || contentType === 'voice-over_promo') {
        const textarea = document.createElement('textarea');
        textarea.value    = content;
        textarea.readOnly = true;
        contentCell.appendChild(textarea);
        // defer resize so the element is in the DOM
        requestAnimationFrame(() => autoResizeTextarea(textarea));
    } else {
        contentCell.textContent = content;
    }

    // Cell 3: duration
    row.insertCell(3).textContent = duration;

    // Cell 4: accumulated
    row.insertCell(4).textContent = accumulated;

    // Cell 5: action buttons
    const actionCell = row.insertCell(5);
    actionCell.appendChild(makeBtn('Edit',      'edit-btn',      `Edit row ${index + 1}`,      () => editRow(row, row.rowIndex - 1)));
    actionCell.appendChild(makeBtn('Duplicate', 'duplicate-btn', `Duplicate row ${index + 1}`, () => duplicateRow(row.rowIndex - 1)));
    actionCell.appendChild(makeBtn('Delete',    'delete-btn',    `Delete row ${index + 1}`,    () => deleteRow(row.rowIndex - 1)));
    actionCell.appendChild(makeBtn('↑',         'move-btn',      `Move row ${index + 1} up`,   () => moveRow(row.rowIndex - 1, 'up')));
    actionCell.appendChild(makeBtn('↓',         'move-btn',      `Move row ${index + 1} down`, () => moveRow(row.rowIndex - 1, 'down')));

    return row;
}

function makeBtn(text, className, ariaLabel, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className   = className;
    btn.setAttribute('aria-label', ariaLabel);
    btn.onclick = onClick;
    return btn;
}

// ===== TABLE HELPERS =====

function renumberRows() {
    const rows = document.getElementById('scriptTableBody')?.rows;
    if (!rows) return;
    let dataIndex = 0;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].dataset.nonData) continue;
        rows[i].cells[0].textContent = ++dataIndex;
    }
}

function recalculateAccumulatedTimes() {
    let acc = 0;
    const rows = document.getElementById('scriptTableBody')?.rows;
    if (rows) {
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].dataset.nonData) continue;
            acc += parseTime(rows[i].cells[3].textContent);
            rows[i].cells[4].textContent = formatTime(acc);
        }
        totalSeconds = acc;
    }
    updateTimeDisplay();
    updatePreview();
}

function updateTimeDisplay() {
    const timeUsed      = document.getElementById('timeUsed');
    const timeRemaining = document.getElementById('timeRemaining');
    if (timeUsed)      timeUsed.textContent      = formatTime(totalSeconds);
    if (timeRemaining) timeRemaining.textContent = formatTime(showDuration - totalSeconds);
}

// Re-attach dynamic onclick handlers after DOM manipulation (drag/move)
function updateRowEventListeners() {
    const rows = document.getElementById('scriptTableBody')?.rows;
    if (!rows) return;
    let dataIndex = 0;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.dataset.nonData) continue;
        const actionCell = row.cells[5];
        row.tabIndex  = 0;
        row.draggable = true;
        row.ondragstart = dragStart;
        row.ondragover  = dragOver;
        row.ondrop      = drop;
        row.onkeydown   = handleRowKeydown;

        const [editBtn, dupBtn, delBtn, upBtn, downBtn] = actionCell.children;
        if (editBtn)  { editBtn.onclick  = () => editRow(row, i); editBtn.setAttribute('aria-label',  `Edit row ${dataIndex + 1}`); }
        if (dupBtn)   { dupBtn.onclick   = () => duplicateRow(i); dupBtn.setAttribute('aria-label',   `Duplicate row ${dataIndex + 1}`); }
        if (delBtn)   { delBtn.onclick   = () => deleteRow(i);    delBtn.setAttribute('aria-label',   `Delete row ${dataIndex + 1}`); }
        if (upBtn)    { upBtn.onclick    = () => moveRow(i, 'up'); upBtn.setAttribute('aria-label',   `Move row ${dataIndex + 1} up`); }
        if (downBtn)  { downBtn.onclick  = () => moveRow(i, 'down'); downBtn.setAttribute('aria-label', `Move row ${dataIndex + 1} down`); }
        dataIndex++;
    }
}

// ===== HISTORY (UNDO / REDO) =====

function saveToHistory(action, data) {
    historyStack.push({ action, data });
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    redoStack = [];
    _syncUndoRedoBtns();
    silentSave();
}

function _syncUndoRedoBtns() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = historyStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function undo() {
    if (historyStack.length === 0) return;
    const entry = historyStack.pop();
    redoStack.push(entry);
    _applyHistoryEntry(entry, 'undo');
}

function redo() {
    if (redoStack.length === 0) return;
    const entry = redoStack.pop();
    historyStack.push(entry);
    _applyHistoryEntry(entry, 'redo');
}

function _applyHistoryEntry({ action, data }, direction) {
    const tableBody = document.getElementById('scriptTableBody');
    if (!tableBody) return;

    if (action === 'add' || action === 'duplicate') {
        if (direction === 'undo') {
            totalSeconds -= parseTime(tableBody.rows[data.index].cells[3].textContent);
            tableBody.deleteRow(data.index);
            showToast('Row removed');
        } else {
            const row = createTableRow({ index: data.index, contentType: data.contentType, content: data.content, duration: data.duration });
            tableBody.insertBefore(row, tableBody.rows[data.index] || null);
            totalSeconds += parseTime(data.duration);
            showToast(action === 'add' ? 'Row added' : 'Row duplicated');
        }
    } else if (action === 'edit') {
        const row = tableBody.rows[data.index];
        const applyType    = direction === 'undo' ? data.oldContentType : data.newContentType;
        const applyContent = direction === 'undo' ? data.oldContent     : data.newContent;
        const applyDur     = direction === 'undo' ? data.oldDuration    : data.newDuration;
        const applyDurTxt  = direction === 'undo' ? data.oldDurationText: data.newDuration;

        totalSeconds = totalSeconds - parseTime(row.cells[3].textContent) + parseTime(applyDur);
        const baseType = getBaseType(applyType);
        row.className = baseType;
        row.dataset.contentType = applyType;
        row.cells[1].textContent = baseType.replace('-', ' ').toUpperCase();

        const contentCell = row.cells[2];
        contentCell.innerHTML = '';
        if (applyType === 'voice-over' || applyType === 'voice-over_promo') {
            const ta = document.createElement('textarea');
            ta.value = applyContent; ta.readOnly = true;
            contentCell.appendChild(ta);
            autoResizeTextarea(ta);
        } else {
            contentCell.textContent = applyContent;
        }
        row.cells[3].textContent = applyDurTxt;
        showToast(direction === 'undo' ? 'Edit undone' : 'Edit redone');

    } else if (action === 'delete') {
        if (direction === 'undo') {
            const row = createTableRow({ index: data.index, contentType: data.contentType, content: data.content, duration: data.duration });
            tableBody.insertBefore(row, tableBody.rows[data.index] || null);
            totalSeconds += parseTime(data.duration);
            showToast('Row restored');
        } else {
            totalSeconds -= parseTime(tableBody.rows[data.index].cells[3].textContent);
            tableBody.deleteRow(data.index);
            showToast('Row deleted');
        }
    } else if (action === 'reorder') {
        const from = direction === 'undo' ? data.toIndex   : data.fromIndex;
        const to   = direction === 'undo' ? data.fromIndex : data.toIndex;
        const row  = tableBody.rows[from];
        const clone = row.cloneNode(true);
        tableBody.deleteRow(from);
        tableBody.insertBefore(clone, tableBody.rows[to] || null);
        showToast('Reorder ' + (direction === 'undo' ? 'undone' : 'redone'));
    }

    renumberRows();
    recalculateAccumulatedTimes();
    updateRowEventListeners();
    _syncUndoRedoBtns();
}

// ===== VALIDATION =====

function validateInputs() {
    const contentText = document.getElementById('contentText')?.value.trim();
    const duration    = document.getElementById('duration')?.value.trim();
    const addBtn  = document.getElementById('addBtn');
    const saveBtn = document.getElementById('saveBtn');
    const isValid = !!(contentText && duration && parseTime(duration) > 0);
    if (addBtn)  addBtn.disabled  = !isValid;
    if (saveBtn) saveBtn.disabled = !isValid;
}

// ===== FORM HANDLERS =====

function handleContentTypeChange() {
    const contentTypeSelect = document.getElementById('contentType');
    const contentInput      = document.getElementById('contentText');
    const durationInput     = document.getElementById('duration');
    if (!contentTypeSelect || !contentInput || !durationInput) return;

    const contentType = contentTypeSelect.value;
    contentInput.value      = '';
    durationInput.value     = '';
    durationInput.readOnly  = false;

    if (jingleDurations[contentType]) {
        contentInput.value     = jingleDurations[contentType].content;
        durationInput.value    = jingleDurations[contentType].duration;
        durationInput.readOnly = true;
        if (contentType === 'voice-over_promo') {
            requestAnimationFrame(() => autoResizeTextarea(contentInput));
        }
    }
    validateInputs();
}

// ===== CRUD OPERATIONS =====

function addRow() {
    const contentTypeValue = document.getElementById('contentType').value;
    const contentText      = document.getElementById('contentText').value.trim();
    const duration         = document.getElementById('duration').value.trim();

    if (!contentText || !contentTypeValue || !duration) { showToast('Please fill in all fields'); return; }
    const durationSeconds = parseTime(duration);
    if (durationSeconds <= 0) { showToast('Invalid duration'); return; }
    if (totalSeconds + durationSeconds > showDuration) { showToast('Duration exceeds 1 hour'); return; }

    totalSeconds += durationSeconds;

    const tableBody = document.getElementById('scriptTableBody');
    const index     = tableBody.rows.length;
    const row = createTableRow({ index, contentType: contentTypeValue, content: contentText, duration });
    row.cells[4].textContent = formatTime(totalSeconds);
    tableBody.appendChild(row);

    saveToHistory('add', { index, contentType: contentTypeValue, content: contentText, duration });
    showToast('Row added');

    updateTimeDisplay();
    document.getElementById('contentText').value   = '';
    document.getElementById('duration').value      = '';
    document.getElementById('duration').readOnly   = false;
    validateInputs();
}

function editRow(row, index) {
    editingRowIndex  = index;
    previousDuration = parseTime(row.cells[3].textContent);
    const contentType = row.dataset.contentType || row.className;

    const contentTypeSelect = document.getElementById('contentType');
    const contentTextInput  = document.getElementById('contentText');
    const durationInput     = document.getElementById('duration');
    if (!contentTypeSelect || !contentTextInput || !durationInput) return;

    contentTypeSelect.value    = contentType;
    contentTextInput.value     = row.cells[2].querySelector('textarea')?.value || row.cells[2].textContent;
    durationInput.value        = row.cells[3].textContent;
    durationInput.readOnly     = !!jingleDurations[contentType];

    document.getElementById('addBtn').style.display    = 'none';
    document.getElementById('saveBtn').style.display   = 'inline-block';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    // Resize textarea if voice-over
    requestAnimationFrame(() => autoResizeTextarea(document.getElementById('contentText')));
    validateInputs();
}

function saveEdit() {
    const contentTypeValue = document.getElementById('contentType').value;
    const contentText      = document.getElementById('contentText').value.trim();
    const duration         = document.getElementById('duration').value.trim();

    if (!contentText || !contentTypeValue || !duration) { showToast('Please fill in all fields'); return; }
    const durationSeconds = parseTime(duration);
    if (durationSeconds <= 0) { showToast('Invalid duration'); return; }

    const newTotal = totalSeconds - previousDuration + durationSeconds;
    if (newTotal > showDuration) { showToast('Duration exceeds 1 hour'); return; }
    totalSeconds = newTotal;

    const tableBody = document.getElementById('scriptTableBody');
    const row       = tableBody.rows[editingRowIndex];

    const oldContentType  = row.dataset.contentType || row.className;
    const oldContent      = row.cells[2].querySelector('textarea')?.value || row.cells[2].textContent;
    const oldDurationText = row.cells[3].textContent;

    const baseType = getBaseType(contentTypeValue);
    row.className = baseType;
    row.dataset.contentType = contentTypeValue;
    row.cells[1].textContent = baseType.replace('-', ' ').toUpperCase();

    const contentCell = row.cells[2];
    contentCell.innerHTML = '';
    if (contentTypeValue === 'voice-over' || contentTypeValue === 'voice-over_promo') {
        const ta = document.createElement('textarea');
        ta.value = contentText; ta.readOnly = true;
        contentCell.appendChild(ta);
        autoResizeTextarea(ta);
    } else {
        contentCell.textContent = contentText;
    }
    row.cells[3].textContent = duration;

    saveToHistory('edit', {
        index: editingRowIndex,
        oldContentType, oldContent, oldDuration: previousDuration, oldDurationText,
        newContentType: contentTypeValue, newContent: contentText, newDuration: duration
    });
    showToast('Row updated');
    recalculateAccumulatedTimes();
    cancelEdit();
}

function duplicateRow(index) {
    const tableBody       = document.getElementById('scriptTableBody');
    const row             = tableBody.rows[index];
    const contentType     = row.dataset.contentType || row.className;
    const content         = row.cells[2].querySelector('textarea')?.value || row.cells[2].textContent;
    const duration        = row.cells[3].textContent;
    const durationSeconds = parseTime(duration);

    if (!durationSeconds || totalSeconds + durationSeconds > showDuration) {
        showToast('Total duration exceeds 1 hour'); return;
    }
    totalSeconds += durationSeconds;

    const newIndex = index + 1;
    const newRow   = createTableRow({ index: newIndex, contentType, content, duration });
    tableBody.insertBefore(newRow, tableBody.rows[newIndex] || null);

    saveToHistory('duplicate', { index: newIndex, contentType, content, duration });
    showToast('Row duplicated');

    renumberRows();
    recalculateAccumulatedTimes();
}

function deleteRow(index) {
    if (!confirm('Are you sure you want to delete this row?')) return;
    const tableBody = document.getElementById('scriptTableBody');
    const row       = tableBody.rows[index];
    const duration  = parseTime(row.cells[3].textContent);
    const data = {
        index,
        contentType: row.dataset.contentType || row.className,
        content:     row.cells[2].querySelector('textarea')?.value || row.cells[2].textContent,
        duration:    row.cells[3].textContent
    };
    totalSeconds -= duration;
    tableBody.deleteRow(index);
    saveToHistory('delete', data);
    renumberRows();
    recalculateAccumulatedTimes();
    showToast('Row deleted');
}

function cancelEdit() {
    editingRowIndex  = null;
    previousDuration = 0;
    document.getElementById('contentText').value   = '';
    document.getElementById('duration').value      = '';
    document.getElementById('duration').readOnly   = false;
    document.getElementById('addBtn').style.display    = 'inline-block';
    document.getElementById('saveBtn').style.display   = 'none';
    document.getElementById('cancelBtn').style.display = 'none';
    validateInputs();
}

// Silent version — used internally without confirm dialog
function _clearAllSilent() {
    document.getElementById('scriptTableBody').innerHTML = '';
    document.getElementById('showNumber').value = '';
    document.getElementById('showName').value   = '';
    totalSeconds  = 0;
    historyStack  = [];
    redoStack     = [];
    _syncUndoRedoBtns();
    updateTimeDisplay();
    updatePreview();
}

function clearAll() {
    if (!confirm('Are you sure you want to clear all rows?')) return;
    _clearAllSilent();
    silentSave();
    showToast('All rows cleared');
}

// ===== DRAG & DROP =====

function dragStart(e) {
    dragStartIndex = Array.from(e.currentTarget.parentNode.children).indexOf(e.currentTarget);
    e.dataTransfer.setData('text/plain', dragStartIndex);
    e.dataTransfer.effectAllowed = 'move';
}

function dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function drop(e) {
    e.preventDefault();
    const targetRow    = e.currentTarget.tagName === 'TR' ? e.currentTarget : e.target.closest('tr');
    if (!targetRow) return;
    const dragEndIndex = Array.from(targetRow.parentNode.children).indexOf(targetRow);
    if (dragStartIndex === dragEndIndex || dragStartIndex === null) return;

    const tableBody = document.getElementById('scriptTableBody');
    const row       = tableBody.rows[dragStartIndex];
    const clone     = row.cloneNode(true);
    tableBody.deleteRow(dragStartIndex);
    tableBody.insertBefore(clone, tableBody.rows[dragEndIndex] || null);

    saveToHistory('reorder', { fromIndex: dragStartIndex, toIndex: dragEndIndex });
    showToast('Rows reordered');
    dragStartIndex = null;

    renumberRows();
    recalculateAccumulatedTimes();
    updateRowEventListeners();
}

// ===== KEYBOARD NAVIGATION =====

function handleRowKeydown(e) {
    const index = e.currentTarget.rowIndex - 1;
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        editRow(e.currentTarget, index);
    } else if (e.key === 'ArrowUp' && index > 0) {
        e.preventDefault();
        moveRow(index, 'up');
        document.getElementById('scriptTableBody').rows[index - 1]?.focus();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveRow(index, 'down');
        document.getElementById('scriptTableBody').rows[index + 1]?.focus();
    } else if (e.key === 'Delete') {
        e.preventDefault();
        deleteRow(index);
    }
}

function moveRow(index, direction) {
    const tableBody = document.getElementById('scriptTableBody');
    if (direction === 'up'   && index === 0)                          return;
    if (direction === 'down' && index === tableBody.rows.length - 1)  return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const row      = tableBody.rows[index];
    const clone    = row.cloneNode(true);
    tableBody.deleteRow(index);
    tableBody.insertBefore(clone, tableBody.rows[newIndex] || null);

    saveToHistory('reorder', { fromIndex: index, toIndex: newIndex });
    renumberRows();
    recalculateAccumulatedTimes();
    updateRowEventListeners();
    showToast('Row moved');
}

// ===== LIVE PREVIEW (no-op if element absent) =====

function updatePreview() {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    const rows = document.getElementById('scriptTableBody').rows;
    let acc  = 0;
    let html = '';

    for (let i = 0; i < rows.length; i++) {
        if (rows[i].dataset.nonData === 'segment') {
            html += `<div class="preview-segment">${rows[i].cells[0].textContent}</div>`;
            continue;
        }
        if (rows[i].dataset.nonData === 'note') {
            html += `<div class="preview-note">${rows[i].cells[0].textContent}</div>`;
            continue;
        }
        const cells   = rows[i].cells;
        const type    = cells[1].textContent;
        const content = cells[2].querySelector('textarea')?.value || cells[2].textContent;
        const dur     = cells[3].textContent;
        acc += parseTime(dur);
        html += `
            <div class="preview-item">
                <div class="preview-time">${formatTime(acc - parseTime(dur))}</div>
                <div class="preview-type">${type} (${dur})</div>
                <div class="preview-content">${content.replace(/\n/g, '<br>')}</div>
            </div><hr>`;
    }
    previewContent.innerHTML = html || '<p>Nenhum conteúdo adicionado.</p>';
}

// ===== LOCAL STORAGE =====

/**
 * Build a safe storage key.
 * Encodes showNumber and showName so underscores/special chars don't break parsing.
 */
function buildStorageKey(showNumber, showName) {
    return STORAGE_PREFIX + encodeURIComponent(showNumber) + '__' + encodeURIComponent(showName);
}

function parseStorageKey(key) {
    if (!key.startsWith(STORAGE_PREFIX)) return null;
    const rest   = key.slice(STORAGE_PREFIX.length);
    const sep    = rest.indexOf('__');
    if (sep === -1) return null;
    return {
        showNumber: decodeURIComponent(rest.slice(0, sep)),
        showName:   decodeURIComponent(rest.slice(sep + 2))
    };
}

// Saves without asking questions — used after every mutation
function silentSave() {
    try {
        const showNumber = document.getElementById('showNumber').value.trim();
        const showName   = document.getElementById('showName').value.trim();
        const rows       = document.getElementById('scriptTableBody').rows;
        if (!showNumber || !showName || rows.length === 0) return;

        const scriptData = {
            showNumber, showName,
            rows: Array.from(rows).filter(r => !r.dataset.nonData).map(row => ({
                contentType: row.dataset.contentType || row.className,
                content:     row.cells[2].querySelector('textarea')?.value || row.cells[2].textContent,
                duration:    row.cells[3].textContent
            })),
            totalSeconds
        };
        localStorage.setItem(buildStorageKey(showNumber, showName), JSON.stringify(scriptData));
        updateSavedScripts();
    } catch (err) {
        console.error('Error saving to localStorage:', err);
    }
}

// Public "Save" button — explicit user action
function saveToLocalStorage() {
    const showNumber = document.getElementById('showNumber').value.trim();
    const showName   = document.getElementById('showName').value.trim();
    const rows       = document.getElementById('scriptTableBody').rows;
    if (!showNumber || !showName) { showToast('Enter a Show Number and Show Name first'); return; }
    if (rows.length === 0)        { showToast('Nothing to save — add some rows first');   return; }
    silentSave();
    showToast('Show saved');
}

function updateSavedScripts() {
    const dropdown = document.getElementById('showHistory');
    if (!dropdown) return;
    const current = dropdown.value;
    dropdown.innerHTML = '<option value="">-- New Script --</option>';

    for (let i = 0; i < localStorage.length; i++) {
        const key    = localStorage.key(i);
        const parsed = parseStorageKey(key);
        if (!parsed) continue;
        const option = document.createElement('option');
        option.value       = key;
        option.textContent = `${parsed.showNumber} - ${parsed.showName}`;
        dropdown.appendChild(option);
    }
    // restore selection if still present
    if (current && dropdown.querySelector(`option[value="${CSS.escape(current)}"]`)) {
        dropdown.value = current;
    }
}

function loadScript() {
    const key = document.getElementById('showHistory').value;
    if (!key) {
        // "New Script" selected — clear without confirm dialog
        _clearAllSilent();
        return;
    }

    const scriptData = JSON.parse(localStorage.getItem(key));
    if (!scriptData) return;

    _clearAllSilent();
    document.getElementById('showNumber').value = scriptData.showNumber;
    document.getElementById('showName').value   = scriptData.showName;

    const tableBody = document.getElementById('scriptTableBody');
    for (const rowData of scriptData.rows) {
        const index = tableBody.rows.length;
        const row   = createTableRow({
            index,
            contentType: rowData.contentType || rowData.type, // backwards compat
            content:     rowData.content,
            duration:    rowData.duration
        });
        tableBody.appendChild(row);
        totalSeconds += parseTime(rowData.duration);
    }

    recalculateAccumulatedTimes();
    showToast('Script loaded');
}

function deleteSavedScript() {
    const dropdown = document.getElementById('showHistory');
    const key      = dropdown.value;
    if (!key || !key.startsWith(STORAGE_PREFIX)) {
        showToast('No saved script selected for deletion'); return;
    }
    const label = dropdown.options[dropdown.selectedIndex].text;
    if (!confirm(`Delete saved script "${label}"?`)) return;
    localStorage.removeItem(key);
    updateSavedScripts();
    _clearAllSilent();
    showToast('Saved script deleted');
}

// ===== EXPORT =====

function exportToText() {
    try {
        const showNumber = document.getElementById('showNumber').value || 'Unknown';
        const showName   = document.getElementById('showName').value   || 'Untitled';
        const rows       = document.getElementById('scriptTableBody').rows;

        const dataRows = Array.from(rows).filter(r => !r.dataset.nonData);
        if (dataRows.length === 0) { showToast('Nenhum conteúdo para exportar'); return; }

        let output  = `METAL GLOBAL — #${showNumber} — ${showName}\n`;
        output     += `Tempo utilizado: ${formatTime(totalSeconds)} | Restante: ${formatTime(showDuration - totalSeconds)}\n`;
        output     += '='.repeat(100) + '\n\n';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.dataset.nonData === 'segment') {
                output += `\n${'─'.repeat(80)}\n${row.cells[0].textContent}\n${'─'.repeat(80)}\n`;
                continue;
            }
            if (row.dataset.nonData === 'note') {
                output += `  ↳ ${row.cells[0].textContent}\n`;
                continue;
            }
            const cells    = row.cells;
            const num      = cells[0].textContent.toString().padEnd(3);
            const type     = cells[1].textContent.padEnd(15);
            const duration = cells[3].textContent.padEnd(8);
            const accum    = cells[4].textContent.padEnd(8);
            const content  = cells[2].querySelector('textarea')?.value || cells[2].textContent;
            output        += `${num} ${type} ${duration} [${accum}] ${content}\n\n`;
        }

        const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `script_${showNumber}_${showName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Script exportado');
    } catch (err) {
        console.error('Error exporting script:', err);
        showToast('Erro ao exportar');
    }
}

function exportToPDF() {
    try {
        const jsPDF = window.jspdf?.jsPDF || window.jspdf?.default || window.jsPDF;
        if (!jsPDF) throw new Error('jsPDF não disponível.');

        const doc        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const showName   = document.getElementById('showName').value   || 'Untitled';
        const showNumber = document.getElementById('showNumber').value || '000';
        const pageW      = 210;
        const marginL    = 14;
        const contentW   = pageW - marginL * 2;

        // ── Colours ──
        const RED    = [139, 0, 0];
        const DARK   = [26, 26, 46];
        const WHITE  = [255, 255, 255];
        const LGREY  = [245, 245, 245];
        const MGREY  = [200, 200, 200];
        const DGREY  = [80, 80, 80];

        // ── Column layout ──
        const colTime  = marginL;
        const colType  = marginL + 18;
        const colAcc   = marginL + 44;
        const colCont  = marginL + 62;
        const wTime    = 17;
        const wType    = 25;
        const wAcc     = 17;
        const wCont    = contentW - 62;

        function drawHeader() {
            // Red bar
            doc.setFillColor(...RED);
            doc.rect(0, 0, pageW, 20, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18); doc.setTextColor(...WHITE);
            doc.text('METAL GLOBAL', marginL, 13);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text(`Script de Emissão — Episódio #${showNumber} — ${showName}`, pageW - marginL, 13, { align: 'right' });

            // Meta row
            doc.setFillColor(...DARK);
            doc.rect(0, 20, pageW, 10, 'F');
            doc.setFontSize(8); doc.setTextColor(...WHITE);
            doc.text(`Apresentador: Jorge Botas  ·  jorge.botas@rtp.pt  ·  metalglobal.pt  ·  @Mountainking`, marginL, 26);
            doc.text(`Tempo: ${formatTime(totalSeconds)}  |  Restante: ${formatTime(showDuration - totalSeconds)}`, pageW - marginL, 26, { align: 'right' });
        }

        function drawTableHeader(yPos) {
            doc.setFillColor(...DARK);
            doc.rect(marginL, yPos, contentW, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8); doc.setTextColor(...WHITE);
            doc.text('TEMPO',     colTime  + 1, yPos + 5);
            doc.text('TIPO',      colType  + 1, yPos + 5);
            doc.text('ACUM.',     colAcc   + 1, yPos + 5);
            doc.text('CONTEÚDO / LOCUÇÃO', colCont + 1, yPos + 5);
            return yPos + 7;
        }

        function drawFooter(pageNum) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7); doc.setTextColor(...DGREY);
            doc.text(`Metal Global #${showNumber}  ·  Gerado em ${new Date().toLocaleString('pt-PT')}  ·  metalglobal.pt`, pageW / 2, 291, { align: 'center' });
            doc.text(`Pág. ${pageNum}`, pageW - marginL, 291, { align: 'right' });
        }

        // Init first page
        let pageNum = 1;
        drawHeader();
        let y = 38;
        y = drawTableHeader(y);

        const rows    = document.getElementById('scriptTableBody').rows;
        const lineH   = 4.5;
        const padV    = 2.5;
        const pageEnd = 284;
        let rowIndex  = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // ── Segment header row ──
            if (row.dataset.nonData === 'segment') {
                const segH = 6;
                if (y + segH > pageEnd) {
                    drawFooter(pageNum++);
                    doc.addPage();
                    drawHeader();
                    y = 38;
                    y = drawTableHeader(y);
                }
                doc.setFillColor(...RED);
                doc.rect(marginL, y, contentW, segH, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8); doc.setTextColor(...WHITE);
                doc.text(row.cells[0].textContent, marginL + 2, y + 4.2);
                y += segH;
                continue;
            }

            // ── Note row ──
            if (row.dataset.nonData === 'note') {
                const noteText = row.cells[0].textContent;
                const noteSplit = doc.splitTextToSize(noteText, contentW - 6);
                const noteH = padV + noteSplit.length * lineH + padV;
                if (y + noteH > pageEnd) {
                    drawFooter(pageNum++);
                    doc.addPage();
                    drawHeader();
                    y = 38;
                    y = drawTableHeader(y);
                }
                doc.setFillColor(255, 248, 248);
                doc.rect(marginL, y, contentW, noteH, 'F');
                doc.setDrawColor(...RED);
                doc.setLineWidth(0.8);
                doc.line(marginL, y, marginL, y + noteH);
                doc.setLineWidth(0.2);
                doc.setDrawColor(...MGREY);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(7.5); doc.setTextColor(...DGREY);
                doc.text(noteSplit, marginL + 3, y + padV + lineH - 0.5);
                y += noteH;
                continue;
            }

            // ── Data row ──
            const cells   = row.cells;
            const type    = cells[1].textContent;
            const content = cells[2].querySelector('textarea')?.value || cells[2].textContent;
            const dur     = cells[3].textContent;
            const accum   = cells[4].textContent;

            const contentSplit = doc.splitTextToSize(content, wCont - 3);
            const rowH = padV + contentSplit.length * lineH + padV;

            if (y + rowH > pageEnd) {
                drawFooter(pageNum++);
                doc.addPage();
                drawHeader();
                y = 38;
                y = drawTableHeader(y);
            }

            // Row background
            const isVoice = type.includes('VOICE') || type.includes('OVER');
            const isSong  = type.includes('SONG') || type.includes('MÚSICA') || type.includes('MUSICA');
            const isJing  = type.includes('JINGLE') || type.includes('SEPAR');
            const isInter = type.includes('INTERVIEW') || type.includes('ENTREV');

            if      (isVoice) doc.setFillColor(235, 245, 255);
            else if (isSong)  doc.setFillColor(235, 255, 235);
            else if (isJing)  doc.setFillColor(255, 253, 225);
            else if (isInter) doc.setFillColor(255, 243, 230);
            else              doc.setFillColor(rowIndex % 2 === 0 ? 250 : 255, 250, 250);

            doc.rect(marginL, y, contentW, rowH, 'F');

            // Cell borders (light)
            doc.setDrawColor(...MGREY);
            doc.setLineWidth(0.2);
            doc.rect(marginL, y, contentW, rowH);

            const textY = y + padV + lineH - 0.5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8); doc.setTextColor(...DARK);
            doc.text(dur,   colTime + 1, textY);
            doc.text(type,  colType + 1, textY, { maxWidth: wType - 2 });
            doc.setTextColor(...DGREY);
            doc.text(accum, colAcc  + 1, textY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...DARK);
            doc.text(contentSplit, colCont + 1, textY, { maxWidth: wCont - 3 });

            y += rowH;
            rowIndex++;
        }

        drawFooter(pageNum);
        doc.save(`Script_${showNumber}_${showName.replace(/ /g, '_')}.pdf`);
        showToast('PDF exportado com sucesso ✓');
    } catch (err) {
        console.error('PDF Export Error:', err);
        showToast('Erro ao exportar PDF: ' + err.message);
    }
}

// ===== CONTENT COUNTER =====

function setupContentCounter() {
    const contentInput = document.getElementById('contentText');
    const charCountEl  = document.getElementById('charCount');
    const wordCountEl  = document.getElementById('wordCount');
    const estTimeEl    = document.getElementById('estimatedTime');
    if (!contentInput || !charCountEl || !wordCountEl || !estTimeEl) return;

    contentInput.addEventListener('input', () => {
        const charCount  = contentInput.value.length;
        const wordCount  = contentInput.value.trim() ? contentInput.value.trim().split(/\s+/).length : 0;
        // 2.5 words/sec — more realistic for radio speech
        const estSecs    = Math.ceil(wordCount / 2.5);

        charCountEl.textContent = charCount;
        wordCountEl.textContent = wordCount;
        estTimeEl.textContent   = formatTime(estSecs);

        const counterContainer = document.querySelector('.counter-container');
        if (counterContainer) {
            counterContainer.classList.remove('counter-warning', 'counter-danger');
            if (charCount > 450) counterContainer.classList.add('counter-warning');
            if (charCount > 600) counterContainer.classList.add('counter-danger');
        }

        // Auto-update duration for voice-overs
        if (document.getElementById('contentType').value.includes('voice-over')) {
            document.getElementById('duration').value =
                `0:${Math.max(30, estSecs).toString().padStart(2, '0')}`;
        }
    });
}

// ===== THEME =====

function toggleTheme() {
    const body     = document.body;
    const newTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    document.getElementById('themeBtn').textContent = newTheme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', newTheme);
}

function toggleHighContrast() {
    const body     = document.body;
    const newTheme = body.getAttribute('data-theme') === 'high-contrast' ? 'light' : 'high-contrast';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function openThemeSettings() {
    const modal = document.getElementById('themeSettingsModal');
    if (modal) modal.style.display = 'block';
}

function saveThemeSettings() {
    const primaryColor = document.getElementById('primaryButtonColor').value;
    const bgPrimary    = document.getElementById('backgroundPrimaryColor').value;
    document.documentElement.style.setProperty('--btn-primary', primaryColor);
    document.documentElement.style.setProperty('--bg-primary',  bgPrimary);
    localStorage.setItem('customPrimary',   primaryColor);
    localStorage.setItem('customBgPrimary', bgPrimary);
    showToast('Theme updated');
    document.getElementById('themeSettingsModal').style.display = 'none';
}

function closeThemeSettings() {
    document.getElementById('themeSettingsModal').style.display = 'none';
}

// Restore saved theme on load
(function restoreTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
        const btn = document.getElementById('themeBtn');
        if (btn) btn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
    const savedPrimary   = localStorage.getItem('customPrimary');
    const savedBgPrimary = localStorage.getItem('customBgPrimary');
    if (savedPrimary)   document.documentElement.style.setProperty('--btn-primary', savedPrimary);
    if (savedBgPrimary) document.documentElement.style.setProperty('--bg-primary',  savedBgPrimary);
})();

// ===== TEMPLATES =====

const scriptTemplates = {
    'news_bulletin': {
        name:        'News Bulletin',
        description: 'Standard 5-minute news format',
        items: [
            { contentType: 'jingle_entrada',   content: 'Jingle de Entrada',                                             duration: '0:58' },
            { contentType: 'voice-over',        content: 'Headlines at ${time}',                                          duration: '0:30' },
            { contentType: 'separador_3',       content: 'Separador 3',                                                   duration: '0:20' },
            { contentType: 'voice-over',        content: 'Main story details...',                                         duration: '1:00' },
            { contentType: 'voice-over',        content: 'Additional news items...',                                      duration: '1:30' },
            { contentType: 'jingle_fecho',      content: 'Jingle de Fecho',                                               duration: '0:23' }
        ]
    },
    'music_show': {
        name:        'Music Show',
        description: 'Standard music program with 5 songs and interview',
        items: [
            { contentType: 'jingle_entrada',   content: 'Jingle de Entrada',                         duration: '0:58' },
            { contentType: 'song',             content: 'Artist - Track 1',                          duration: '3:30' },
            { contentType: 'voice-over',       content: 'That was...',                               duration: '0:30' },
            { contentType: 'jingle_3',         content: 'Jingle 3',                                  duration: '0:03' },
            { contentType: 'interview',        content: 'Interview',                                  duration: '20:00' },
            { contentType: 'separador_3',      content: 'Separador 3',                               duration: '0:20' },
            { contentType: 'song',             content: 'Artist - Track 2',                          duration: '3:45' },
            { contentType: 'voice-over',       content: 'That was...',                               duration: '0:30' },
            { contentType: 'song',             content: 'Artist - Track 3',                          duration: '4:00' },
            { contentType: 'separador_3',      content: 'Separador 3',                               duration: '0:20' },
            { contentType: 'song',             content: 'Artist - Track 4',                          duration: '3:55' },
            { contentType: 'voice-over',       content: 'That was...',                               duration: '0:30' },
            { contentType: 'voice-over_promo', content: jingleDurations['voice-over_promo'].content,  duration: '0:30' },
            { contentType: 'song',             content: 'Artist - Track 5',                          duration: '4:10' },
            { contentType: 'jingle_fecho',     content: 'Jingle de Fecho',                           duration: '0:23' }
        ]
    }
};

function initTemplateSystem() {
    const container   = document.querySelector('.container');
    const scriptTable = document.getElementById('scriptTable');
    if (!container || !scriptTable) return;

    const templateContainer = document.createElement('div');
    templateContainer.className = 'template-container';
    templateContainer.innerHTML = `<h3>Templates</h3><div class="template-grid" id="templateGrid"></div>`;
    container.insertBefore(templateContainer, scriptTable.parentNode);

    const grid = document.getElementById('templateGrid');
    if (!grid) return;
    Object.entries(scriptTemplates).forEach(([key, tpl]) => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.innerHTML = `<h4>${tpl.name}</h4><p>${tpl.description}</p><button class="template-btn" data-template="${key}">Apply</button>`;
        grid.appendChild(card);
    });

    grid.querySelectorAll('.template-btn').forEach(btn =>
        btn.addEventListener('click', () => applyTemplate(btn.dataset.template))
    );
}

function applyTemplate(templateKey) {
    const tpl = scriptTemplates[templateKey];
    if (!tpl) return;
    if (!confirm(`Apply "${tpl.name}" template? This will clear your current script.`)) return;

    _clearAllSilent();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    tpl.items.forEach(item => {
        const content = item.content.replace('${time}', now);
        document.getElementById('contentType').value  = item.contentType;
        document.getElementById('contentText').value  = content;
        document.getElementById('duration').value     = item.duration || jingleDurations[item.contentType]?.duration || '0:30';
        addRow();
    });
    showToast(`"${tpl.name}" template applied`);
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', function () {
    // Theme buttons
    document.getElementById('themeBtn').addEventListener('click',          toggleTheme);
    document.getElementById('themeSettingsBtn').addEventListener('click',  openThemeSettings);
    document.getElementById('highContrastBtn').addEventListener('click',   toggleHighContrast);
    document.getElementById('saveThemeSettings').addEventListener('click', saveThemeSettings);
    document.getElementById('closeThemeSettings').addEventListener('click',closeThemeSettings);

    // Form controls
    document.getElementById('contentType').addEventListener('change', handleContentTypeChange);
    document.getElementById('contentText').addEventListener('input',  validateInputs);
    document.getElementById('duration').addEventListener('input',     validateInputs);

    // Show management
    document.getElementById('showHistory').addEventListener('change', loadScript);
    document.getElementById('saveShowBtn').addEventListener('click',  saveToLocalStorage);
    document.getElementById('deleteShowBtn').addEventListener('click',deleteSavedScript);

    // Action buttons
    document.getElementById('addBtn').addEventListener('click',       addRow);
    document.getElementById('saveBtn').addEventListener('click',      saveEdit);
    document.getElementById('cancelBtn').addEventListener('click',    cancelEdit);
    document.getElementById('exportTextBtn').addEventListener('click',exportToText);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
    document.getElementById('clearAllBtn').addEventListener('click',  clearAll);
    document.getElementById('undoBtn').addEventListener('click',      undo);
    document.getElementById('redoBtn').addEventListener('click',      redo);

    // Init components
    updateSavedScripts();
    updateTimeDisplay();
    handleContentTypeChange();
    initTemplateSystem();
    setupContentCounter();
    _syncUndoRedoBtns();

    // MutationObserver for live preview
    const scriptTableBody = document.getElementById('scriptTableBody');
    if (scriptTableBody) {
        const observer = new MutationObserver(debounce(updatePreview, 100));
        observer.observe(scriptTableBody, { childList: true, subtree: true, characterData: true });
    }
});
