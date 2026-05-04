/**
 * EPG Studio - Professional Editor Core
 * Vanilla JavaScript Edition
 */

// --- Estado Global ---
let channels = [];
let programmes = [];
let projectName = "Novo Projeto";
let projectLastUpdate = "";
let selectedChannelId = null;
let currentDay = 'seg';
let currentView = 'grid';
let modalDays = [];
let programClipboard = null; // Clipboard para copiar/colar programas

// Estado do Modal de Exportação
let exportActiveTab = 'master'; // Pode ser 'master', 'normal' ou 'project'
let exportDaysToGenerate = 7;
let exportMergeSubtitle = false;
let exportSubtitleSeparator = " - ";

const PX_HOUR = 220;
const WEEKLY_MIN_HEIGHT = 4; // 4px por minuto

const DAYS = [
    { key: 'seg', label: 'Segunda', jsDay: 1 },
    { key: 'ter', label: 'Terça', jsDay: 2 },
    { key: 'qua', label: 'Quarta', jsDay: 3 },
    { key: 'qui', label: 'Quinta', jsDay: 4 },
    { key: 'sex', label: 'Sexta', jsDay: 5 },
    { key: 'sab', label: 'Sábado', jsDay: 6 },
    { key: 'dom', label: 'Domingo', jsDay: 0 }
];

// --- Utilitários de Tempo e ID ---

const generateId = () => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const parseTimeToMin = (t) => {
    if (!t || t.length < 4) return 0;
    return (parseInt(t.substring(0, 2)) * 60) + parseInt(t.substring(2, 4));
};

const hhmmssToInput = (hhmmss) => {
    if (!hhmmss || hhmmss.length < 4) return "00:00";
    return `${hhmmss.substring(0,2)}:${hhmmss.substring(2,4)}`;
};

const inputToHhmmss = (timeVal) => {
    return timeVal.replace(':', '') + "00";
};

const getPreviousDay = (dayKey) => {
    const idx = DAYS.findIndex(d => d.key === dayKey);
    return DAYS[idx === 0 ? 6 : idx - 1].key;
};

// --- Funções de Renderização Auxiliares ---

function renderWeeklyToolbar() {
    const select = document.getElementById("weeklyChannelSelect");
    const iconContainer = document.getElementById("weeklyCurrentIcon");
    if (!select || !iconContainer) return;

    select.innerHTML = "";
    channels.forEach(ch => {
        const opt = document.createElement("option");
        opt.value = ch.id;
        opt.textContent = ch.displayName;
        if (ch.id === selectedChannelId) opt.selected = true;
        select.appendChild(opt);
    });

    const selectedCh = channels.find(ch => ch.id === selectedChannelId);
    if (selectedCh && selectedCh.icon) {
        iconContainer.innerHTML = `<img src="${selectedCh.icon}" class="w-full h-full object-contain">`;
    } else {
        iconContainer.innerHTML = `<span class="text-[9px] text-zinc-600">N/A</span>`;
    }
}

function getVisiblePrograms(dayKey, chId) {
    const prevDay = getPreviousDay(dayKey);
    const results = [];

    programmes.forEach(p => {
        if (p.channelId !== chId) return;
        
        // Na grade principal, NUNCA mostramos arquivados
        if (p.isArchived) return;

        const startMin = parseTimeToMin(p.start);
        let stopMin = parseTimeToMin(p.stop);
        
        if ((p.stop === '000000' || stopMin === 0) && startMin !== 0) stopMin = 1440;
        const crossesMidnight = stopMin < startMin && p.stop !== '000000';

        if (p.days.includes(dayKey)) {
            results.push({
                ...p,
                renderStart: startMin,
                renderStop: crossesMidnight ? 1440 : stopMin,
                isPart2: false
            });
        }

        if (crossesMidnight && p.days.includes(prevDay)) {
            results.push({
                ...p,
                renderStart: 0,
                renderStop: stopMin,
                isPart2: true
            });
        }
    });
    return results;
}

// --- Painel de Arquivados ---

window.openArchivedPanel = function() {
    const overlay = document.getElementById('archivedPanelOverlay');
    const container = document.getElementById('archivedListContainer');
    const subtitle = document.getElementById('archivedPanelSubtitle');
    if (!overlay || !container) return;

    if (!selectedChannelId) {
        window.customAlert("Selecione um canal primeiro para ver seus arquivados.");
        return;
    }

    const ch = channels.find(c => c.id === selectedChannelId);
    subtitle.innerText = ch ? `Canal: ${ch.displayName}` : '';
    
    overlay.classList.remove('hidden');
    renderArchivedList();
};

window.closeArchivedPanel = function() {
    document.getElementById('archivedPanelOverlay').classList.add('hidden');
};

function renderArchivedList() {
    const container = document.getElementById('archivedListContainer');
    if (!container) return;
    container.innerHTML = "";

    const archived = programmes.filter(p => p.isArchived && p.channelId === selectedChannelId);

    if (archived.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-zinc-500">
                <p class="text-3xl mb-2">📁</p>
                <p class="text-sm">Nenhum programa arquivado neste canal.</p>
            </div>
        `;
        return;
    }

    archived.forEach(p => {
        const item = document.createElement('div');
        item.className = "bg-zinc-800/40 border border-zinc-700/50 p-4 rounded-xl flex items-center justify-between hover:bg-zinc-800 transition shadow-sm";
        item.innerHTML = `
            <div class="flex items-center gap-4 flex-1">
                <div class="w-12 h-12 bg-black rounded border border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    ${p.iconSrc ? `<img src="${p.iconSrc}" class="w-full h-full object-cover">` : '<span class="text-[10px] text-zinc-800 font-bold">EPG</span>'}
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-white text-sm truncate">${p.title}</h3>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[10px] text-[#0a84ff] font-bold">${hhmmssToInput(p.start)} — ${hhmmssToInput(p.stop)}</span>
                        <span class="text-[9px] bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-400 font-medium">${p.days.join(', ')}</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2 ml-4">
                <button onclick="window.openModalByIdFromArchived('${p.id}')" class="bg-zinc-700 hover:bg-blue-600 hover:text-white text-zinc-300 p-2 rounded-lg transition-colors" title="Editar Programa">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onclick="window.unarchiveFromPanel('${p.id}')" class="bg-zinc-700 hover:bg-green-600 hover:text-white text-zinc-300 p-2 rounded-lg transition-colors" title="Restaurar para a grade">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
                <button onclick="window.deleteArchivedFromPanel('${p.id}')" class="bg-zinc-700 hover:bg-red-600 hover:text-white text-zinc-300 p-2 rounded-lg transition-colors" title="Excluir Permanentemente">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

window.openModalByIdFromArchived = function(id) {
    const p = programmes.find(prog => prog.id === id);
    if (p) window.openModal(p);
};

window.unarchiveFromPanel = function(id) {
    programmes = programmes.map(p => p.id === id ? { ...p, isArchived: false } : p);
    renderArchivedList();
    render();
};

window.deleteArchivedFromPanel = function(id) {
    window.customConfirm("Excluir Permanente?", "Deseja remover este programa arquivado para sempre?", () => {
        programmes = programmes.filter(p => p.id !== id);
        renderArchivedList();
        render();
    });
};

function refreshArchivedListIfOpen() {
    const overlay = document.getElementById('archivedPanelOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        renderArchivedList();
    }
}

// --- Funções de Copiar e Colar (Clipboard) ---

window.copyProgramData = function() {
    // Collect daily values currently in inputs
    const dailySubs = {};
    const dailyDescs = {};
    DAYS.forEach(d => {
        const s = document.getElementById(`fSubTitle-${d.key}`)?.value;
        const de = document.getElementById(`fDesc-${d.key}`)?.value;
        if (s) dailySubs[d.key] = s;
        if (de) dailyDescs[d.key] = de;
    });

    programClipboard = {
        title: document.getElementById("fTitle").value,
        subTitle: document.getElementById("fSubTitle").value,
        desc: document.getElementById("fDesc").value,
        start: document.getElementById("fStartTime").value,
        stop: document.getElementById("fStopTime").value,
        rating: document.getElementById("fRating").value,
        iconSrc: document.getElementById("fIconSrc").value,
        days: [...modalDays],
        dailySubtitles: dailySubs,
        dailyDescriptions: dailyDescs
    };
    console.log("Programa copiado para o clipboard interno.");
};

window.pasteProgramData = function() {
    if (!programClipboard) {
        window.customAlert("Nenhum programa copiado anteriormente.");
        return;
    }

    document.getElementById("fTitle").value = programClipboard.title || "";
    document.getElementById("fSubTitle").value = programClipboard.subTitle || "";
    document.getElementById("fDesc").value = programClipboard.desc || "";
    document.getElementById("fStartTime").value = programClipboard.start || "08:00";
    document.getElementById("fStopTime").value = programClipboard.stop || "09:00";
    document.getElementById("fRating").value = programClipboard.rating || "L";
    document.getElementById("fIconSrc").value = programClipboard.iconSrc || "";
    modalDays = [...(programClipboard.days || [])];
    
    renderModalDayChips();

    // Populate the newly rendered daily fields
    DAYS.forEach(d => {
        const stEl = document.getElementById(`fSubTitle-${d.key}`);
        const descEl = document.getElementById(`fDesc-${d.key}`);
        if (stEl) stEl.value = (programClipboard.dailySubtitles && programClipboard.dailySubtitles[d.key]) || "";
        if (descEl) descEl.value = (programClipboard.dailyDescriptions && programClipboard.dailyDescriptions[d.key]) || "";
    });
    
    window.updatePreview(programClipboard.iconSrc);
    
    // Dispara validação XML nos campos principais
    ['fTitle', 'fSubTitle', 'fDesc', 'fIconSrc'].forEach(id => {
        const input = document.getElementById(id);
        if (input) window.checkXml(input);
    });
};

// --- Modais e Handlers Globais ---

window.checkXml = function(input) {
    const val = input.value;
    const warnEl = document.getElementById(`warn-${input.id}`);
    if (!warnEl) return;
    const forbidden = ['<', '>', '&', '"'];
    const found = forbidden.filter(char => val.includes(char));
    if (found.length > 0) {
        warnEl.classList.add('visible');
        warnEl.innerText = `Atenção: Caracteres reservados (${found.join(' ')}).`;
    } else {
        warnEl.classList.remove('visible');
    }
};

window.updatePreview = function(url, containerId = 'imagePreview') {
    const preview = document.getElementById(containerId);
    if (!preview) return;
    
    if (!url || url.trim() === "") {
        preview.innerHTML = `<span class="text-[10px] text-zinc-600">Sem Imagem</span>`;
        return;
    }

    const img = new Image();
    img.className = "max-w-full max-h-full object-contain hidden";
    
    img.onload = function() {
        preview.innerHTML = ""; 
        img.classList.remove('hidden');
        preview.appendChild(img);
    };
    
    img.onerror = function() {
        if (url.trim() !== "") {
            preview.innerHTML = `<span class="text-[10px] text-red-500 font-medium">Erro ao carregar</span>`;
        }
    };
    
    img.src = url;
};

window.toggleModalDay = function(dayKey) {
    if (modalDays.includes(dayKey)) {
        modalDays = modalDays.filter(d => d !== dayKey);
    } else {
        modalDays.push(dayKey);
    }
    renderModalDayChips();
};

window.setModalTab = (tabId) => {
    const tabs = ['general', 'daily'];
    tabs.forEach(t => {
        const content = document.getElementById(`tabContent-${t}`);
        const btn = document.getElementById(`tabBtn-${t}`);
        if (content) content.classList.toggle('hidden', t !== tabId);
        if (btn) {
            if (t === tabId) {
                btn.classList.add('border-[#0a84ff]', 'text-white');
                btn.classList.remove('border-transparent', 'text-zinc-500');
            } else {
                btn.classList.remove('border-[#0a84ff]', 'text-white');
                btn.classList.add('border-transparent', 'text-zinc-500');
            }
        }
    });
};

function renderModalDayChips() {
    const container = document.getElementById('daysContainer');
    const fieldsContainer = document.getElementById('dailyFieldsContainer');
    if (!container) return;
    container.innerHTML = "";
    
    // Save current values from daily fields before re-rendering
    const currentValues = {};
    DAYS.forEach(d => {
        currentValues[d.key] = {
            st: document.getElementById(`fSubTitle-${d.key}`)?.value || "",
            desc: document.getElementById(`fDesc-${d.key}`)?.value || ""
        };
    });

    DAYS.forEach(day => {
        const chip = document.createElement('div');
        const isActive = modalDays.includes(day.key);
        chip.className = `day-chip ${isActive ? 'active' : ''}`;
        chip.innerText = day.label;
        chip.onclick = () => window.toggleModalDay(day.key);
        container.appendChild(chip);
    });

    // Render daily variations fields
    if (fieldsContainer) {
        fieldsContainer.innerHTML = "";
        
        if (modalDays.length === 0) {
            fieldsContainer.innerHTML = `<div class="text-center py-10 text-zinc-600 text-xs italic">Selecione dias na aba "Geral" para configurar variações.</div>`;
            return;
        }

        modalDays.forEach(dayKey => {
            const dayObj = DAYS.find(d => d.key === dayKey);
            if (!dayObj) return;

            const dayRow = document.createElement('div');
            dayRow.className = "bg-[#1c1c1e] p-4 rounded-xl border border-zinc-800 space-y-3";
            dayRow.innerHTML = `
                <div class="flex items-center gap-2 mb-1">
                    <span class="w-2 h-2 rounded-full bg-[#0a84ff]"></span>
                    <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">${dayObj.label}</span>
                </div>
                <div class="grid grid-cols-1 gap-3">
                    <div>
                        <label class="text-[9px] font-bold text-zinc-500 uppercase mb-1 block">Sub-título (${dayObj.key})</label>
                        <input type="text" id="fSubTitle-${dayObj.key}" value="${currentValues[dayKey]?.st || ""}" class="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-lg px-3 py-1.5 outline-none focus:border-[#0a84ff] text-xs" placeholder="Ex: Ep 1">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-zinc-500 uppercase mb-1 block">Descrição (${dayObj.key})</label>
                        <textarea id="fDesc-${dayObj.key}" class="w-full bg-[#2c2c2e] border border-[#3a3a3c] rounded-lg px-3 py-1.5 outline-none focus:border-[#0a84ff] text-xs h-12" placeholder="Descrição para este dia...">${currentValues[dayKey]?.desc || ""}</textarea>
                    </div>
                </div>
            `;
            fieldsContainer.appendChild(dayRow);
        });
    }
}

function populateModalChannelSelect(selectedId) {
    const select = document.getElementById("fChannel");
    if (!select) return;
    select.innerHTML = "";
    
    if (channels.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Nenhum canal cadastrado";
        select.appendChild(opt);
        return;
    }

    channels.forEach(ch => {
        const opt = document.createElement("option");
        opt.value = ch.id;
        opt.textContent = ch.displayName;
        if (ch.id === (selectedId || selectedChannelId)) opt.selected = true;
        select.appendChild(opt);
    });
}

window.openModal = function(prog = null) {
    const overlay = document.getElementById("modalOverlay");
    const delBtn = document.getElementById("btnDelete");
    const arcBtn = document.getElementById("btnArchive");
    if (!overlay) return;

    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // Bloqueia scroll do fundo
    document.querySelectorAll('.xml-warning').forEach(w => w.classList.remove('visible'));
    window.setModalTab('general');

    if (prog) {
        document.getElementById("modalTitle").innerText = "Editar Programa";
        document.getElementById("editId").value = prog.id;
        document.getElementById("editIsArchived").value = prog.isArchived ? "true" : "false";
        document.getElementById("fTitle").value = prog.title || "";
        document.getElementById("fSubTitle").value = prog.subTitle || "";
        document.getElementById("fDesc").value = prog.desc || "";
        document.getElementById("fStartTime").value = hhmmssToInput(prog.start);
        document.getElementById("fStopTime").value = hhmmssToInput(prog.stop);
        document.getElementById("fRating").value = prog.rating || "L";
        document.getElementById("fIconSrc").value = prog.iconSrc || "";
        modalDays = Array.isArray(prog.days) ? [...prog.days] : (prog.days ? prog.days.split(',') : []);
        window.updatePreview(prog.iconSrc);
        populateModalChannelSelect(prog.channelId);

        renderModalDayChips();

        // Populate daily fields after chips render the inputs
        DAYS.forEach(d => {
            const stEl = document.getElementById(`fSubTitle-${d.key}`);
            const descEl = document.getElementById(`fDesc-${d.key}`);
            if (stEl) stEl.value = (prog.dailySubtitles && prog.dailySubtitles[d.key]) || "";
            if (descEl) descEl.value = (prog.dailyDescriptions && prog.dailyDescriptions[d.key]) || "";
        });

        if (delBtn) delBtn.classList.remove("hidden");
        if (arcBtn) {
            arcBtn.classList.remove("hidden");
            arcBtn.innerText = prog.isArchived ? "Desarquivar" : "Arquivar";
        }
    } else {
        document.getElementById("modalTitle").innerText = "Novo Programa";
        document.getElementById("editId").value = "";
        document.getElementById("editIsArchived").value = "false";
        document.getElementById("fTitle").value = "";
        document.getElementById("fSubTitle").value = "";
        document.getElementById("fDesc").value = "";
        document.getElementById("fStartTime").value = "08:00";
        document.getElementById("fStopTime").value = "09:00";
        document.getElementById("fRating").value = "L";
        document.getElementById("fIconSrc").value = "";
        modalDays = [currentDay];
        window.updatePreview("");
        populateModalChannelSelect(selectedChannelId);

        if (delBtn) delBtn.classList.add("hidden");
        if (arcBtn) arcBtn.classList.add("hidden");

        renderModalDayChips();

        // Clear daily fields
        DAYS.forEach(d => {
            const stEl = document.getElementById(`fSubTitle-${d.key}`);
            const descEl = document.getElementById(`fDesc-${d.key}`);
            if (stEl) stEl.value = "";
            if (descEl) descEl.value = "";
        });
    }
};

window.closeModal = () => {
    document.getElementById("modalOverlay")?.classList.add("hidden");
    document.body.style.overflow = "auto"; // Libera scroll do fundo
};

window.saveChanges = function() {
    const modalChannelId = document.getElementById("fChannel").value;
    if (!modalChannelId) return window.customAlert("Selecione um canal primeiro.");
    if (modalDays.length === 0) return window.customAlert("Selecione os dias de exibição.");
    
    const id = document.getElementById("editId").value;
    const isArchived = document.getElementById("editIsArchived").value === "true";
    const data = {
        id: id || generateId(),
        channelId: modalChannelId,
        title: document.getElementById("fTitle").value || "Sem Título",
        subTitle: document.getElementById("fSubTitle").value || "",
        desc: document.getElementById("fDesc").value || "",
        dailySubtitles: DAYS.reduce((acc, d) => {
            const val = document.getElementById(`fSubTitle-${d.key}`)?.value || "";
            if (val) acc[d.key] = val;
            return acc;
        }, {}),
        dailyDescriptions: DAYS.reduce((acc, d) => {
            const val = document.getElementById(`fDesc-${d.key}`)?.value || "";
            if (val) acc[d.key] = val;
            return acc;
        }, {}),
        start: inputToHhmmss(document.getElementById("fStartTime").value),
        stop: inputToHhmmss(document.getElementById("fStopTime").value),
        rating: document.getElementById("fRating").value,
        iconSrc: document.getElementById("fIconSrc").value,
        days: [...modalDays],
        isArchived: isArchived
    };

    if (id) {
        programmes = programmes.map(p => p.id === id ? data : p);
    } else {
        programmes.push(data);
    }
    
    window.closeModal(); 
    render();
    refreshArchivedListIfOpen();
};

window.handleArchiveProgram = function() {
    const id = document.getElementById("editId").value;
    if (!id) return;
    const prog = programmes.find(p => p.id === id);
    if (!prog) return;

    const action = prog.isArchived ? "Desarquivar" : "Arquivar";
    window.customConfirm(action + "?", "Deseja " + action.toLowerCase() + " este programa?", () => {
        programmes = programmes.map(p => p.id === id ? { ...p, isArchived: !p.isArchived } : p);
        window.closeModal();
        render();
        refreshArchivedListIfOpen();
    });
};

// --- Visualizações (Grid, Weekly, List) ---

function renderGrid(container) {
    const wrapper = document.createElement("div");
    wrapper.className = "overflow-x-auto bg-[#0f0f0f]";
    
    let headerHtml = `
        <div class="flex border-b border-[#2c2c2e] bg-[#0f0f0f]">
            <div class="min-w-[240px] sticky left-0 z-20 bg-[#0f0f0f] border-r border-[#2c2c2e] p-4 flex items-center justify-between">
                <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Canais</span>
                <button onclick="window.openChannelModal()" class="bg-[#0a84ff] hover:bg-[#0070e0] text-white text-[10px] font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
                    <span class="text-xs">+</span> Novo Canal
                </button>
            </div>
            <div class="flex flex-grow">
    `;
    
    for(let i=0; i<24; i++) {
        headerHtml += `<div class="min-w-[${PX_HOUR}px] p-2 text-[10px] text-[#a1a1a6] border-l border-[#2c2c2e] whitespace-nowrap">${String(i).padStart(2,'0')}:00</div>`;
    }
    headerHtml += `</div></div>`;
    
    wrapper.innerHTML = headerHtml;

    channels.forEach(ch => {
        const row = document.createElement("div");
        row.className = "flex border-b border-[#2c2c2e] min-h-[100px]";
        
        const info = document.createElement("div");
        info.className = "min-w-[240px] bg-[#161618] flex items-center p-4 gap-3 sticky left-0 z-10 border-r border-[#2c2c2e]";
        info.innerHTML = `
            <div class="flex-grow flex items-center gap-3 truncate">
                ${ch.icon ? `<img src="${ch.icon}" class="w-10 h-10 object-contain">` : '<div class="w-10 h-10 bg-[#2c2c2e] rounded flex items-center justify-center text-[10px] text-zinc-500">Logo</div>'}
                <span class="font-semibold text-sm truncate">${ch.displayName}</span>
            </div>
            <button onclick="window.selectAndEditChannel('${ch.id}')" class="text-zinc-500 hover:text-[#0a84ff] p-1.5 rounded hover:bg-zinc-800 transition-colors" title="Editar Canal">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
        `;
        
        const track = document.createElement("div");
        track.className = "relative flex-grow";
        track.style.width = (24 * PX_HOUR) + "px";

        getVisiblePrograms(currentDay, ch.id).forEach(p => {
            const block = document.createElement("div");
            block.className = `absolute top-2 bottom-2 bg-[#2c2c2e] border border-[#3a3a3c] rounded-md p-2 text-xs cursor-pointer hover:border-[#0a84ff] hover:bg-[#3a3a3c] overflow-hidden transition-all ${p.isPart2 ? 'opacity-80 border-dashed' : ''}`;
            block.style.left = ((p.renderStart / 60) * PX_HOUR) + "px";
            block.style.width = (((p.renderStop - p.renderStart) / 60) * PX_HOUR) + "px";
            block.onclick = () => window.openModal(p);
            
            const displaySubTitle = (p.dailySubtitles && p.dailySubtitles[currentDay]) || p.subTitle;

            block.innerHTML = `
                <div class="font-bold truncate">${p.isPart2 ? '→ ' : ''}${p.title}</div>
                ${displaySubTitle ? `<div class="text-[9px] text-zinc-500 truncate italic">${displaySubTitle}</div>` : ''}
                <div class="text-[#a1a1a6] text-[10px]">${p.start.substring(0,2)}:${p.start.substring(2,4)}</div>
                <div class="rating-badge rating-${p.rating} mt-1">${p.rating}</div>
            `;
            track.appendChild(block);
        });

        row.appendChild(info);
        row.appendChild(track);
        wrapper.appendChild(row);
    });
    container.appendChild(wrapper);
}

window.selectAndEditChannel = function(id) {
    selectedChannelId = id;
    window.openEditChannelModal();
};

function renderWeekly(container) {
    if (!selectedChannelId) {
        container.innerHTML = `<div class="p-20 text-center text-[#a1a1a6]">Selecione um canal na barra semanal para visualizar.</div>`;
        return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "overflow-x-auto relative no-scrollbar";
    
    const grid = document.createElement("div");
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '100px repeat(7, 1fr)';
    grid.style.gridTemplateRows = `40px repeat(1440, ${WEEKLY_MIN_HEIGHT}px)`; 
    grid.className = "bg-[#2c2c2e] gap-x-px w-full min-w-full relative";

    const now = new Date();
    const currentTotalMinutes = (now.getHours() * 60) + now.getMinutes();
    const timeLine = document.createElement('div');
    timeLine.className = "time-line";
    timeLine.style.top = `${(currentTotalMinutes * WEEKLY_MIN_HEIGHT) + 40}px`;
    grid.appendChild(timeLine);

    const timeHead = document.createElement('div');
    timeHead.className = "bg-black text-[#a1a1a6] uppercase text-[11px] font-bold flex items-center justify-center border-b border-[#2c2c2e] sticky top-0 z-20";
    timeHead.innerText = "Hora";
    grid.appendChild(timeHead);

    DAYS.forEach((d, i) => {
        const dayHead = document.createElement('div');
        dayHead.className = "bg-black text-white font-bold flex items-center justify-center text-sm border-b border-[#2c2c2e] sticky top-0 z-20";
        dayHead.style.gridColumn = (i + 2).toString();
        dayHead.innerText = d.label;
        grid.appendChild(dayHead);
    });

    for(let i=0; i<24; i++) {
        const label = document.createElement('div');
        label.className = "bg-black text-[#a1a1a6] flex items-start pt-4 justify-center text-xs font-bold border-b border-[#2c2c2e]";
        label.style.gridRow = `${(i * 60) + 2} / span 60`;
        label.innerText = `${String(i).padStart(2, '0')}:00`;
        grid.appendChild(label);

        for(let d=0; d<7; d++) {
            const stripe = document.createElement('div');
            stripe.className = "bg-[#161618] border-b border-[#2c2c2e]";
            stripe.style.gridRow = `${(i * 60) + 2} / span 60`;
            stripe.style.gridColumn = (d + 2).toString();
            grid.appendChild(stripe);
        }
    }

    DAYS.forEach((d, i) => {
        getVisiblePrograms(d.key, selectedChannelId).forEach(p => {
            const block = document.createElement("div");
            block.className = `bg-[#2c2c2e] border border-[#3a3a3c] rounded-sm p-2 text-[11px] cursor-pointer hover:border-[#0a84ff] hover:bg-[#333335] hover:z-10 overflow-hidden flex flex-col transition-all ${p.isPart2 ? 'border-dashed' : ''}`;
            block.style.gridRow = `${p.renderStart + 2} / ${p.renderStop + 2}`;
            block.style.gridColumn = (i + 2).toString();
            block.onclick = (e) => { e.stopPropagation(); window.openModal(p); };

            const displaySubTitle = (p.dailySubtitles && p.dailySubtitles[d.key]) || p.subTitle;

            block.innerHTML = `
                <div class="font-bold text-white truncate leading-tight mb-0.5">${p.title}</div>
                ${displaySubTitle ? `<div class="text-[9px] text-[#a1a1a6] truncate italic leading-tight mb-1">${displaySubTitle}</div>` : ''}
                <div class="text-[#0a84ff] font-medium text-[10px] mb-1">
                    ${hhmmssToInput(p.start)} — ${hhmmssToInput(p.stop)}
                </div>
                <div>
                    <span class="rating-badge rating-${p.rating}">${p.rating}</span>
                </div>
            `;
            grid.appendChild(block);
        });
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
}

function renderList(container) {
    if (!selectedChannelId) {
        container.innerHTML = `<div class="p-20 text-center text-[#a1a1a6]">Selecione um canal na barra acima para visualizar a lista.</div>`;
        return;
    }
    
    const ch = channels.find(c => c.id === selectedChannelId);
    if (!ch) return;

    const listWrapper = document.createElement("div");
    listWrapper.className = "p-6 max-w-5xl mx-auto space-y-6";

    const listHeader = document.createElement("div");
    listHeader.className = "flex items-center justify-between mb-8 pb-4 border-b border-[#2c2c2e]";
    listHeader.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="w-16 h-16 bg-[#1c1c1e] rounded-lg border border-[#3a3a3c] flex items-center justify-center p-2">
                ${ch.icon ? `<img src="${ch.icon}" class="w-full h-full object-contain">` : '<span class="text-xs text-zinc-600">Logo</span>'}
            </div>
            <div>
                <h1 class="text-2xl font-bold">${ch.displayName}</h1>
                <p class="text-zinc-500 text-sm">Programação de ${DAYS.find(d => d.key === currentDay).label}</p>
            </div>
        </div>
        <button onclick="window.openEditChannelModal()" class="bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-[#2c2c2e] px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <span>✎</span> Editar Canal
        </button>
    `;
    listWrapper.appendChild(listHeader);

    const filtered = getVisiblePrograms(currentDay, selectedChannelId).sort((a,b) => a.renderStart - b.renderStart);
    
    if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "py-20 text-center text-[#a1a1a6] bg-[#161618] rounded-2xl border border-dashed border-[#2c2c2e]";
        empty.innerText = "Nenhum programa ativo para este dia.";
        listWrapper.appendChild(empty);
    }

    filtered.forEach(p => {
        const item = document.createElement("div");
        item.className = `bg-[#161618] rounded-xl border border-[#2c2c2e] overflow-hidden flex hover:border-[#0a84ff] transition-all cursor-pointer group`;
        item.onclick = () => window.openModal(p);
        
        const displaySubTitle = (p.dailySubtitles && p.dailySubtitles[currentDay]) || p.subTitle;
        const displayDesc = (p.dailyDescriptions && p.dailyDescriptions[currentDay]) || p.desc;

        item.innerHTML = `
            <div class="w-48 h-32 bg-black flex-shrink-0 relative">
                ${p.iconSrc ? `<img src="${p.iconSrc}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-zinc-800 font-bold">EPG</div>'}
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>
            <div class="flex-1 p-5 flex flex-col justify-center">
                <div class="flex justify-between items-start mb-1">
                    <div>
                        <h3 class="text-lg font-bold group-hover:text-[#0a84ff] transition-colors leading-tight">${p.title}</h3>
                        ${displaySubTitle ? `<h4 class="text-zinc-500 text-sm font-medium italic mt-0.5">${displaySubTitle}</h4>` : ''}
                    </div>
                    <span class="rating-badge rating-${p.rating}">${p.rating}</span>
                </div>
                <div class="text-[#0a84ff] font-medium text-sm mb-2">
                    ${hhmmssToInput(p.start)} — ${hhmmssToInput(p.stop)} 
                    ${p.isPart2 ? '<span class="text-zinc-500 ml-1 italic">(Continua)</span>' : ''}
                </div>
                <p class="text-zinc-400 text-xs line-clamp-2 leading-relaxed">
                    ${displayDesc || 'Nenhuma descrição disponível para este programa.'}
                </p>
            </div>
        `;
        listWrapper.appendChild(item);
    });
    container.appendChild(listWrapper);
}

function renderChannelBar() {
    const bar = document.getElementById("channelBar");
    if (!bar) return;
    bar.innerHTML = "";
    
    channels.forEach(ch => {
        const div = document.createElement("div");
        div.className = `min-w-[130px] h-[75px] rounded-xl flex flex-col items-center justify-center p-2 cursor-pointer transition-all border-2 channel-thumb flex-shrink-0 ${selectedChannelId === ch.id ? 'active' : 'border-transparent bg-[#1c1c1e]'}`;
        div.onclick = (e) => { 
            if (e.target.closest('.btn-del-channel')) return;
            selectedChannelId = ch.id; 
            render(); 
        };
        div.innerHTML = `
            <button onclick="window.deleteChannel('${ch.id}')" class="btn-del-channel">×</button>
            <div class="w-full h-8 flex items-center justify-center mb-1 overflow-hidden">
                ${ch.icon ? `<img src="${ch.icon}" class="h-full w-full object-contain pointer-events-none">` : '<div class="text-[9px] text-zinc-600">Sem Logo</div>'}
            </div>
            <span class="text-[10px] text-[#a1a1a6] font-semibold text-center truncate w-full pointer-events-none">${ch.displayName}</span>
        `;
        bar.appendChild(div);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "min-w-[60px] h-[75px] rounded-xl border-2 border-dashed border-[#2c2c2e] hover:border-[#0a84ff] text-[#a1a1a6] flex items-center justify-center text-xl transition-all flex-shrink-0";
    addBtn.onclick = () => window.openChannelModal();
    addBtn.innerHTML = "+";
    bar.appendChild(addBtn);
}

function renderDayMenuBar() {
    const bar = document.getElementById("dayMenuBar");
    if (!bar) return;
    
    if (currentView === 'weekly') {
        bar.classList.add("hidden");
        return;
    }
    bar.classList.remove("hidden");
    bar.innerHTML = "";

    DAYS.forEach(day => {
        const btn = document.createElement("button");
        const isActive = currentDay === day.key;
        btn.onclick = () => {
            currentDay = day.key;
            render();
        };
        btn.className = `px-6 py-2 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
            isActive 
            ? 'bg-[#0a84ff] border-[#0a84ff] text-white shadow-lg' 
            : 'bg-[#1c1c1e] border-[#2c2c2e] text-[#a1a1a6] hover:bg-[#2c2c2e] hover:text-white'
        }`;
        btn.innerText = day.label;
        bar.appendChild(btn);
    });
}

window.startNewProject = function() {
    channels = [];
    programmes = [];
    selectedChannelId = "";
    currentDay = 'mon';
    currentView = 'list';
    const welcome = document.getElementById("welcomeScreen");
    if (welcome) welcome.setAttribute('data-started', 'true');
    render();
};

function render() {
    const welcome = document.getElementById("welcomeScreen");
    const appHeader = document.getElementById("appHeader");
    const channelBar = document.getElementById("channelBar");
    const weeklyToolbar = document.getElementById("weeklyToolbar");
    const dayMenuBar = document.getElementById("dayMenuBar");
    const content = document.getElementById("mainContent");
    
    // Welcome screen logic: Show if no channels and no programs and not manually started
    const hasData = (channels.length > 0 || programmes.length > 0);
    const wasStarted = welcome && welcome.getAttribute('data-started') === 'true';

    if (!hasData && !wasStarted) {
        if (welcome) welcome.classList.remove("hidden");
        if (appHeader) appHeader.classList.add("hidden");
        if (channelBar) channelBar.classList.add("hidden");
        if (dayMenuBar) dayMenuBar.classList.add("hidden");
        if (weeklyToolbar) weeklyToolbar.classList.add("hidden");
        return;
    } else {
        if (welcome) welcome.classList.add("hidden");
        if (appHeader) appHeader.classList.remove("hidden");
    }

    if (!content) return;
    content.innerHTML = "";

    if (channelBar) {
        channelBar.classList.add("hidden");
        channelBar.classList.remove("flex");
    }
    if (weeklyToolbar) {
        weeklyToolbar.classList.add("hidden");
    }
    
    renderDayMenuBar();

    if (currentView === 'list') {
        if (channelBar) {
            channelBar.classList.remove("hidden");
            channelBar.classList.add("flex");
        }
        renderChannelBar();
        renderList(content);
    } else if (currentView === 'grid') {
        renderGrid(content);
    } else if (currentView === 'weekly') {
        if (weeklyToolbar) {
            weeklyToolbar.classList.remove("hidden");
        }
        renderWeeklyToolbar();
        renderWeekly(content);
    }
}

// --- Funções de Exportação Profissional ---

// --- Helpers Globais ---
function formatEPGDate(rawDate) {
    if (!rawDate || rawDate.length < 14) return rawDate || "Não disponível";
    const y = rawDate.slice(0, 4);
    const m = rawDate.slice(4, 6);
    const d = rawDate.slice(6, 8);
    const h = rawDate.slice(8, 10);
    const min = rawDate.slice(10, 12);
    const s = rawDate.slice(12, 14);
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
}

window.openExportModal = function() {
    const overlay = document.getElementById('exportModalOverlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Bloqueia scroll do fundo
    window.setExportTab(exportActiveTab);
    window.updateExportDays(exportDaysToGenerate);
    renderExportChannelList();

    // Sincroniza opções de subtítulo
    const mergeCheck = document.getElementById('mergeSubtitleCheck');
    const separatorSelect = document.getElementById('subtitleSeparator');
    if (mergeCheck) mergeCheck.checked = exportMergeSubtitle;
    if (separatorSelect) separatorSelect.value = exportSubtitleSeparator;
    window.updateExportOptions(); // Atualiza opacidade do grupo

    // Populate project fields
    const nameInput = document.getElementById('projNameInput');
    const dateDisplay = document.getElementById('projDateDisplay');
    if (nameInput) nameInput.value = projectName;
    if (dateDisplay) dateDisplay.innerText = projectLastUpdate ? formatEPGDate(projectLastUpdate) : "Não disponível";
};

window.updateProjectName = function(val) {
    projectName = val || "Sem Nome";
};

window.saveProject = function() {
    // Para salvar o projeto completo (Backup), incluímos todos os canais
    const allChannelIds = channels.map(c => c.id);
    const xmlContent = generateMasterXML(allChannelIds);
    
    // Nome do arquivo: Nome-do-Projeto-DD-MM-AAAA-HH-MM.xml (Backup)
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const aaaa = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    const dateFormatted = `${dd}-${mm}-${aaaa}-${hh}-${min}`;
    const safeName = projectName.replace(/[^a-z0-9]/gi, '-');
    const fileName = `${safeName || 'projeto'}-${dateFormatted}.xml`;
    
    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Atualiza a data de modificação na interface
    const dateDisplay = document.getElementById('projDateDisplay');
    if (dateDisplay) dateDisplay.innerText = formatEPGDate(projectLastUpdate);
    
    window.customAlert(`Backup "${projectName}" exportado com sucesso.`);
};

window.saveProjectAs = async function() {
    // Tenta usar a File System Access API (Nativa)
    // Nota: Em iframes (como o preview do AI Studio), o navegador bloqueia esta API.
    if ('showSaveFilePicker' in window && window.self === window.top) {
        try {
            const allChannelIds = channels.map(c => c.id);
            const xmlContent = generateMasterXML(allChannelIds);
            
            const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const suggestedName = `${safeName || 'projeto_epg'}.xml`;

            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{
                    description: 'XML Files',
                    accept: { 'application/xml': ['.xml'] },
                }],
            });

            const writable = await handle.createWritable();
            await writable.write(xmlContent);
            await writable.close();

            const newFileName = handle.name.replace(/\.[^/.]+$/, "");
            projectName = newFileName;
            const nameInput = document.getElementById('projNameInput');
            if (nameInput) nameInput.value = projectName;

            const dateDisplay = document.getElementById('projDateDisplay');
            if (dateDisplay) dateDisplay.innerText = formatEPGDate(projectLastUpdate);

            window.customAlert(`Projeto "${projectName}" salvo com sucesso!`);
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.log("Migrando para fallback de salvamento: Ambiente restrito ou erro na API nativa.");
        }
    }

    // Fallback: Abre o modal para o usuário escolher o nome
    const modal = document.getElementById("modalSaveAsOverlay");
    const input = document.getElementById("saveAsNameInput");
    if (!modal || !input) return;
    
    input.value = projectName;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // Bloqueia scroll do fundo
    input.focus();
    input.select();
};

window.closeSaveAsModal = function() {
    const modal = document.getElementById("modalSaveAsOverlay");
    if (modal) {
        modal.classList.add("hidden");
        document.body.style.overflow = ""; // Restaura scroll do fundo
    }
};

window.confirmSaveAs = function() {
    const input = document.getElementById("saveAsNameInput");
    const newName = input ? input.value.trim() : "";
    
    if (newName === "") {
        return window.customAlert("O nome do projeto não pode ser vazio.");
    }
    
    projectName = newName;
    const nameInput = document.getElementById('projNameInput');
    if (nameInput) nameInput.value = projectName;
    
    window.closeSaveAsModal();
    window.saveProject();
};

window.toggleExportMasterChannels = function(checked) {
    document.querySelectorAll('.export-channel-check').forEach(cb => {
        cb.checked = checked;
    });
};

function renderExportChannelList() {
    const container = document.getElementById('exportMasterChannelsList');
    if (!container) return;
    container.innerHTML = "";
    
    channels.forEach(ch => {
        const item = document.createElement('label');
        item.className = "flex items-center gap-3 p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-zinc-700";
        item.innerHTML = `
            <input type="checkbox" checked value="${ch.id}" class="export-channel-check w-3 h-3 rounded bg-zinc-800 border-zinc-700 text-[#0a84ff] focus:ring-0">
            <span class="text-[10px] text-zinc-300 font-medium truncate">${ch.displayName}</span>
        `;
        container.appendChild(item);
    });
}

window.closeExportModal = () => {
    const overlay = document.getElementById('exportModalOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        document.body.style.overflow = ''; // Restaura scroll do fundo
    }
};

window.setExportTab = function(tab) {
    exportActiveTab = tab;
    document.querySelectorAll('.export-tab').forEach(t => {
        t.classList.remove('text-blue-500', 'active');
        t.classList.add('text-zinc-500');
    });
    
    const activeBtn = document.getElementById(`tab-${tab}`);
    if (activeBtn) {
        activeBtn.classList.add('text-blue-500', 'active');
        activeBtn.classList.remove('text-zinc-500');
    }

    document.getElementById('exportContentMaster').classList.add('hidden');
    document.getElementById('exportContentNormal').classList.add('hidden');
    document.getElementById('exportContentProject').classList.add('hidden');
    
    if (tab === 'master') document.getElementById('exportContentMaster').classList.remove('hidden');
    if (tab === 'normal') document.getElementById('exportContentNormal').classList.remove('hidden');
    if (tab === 'project') document.getElementById('exportContentProject').classList.remove('hidden');
};

window.updateExportDays = function(val) {
    let num = parseInt(val);
    if (isNaN(num)) num = 7;
    if (num < 1) num = 1;
    if (num > 30) num = 30; // Limite de 30 dias
    
    exportDaysToGenerate = num;
    const input = document.getElementById('exportDaysInput');
    if (input) input.value = num;
    
    document.getElementById('exportStartDate').innerText = `Início: ${new Date().toLocaleDateString('pt-BR')} (Hoje)`;
};

window.handleExportDaysWheel = function(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    let newValue = exportDaysToGenerate + delta;
    window.updateExportDays(newValue);
};

window.updateExportOptions = function() {
    const mergeCheck = document.getElementById('mergeSubtitleCheck');
    const separatorSelect = document.getElementById('subtitleSeparator');
    const separatorGroup = document.getElementById('subtitleSeparatorGroup');

    if (mergeCheck) {
        exportMergeSubtitle = mergeCheck.checked;
        if (separatorGroup) {
            if (exportMergeSubtitle) {
                separatorGroup.classList.remove('opacity-50', 'pointer-events-none');
            } else {
                separatorGroup.classList.add('opacity-50', 'pointer-events-none');
            }
        }
    }
    if (separatorSelect) {
        exportSubtitleSeparator = separatorSelect.value;
    }
};

// Gerador de XML Master (Backup) - Suporta <aprogramme> para arquivados
function generateMasterXML(selectedChannelIds = []) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n`;
    
    // Add project tag
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    projectLastUpdate = dateStr;
    xml += `  <project name="${projectName}" date="${dateStr}"/>\n`;
    
    const filteredChannels = selectedChannelIds.length > 0 
        ? channels.filter(ch => selectedChannelIds.includes(ch.id))
        : channels;

    filteredChannels.forEach(ch => {
        xml += `  <channel id="${ch.id}">\n    <display-name>${ch.displayName}</display-name>\n`;
        if (ch.date) xml += `    <date>${ch.date}</date>\n`;
        if (ch.icon) xml += `    <icon src="${ch.icon}" />\n`;
        xml += `  </channel>\n`;
    });

    programmes.forEach(p => {
        if (selectedChannelIds.length > 0 && !selectedChannelIds.includes(p.channelId)) return;

        const tagName = p.isArchived ? "aprogramme" : "programme";
        xml += `  <${tagName} start="${p.start}" stop="${p.stop}" channel="${p.channelId}">\n`;
        xml += `    <title>${p.title}</title>\n`;
        if (p.subTitle) xml += `    <sub-title>${p.subTitle}</sub-title>\n`;
        
        // Export daily subtitles
        if (p.dailySubtitles && Object.keys(p.dailySubtitles).length > 0) {
            xml += `    <st-day>\n`;
            Object.entries(p.dailySubtitles).forEach(([day, val]) => {
                if (val) xml += `      <${day}>${val}</${day}>\n`;
            });
            xml += `    </st-day>\n`;
        }

        if (p.desc) xml += `    <desc>${p.desc}</desc>\n`;

        // Export daily descriptions
        if (p.dailyDescriptions && Object.keys(p.dailyDescriptions).length > 0) {
            xml += `    <desc-day>\n`;
            Object.entries(p.dailyDescriptions).forEach(([day, val]) => {
                if (val) xml += `      <${day}>${val}</${day}>\n`;
            });
            xml += `    </desc-day>\n`;
        }

        if (p.iconSrc) xml += `    <icon src="${p.iconSrc}" />\n`;
        xml += `    <weekday days="${p.days.join(',')}" />\n`;
        xml += `    <rating><value>${p.rating}</value></rating>\n  </${tagName}>\n`;
    });
    xml += `</tv>`;
    return xml;
}

// Gerador de XML Padrão (Datas reais) - Ignora arquivados
function generateStandardXML(days) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="EPG Studio Professional">\n`;
    
    channels.forEach(ch => {
        xml += `  <channel id="${ch.id}">\n    <display-name>${ch.displayName}</display-name>\n`;
        if (ch.icon) xml += `    <icon src="${ch.icon}" />\n`;
        xml += `  </channel>\n`;
    });

    const now = new Date();
    
    for (let i = 0; i < days; i++) {
        const currentDate = new Date(now);
        currentDate.setDate(now.getDate() + i);
        
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        const datePrefix = `${yyyy}${mm}${dd}`;
        
        const jsDay = currentDate.getDay();
        const dayKey = DAYS.find(d => d.jsDay === jsDay).key;

        programmes.forEach(p => {
            if (!p.isArchived && p.days.includes(dayKey)) { // Ignora se arquivado
                const startFull = `${datePrefix}${p.start} -0300`;
                const startVal = parseInt(p.start);
                const stopVal = parseInt(p.stop);
                let stopFull = `${datePrefix}${p.stop} -0300`;
                
                // Se o stop for menor que o start, ou se for meia-noite (000000), avança um dia
                if (stopVal < startVal || (p.stop === '000000' && p.start !== '000000')) {
                    const tomorrow = new Date(currentDate);
                    tomorrow.setDate(currentDate.getDate() + 1);
                    const tY = tomorrow.getFullYear();
                    const tM = String(tomorrow.getMonth() + 1).padStart(2, '0');
                    const tD = String(tomorrow.getDate()).padStart(2, '0');
                    stopFull = `${tY}${tM}${tD}${p.stop} -0300`;
                }

                const resolvedSubTitle = (p.dailySubtitles && p.dailySubtitles[dayKey]) || p.subTitle;
                const resolvedDesc = (p.dailyDescriptions && p.dailyDescriptions[dayKey]) || p.desc;

                let finalTitle = p.title;
                if (exportMergeSubtitle && resolvedSubTitle) {
                    finalTitle = `${p.title}${exportSubtitleSeparator}${resolvedSubTitle}`;
                }

                xml += `  <programme start="${startFull}" stop="${stopFull}" channel="${p.channelId}">\n`;
                xml += `    <title lang="pt">${finalTitle}</title>\n`;
                if (resolvedSubTitle) xml += `    <sub-title lang="pt">${resolvedSubTitle}</sub-title>\n`;
                if (resolvedDesc) xml += `    <desc lang="pt">${resolvedDesc}</desc>\n`;
                if (p.iconSrc) xml += `    <icon src="${p.iconSrc}" />\n`;
                xml += `    <rating system="CLASSIND"><value>${p.rating}</value></rating>\n`;
                xml += `  </programme>\n`;
            }
        });
    }
    
    xml += `</tv>`;
    return xml;
}

window.handleExportDownload = function() {
    if (channels.length === 0) return window.customAlert("Nenhum dado para exportar.");
    
    let xmlContent = '';
    let fileName = '';

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const aaaa = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const dateFormatted = `${dd}-${mm}-${aaaa}-${hh}-${min}`;

    if (exportActiveTab === 'master' || exportActiveTab === 'project') {
        const selectedIds = Array.from(document.querySelectorAll('.export-channel-check:checked')).map(cb => cb.value);
        if (selectedIds.length === 0 && exportActiveTab === 'master') return window.customAlert("Selecione ao menos um canal para exportar.");
        
        xmlContent = generateMasterXML(selectedIds);
        const safeName = projectName.replace(/[^a-z0-9]/gi, '-');
        
        if (exportActiveTab === 'master') {
            fileName = `${safeName || 'backup'}-${dateFormatted}.xml`;
        } else {
            // Aba de projeto usa apenas o nome do projeto (sem data/hora)
            fileName = `${safeName || 'projeto'}.xml`;
        }
    } else {
        xmlContent = generateStandardXML(exportDaysToGenerate);
        fileName = `epg_standard_${exportDaysToGenerate}dias.xml`;
    }

    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    window.closeExportModal();
};

// --- Funções do Ciclo de Vida e Exportação ---

window.setView = function(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${view}`);
    if (btn) btn.classList.add('active');
    render();
};

window.selectChannel = function(id) { 
    selectedChannelId = id; 
    render(); 
};

window.openModalById = (id) => {
    const p = programmes.find(prog => prog.id === id);
    if (p) window.openModal(p);
};

window.handleDeleteProgram = function() {
    const id = document.getElementById("editId").value;
    if (!id) return;
    window.customConfirm("Excluir?", "Remover este programa permanentemente?", () => {
        programmes = programmes.filter(p => p.id !== id);
        window.closeModal(); 
        render();
        refreshArchivedListIfOpen();
    });
};

window.deleteChannel = function(id) {
    window.customConfirm("Excluir Canal?", "Excluir tudo deste canal?", () => {
        channels = channels.filter(ch => ch.id !== id);
        programmes = programmes.filter(p => p.channelId !== id);
        if (selectedChannelId === id) selectedChannelId = channels[0]?.id || null;
        render();
    });
};

window.openChannelModal = function() {
    const modal = document.getElementById("modalChannelOverlay");
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    modal.innerHTML = `
        <div class="bg-[#161618] w-full max-w-md rounded-2xl border border-[#0a84ff] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-6 border-b border-[#2c2c2e] bg-zinc-900 flex items-center justify-between">
                <h2 class="text-xl font-bold text-[#0a84ff]">Novo Canal</h2>
                <button onclick="window.closeChannelModal()" class="text-zinc-500 hover:text-white transition-colors text-2xl">×</button>
            </div>
            <div class="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                <div>
                    <label class="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">ID do Canal</label>
                    <input type="text" id="fcId" placeholder="ex: globo" class="w-full bg-[#1c1c1e] border border-[#2c2c2e] rounded-lg px-4 py-2 outline-none focus:border-[#0a84ff] text-sm">
                </div>
                <div>
                    <label class="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Nome de Exibição</label>
                    <input type="text" id="fcName" placeholder="Nome do Canal" class="w-full bg-[#1c1c1e] border border-[#2c2c2e] rounded-lg px-4 py-2 outline-none focus:border-[#0a84ff] text-sm">
                </div>
                <div>
                    <label class="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Logotipo (URL)</label>
                    <input type="text" id="fcIcon" oninput="window.updatePreview(this.value, 'channelIconPreview')" placeholder="https://..." class="w-full bg-[#1c1c1e] border border-[#2c2c2e] rounded-lg px-4 py-2 outline-none focus:border-[#0a84ff] text-sm">
                </div>
                <div id="channelIconPreview" class="w-full h-24 bg-black rounded-xl border border-[#2c2c2e] flex items-center justify-center overflow-hidden">
                    <span class="text-[10px] text-zinc-600">Logo Preview</span>
                </div>
            </div>
            <div class="p-6 border-t border-[#2c2c2e] bg-[#1a1a1c] flex items-center gap-3">
                <button onclick="window.closeChannelModal()" class="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition-all">Cancelar</button>
                <button onclick="window.saveNewChannel()" class="flex-1 bg-[#0a84ff] hover:bg-[#0070e0] text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20">Adicionar</button>
            </div>
        </div>
    `;
};

window.openEditChannelModal = function() {
    const ch = channels.find(c => c.id === selectedChannelId);
    if (!ch) return;
    const modal = document.getElementById("modalChannelOverlay");
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    
    modal.innerHTML = `
        <div class="bg-[#161618] w-full max-w-md rounded-2xl border border-[#0a84ff] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-6 border-b border-[#2c2c2e] bg-zinc-900 flex items-center justify-between">
                <h2 class="text-xl font-bold text-[#0a84ff]">Editar Canal</h2>
                <button onclick="window.closeChannelModal()" class="text-zinc-500 hover:text-white transition-colors text-2xl">×</button>
            </div>
            <div class="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                <div>
                    <label class="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">ID do Canal</label>
                    <input type="text" id="fcId" value="${ch.id}" class="w-full bg-[#1c1c1e] border border-[#2c2c2e] rounded-lg px-4 py-2 outline-none focus:border-[#0a84ff] text-sm">
                </div>
                <div>
                    <label class="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Nome de Exibição</label>
                    <input type="text" id="fcName" value="${ch.displayName}" class="w-full bg-[#1c1c1e] border border-[#2c2c2e] rounded-lg px-4 py-2 outline-none focus:border-[#0a84ff] text-sm">
                </div>
                <div>
                    <label class="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Logotipo (URL)</label>
                    <input type="text" id="fcIcon" value="${ch.icon || ''}" oninput="window.updatePreview(this.value, 'channelIconPreview')" class="w-full bg-[#1c1c1e] border border-[#2c2c2e] rounded-lg px-4 py-2 outline-none focus:border-[#0a84ff] text-sm">
                </div>
                <div id="channelIconPreview" class="w-full h-24 bg-black rounded-xl border border-[#2c2c2e] flex items-center justify-center overflow-hidden"></div>
                
                <div>
                    <label class="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Última Atualização</label>
                    <div class="w-full bg-black/40 border border-[#2c2c2e] rounded-lg px-4 py-2 text-xs font-mono text-zinc-500">
                        ${ch.date ? formatEPGDate(ch.date) : 'Sem registro'}
                    </div>
                </div>

                <div class="pt-4 border-t border-[#2c2c2e]">
                    <div class="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Atualizar Grade</span>
                            <span class="text-[9px] text-blue-500 italic">Importar XML</span>
                        </div>
                        <button onclick="document.getElementById('channelUpdateInput').click()" class="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
                            <span>📥</span> Importar XML para este Canal
                        </button>
                        <input type="file" id="channelUpdateInput" class="hidden" accept=".xml" onchange="window.handleChannelUpdateImport(this)">
                    </div>
                </div>
            </div>
            <div class="p-6 border-t border-[#2c2c2e] bg-[#1a1a1c] flex items-center gap-3">
                <button id="btnDeleteChannel" onclick="window.handleDeleteChannel()" class="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 px-4 py-2 rounded-lg text-xs font-bold transition-all">Excluir</button>
                <div class="flex-grow"></div>
                <button onclick="window.closeChannelModal()" class="text-zinc-500 hover:text-white text-xs font-bold px-4 py-2 transition-colors">Cancelar</button>
                <button onclick="window.saveNewChannel('${ch.id}')" class="bg-[#0a84ff] hover:bg-[#0070e0] text-white font-bold px-8 py-2 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20">Salvar</button>
            </div>
        </div>
    `;
    window.updatePreview(ch.icon || '', 'channelIconPreview');
};

window.handleChannelUpdateImport = function(input) {
    const file = input.files[0];
    if (!file || !selectedChannelId) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(e.target.result, "application/xml");
        
        // Remove programas antigos deste canal
        programmes = programmes.filter(p => p.channelId !== selectedChannelId);

        // Importa novos programas do XML
        const progTags = Array.from(xmlDoc.querySelectorAll("programme"));
        const archiveTags = Array.from(xmlDoc.querySelectorAll("aprogramme"));
        const allProgs = [...progTags.map(p => ({ p, isArchived: false })), ...archiveTags.map(p => ({ p, isArchived: true }))];

        const newProgs = allProgs.map((item, idx) => {
            const p = item.p;
            
            // Only take programs for THIS specific channel ID
            const channelAttr = p.getAttribute("channel");
            if (channelAttr !== selectedChannelId) return null;

            const dailySubtitles = {};
            const stDayEl = p.querySelector("st-day");
            if (stDayEl) {
                DAYS.forEach(d => {
                    const dayEl = stDayEl.querySelector(d.key);
                    if (dayEl) dailySubtitles[d.key] = dayEl.textContent;
                });
            }

            const dailyDescriptions = {};
            const descDayEl = p.querySelector("desc-day");
            if (descDayEl) {
                DAYS.forEach(d => {
                    const dayEl = descDayEl.querySelector(d.key);
                    if (dayEl) dailyDescriptions[d.key] = dayEl.textContent;
                });
            }

            return {
                id: `p-${Date.now()}-${idx}`,
                channelId: selectedChannelId,
                start: (p.getAttribute("start") || "").substring(0, 6),
                stop: (p.getAttribute("stop") || "").substring(0, 6),
                title: p.querySelector("title")?.textContent || "Sem Título",
                subTitle: p.querySelector("sub-title")?.textContent || "",
                dailySubtitles: dailySubtitles,
                desc: p.querySelector("desc")?.textContent || "",
                dailyDescriptions: dailyDescriptions,
                iconSrc: p.querySelector("icon")?.getAttribute("src") || "",
                days: (p.querySelector("weekday")?.getAttribute("days") || "").split(",").map(d => d.trim()).filter(d => d),
                rating: (p.querySelector("rating value")?.textContent || "L").toUpperCase(),
                isArchived: item.isArchived
            };
        }).filter(p => p !== null);

        programmes = [...programmes, ...newProgs];

        // Atualiza a data do canal
        const ch = channels.find(c => c.id === selectedChannelId);
        if (ch) {
            const now = new Date();
            const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
            ch.date = dateStr;
        }

        window.customAlert(`Grade do canal atualizada com sucesso! (${newProgs.length} programas importados)`);
        window.openEditChannelModal(); // Re-render modal to show new count/date if we decide to show it later
        render();
    };
    reader.readAsText(file);
    input.value = ""; // Clear input
};

window.closeChannelModal = () => {
    document.getElementById("modalChannelOverlay").classList.add("hidden");
    document.body.style.overflow = "auto";
};

window.saveNewChannel = function(editingId = null) {
    const newId = document.getElementById("fcId").value.trim();
    const name = document.getElementById("fcName").value.trim();
    const icon = document.getElementById("fcIcon").value.trim();
    
    if (!newId || !name) return window.customAlert("ID e Nome são campos obrigatórios.");

    if (editingId) {
        if (newId !== editingId && channels.some(ch => ch.id === newId)) {
            return window.customAlert("Este ID de canal já está sendo utilizado.");
        }
        channels = channels.map(ch => {
            if (ch.id === editingId) {
                return { ...ch, id: newId, displayName: name, icon };
            }
            return ch;
        });
        if (newId !== editingId) {
            programmes = programmes.map(p => {
                if (p.channelId === editingId) {
                    return { ...p, channelId: newId };
                }
                return p;
            });
            if (selectedChannelId === editingId) {
                selectedChannelId = newId;
            }
        }
    } else {
        if (channels.some(ch => ch.id === newId)) {
            return window.customAlert("Este ID de canal já existe.");
        }
        channels.push({ id: newId, displayName: name, icon, date: "" });
        selectedChannelId = newId;
    }
    
    window.closeChannelModal();
    render();
};

window.customConfirm = function(title, message, callback) {
    const overlay = document.getElementById('confirmOverlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = message;
    document.getElementById('confirmYes').onclick = () => { overlay.classList.add('hidden'); callback(); };
    document.getElementById('confirmNo').onclick = () => overlay.classList.add('hidden');
};

window.customAlert = function(msg) {
    const alert = document.getElementById('alertOverlay');
    if (!alert) return;
    alert.classList.remove('hidden');
    alert.innerHTML = `
        <div class="bg-[#161618] p-6 rounded-2xl border border-yellow-500 max-w-xs text-center shadow-2xl">
            <div class="text-3xl mb-2">⚠️</div>
            <p class="text-sm mb-4">${msg}</p>
            <button onclick="this.closest('#alertOverlay').classList.add('hidden')" class="bg-yellow-500 text-black px-6 py-2 rounded-lg font-bold">OK</button>
        </div>
    `;
};

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(event.target.result, "application/xml");
        
        // Importa metadados do projeto
        const projTag = xmlDoc.querySelector("project");
        if (projTag) {
            projectName = projTag.getAttribute("name") || "Projeto Importado";
            projectLastUpdate = projTag.getAttribute("date") || "";
        } else {
            // Se não tiver tag de projeto, usa o nome do arquivo (sem extensão)
            projectName = file.name.replace(/\.[^/.]+$/, "");
            projectLastUpdate = "";
        }

        channels = Array.from(xmlDoc.querySelectorAll("channel")).map(ch => ({
            id: ch.getAttribute("id"),
            displayName: ch.querySelector("display-name")?.textContent || "Canal",
            icon: ch.querySelector("icon")?.getAttribute("src") || "",
            date: ch.querySelector("date")?.textContent || ""
        }));

        // Importa tanto <programme> quanto <aprogramme>
        const progTags = Array.from(xmlDoc.querySelectorAll("programme"));
        const archiveTags = Array.from(xmlDoc.querySelectorAll("aprogramme"));
        
        const allProgs = [...progTags.map(p => ({ p, isArchived: false })), ...archiveTags.map(p => ({ p, isArchived: true }))];

        programmes = allProgs.map((item, idx) => {
            const p = item.p;
            
            // Daily Subtitles Parsing
            const dailySubtitles = {};
            const stDayEl = p.querySelector("st-day");
            if (stDayEl) {
                DAYS.forEach(d => {
                    const dayEl = stDayEl.querySelector(d.key);
                    if (dayEl) dailySubtitles[d.key] = dayEl.textContent;
                });
            }

            // Daily Descriptions Parsing
            const dailyDescriptions = {};
            const descDayEl = p.querySelector("desc-day");
            if (descDayEl) {
                DAYS.forEach(d => {
                    const dayEl = descDayEl.querySelector(d.key);
                    if (dayEl) dailyDescriptions[d.key] = dayEl.textContent;
                });
            }

            return {
                id: `p-${Date.now()}-${idx}`,
                channelId: p.getAttribute("channel"),
                start: (p.getAttribute("start") || "").substring(0, 6),
                stop: (p.getAttribute("stop") || "").substring(0, 6),
                title: p.querySelector("title")?.textContent || "Sem Título",
                subTitle: p.querySelector("sub-title")?.textContent || "",
                dailySubtitles: dailySubtitles,
                desc: p.querySelector("desc")?.textContent || "",
                dailyDescriptions: dailyDescriptions,
                iconSrc: p.querySelector("icon")?.getAttribute("src") || "",
                days: (p.querySelector("weekday")?.getAttribute("days") || "").split(",").map(d => d.trim()).filter(d => d),
                rating: (p.querySelector("rating value")?.textContent || "L").toUpperCase(),
                isArchived: item.isArchived
            };
        });

        if (channels.length > 0) {
          selectedChannelId = channels[0].id;
        } else {
          selectedChannelId = null;
        }
        render();
    };
    reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.addEventListener('change', handleImport);
    setInterval(() => {
        if (currentView === 'weekly') {
            const line = document.querySelector('.time-line');
            if (line) {
                const now = new Date();
                const minutes = (now.getHours() * 60) + now.getMinutes();
                line.style.top = `${(minutes * WEEKLY_MIN_HEIGHT) + 40}px`;
            }
        }
    }, 60000);
    render();
});