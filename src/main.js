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
    showInfo('doc-info', `Error: ${e.message}`, 'error');
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
    renderText(data.text_original);
  } catch (e) {
    showInfo('doc-info', `Error: ${e.message}`, 'error');
  }
});

// ── Search ────────────────────────────────────────────────────────────────────

document.getElementById('search-btn').addEventListener('click', async () => {
  const pattern = document.getElementById('search-input').value.trim();
  if (!pattern) { showInfo('doc-info', 'Escribe un patrón', 'error'); return; }
  hideInfo('search-results');
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

    highlightOccurrences(data.original_occurrences);
  } catch (e) {
    showInfo('doc-info', `Error: ${e.message}`, 'error');
  }
});

// ── Text rendering & highlighting ─────────────────────────────────────────────

function renderText(text) {
  const el = document.getElementById('text-display');
  el.textContent = text || '(sin documento)';
}

function highlightOccurrences(positions) {
  const el = document.getElementById('text-display');
  const text = el.textContent;
  if (!text || !positions.length) return;

  const pattern = document.getElementById('search-input').value.trim().toLowerCase();
  if (!pattern) return;

  const parts = [];
  let lastIdx = 0;
  const sorted = [...positions].sort((a, b) => a - b);

  for (const pos of sorted) {
    if (pos < lastIdx) continue;
    if (pos > lastIdx) {
      parts.push(text.slice(lastIdx, pos));
    }
    const end = Math.min(pos + pattern.length, text.length);
    parts.push(`<mark>${text.slice(pos, end)}</mark>`);
    lastIdx = end;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  el.innerHTML = parts.join('');
}

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
    showInfo('corpus-info', `Error: ${e.message}`, 'error');
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
    showInfo('corpus-info', `Error: ${e.message}`, 'error');
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
    showInfo('corpus-info', `Error: ${e.message}`, 'error');
  }
});

function renderPlagiarismSpans(spans) {
  const el = document.getElementById('detect-spans');
  const text = window._docText || '';
  if (!text) { el.textContent = '(sin documento)'; return; }

  if (!spans.length) {
    el.innerHTML = '<em>No se detectaron coincidencias significativas.</em>';
    return;
  }

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
      const sizeLabel = r.size >= 1_000_000
        ? (r.size / 1_000_000).toFixed(1) + 'M'
        : (r.size / 1_000).toFixed(0) + 'K';
      return `<tr>
        <td>${sizeLabel}</td>
        <td>${r.file}</td>
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
      `<div class="info-box error">Error: ${e.message}</div>`;
    show('benchmark-results');
  }
});

function renderBenchmarkChart(results) {
  const container = document.getElementById('benchmark-chart');
  const maxVal = Math.max(...results.map(r => Math.max(r.suffix_tree_build_ms, r.suffix_tree_search_ms * 100, r.naive_search_ms)));

  container.innerHTML = `
    <div class="chart-bars">
      ${results.map(r => {
        const sizeLabel = r.size >= 1_000_000
          ? (r.size / 1_000_000).toFixed(1) + 'M'
          : (r.size / 1_000).toFixed(0) + 'K';
        const buildH = (r.suffix_tree_build_ms / maxVal * 180);
        const searchH = Math.max(4, (r.suffix_tree_search_ms * 100 / maxVal * 180));
        const naiveH = (r.naive_search_ms / maxVal * 180);
        return `<div class="chart-group">
          <div class="bars">
            <div class="chart-bar build" style="height:${buildH}px" title="Build: ${r.suffix_tree_build_ms.toFixed(2)}ms">
              <span class="bar-label">${r.suffix_tree_build_ms.toFixed(1)}</span>
            </div>
            <div class="chart-bar search" style="height:${searchH}px" title="Search ST: ${r.suffix_tree_search_ms.toFixed(4)}ms">
              <span class="bar-label">${r.suffix_tree_search_ms.toFixed(3)}</span>
            </div>
            <div class="chart-bar naive" style="height:${naiveH}px" title="Naive: ${r.naive_search_ms.toFixed(2)}ms">
              <span class="bar-label">${r.naive_search_ms.toFixed(1)}</span>
            </div>
          </div>
          <div class="x-label">${sizeLabel}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="chart-legend">
      <span class="legend-build">Construcción</span>
      <span class="legend-search">Búsqueda ST</span>
      <span class="legend-naive">Búsqueda Naive</span>
    </div>
  `;
}
