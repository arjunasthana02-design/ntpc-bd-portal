const EMPLOYEE_API = "http://127.0.0.1:8000/employees";

let employees = [];
let editingEmployeeId = null;

document.addEventListener("DOMContentLoaded", () => {
    bindEmployeeEvents();
    loadEmployees();
});

function bindEmployeeEvents() {
    const employeeForm = document.getElementById("employeeForm");
    const resetBtn = document.getElementById("resetEmployeeBtn");
    const reloadBtn = document.getElementById("reloadEmployeesBtn");

    if (employeeForm) {
        employeeForm.addEventListener("submit", saveEmployee);
    }
    if (resetBtn) {
        resetBtn.addEventListener("click", resetEmployeeForm);
    }
    if (reloadBtn) {
        reloadBtn.addEventListener("click", loadEmployees);
    }
}

async function loadEmployees() {
    try {
        const response = await fetch(EMPLOYEE_API);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to load employees");
        }

        employees = Array.isArray(data) ? data : [];
        renderEmployeeStats();
        renderEmployeesTable();
    } catch (error) {
        showEmployeeMessage(error.message || "Failed to load employees");
        renderEmployeesTable([]);
    }
}

function renderEmployeeStats() {
    setText("employeeTotalCount", employees.length);
    setText("employeeApprovedCount", employees.filter(emp => emp.status === "APPROVED").length);
    setText("employeePendingCount", employees.filter(emp => emp.status === "PENDING").length);
    setText("employeeRejectedCount", employees.filter(emp => emp.status === "REJECTED").length);
}

function renderEmployeesTable() {
    const table = document.getElementById("employeesTable");
    if (!table) return;

    if (!employees.length) {
        table.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:#64748b; padding:22px;">
                    No employee records found.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = employees.map(emp => `
        <tr>
            <td>${escapeHtml(emp.full_name || "")}</td>
            <td>${escapeHtml(emp.username || "")}</td>
            <td>${escapeHtml(emp.role || "")}</td>
            <td>
                <span class="status-badge ${getStatusClass(emp.status)}">
                    ${escapeHtml(emp.status || "")}
                </span>
            </td>
            <td>${formatDate(emp.created_at)}</td>
            <td>
                <button class="mini-btn" type="button" onclick="openCompanyAssignment(${emp.user_id}, '${escapeJs(emp.full_name || emp.username || "Employee")}')">
                    Assign Companies
                </button>
            </td>
            <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="mini-btn" type="button" onclick="editEmployee(${emp.user_id})">Edit</button>
                    ${emp.status !== "APPROVED" ? `
                        <button class="mini-btn" type="button" onclick="changeEmployeeStatus(${emp.user_id}, 'APPROVED')">Approve</button>
                    ` : ""}
                    ${emp.status !== "REJECTED" ? `
                        <button class="danger-btn" type="button" onclick="changeEmployeeStatus(${emp.user_id}, 'REJECTED')">Reject</button>
                    ` : ""}
                    ${emp.status !== "PENDING" ? `
                        <button class="mini-btn" type="button" onclick="changeEmployeeStatus(${emp.user_id}, 'PENDING')">Pending</button>
                    ` : ""}
                    <button class="danger-btn" type="button" onclick="deleteEmployee(${emp.user_id})">Delete</button>
                </div>
            </td>
        </tr>
    `).join("");
}

async function saveEmployee(event) {
    event.preventDefault();

    const payload = {
        full_name: document.getElementById("employeeFullName").value.trim(),
        username: document.getElementById("employeeUsername").value.trim(),
        password: document.getElementById("employeePassword").value.trim(),
        role: document.getElementById("employeeRole").value,
        status: document.getElementById("employeeStatus").value
    };

    if (!payload.full_name) {
        showEmployeeMessage("Employee full name is required.");
        return;
    }
    if (!payload.username) {
        showEmployeeMessage("Username is required.");
        return;
    }

    // for new employee password required
    if (!editingEmployeeId && !payload.password) {
        showEmployeeMessage("Password is required for new employee.");
        return;
    }

    try {
        let response;

        if (editingEmployeeId) {
            response = await fetch(`${EMPLOYEE_API}/${editingEmployeeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(`${EMPLOYEE_API}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to save employee");
        }

        showEmployeeMessage(
            editingEmployeeId ? "Employee updated successfully." : "Employee added successfully.",
            false
        );

        resetEmployeeForm();
        await loadEmployees();
    } catch (error) {
        showEmployeeMessage(error.message || "Failed to save employee");
    }
}

function editEmployee(userId) {
    const emp = employees.find(item => item.user_id === userId);
    if (!emp) return;

    editingEmployeeId = userId;

    document.getElementById("employeeId").value = emp.user_id || "";
    document.getElementById("employeeFullName").value = emp.full_name || "";
    document.getElementById("employeeUsername").value = emp.username || "";
    document.getElementById("employeePassword").value = "";
    document.getElementById("employeeRole").value = emp.role || "EMPLOYEE";
    document.getElementById("employeeStatus").value = emp.status || "APPROVED";

    const formTitle = document.getElementById("employeeFormTitle");
    if (formTitle) {
        formTitle.textContent = "Edit Employee";
    }

    showEmployeeMessage("Editing employee. Leave password blank if you do not want to change it.", false);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function changeEmployeeStatus(userId, status) {
    try {
        const response = await fetch(`${EMPLOYEE_API}/${userId}/status?status=${encodeURIComponent(status)}`, {
            method: "PATCH"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `Failed to set status to ${status}`);
        }

        showEmployeeMessage(`Employee marked ${status}.`, false);
        await loadEmployees();
    } catch (error) {
        showEmployeeMessage(error.message || `Failed to set status to ${status}`);
    }
}

async function deleteEmployee(userId) {
    if (!confirm("Delete this employee?")) return;

    try {
        const response = await fetch(`${EMPLOYEE_API}/${userId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to delete employee");
        }

        if (editingEmployeeId === userId) {
            resetEmployeeForm();
        }

        showEmployeeMessage("Employee deleted successfully.", false);
        await loadEmployees();
    } catch (error) {
        showEmployeeMessage(error.message || "Failed to delete employee");
    }
}

function resetEmployeeForm() {
    editingEmployeeId = null;

    const form = document.getElementById("employeeForm");
    if (form) {
        form.reset();
    }

    const hiddenId = document.getElementById("employeeId");
    if (hiddenId) {
        hiddenId.value = "";
    }

    const role = document.getElementById("employeeRole");
    const status = document.getElementById("employeeStatus");
    if (role) role.value = "EMPLOYEE";
    if (status) status.value = "APPROVED";

    const formTitle = document.getElementById("employeeFormTitle");
    if (formTitle) {
        formTitle.textContent = "Add Employee";
    }

    showEmployeeMessage("");
}

/* =========================================================
   COMPANY ASSIGNMENT
   ========================================================= */

async function openCompanyAssignment(userId, employeeName) {
    const modal = document.getElementById("companyAssignmentModal");
    const employeeNameLabel = document.getElementById("assignmentEmployeeName");
    const employeeIdInput = document.getElementById("assignmentEmployeeId");
    const companyList = document.getElementById("assignmentCompanyList");
    const assignmentMessage = document.getElementById("assignmentMessage");

    if (!modal || !employeeIdInput || !companyList) {
        alert("Company assignment modal HTML is missing.");
        return;
    }

    employeeIdInput.value = userId;
    if (employeeNameLabel) {
        employeeNameLabel.textContent = employeeName || "Employee";
    }
    if (assignmentMessage) {
        assignmentMessage.textContent = "";
        assignmentMessage.classList.remove("success");
    }

    modal.classList.remove("hidden");
    companyList.innerHTML = `<p class="muted-text">Loading assigned companies...</p>`;

    try {
        const response = await fetch(`${EMPLOYEE_API}/${userId}/companies`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to load assigned companies");
        }

        const assigned = Array.isArray(data) ? data : [];

        if (!assigned.length) {
            companyList.innerHTML = `
                <div class="empty-state-box">
                    <p>No companies assigned yet.</p>
                    <p style="margin-top:8px;">Use the form below to add one company at a time.</p>
                </div>
            `;
        } else {
            companyList.innerHTML = assigned.map(company => `
                <div class="assignment-row">
                    <div>
                        <strong>${escapeHtml(company.company_name || "")}</strong>
                        ${company.company_type ? `<div class="muted-text">${escapeHtml(company.company_type)}</div>` : ""}
                        ${company.description ? `<div class="muted-text">${escapeHtml(company.description)}</div>` : ""}
                    </div>
                    <button class="danger-btn" type="button" onclick="removeAssignedCompany(${userId}, ${company.company_id})">Remove</button>
                </div>
            `).join("");
        }
    } catch (error) {
        companyList.innerHTML = `<p class="muted-text">${escapeHtml(error.message || "Failed to load companies")}</p>`;
    }
}

function closeCompanyAssignmentModal() {
    const modal = document.getElementById("companyAssignmentModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

async function addCompanyAssignment(event) {
    event.preventDefault();

    const employeeId = Number(document.getElementById("assignmentEmployeeId").value || 0);
    const companyName = document.getElementById("assignmentCompanyName").value.trim();
    const companyType = document.getElementById("assignmentCompanyType").value.trim();
    const description = document.getElementById("assignmentCompanyDescription").value.trim();

    if (!employeeId) {
        showAssignmentMessage("Employee ID missing.");
        return;
    }
    if (!companyName) {
        showAssignmentMessage("Company name is required.");
        return;
    }

    try {
        const response = await fetch(`${EMPLOYEE_API}/${employeeId}/companies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                company_name: companyName,
                company_type: companyType,
                description
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to assign company");
        }

        showAssignmentMessage("Company assigned successfully.", false);
        document.getElementById("assignmentCompanyForm").reset();

        const employee = employees.find(item => item.user_id === employeeId);
        await openCompanyAssignment(employeeId, employee?.full_name || employee?.username || "Employee");
    } catch (error) {
        showAssignmentMessage(error.message || "Failed to assign company");
    }
}

async function removeAssignedCompany(userId, companyId) {
    if (!confirm("Remove this company assignment?")) return;

    try {
        const response = await fetch(`${EMPLOYEE_API}/${userId}/companies/${companyId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Failed to remove company assignment");
        }

        showAssignmentMessage("Company removed successfully.", false);

        const employee = employees.find(item => item.user_id === userId);
        await openCompanyAssignment(userId, employee?.full_name || employee?.username || "Employee");
    } catch (error) {
        showAssignmentMessage(error.message || "Failed to remove company assignment");
    }
}

function showAssignmentMessage(message, isError = true) {
    const element = document.getElementById("assignmentMessage");
    if (!element) return;

    element.textContent = message || "";
    element.classList.remove("success");
    if (!isError && message) {
        element.classList.add("success");
    }
}

function showEmployeeMessage(message, isError = true) {
    const element = document.getElementById("employeeMessage");
    if (!element) return;

    element.textContent = message || "";
    element.classList.remove("success");
    if (!isError && message) {
        element.classList.add("success");
    }
}

function getStatusClass(status) {
    if (status === "APPROVED") return "approved";
    if (status === "REJECTED") return "rejected";
    return "pending";
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatDate(value) {
    if (!value) return "";
    if (value.includes("T")) return value.slice(0, 10);
    return value;
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeJs(value) {
    return String(value || "")
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'");
}