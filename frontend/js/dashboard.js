const DASHBOARD_API = ntpcApiBase();

document.addEventListener("DOMContentLoaded", () => {
    enforcePageAccess();
    hydrateCurrentUserUI();
    loadDashboardStats();
});

function logout() {
    localStorage.removeItem("ntpcUser");
    window.location.href = "login.html";
}

function currentUser() {
    try {
        return JSON.parse(localStorage.getItem("ntpcUser") || "null");
    } catch (error) {
        return null;
    }
}

function enforcePageAccess() {
    const user = currentUser();
    const page = window.location.pathname.split("/").pop() || "login.html";

    const publicPages = ["login.html", "index.html", ""];
    const employeeOnlyPages = ["employee_dashboard.html"];
    const adminOnlyPages = [
        "dashboard.html",
        "employees.html",
        "review.html",
        "raw_documents.html",
        "ai_training.html",
        "bd_dashboard.html"
    ];

    if (!user && !publicPages.includes(page)) {
        window.location.href = "login.html";
        return;
    }

    if (!user) return;

    if (user.role === "EMPLOYEE" && adminOnlyPages.includes(page)) {
        window.location.href = "employee_dashboard.html";
        return;
    }

    if (user.role === "ADMIN" && employeeOnlyPages.includes(page)) {
        window.location.href = "dashboard.html";
        return;
    }

    if (user.role === "EMPLOYEE") {
        hideAdminOnlySidebarLinks();
    }
}

function hideAdminOnlySidebarLinks() {
    document.querySelectorAll('a[href="employees.html"], a[href="review.html"], a[href="ai_training.html"], a[href="bd_dashboard.html"]').forEach(link => {
        const navItem = link.closest(".nav-item") || link;
        navItem.remove();
    });
}

function hydrateCurrentUserUI() {
    const user = currentUser();
    if (!user) return;

    const name = user.name || user.full_name || user.username || "User";
    const initial = name.charAt(0).toUpperCase();

    const possibleNameIds = [
        "adminName",
        "employeeName",
        "uploadUserName"
    ];

    const possibleInitialIds = [
        "adminInitial",
        "employeeInitial",
        "uploadUserInitial"
    ];

    possibleNameIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = name;
    });

    possibleInitialIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = initial;
    });
}

async function loadDashboardStats() {
    const page = window.location.pathname.split("/").pop() || "";

    if (page === "employee_dashboard.html") {
        return;
    }

    const hasDashboardWidgets =
        document.getElementById("weeklyReports") ||
        document.getElementById("totalEmployees") ||
        document.getElementById("recentSubmissionsTable");

    if (!hasDashboardWidgets) {
        return;
    }

    try {
        const [summaryResponse, employeeResponse, submissionResponse] = await Promise.all([
            fetch(`${DASHBOARD_API}/reports/summary`),
            fetch(`${DASHBOARD_API}/employees`),
            fetch(`${DASHBOARD_API}/reports/submissions`)
        ]);

        const summary = await safeJson(summaryResponse);
        const employees = await safeJson(employeeResponse);
        const submissions = await safeJson(submissionResponse);

        if (!summaryResponse.ok) {
            throw new Error(summary.detail || "Failed to load report summary");
        }
        if (!employeeResponse.ok) {
            throw new Error(employees.detail || "Failed to load employees");
        }
        if (!submissionResponse.ok) {
            throw new Error(submissions.detail || "Failed to load submissions");
        }

        const employeeList = Array.isArray(employees) ? employees : [];
        const submissionList = Array.isArray(submissions) ? submissions : [];

        setText("weeklyReports", summary.weekly_entries || 0);
        setText("reportsThisWeek", summary.weekly_entries || 0);
        setText("totalSubmissions", summary.total_submissions || submissionList.length || 0);
        setText("pendingReviews", summary.review_submissions || submissionList.filter(item => item.status === "Under Review").length || 0);
        setText("totalEmployees", employeeList.length || 0);
        setText("activeEmployees", employeeList.filter(item => item.status === "APPROVED").length || 0);

        setText(
            "summaryTotalReports",
            `${summary.weekly_entries || 0} weekly entries and ${summary.monthly_entries || 0} monthly entries available.`
        );

        setText(
            "summaryPendingChecks",
            `${summary.review_submissions || submissionList.filter(item => item.status === "Under Review").length || 0} submissions waiting for review.`
        );

        setText(
            "summaryEmployeeAccess",
            `${employeeList.length || 0} employee accounts currently configured.`
        );

        setText(
            "summaryWeekProgress",
            `${summary.final_entries || 0} entries marked final.`
        );

        renderRecentSubmissions(submissionList.slice(0, 8));
    } catch (error) {
        setText("summaryWeekProgress", error.message || "Failed to load dashboard data.");
        renderRecentSubmissions([]);
    }
}

function renderRecentSubmissions(submissions) {
    const table = document.getElementById("recentSubmissionsTable");
    if (!table) return;

    if (!Array.isArray(submissions) || !submissions.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:#64748b; padding:22px;">
                    No employee submissions available yet.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = submissions.map(item => `
        <tr>
            <td>${escapeHtml(item.submitted_by || "Unknown")}</td>
            <td>${escapeHtml(item.report_type || "")}${item.week_label ? ` (${escapeHtml(item.week_label)})` : ""}</td>
            <td>${escapeHtml(item.company || item.topic || "-")}</td>
            <td>
                <span class="status-badge ${getStatusClass(item.status)}">
                    ${escapeHtml(item.status || "")}
                </span>
            </td>
            <td>${formatDate(item.created_at)}</td>
        </tr>
    `).join("");
}

function getStatusClass(status) {
    if (status === "Approved" || status === "Final") return "approved";
    if (status === "Rejected") return "rejected";
    return "pending";
}

function formatDate(value) {
    if (!value) return "";
    if (value.includes("T")) {
        return value.slice(0, 10);
    }
    return value;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return {};
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
