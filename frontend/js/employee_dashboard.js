const EMPLOYEE_DASHBOARD_API = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    const user = getCurrentUser();

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    fillUserHeader(user);

    const reloadBtn = document.getElementById("reloadEmployeeDashboard");
    if (reloadBtn) {
        reloadBtn.addEventListener("click", loadEmployeeDashboard);
    }

    loadEmployeeDashboard();
});

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem("ntpcUser") || "null");
    } catch {
        return null;
    }
}

function fillUserHeader(user) {
    const displayName = user.name || user.full_name || user.username || "Employee";

    const employeeName = document.getElementById("employeeName");
    const employeeInitial = document.getElementById("employeeInitial");
    const employeeRoleText = document.getElementById("employeeRoleText");

    if (employeeName) employeeName.textContent = displayName;
    if (employeeInitial) employeeInitial.textContent = displayName.charAt(0).toUpperCase();
    if (employeeRoleText) {
        employeeRoleText.textContent = user.role === "ADMIN"
            ? "Administrator access"
            : "Approved employee access";
    }
}

async function loadEmployeeDashboard() {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const [companiesRes, submissionsRes] = await Promise.all([
            fetch(`${EMPLOYEE_DASHBOARD_API}/employees/${user.user_id}/companies`),
            fetch(`${EMPLOYEE_DASHBOARD_API}/reports/submissions`)
        ]);

        let companies = [];
        let allSubmissions = [];

        if (companiesRes.ok) {
            companies = await companiesRes.json();
        }

        if (submissionsRes.ok) {
            allSubmissions = await submissionsRes.json();
        }

        renderAssignedCompanies(companies);

        const mine = allSubmissions.filter(item => isMySubmission(item, user));
        renderSubmissionStats(mine);
        renderMyUploads(mine.slice(0, 10));
    } catch (error) {
        console.error("Employee dashboard load failed:", error);
        renderAssignedCompanies([]);
        renderSubmissionStats([]);
        renderMyUploads([]);
    }
}

function isMySubmission(item, user) {
    const userName = (user.name || user.full_name || "").trim().toLowerCase();
    const username = (user.username || "").trim().toLowerCase();
    const submittedBy = String(item.submitted_by || "").trim().toLowerCase();

    return submittedBy === userName || submittedBy === username;
}

function renderSubmissionStats(items) {
    const total = items.length;
    const pending = items.filter(item => normalizeStatus(item.status) === "under review").length;
    const approved = items.filter(item => normalizeStatus(item.status) === "approved").length;

    const mySubmissions = document.getElementById("mySubmissions");
    const myPending = document.getElementById("myPending");
    const myApproved = document.getElementById("myApproved");

    if (mySubmissions) mySubmissions.textContent = total;
    if (myPending) myPending.textContent = pending;
    if (myApproved) myApproved.textContent = approved;
}

function renderAssignedCompanies(companies) {
    const container = document.getElementById("assignedCompanies");
    const assignedCompanyCount = document.getElementById("assignedCompanyCount");

    if (assignedCompanyCount) {
        assignedCompanyCount.textContent = `${companies.length} Assigned Companies`;
    }

    if (!container) return;

    if (!companies || !companies.length) {
        container.innerHTML = `
            <div class="empty-state-card">
                No companies / business areas assigned yet.
            </div>
        `;
        return;
    }

    container.innerHTML = companies.map(company => `
        <div class="company-card">
            <div class="company-card-top">
                <h3>${escapeHtml(company.company_name || "-")}</h3>
                <span class="company-type-pill">${escapeHtml(company.company_type || "Company")}</span>
            </div>
            <p class="company-description">${escapeHtml(company.description || "No description available.")}</p>
        </div>
    `).join("");
}

function renderMyUploads(items) {
    const table = document.getElementById("employeeUploadsTable");
    if (!table) return;

    if (!items || !items.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:#64748b; padding:22px;">
                    No uploads submitted yet.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = items.map(item => {
        const statusClass = getStatusClass(item.status);
        const projectOrTopic = item.project || item.topic || "-";
        const fileText = item.file_names || item.file_name || "Text data";

        return `
            <tr>
                <td>${escapeHtml(item.company || "-")}</td>
                <td>${escapeHtml(projectOrTopic)}</td>
                <td>${escapeHtml(fileText)}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHtml(item.status || "Under Review")}
                    </span>
                </td>
                <td>${formatDate(item.created_at)}</td>
            </tr>
        `;
    }).join("");
}

function getStatusClass(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "approved") return "approved";
    if (normalized === "rejected") return "rejected";
    return "pending";
}

function normalizeStatus(status) {
    return String(status || "").trim().toLowerCase();
}

function formatDate(value) {
    if (!value) return "-";
    return String(value).slice(0, 10);
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}