const REPORT_API = ntpcApiBase();

(function () {
    const reportType = document.body.dataset.reportType || "weekly";
    const els = {
        uploadedWeekFilter: document.getElementById("uploadedWeekFilter"),
        uploadedMonthFilter: document.getElementById("uploadedMonthFilter"),
        uploadedYearFilter: document.getElementById("uploadedYearFilter"),
        weeklyPeriodStart: document.getElementById("weeklyPeriodStart"),
        weeklyPeriodEnd: document.getElementById("weeklyPeriodEnd"),
        weeklyReportTitle: document.getElementById("weeklyReportTitle"),
        monthlyReportDate: document.getElementById("monthlyReportDate"),
        monthlyReportTitle: document.getElementById("monthlyReportTitle"),
        uploadedDataList: document.getElementById("uploadedDataList"),
        uploadedDataMessage: document.getElementById("uploadedDataMessage"),
        reportMessage: document.getElementById("reportMessage"),
        entriesTable: document.getElementById("entriesTable"),
        reportEditor: document.getElementById("reportEditor")
    };

    let currentDraftId = null;
    let loadedSources = [];

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        setDefaultDates();
        bindEvents();
        bindToolbar();
        initialiseBlankEditor();
        loadUploadedData();
        loadSavedReports();
    }

    function bindEvents() {
        byId("reloadUploadedDataBtn")?.addEventListener("click", loadUploadedData);
        byId("useUploadedDataBtn")?.addEventListener("click", generateReport);
        byId("loadEntriesBtn")?.addEventListener("click", loadSavedReports);
        byId("refreshPreviewBtn")?.addEventListener("click", () => message("reportMessage", "Editor refreshed.", "success"));
        byId("saveEditedReportBtn")?.addEventListener("click", saveEditedReport);
        byId("exportPdfBtn")?.addEventListener("click", () => exportHtml("html"));
        byId("exportWordBtn")?.addEventListener("click", () => exportHtml("doc"));
        byId("exportExcelBtn")?.addEventListener("click", exportCsv);
        byId("reportSearchBtn")?.addEventListener("click", searchInReport);
        byId("reportClearSearchBtn")?.addEventListener("click", clearSearch);
        els.uploadedWeekFilter?.addEventListener("change", loadUploadedData);
        els.uploadedMonthFilter?.addEventListener("change", loadUploadedData);
        els.uploadedYearFilter?.addEventListener("change", loadUploadedData);
    }

    function bindToolbar() {
        document.querySelectorAll(".toolbar-btn[data-cmd]").forEach(btn => {
            btn.addEventListener("click", () => {
                document.execCommand(btn.dataset.cmd, false, null);
                els.reportEditor?.focus();
            });
        });
        bindCommandSelect("fontNameSelect", "fontName");
        bindCommandSelect("fontSizeSelect", "fontSize");
        bindCommandSelect("formatBlockSelect", "formatBlock");
        byId("foreColorPicker")?.addEventListener("input", e => document.execCommand("foreColor", false, e.target.value));
        byId("highlightColorPicker")?.addEventListener("input", e => document.execCommand("hiliteColor", false, e.target.value));
        byId("insertHrBtn")?.addEventListener("click", () => document.execCommand("insertHorizontalRule", false, null));
        byId("clearFormattingBtn")?.addEventListener("click", () => document.execCommand("removeFormat", false, null));
    }

    function bindCommandSelect(id, command) {
        byId(id)?.addEventListener("change", e => {
            document.execCommand(command, false, e.target.value || "P");
            els.reportEditor?.focus();
        });
    }

    async function loadUploadedData() {
        try {
            const params = new URLSearchParams();
            if (reportType === "weekly" && els.uploadedWeekFilter?.value) {
                params.set("q", els.uploadedWeekFilter.value);
            }
            if (reportType === "monthly" && els.uploadedYearFilter?.value) {
                params.set("date_from", `${els.uploadedYearFilter.value}-01-01`);
                params.set("date_to", `${els.uploadedYearFilter.value}-12-31`);
            }
            const response = await fetch(`${REPORT_API}/reports/submissions?${params}`);
            loadedSources = await response.json();
            if (!response.ok) throw new Error(loadedSources.detail || "Unable to load raw data");
            renderSources(loadedSources);
        } catch (error) {
            loadedSources = [];
            renderSources([]);
            message("uploadedDataMessage", error.message, "error");
        }
    }

    function renderSources(items) {
        if (!els.uploadedDataList) return;
        if (!items.length) {
            els.uploadedDataList.innerHTML = `<div class="empty-state-box">No uploaded raw data found. Submit source documents first.</div>`;
            return;
        }
        els.uploadedDataList.innerHTML = items.map(item => `
            <label class="upload-select-card">
                <div class="upload-select-check">
                    <input type="checkbox" class="uploaded-record-check" value="${escapeHtml(item.submission_id)}" />
                </div>
                <div class="upload-select-content">
                    <div class="upload-select-title">${escapeHtml(item.data_title || item.file_name || "Untitled")}</div>
                    <div class="upload-select-meta">${escapeHtml([item.company, item.project, item.section_title, item.status].filter(Boolean).join(" | "))}</div>
                    <div class="upload-select-submeta">
                        <strong>Topic:</strong> ${escapeHtml(item.topic || "-")}
                        &nbsp; <strong>By:</strong> ${escapeHtml(item.submitted_by || "-")}
                        &nbsp; <strong>Date:</strong> ${escapeHtml(formatDate(item.created_at))}
                    </div>
                </div>
            </label>
        `).join("");
    }

    async function generateReport() {
        const selected = Array.from(document.querySelectorAll(".uploaded-record-check:checked")).map(cb => Number(cb.value));
        if (!selected.length) {
            message("uploadedDataMessage", "Select at least one source submission.", "error");
            return;
        }
        const payload = buildReportPayload(selected);
        message("uploadedDataMessage", "Generating grounded AI draft...", "");
        try {
            const response = await fetch(`${REPORT_API}/reports/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const draft = await response.json();
            if (!response.ok) throw new Error(draft.detail || "Report generation failed");
            currentDraftId = draft.draft_id;
            els.reportEditor.innerHTML = draft.html_content || "";
            message("uploadedDataMessage", `Report generated using ${draft.generation_mode}.`, "success");
            message("reportMessage", "Draft ready. Review, edit, and save the final version.", "success");
            loadSavedReports();
        } catch (error) {
            message("uploadedDataMessage", error.message, "error");
        }
    }

    function buildReportPayload(submissionIds) {
        const user = currentUserSafe();
        if (reportType === "monthly") {
            return {
                report_type: "monthly",
                title: els.monthlyReportTitle?.value || "KEY ACTIVITIES OF BUSINESS DEVELOPMENT",
                month: Number(els.uploadedMonthFilter?.value || new Date().getMonth() + 1),
                year: Number(els.uploadedYearFilter?.value || new Date().getFullYear()),
                submission_ids: submissionIds,
                created_by: user?.name || user?.username || "Admin",
                use_ollama: true
            };
        }
        return {
            report_type: "weekly",
            title: els.weeklyReportTitle?.value || "SNAPSHOT OF BUSINESS DEVELOPMENT ACTIVITIES",
            period_start: els.weeklyPeriodStart?.value || "",
            period_end: els.weeklyPeriodEnd?.value || "",
            submission_ids: submissionIds,
            created_by: user?.name || user?.username || "Admin",
            use_ollama: true
        };
    }

    async function saveEditedReport() {
        const html = els.reportEditor?.innerHTML || "";
        const text = els.reportEditor?.innerText || "";
        if (!text.trim()) {
            message("reportMessage", "Report is empty.", "error");
            return;
        }
        if (!currentDraftId) {
            await generateReportFromEditorOnly(html, text);
            return;
        }
        try {
            const response = await fetch(`${REPORT_API}/reports/drafts/${currentDraftId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: currentTitle(), html_content: html, plain_text: text, status: "Draft" })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Save failed");
            message("reportMessage", "Report saved to backend.", "success");
            loadSavedReports();
        } catch (error) {
            message("reportMessage", error.message, "error");
        }
    }

    async function generateReportFromEditorOnly(html, text) {
        const payload = { report_type: reportType, title: currentTitle(), submission_ids: [], use_ollama: false };
        const response = await fetch(`${REPORT_API}/reports/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const draft = await response.json();
        currentDraftId = draft.draft_id;
        await fetch(`${REPORT_API}/reports/drafts/${currentDraftId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: currentTitle(), html_content: html, plain_text: text })
        });
        message("reportMessage", "Report saved to backend.", "success");
        loadSavedReports();
    }

    async function loadSavedReports() {
        if (!els.entriesTable) return;
        try {
            const response = await fetch(`${REPORT_API}/reports/drafts?report_type=${reportType}`);
            const drafts = await response.json();
            if (!response.ok) throw new Error(drafts.detail || "Unable to load drafts");
            renderDrafts(drafts);
        } catch (error) {
            els.entriesTable.innerHTML = `<tr><td colspan="5" class="empty-table-cell">${escapeHtml(error.message)}</td></tr>`;
        }
    }

    function renderDrafts(drafts) {
        if (!drafts.length) {
            els.entriesTable.innerHTML = `<tr><td colspan="5" class="empty-table-cell">No saved ${reportType} reports found.</td></tr>`;
            return;
        }
        els.entriesTable.innerHTML = drafts.map(draft => `
            <tr>
                <td>${escapeHtml(draft.title)}</td>
                <td>${escapeHtml(draft.report_type === "monthly" ? `${monthName(draft.month)} ${draft.year || ""}` : `${draft.period_start || "-"} to ${draft.period_end || "-"}`)}</td>
                <td>${escapeHtml(draft.generation_mode || "Draft")}</td>
                <td>${escapeHtml(formatDate(draft.updated_at))}</td>
                <td><button class="table-action-btn" data-open-draft="${draft.draft_id}">Open</button></td>
            </tr>
        `).join("");
        els.entriesTable.querySelectorAll("[data-open-draft]").forEach(btn => {
            btn.addEventListener("click", () => openDraft(Number(btn.dataset.openDraft)));
        });
    }

    async function openDraft(id) {
        const response = await fetch(`${REPORT_API}/reports/drafts/${id}`);
        const draft = await response.json();
        if (!response.ok) {
            message("reportMessage", draft.detail || "Draft not found", "error");
            return;
        }
        currentDraftId = draft.draft_id;
        els.reportEditor.innerHTML = draft.html_content || "";
        if (els.weeklyReportTitle) els.weeklyReportTitle.value = draft.title || "";
        if (els.weeklyPeriodStart) els.weeklyPeriodStart.value = draft.period_start || "";
        if (els.weeklyPeriodEnd) els.weeklyPeriodEnd.value = draft.period_end || "";
        if (els.monthlyReportTitle) els.monthlyReportTitle.value = draft.title || "";
        if (els.uploadedMonthFilter && draft.month) els.uploadedMonthFilter.value = String(draft.month);
        if (els.uploadedYearFilter && draft.year) els.uploadedYearFilter.value = String(draft.year);
        message("reportMessage", "Draft loaded.", "success");
    }

    function exportHtml(ext) {
        const content = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(currentTitle())}</title></head><body>${els.reportEditor.innerHTML}</body></html>`;
        download(new Blob([content], { type: "text/html" }), `${slug(currentTitle())}.${ext}`);
    }

    function exportCsv() {
        const csv = `"Title","${currentTitle().replaceAll('"', '""')}"\n"Content","${(els.reportEditor.innerText || "").replaceAll('"', '""').replace(/\n/g, " ")}"`;
        download(new Blob([csv], { type: "text/csv" }), `${slug(currentTitle())}.csv`);
    }

    function searchInReport() {
        clearSearch(false);
        const term = byId("reportSearchInput")?.value.trim();
        if (!term) return;
        const walker = document.createTreeWalker(els.reportEditor, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const regex = new RegExp(`(${escapeRegExp(term)})`, "gi");
        nodes.forEach(node => {
            if (!regex.test(node.nodeValue)) return;
            regex.lastIndex = 0;
            const span = document.createElement("span");
            span.innerHTML = node.nodeValue.replace(regex, `<mark class="report-search-mark">$1</mark>`);
            node.parentNode.replaceChild(span, node);
        });
        message("reportMessage", "Search highlighted.", "success");
    }

    function clearSearch(show = true) {
        els.reportEditor?.querySelectorAll("mark.report-search-mark").forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
        els.reportEditor?.normalize();
        if (show) message("reportMessage", "Search cleared.", "success");
    }

    function initialiseBlankEditor() {
        if (!els.reportEditor) return;
        els.reportEditor.innerHTML = reportType === "monthly"
            ? `<div class="report-doc monthly-doc"><div class="report-title">KEY ACTIVITIES OF BUSINESS DEVELOPMENT</div><div class="report-subtitle">Monthly BD Report</div><div class="report-section-title">Executive Summary</div><ul class="report-bullets"><li>Select weekly data and generate a monthly draft.</li></ul></div>`
            : `<div class="report-doc weekly-doc"><div class="report-title">SNAPSHOT OF BUSINESS DEVELOPMENT ACTIVITIES</div><div class="report-subtitle">Weekly BD Report</div><div class="report-section-title">Executive Summary</div><ul class="report-bullets"><li>Select raw data and generate a weekly draft.</li></ul></div>`;
    }

    function setDefaultDates() {
        const today = new Date();
        const end = isoDate(today);
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        if (els.weeklyPeriodStart && !els.weeklyPeriodStart.value) els.weeklyPeriodStart.value = isoDate(start);
        if (els.weeklyPeriodEnd && !els.weeklyPeriodEnd.value) els.weeklyPeriodEnd.value = end;
        if (els.monthlyReportDate && !els.monthlyReportDate.value) els.monthlyReportDate.value = end;
        if (els.uploadedMonthFilter && !els.uploadedMonthFilter.value) els.uploadedMonthFilter.value = String(today.getMonth() + 1);
        if (els.uploadedYearFilter && !els.uploadedYearFilter.value) els.uploadedYearFilter.value = String(today.getFullYear());
    }

    function currentTitle() {
        return reportType === "monthly"
            ? (els.monthlyReportTitle?.value || "KEY ACTIVITIES OF BUSINESS DEVELOPMENT")
            : (els.weeklyReportTitle?.value || "SNAPSHOT OF BUSINESS DEVELOPMENT ACTIVITIES");
    }

    function byId(id) { return document.getElementById(id); }
    function message(id, text, type) {
        const el = byId(id);
        if (!el) return;
        el.textContent = text || "";
        el.className = `inline-message ${type || ""}`;
    }
    function currentUserSafe() {
        try { return JSON.parse(localStorage.getItem("ntpcUser") || "null"); } catch { return null; }
    }
    function isoDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    function formatDate(value) { return value ? String(value).slice(0, 10) : "-"; }
    function monthName(month) { return ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month)] || ""; }
    function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
    function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function slug(value) { return String(value || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
    function download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
})();
