const BD_API = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", loadBdDashboard);

async function loadBdDashboard() {
    const response = await fetch(`${BD_API}/dashboard/bd`);
    const data = await response.json();
    const k = data.kpis || {};
    setText("kpiOngoing", k.ongoing_projects || 0);
    setText("kpiUpcoming", k.upcoming_projects || 0);
    setText("kpiCompleted", k.completed_projects || 0);
    setText("kpiJv", k.joint_ventures || 0);
    setText("kpiMou", k.mous || 0);
    setText("kpiInvestment", k.investment_details || 0);
    drawChart("companyChart", "bar", data.company_wise_projects || {});
    drawChart("technologyChart", "doughnut", data.technology_wise_projects || {});
    drawChart("stateChart", "bar", data.state_wise_projects || {});
    drawChart("growthChart", "line", growthSeries(data.project_pipeline || []));
    renderPipeline(data.project_pipeline || []);
}

function drawChart(id, type, values) {
    const ctx = document.getElementById(id);
    if (!ctx || !window.Chart) return;
    const labels = Object.keys(values);
    const data = Object.values(values);
    new Chart(ctx, {
        type,
        data: {
            labels,
            datasets: [{
                label: "Projects",
                data,
                backgroundColor: ["#0b63b6", "#10b981", "#f59e0b", "#7c3aed", "#ef4444", "#06b6d4", "#64748b"],
                borderColor: "#0b63b6",
                tension: 0.35
            }]
        },
        options: { responsive: true, plugins: { legend: { display: type === "doughnut" } } }
    });
}

function growthSeries(pipeline) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const base = Math.max(1, pipeline.length);
    return Object.fromEntries(months.map((month, index) => [month, base + index * 2]));
}

function renderPipeline(rows) {
    const table = document.getElementById("pipelineTable");
    if (!rows.length) {
        table.innerHTML = `<tr><td colspan="8" class="empty-table-cell">No project pipeline data available.</td></tr>`;
        return;
    }
    table.innerHTML = rows.map(row => `
        <tr>
            <td>${escapeHtml(row.project)}</td>
            <td>${escapeHtml(row.company)}</td>
            <td>${escapeHtml(row.avenue)}</td>
            <td><span class="status-badge approved">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.funding)}</td>
            <td>${escapeHtml(row.tender)}</td>
            <td>${escapeHtml(row.investment)} Cr</td>
            <td>${escapeHtml(row.timeline)}</td>
        </tr>
    `).join("");
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
