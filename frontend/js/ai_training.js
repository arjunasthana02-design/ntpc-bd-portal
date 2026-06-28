const TRAINING_API = ntpcApiBase();

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("trainingForm")?.addEventListener("submit", uploadTraining);
    document.getElementById("reloadTrainingBtn")?.addEventListener("click", loadTraining);
    loadTraining();
});

async function uploadTraining(event) {
    event.preventDefault();
    const file = document.getElementById("trainingFile").files[0];
    if (!file) return showTraining("Select a file.", "error");
    const user = currentUser();
    const form = new FormData();
    form.append("title", document.getElementById("trainingTitle").value.trim());
    form.append("category", document.getElementById("trainingCategory").value);
    form.append("company", document.getElementById("trainingCompany").value.trim());
    form.append("project", document.getElementById("trainingProject").value.trim());
    form.append("topic", document.getElementById("trainingTopic").value.trim());
    form.append("business_avenue", document.getElementById("trainingAvenue").value.trim());
    form.append("uploaded_by", user?.name || user?.username || "Admin");
    form.append("file", file);
    showTraining("Uploading and extracting document text...", "");
    const response = await fetch(`${TRAINING_API}/reports/training`, { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) return showTraining(data.detail || "Upload failed.", "error");
    event.target.reset();
    showTraining("Training document uploaded.", "success");
    loadTraining();
}

async function loadTraining() {
    const response = await fetch(`${TRAINING_API}/reports/training`);
    const rows = await response.json();
    const table = document.getElementById("trainingTable");
    if (!Array.isArray(rows) || !rows.length) {
        table.innerHTML = `<tr><td colspan="6" class="empty-table-cell">No AI training material uploaded yet.</td></tr>`;
        return;
    }
    table.innerHTML = rows.map(row => `
        <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.company || "-")}</td>
            <td>${escapeHtml(row.topic || row.business_avenue || "-")}</td>
            <td>${escapeHtml(String(row.created_at || "").slice(0, 10))}</td>
            <td>${row.stored_path ? `<a class="table-action-btn" href="${TRAINING_API}/reports/training/${row.training_id}/download">Download</a>` : "-"}</td>
        </tr>
    `).join("");
}

function showTraining(text, type) {
    const el = document.getElementById("trainingMessage");
    el.textContent = text;
    el.className = `inline-message ${type || ""}`;
}

function currentUser() {
    try { return JSON.parse(localStorage.getItem("ntpcUser") || "null"); } catch { return null; }
}

function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
