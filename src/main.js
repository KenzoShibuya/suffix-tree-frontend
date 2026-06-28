import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const API_BASE = '';

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function text(id, val) { document.getElementById(id).textContent = val; }

function showInfo(id, msg, type = 'info') {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `info-box ${type}`;
  el.classList.remove('hidden');
}

function hideInfo(id) {
  document.getElementById(id).classList.add('hidden');
}

// Small badge above the shared text panel saying what it's currently showing.
function setViewMode(label) {
  const box = document.getElementById('view-mode');
  if (!label) { box.classList.add('hidden'); return; }
  document.getElementById('view-mode-label').textContent = label;
  box.classList.remove('hidden');
}

const ERROR_MESSAGES = {
  search_doc_missing: 'No hay ningún documento subido para cargar.',
  search_doc_multiple: 'Hay más de un documento; deja solo uno.',
  no_document: 'Primero carga un documento en el árbol.',
  empty_pattern: 'El patrón de búsqueda está vacío.',
  no_corpus: 'Primero construye el árbol del corpus.',
  corpus_dir_empty: 'El corpus está vacío; sube al menos un archivo.',
  too_many_documents: 'Demasiados documentos en el corpus (máx. 254).',
  corpus_too_large: 'El corpus excede el tamaño máximo (2M caracteres).',
  benchmark_file_missing: 'No se encontraron archivos de benchmark.',
};

function friendlyError(msg) {
  return ERROR_MESSAGES[msg] || msg;
}

async function api(url, body) {
  const opts = { method: 'POST' };
  if (body instanceof FormData) {
    opts.body = body;
  } else {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${url}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || 'Error');
  return data;
}

// ── Document upload / load ────────────────────────────────────────────────────

document.getElementById('doc-upload-btn').addEventListener('click', async () => {
  const input = document.getElementById('doc-file-input');
  if (!input.files.length) { showInfo('doc-info', 'Selecciona un archivo primero', 'error'); return; }
  hideInfo('doc-info');
  const fd = new FormData();
  fd.append('file', input.files[0]);
  try {
    const data = await api('/document/upload', fd);
    showInfo('doc-info', `"${data.filename}" subido (${data.char_count} caracteres)`, 'success');
  } catch (e) {
    showInfo('doc-info', `Error: ${friendlyError(e.message)}`, 'error');
  }
});

document.getElementById('doc-load-btn').addEventListener('click', async () => {
  hideInfo('doc-info');
  hide('search-results');
  try {
    const data = await api('/document/load');
    showInfo('doc-info', `"${data.filename}" cargado en el árbol`, 'success');
    show('doc-build-stats');
    text('doc-filename-label', `Archivo: ${data.filename}`);
    text('doc-chars-label', `Caracteres: ${data.char_count.toLocaleString()}`);
    text('doc-build-time-label', `Construcción: ${data.build_time_ms.toFixed(2)} ms`);
    window._docText = data.text_original;
    setViewMode('');
    renderText(data.text_original);
  } catch (e) {
    showInfo('doc-info', `Error: ${friendlyError(e.message)}`, 'error');
  }
});

// ── Search ────────────────────────────────────────────────────────────────────

document.getElementById('search-btn').addEventListener('click', async () => {
  const pattern = document.getElementById('search-input').value.trim();
  if (!pattern) { showInfo('doc-info', 'Escribe un patrón', 'error'); return; }
  hide('search-results');
  try {
    const data = await api('/document/search', { pattern });
    show('search-results');
    text('search-count-label', `Coincidencias: ${data.count}`);
    text('search-time-label', `Tiempo: ${data.search_time_ms.toFixed(4)} ms`);
    text('search-positions-label', `Posiciones: ${data.original_occurrences.join(', ') || '—'}`);

    if (data.tree_path && data.tree_path.length) {
      show('tree-path-box');
      text('tree-path-content', data.tree_path.join(' → '));
    } else {
      hide('tree-path-box');
    }

    setViewMode(data.count ? `Búsqueda: "${pattern}"` : '');
    highlightOccurrences(data.original_occurrences);
  } catch (e) {
    showInfo('doc-info', `Error: ${friendlyError(e.message)}`, 'error');
  }
});

// ── Text rendering & highlighting ─────────────────────────────────────────────

function renderText(text) {
  const el = document.getElementById('text-display');
  el.textContent = text || '(sin documento)';
}

let occMarks = [];
let occIndex = -1;

function highlightOccurrences(positions) {
  const el = document.getElementById('text-display');
  const nav = document.getElementById('occ-nav');
  occMarks = [];
  occIndex = -1;

  // Re-render plain text first so a search with 0 results clears old highlights.
  renderText(window._docText || '');
  const text = el.textContent;

  const pattern = document.getElementById('search-input').value.trim().toLowerCase();
  if (!text || !positions.length || !pattern) {
    nav.classList.add('hidden');
    return;
  }

  const parts = [];
  let lastIdx = 0;
  const sorted = [...positions].sort((a, b) => a - b);

  for (const pos of sorted) {
    if (pos < lastIdx) continue;
    if (pos > lastIdx) {
      parts.push(text.slice(lastIdx, pos));
    }
    const end = Math.min(pos + pattern.length, text.length);
    parts.push(`<mark class="occ">${text.slice(pos, end)}</mark>`);
    lastIdx = end;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  el.innerHTML = parts.join('');

  occMarks = Array.from(el.querySelectorAll('mark.occ'));
  if (occMarks.length) {
    nav.classList.remove('hidden');
    gotoOcc(0);
  } else {
    nav.classList.add('hidden');
  }
}

function gotoOcc(i) {
  if (!occMarks.length) return;
  occIndex = (i + occMarks.length) % occMarks.length;
  occMarks.forEach(m => m.classList.remove('active'));
  const mark = occMarks[occIndex];
  mark.classList.add('active');
  mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
  text('occ-position', `${occIndex + 1} / ${occMarks.length}`);
}

document.getElementById('occ-prev').addEventListener('click', () => gotoOcc(occIndex - 1));
document.getElementById('occ-next').addEventListener('click', () => gotoOcc(occIndex + 1));
document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('search-btn').click();
});

// ── Corpus upload / build ────────────────────────────────────────────────────

document.getElementById('corpus-upload-btn').addEventListener('click', async () => {
  const input = document.getElementById('corpus-file-input');
  if (!input.files.length) { showInfo('corpus-info', 'Selecciona al menos un archivo', 'error'); return; }
  hideInfo('corpus-info');
  const fd = new FormData();
  for (const f of input.files) fd.append('files', f);
  try {
    const data = await api('/corpus/upload', fd);
    showInfo('corpus-info', `${data.saved.length} archivo(s) guardado(s) (${data.total_chars} caracteres)`, 'success');
  } catch (e) {
    showInfo('corpus-info', `Error: ${friendlyError(e.message)}`, 'error');
  }
});

document.getElementById('corpus-build-btn').addEventListener('click', async () => {
  hideInfo('corpus-info');
  hide('detect-results');
  try {
    const data = await api('/corpus/build');
    showInfo('corpus-info', 'Árbol del corpus construido', 'success');
    show('corpus-stats');
    text('corpus-sources-label', `Fuentes: ${data.sources.join(', ')}`);
    text('corpus-chars-label', `Caracteres: ${data.total_chars.toLocaleString()}`);
    text('corpus-build-time-label', `Construcción: ${data.build_time_ms.toFixed(2)} ms`);
  } catch (e) {
    showInfo('corpus-info', `Error: ${friendlyError(e.message)}`, 'error');
  }
});

// ── Plagiarism detection ──────────────────────────────────────────────────────

document.getElementById('detect-btn').addEventListener('click', async () => {
  const minLen = parseInt(document.getElementById('min-match-length').value) || 40;
  hideInfo('corpus-info');
  hide('detect-results');
  try {
    const data = await api('/detect', { min_match_length: minLen });
    show('detect-results');
    text('detect-global-pct', `Global: ${data.global_pct}% del documento coincide con el corpus`);

    const sources = Object.entries(data.by_source);
    if (sources.length) {
      show('detect-by-source');
      const el = document.getElementById('detect-by-source');
      el.innerHTML = '<p><strong>Por fuente:</strong></p>' +
        sources.map(([src, pct]) => `<p>${src}: ${pct}%</p>`).join('');
    } else {
      hide('detect-by-source');
    }

    renderPlagiarismSpans(data.spans);
  } catch (e) {
    showInfo('corpus-info', `Error: ${friendlyError(e.message)}`, 'error');
  }
});

function renderPlagiarismSpans(spans) {
  const el = document.getElementById('text-display');
  const text = window._docText || '';
  // Plagiarism takes over the shared text panel: clear any Ctrl+F nav.
  document.getElementById('occ-nav').classList.add('hidden');
  occMarks = [];
  occIndex = -1;

  if (!text) { setViewMode(''); el.textContent = '(sin documento)'; return; }

  if (!spans.length) {
    setViewMode('Plagio: sin coincidencias');
    el.textContent = text;
    return;
  }

  setViewMode('Resaltando coincidencias con el corpus');

  const sorted = [...spans].sort((a, b) => a.original_start - b.original_start);
  const parts = [];
  let lastIdx = 0;

  for (const span of sorted) {
    const s = span.original_start;
    const e = span.original_end;
    if (s > lastIdx) parts.push(text.slice(lastIdx, s));
    parts.push(`<mark class="plagiarism-span" title="Fuente: ${span.source}">${text.slice(s, e)}</mark>`);
    lastIdx = e;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  el.innerHTML = parts.join('');
}

// ── Benchmark ─────────────────────────────────────────────────────────────────

document.getElementById('benchmark-upload-btn').addEventListener('click', async () => {
  const input = document.getElementById('benchmark-file-input');
  if (!input.files.length) {
    showInfo('benchmark-upload-info', 'Selecciona al menos un archivo', 'error');
    return;
  }
  hideInfo('benchmark-upload-info');
  const fd = new FormData();
  for (const f of input.files) fd.append('files', f);
  try {
    const data = await api('/benchmark/upload', fd);
    const statsEl = document.getElementById('benchmark-upload-stats');
    statsEl.innerHTML = data.saved.map(s =>
      `<div class="stat-row"><strong>${s.filename}</strong> — ${s.char_count.toLocaleString()} caracteres · ${s.word_count.toLocaleString()} palabras</div>`
    ).join('');
    show('benchmark-upload-stats');
    showInfo('benchmark-upload-info', `${data.saved.length} archivo(s) listos para benchmark`, 'success');
  } catch (e) {
    showInfo('benchmark-upload-info', `Error: ${friendlyError(e.message)}`, 'error');
  }
});

document.getElementById('benchmark-btn').addEventListener('click', async () => {
  const pattern = document.getElementById('benchmark-pattern').value || 'the';
  hide('benchmark-results');
  try {
    const data = await api('/benchmark', { pattern });
    show('benchmark-results');

    const tbody = document.getElementById('benchmark-tbody');
    tbody.innerHTML = data.results.map(r => {
      const speedup = r.naive_search_ms > 0
        ? (r.naive_search_ms / r.suffix_tree_search_ms).toFixed(1) + 'x'
        : '—';
      const charsLabel = r.size >= 1_000_000
        ? (r.size / 1_000_000).toFixed(2) + 'M'
        : (r.size / 1_000).toFixed(1) + 'K';
      const wordsLabel = r.word_count >= 1_000
        ? (r.word_count / 1_000).toFixed(1) + 'K'
        : r.word_count;
      return `<tr>
        <td>${r.file}</td>
        <td>${charsLabel}</td>
        <td>${wordsLabel}</td>
        <td>${r.suffix_tree_build_ms.toFixed(2)}</td>
        <td>${r.suffix_tree_search_ms.toFixed(4)}</td>
        <td>${r.naive_search_ms.toFixed(2)}</td>
        <td>${speedup}</td>
        <td>${r.occurrences}</td>
      </tr>`;
    }).join('');

    renderBenchmarkChart(data.results);
  } catch (e) {
    document.getElementById('benchmark-results').innerHTML =
      `<div class="info-box error">Error: ${friendlyError(e.message)}</div>`;
    show('benchmark-results');
  }
});

const _charts = { build: null, search: null };

function makeChartOptions(title, tooltipDecimals) {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', size: 12 },
          color: '#444',
          boxWidth: 12,
          borderRadius: 3,
        },
      },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.x.toFixed(tooltipDecimals)} ms`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: { color: '#666', font: { size: 11 }, callback: v => v + ' ms' },
        title: { display: true, text: title, color: '#888', font: { size: 11 } },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#333', font: { size: 12 } },
      },
    },
  };
}

function renderBenchmarkChart(results) {
  const labels = results.map(r => r.file.replace(/\.txt$/, ''));
  const h = Math.max(220, results.length * 52) + 'px';

  // Destroy previous instances
  for (const key of Object.keys(_charts)) {
    if (_charts[key]) { _charts[key].destroy(); _charts[key] = null; }
  }

  // Chart 1: Construction time
  const buildCanvas = document.getElementById('chart-build');
  buildCanvas.parentElement.style.height = h;
  _charts.build = new Chart(buildCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Construcción ST (ms)',
        data: results.map(r => r.suffix_tree_build_ms),
        backgroundColor: 'rgba(52, 85, 126, 0.82)',
        borderRadius: 4,
      }],
    },
    options: makeChartOptions('Tiempo de construcción (ms)', 2),
  });

  // Chart 2: ST search vs Naive search
  const searchCanvas = document.getElementById('chart-search');
  searchCanvas.parentElement.style.height = h;
  _charts.search = new Chart(searchCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Búsqueda ST (ms)',
          data: results.map(r => r.suffix_tree_search_ms),
          backgroundColor: 'rgba(46, 107, 62, 0.82)',
          borderRadius: 4,
        },
        {
          label: 'Búsqueda Naive (ms)',
          data: results.map(r => r.naive_search_ms),
          backgroundColor: 'rgba(154, 42, 42, 0.82)',
          borderRadius: 4,
        },
      ],
    },
    options: makeChartOptions('Tiempo de búsqueda (ms)', 4),
  });
}
