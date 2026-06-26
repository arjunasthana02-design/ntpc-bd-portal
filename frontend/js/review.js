const REVIEW_API = "http://127.0.0.1:8000/reports";
let submissions = [];

document.addEventListener("DOMContentLoaded", () => {
    const reloadBtn = document.getElementById("reloadReviewBtn");
    if (reloadBtn) {
        reloadBtn.addEventListener("click", loadReview);
    }
    loadReview();
});

async function loadReview() {
    try {
        const response = await fetch(`${REVIEW_API}/submissions`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to load submissions");
        }

        submissions = Array.isArray(data) ? data : [];
        renderReviewStats();
        renderReviewList();
    } catch (error) {
        const list = document.getElementById("reviewList");
        if (list) {
            list.innerHTML = `<p class="muted-text">${escapeHtml(error.message || "Cannot connect to backend.")}</p>`;
        }
    }
}

function renderReviewStats() {
    const total = document.getElementById("reviewTotal");
    const pending = document.getElementById("reviewPending");
    const approved = document.getElementById("reviewApproved");

    if (total) total.textContent = submissions.length;
    if (pending) pending.textContent = submissions.filter(item => item.status === "Under Review").length;
    if (approved) approved.textContent = submissions.filter(item => item.status === "Approved").length;
}

function renderReviewList() {
    const list = document.getElementById("reviewList");
    if (!list) return;

    if (!submissions.length) {
        list.innerHTML = `<p class="muted-text">No uploaded data has been submitted yet.</p>`;
        return;
    }

    list.innerHTML = submissions.map(item => `
        <article class="review-card">
            <div class="review-card-head">
                <div>
                    <h3>${escapeHtml(item.company || item.topic || "Untitled Submission")}</h3>
                    <p>
                        <strong>${escapeHtml(item.report_type || "")}</strong>
                        ${item.week_label ? ` | ${escapeHtml(item.week_label)}` : ""}
                        | ${escapeHtml(item.section_code || "")} - ${escapeHtml(item.section_title || "")}
                    </p>
                    <p>
                        ${escapeHtml(item.period_start || "")} to ${escapeHtml(item.period_end || "")}
                    </p>
                    <p>
                        <strong>Project:</strong> ${escapeHtml(item.project || "-")}
                        ${item.subtopic ? ` | <strong>Subtopic:</strong> ${escapeHtml(item.subtopic)}` : ""}
                    </p>
                    <p>
                        <strong>Submitted by:</strong> ${escapeHtml(item.submitted_by || "Unknown")}
                    </p>
                    ${item.file_names || item.file_name ? `
                        <p><strong>Files:</strong> ${escapeHtml(item.file_names || item.file_name)}</p>
                    ` : ""}
                </div>

                <span class="status-badge ${getStatusClass(item.status)}">
                    ${escapeHtml(item.status || "")}
                </span>
            </div>

            <div class="form-grid">
                <label>
                    Company
                    <input id="company-${item.submission_id}" value="${escapeAttribute(item.company || "")}" />
                </label>

                <label>
                    Project
                    <input id="project-${item.submission_id}" value="${escapeAttribute(item.project || "")}" />
                </label>

                <label>
                    Topic
                    <input id="topic-${item.submission_id}" value="${escapeAttribute(item.topic || "")}" />
                </label>

                <label>
                    Subtopic
                    <input id="subtopic-${item.submission_id}" value="${escapeAttribute(item.subtopic || "")}" />
                </label>
            </div>

            <label class="review-text-label">
                Extracted / editable information
                <textarea id="text-${item.submission_id}" rows="8">${escapeTextarea(item.extracted_text || "")}</textarea>
            </label>

            <label class="review-text-label">
                Review note
                <input id="note-${item.submission_id}" value="${escapeAttribute(item.review_note || "")}" />
            </label>

            <div class="form-actions">
                <button class="mini-btn" type="button" onclick="saveSubmission(${item.submission_id})">Save Edit</button>
                <button class="mini-btn" type="button" onclick="reviewSubmission(${item.submission_id}, 'Approved')">Approve</button>
                <button class="danger-btn" type="button" onclick="reviewSubmission(${item.submission_id}, 'Rejected')">Reject</button>
                <button class="danger-btn" type="button" onclick="deleteSubmission(${item.submission_id})">Delete</button>
                <a class="secondary-btn" href="${(item.report_type || '').toUpperCase() === 'MONTHLY' ? 'monthly_reports.html' : 'weekly_reports.html'}">Open Report</a>
            </div>
        </article>
    `).join("");
}

async function saveSubmission(id) {
    const item = submissions.find(submission => submission.submission_id === id);
    if (!item) return;

    const payload = {
        report_type: normalizeReportType(item.report_type),
        period_start: item.period_start || "",
        period_end: item.period_end || "",
        section_code: item.section_code || "",
        section_title: item.section_title || "",
        company: document.getElementById(`company-${id}`).value.trim(),
        project: document.getElementById(`project-${id}`).value.trim(),
        topic: document.getElementById(`topic-${id}`).value.trim(),
        subtopic: document.getElementById(`subtopic-${id}`).value.trim(),
        submitted_by: item.submitted_by || "",
        text_data: document.getElementById(`text-${id}`).value.trim(),
        source_type: item.source_type || "Raw Text"
    };

    try {
        const response = await fetch(`${REVIEW_API}/submissions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to save submission");
        }

        await loadReview();
    } catch (error) {
        alert(error.message || "Failed to save submission");
    }
}

async function reviewSubmission(id, status) {
    try {
        const response = await fetch(`${REVIEW_API}/submissions/${id}/review`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status,
                review_note: document.getElementById(`note-${id}`).value.trim()
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `Failed to mark submission as ${status}`);
        }

        await loadReview();
    } catch (error) {
        alert(error.message || `Failed to mark submission as ${status}`);
    }
}

async function deleteSubmission(id) {
    if (!confirm("Delete this submission and its linked report entry?")) return;

    try {
        const response = await fetch(`${REVIEW_API}/submissions/${id}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to delete submission");
        }

        await loadReview();
    } catch (error) {
        alert(error.message || "Failed to delete submission");
    }
}

function normalizeReportType(value) {
    return String(value || "").toUpperCase() === "MONTHLY" ? "MONTHLY" : "WEEKLY";
}

function getStatusClass(status) {
    if (status === "Approved" || status === "Final") return "approved";
    if (status === "Rejected") return "rejected";
    return "pending";
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeTextarea(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}