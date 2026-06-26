const SUBMISSION_API = "http://127.0.0.1:8000";

const SECTION_OPTIONS = [
    { code: "HURL", title: "HURL" },
    { code: "UPL", title: "UPL" },
    { code: "NGEL", title: "NGEL" },
    { code: "NREL", title: "NREL" },
    { code: "THDC", title: "THDC" },
    { code: "NVVN", title: "NVVN" },
    { code: "INTL", title: "International Business" },
    { code: "H2", title: "Hydrogen / Green Fuels" },
    { code: "STORAGE", title: "Storage / RTC / New Tech" },
    { code: "OTHER", title: "Other" }
];

document.addEventListener("DOMContentLoaded", () => {
    const user = getCurrentUser();

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    setupUser(user);
    populateSectionDropdown();
    bindEvents();
});

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem("ntpcUser") || "null");
    } catch {
        return null;
    }
}

function setupUser(user) {
    const name = user.name || user.full_name || user.username || "Employee";

    const nameEl = document.getElementById("uploadUserName");
    const initialEl = document.getElementById("uploadUserInitial");
    const submittedBy = document.getElementById("submitBy");

    if (nameEl) nameEl.textContent = name;
    if (initialEl) initialEl.textContent = name.charAt(0).toUpperCase();
    if (submittedBy) submittedBy.value = name;
}

function bindEvents() {
    const form = document.getElementById("submissionForm");
    const clearBtn = document.getElementById("clearSubmissionForm");
    const aiBtn = document.getElementById("generateAI");
    const draftBtn = document.getElementById("saveDraft");

    if (form) form.addEventListener("submit", submitData);
    if (clearBtn) clearBtn.addEventListener("click", clearForm);
    if (draftBtn) draftBtn.addEventListener("click", saveLocalDraft);
    if (aiBtn) aiBtn.addEventListener("click", generateAiFromCurrentForm);
}

function populateSectionDropdown() {
    const select = document.getElementById("submitSection");
    if (!select) return;

    select.innerHTML = `
        ${SECTION_OPTIONS.map(section => `
            <option value="${escapeHtml(section.code)}">${escapeHtml(section.title)}</option>
        `).join("")}
    `;
}

async function submitData(event) {
    event.preventDefault();

    const user = getCurrentUser();
    if (!user) {
        showSubmissionMessage("User session not found");
        return;
    }

    // ===== EXACT FIELD IDS FROM YOUR RAW UPLOAD PAGE =====
    const dataTitle = document.getElementById("submitDataTitle")?.value.trim() || "";
    const periodStart = document.getElementById("submitPeriodStart")?.value || "";
    const periodEnd = document.getElementById("submitPeriodEnd")?.value || "";
    const sectionCode = document.getElementById("submitSection")?.value || "OTHER";
    const companySelect = document.getElementById("submitCompany")?.value.trim() || "";
    const otherCompany = document.getElementById("otherCompany")?.value.trim() || "";
    const company = companySelect === "OTHER" ? otherCompany : companySelect;
    const project = document.getElementById("submitProject")?.value.trim() || "";
    const topic = document.getElementById("submitTopic")?.value.trim() || dataTitle;
    const subtopic = document.getElementById("submitSubtopic")?.value.trim() || "";
    const sourceType = document.getElementById("submitSourceType")?.value || "File Upload";
    const submittedBy = document.getElementById("submitBy")?.value.trim() || "";
    const rawText = getEditorText();
    const weekLabel = document.getElementById("submitWeek")?.value || "";
    const filesInput = document.getElementById("submitFile");
    const files = filesInput ? filesInput.files : [];

    // ===== VALIDATIONS =====
    if (!dataTitle) {
        showSubmissionMessage("Data title is required");
        return;
    }

    if (!periodStart || !periodEnd) {
        showSubmissionMessage("Please select period start and period end");
        return;
    }

    if (!sectionCode) {
        showSubmissionMessage("Please select business avenue / section");
        return;
    }

    if (!company) {
        showSubmissionMessage("Please enter company name");
        return;
    }

    if (!project) {
        showSubmissionMessage("Please enter project name");
        return;
    }

    if (!topic) {
        showSubmissionMessage("Please enter topic");
        return;
    }

    if (files.length === 0 && !rawText) {
        showSubmissionMessage("Upload at least one file or enter raw text");
        return;
    }

    const sectionTitle = getSectionTitle(sectionCode);

    // ===== ALWAYS SEND RAW =====
    const formData = new FormData();
    formData.append("report_type", "RAW");
    formData.append("data_title", dataTitle);
    formData.append("period_start", periodStart);
    formData.append("period_end", periodEnd);
    formData.append("week_label", weekLabel);
    formData.append("section_code", sectionCode);
    formData.append("section_title", sectionTitle);
    formData.append("company", company);
    formData.append("project", project);
    formData.append("topic", topic);
    formData.append("subtopic", subtopic);
    formData.append("source_type", sourceType);
    formData.append("extracted_text", rawText);
    formData.append("submitted_by", submittedBy || user.name || user.full_name || user.username || "");

    for (const file of files) {
        formData.append("files", file);
    }

    const submitButton = document.querySelector('#submissionForm button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : "Submit Data";

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
    }

    try {
        const response = await fetch(`${SUBMISSION_API}/reports/submissions`, {
            method: "POST",
            body: formData
        });

        let data = {};
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.detail || "Submission failed");
        }

        showSubmissionMessage("Raw data submitted successfully", false);
        localStorage.removeItem("ntpc_submission_draft");
        resetSubmissionFormKeepUser();

    } catch (error) {
        showSubmissionMessage(error.message || "Submission failed");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}

function getEditorText() {
    if (window.quill) {
        return window.quill.getText().trim();
    }
    const editor = document.getElementById("editor");
    return editor ? editor.innerText.trim() : "";
}

function saveLocalDraft() {
    const draft = {
        dataTitle: document.getElementById("submitDataTitle")?.value || "",
        company: document.getElementById("submitCompany")?.value || "",
        project: document.getElementById("submitProject")?.value || "",
        topic: document.getElementById("submitTopic")?.value || "",
        subtopic: document.getElementById("submitSubtopic")?.value || "",
        html: window.quill ? window.quill.root.innerHTML : document.getElementById("editor")?.innerHTML || "",
        savedAt: new Date().toISOString()
    };
    localStorage.setItem("ntpc_submission_draft", JSON.stringify(draft));
    showSubmissionMessage("Draft saved in this browser.", false);
}

async function generateAiFromCurrentForm() {
    showSubmissionMessage("Save the submission first, then generate Weekly or Monthly reports from the report pages.", false);
}

function resetSubmissionFormKeepUser() {
    const user = getCurrentUser();
    const form = document.getElementById("submissionForm");
    const submitByInput = document.getElementById("submitBy");

    const oldSubmitBy = submitByInput ? submitByInput.value : "";

    if (form) form.reset();

    populateSectionDropdown();

    if (submitByInput) {
        submitByInput.value = oldSubmitBy || user?.name || user?.full_name || user?.username || "";
    }

    showSubmissionMessage("", true);
}

function clearForm() {
    resetSubmissionFormKeepUser();
}

function getSectionTitle(sectionCode) {
    const found = SECTION_OPTIONS.find(item => item.code === sectionCode);
    return found ? found.title : sectionCode;
}

function showSubmissionMessage(message, isError = true) {
    const element = document.getElementById("submissionMessage");
    if (!element) return;

    element.textContent = message || "";
    element.className = isError ? "inline-message error" : "inline-message success";
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
