const RAW_API = "http://127.0.0.1:8000";

let rawRows = [];
let activeRawId = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("rawSearchBtn")?.addEventListener("click", loadRawDocuments);
    document.getElementById("rawSaveBtn")?.addEventListener("click", saveRawEdit);
    loadRawDocuments();
});

async function loadRawDocuments() {
    const params = new URLSearchParams();
    addParam(params, "q", "rawQ");
    addParam(params, "company", "rawCompany");
    addParam(params, "project", "rawProject");
    addParam(params, "employee", "rawEmployee");
    addParam(params, "business_avenue", "rawAvenue");
    addParam(params, "date_from", "rawDateFrom");
    addParam(params, "date_to", "rawDateTo");
    const response = await fetch(`${RAW_API}/raw-documents/search?${params}`);
    rawRows = await response.json();
    renderRawTable(Array.isArray(rawRows) ? rawRows : []);
}

function renderRawTable(rows) {
    document.getElementById("rawCount").textContent = `${rows.length} record(s)`;
    const table = document.getElementById("rawTable");
    if (!rows.length) {
        table.innerHTML = `<tr><td colspan="5" class="empty-table-cell">No raw documents found.</td></tr>`;
        return;
    }
    table.innerHTML = rows.map(row => `
        <tr>
            <td>${escapeHtml(row.data_title || row.file_name || "Untitled")}</td>
            <td>${escapeHtml(row.company || "-")}</td>
            <td>${escapeHtml(row.project || "-")}</td>
            <td><span class="status-badge pending">${escapeHtml(row.status || "Under Review")}</span></td>
            <td class="table-actions">
                <button class="table-action-btn" data-open="${row.submission_id}">Open</button>
                ${row.stored_path ? `<a class="table-action-btn" href="${RAW_API}/reports/submissions/${row.submission_id}/download">Download</a>` : ""}
            </td>
        </tr>
    `).join("");
    table.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => openRaw(Number(btn.dataset.open))));
}

function openRaw(id) {
    const row = rawRows.find(item => item.submission_id === id);
    if (!row) return;
    activeRawId = id;
    document.getElementById("rawMeta").textContent = [row.company, row.project, row.topic, row.submitted_by].filter(Boolean).join(" | ");
    document.getElementById("rawEditor").innerText = row.extracted_text || "No extracted text available.";
}

async function saveRawEdit() {
    if (!activeRawId) {
        show("Select a raw document first.", "error");
        return;
    }
    const text = document.getElementById("rawEditor").innerText;
    const response = await fetch(`${RAW_API}/reports/submissions/${activeRawId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_text: text })
    });
    const data = await response.json();
    if (!response.ok) {
        show(data.detail || "Save failed.", "error");
        return;
    }
    show("Raw document edit saved.", "success");
    loadRawDocuments();
}

function addParam(params, name, id) {
    const value = document.getElementById(id)?.value.trim();
    if (value) params.set(name, value);
}

function show(text, type) {
    const el = document.getElementById("rawMessage");
    el.textContent = text;
    el.className = `inline-message ${type}`;
}

function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
