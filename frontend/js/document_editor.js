const API = "http://127.0.0.1:8000/reports";

let quill = null;
let currentDocumentId = null;
let autoSaveTimer = null;
let currentUser = null;

const COMPANIES = [
    "Anushakti Vidyut Nigam Ltd (ASHWINI)",
    "Aravali Power Co. Pvt Ltd (APCPL)",
    "Bangladesh-india Friendship Power Co.Pvt.Ltd (BIFPCL)",
    "BF-NTPC Energy Systems Ltd (BFNESL)",
    "Bhartiya Rail Bijlee Co. Ltd (BRBCL)",
    "CIL NTPC Urja Pvt Ltd (CNUPL)",
    "Energy Efficiency Services Ltd (EESL)",
    "Hindustan Urvarak & Rasayan Ltd (HURL)",
    "International Coal Ventures Pvt Ltd (ICVL)",
    "Jhabua Power Ltd",
    "Meja Urja Nigam Pvt Ltd (MUNPL)",
    "National High Power Test Laboratory Pvt Ltd (NHPTL)",
    "North Eastern Electric Power Corporation Ltd. (NEEPCO)",
    "NTPC BHEL Power Projects Pvt Ltd (NBPPL)",
    "NTPC EDMC Waste Solutions Pvt. Limited (NEWS)",
    "NTPC Electric Supply Co. Ltd (NESCL)",
    "NTPC GE Power Services Pvt Ltd (NTPC-GE)",
    "NTPC Green Energy Ltd (NGEL)",
    "NTPC Mining Limited (NML)",
    "NTPC Parmanu Urja Nigam Limited",
    "NTPC SAIL Power Co. Pvt Ltd (NSPCL)",
    "NTPC Tamilnadu Energy Co. Ltd (NTECL)",
    "NTPC Vidyut Vyapar Nigam Ltd (NVVN)",
    "Patratu Vidyut Utpadan Nigam Ltd (PVUNL)",
    "Power Trading Corporation Ltd (PTC)",
    "Ratnagiri Gas and Power Pvt Ltd (RGPPL)",
    "THDC India Ltd.",
    "Transformers and Electricals Kerala Ltd (TELK)",
    "Trincomalee Power Co. Ltd (TPCL)",
    "Utility Powertech Ltd (UPL)",
    "Sinnar Thermal Power Limited (STPL)",
    "Other..."
];

document.addEventListener("DOMContentLoaded", async () => {

    currentUser = getCurrentUser();

    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    initialiseQuill();

    populateCompanies();

    initialiseDateTime();

    bindEvents();

    startAutoSave();

    const params = new URLSearchParams(window.location.search);

    const id = params.get("id");

    await loadDocuments();

    if (id) {

        await openDocument(Number(id));

    }

});

function initialiseQuill() {

    quill = new Quill("#editor", {

        theme: "snow",

        modules: {

            toolbar: "#toolbar",

            history: {
                delay: 1000,
                maxStack: 500,
                userOnly: true
            }

        }

    });

    quill.on(
        "text-change",
        debounce(
            () => {
                if (currentDocumentId !== null) {
                    setStatus("Unsaved Changes");
                }
            },
            500
        )
    );

}

function getCurrentUser() {

    try {

        return JSON.parse(
            localStorage.getItem("ntpcUser")
        );

    }

    catch {

        return null;

    }

}

function populateCompanies() {

    const select =
        document.getElementById("docCompany");

    select.innerHTML = "";

    COMPANIES.forEach(company => {

        const option =
            document.createElement("option");

        option.value = company;

        option.textContent = company;

        select.appendChild(option);

    });

}

function initialiseDateTime() {

    const now = new Date();

    const local =
        new Date(
            now.getTime()
            -
            now.getTimezoneOffset() * 60000
        )
        .toISOString()
        .slice(0,16);

    document.getElementById("docStartDate").value = local;

    document.getElementById("docEndDate").value = local;

}

function bindEvents() {

    document
        .getElementById("saveDocument")
        .addEventListener(
            "click",
            saveDocument
        );

    document
        .getElementById("newDocumentBtn")
        .addEventListener(
            "click",
            createBlankDocument
        );

    document
        .getElementById("generateWeekly")
        .addEventListener(
            "click",
            generateWeekly
        );

    document
        .getElementById("generateMonthly")
        .addEventListener(
            "click",
            generateMonthly
        );

    document
        .getElementById("generateAI")
        .addEventListener(
            "click",
            generateAI
        );

    document.addEventListener(

        "keydown",

        function(e){

            if(
                (e.ctrlKey || e.metaKey)
                &&
                e.key==="s"
            ){

                e.preventDefault();

                saveDocument();

            }

        }

    );

}

function setStatus(text){

    document
        .getElementById("saveStatus")
        .textContent = text;

}

function startAutoSave(){

    autoSaveTimer =
        setInterval(

            ()=>{

                if(currentDocumentId){

                    saveDocument(true);

                }

            },

            10000

        );

}
async function loadDocuments() {

    setStatus("Loading...");

    try {

        const response =
            await fetch(
                `${API}/documents`
            );

        if (!response.ok)
            throw new Error();

        const documents =
            await response.json();

        renderDocumentList(documents);

        
        setStatus("Ready");

    }

    catch {

        setStatus("Unable to load");

    }

}


function renderDocumentList(documents) {

    const list =
        document.getElementById(
            "documentList"
        );

    list.innerHTML = "";

    documents.forEach(doc => {

        const item =
            document.createElement("div");

        item.className =
            "document-item";

        if (
    (doc.document_id || doc.id) ===
    currentDocumentId
) {

            item.classList.add(
                "active"
            );

        }

        item.innerHTML = `

        <div class="document-title">

        ${escapeHtml(doc.title)}

        </div>

        <div class="document-company">

        ${escapeHtml(doc.company)}

        </div>

        <div style="margin-top:6px;
                    font-size:12px;
                    color:#888;">

        ${doc.document_type}

        </div>

        `;

        item.onclick = () =>

            openDocument(
    doc.document_id || doc.id
);

        list.appendChild(item);

    });

}


async function openDocument(id) {

    try {

        const response =
            await fetch(
                `${API}/documents/${id}`
            );

        if (!response.ok)
            throw new Error();

        const doc =
            await response.json();

        currentDocumentId =
            doc.document_id;

        document.getElementById(
            "docTitle"
        ).value =
            doc.title;

        document.getElementById(
            "docCompany"
        ).value =
            doc.company;

        document.getElementById(
            "docProject"
        ).value =
            doc.project;

        document.getElementById(
            "docType"
        ).value =
            doc.document_type;

        document.getElementById(
            "docStartDate"
        ).value =
            doc.period_start || "";

        document.getElementById(
            "docEndDate"
        ).value =
            doc.period_end || "";

        quill.root.innerHTML =
            doc.html_content ||
            "<p><br></p>";

        setStatus(
            "Opened"
        );

        await loadDocuments();

    }

    catch {

        setStatus(
            "Unable to open"
        );

    }

}


function createBlankDocument() {

    currentDocumentId = null;

    document.getElementById(
        "docTitle"
    ).value = "";

    document.getElementById(
        "docProject"
    ).value = "";

    document.getElementById(
        "docType"
    ).value = "RAW";

    initialiseDateTime();

    quill.root.innerHTML = "<p><br></p>";

    setStatus(
        "New document"
    );

}


function getEditorHTML() {

    return quill.root.innerHTML;

}


function getPlainText() {

    return quill.getText();

}


function getDocumentPayload() {

    return {

        title:
            document.getElementById(
                "docTitle"
            ).value.trim(),

        company:
            document.getElementById(
                "docCompany"
            ).value,

        project:
            document.getElementById(
                "docProject"
            ).value.trim(),

        report_type:
            document.getElementById(
                "docType"
            ).value,

        document_type:
            document.getElementById(
                "docType"
            ).value,

        period_start:
            document.getElementById(
                "docStartDate"
            ).value,

        period_end:
            document.getElementById(
                "docEndDate"
            ).value,

        html_content:
            getEditorHTML(),

        plain_text:
            getPlainText(),

        owner:
            currentUser.username,

        source_submission_id:
            null,

        parent_document_id:
            null

    };

}


function escapeHtml(text) {

    return String(text || "")

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#39;");

}
async function saveDocument(autoSave = false) {

    const payload = getDocumentPayload();

    if (!payload.title) {

        if (!autoSave)
            alert("Document title is required.");

        return;
    }

    if (!payload.project) {

        if (!autoSave)
            alert("Project name is required.");

        return;
    }

    setStatus(autoSave ? "Autosaving..." : "Saving...");

    try {

        const url = currentDocumentId
            ? `${API}/documents/${currentDocumentId}`
            : `${API}/documents`;

        const method = currentDocumentId
            ? "PUT"
            : "POST";

        const response = await fetch(url, {

            method,

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)

        });

        if (!response.ok)
            throw new Error("Save failed");

        const saved = await response.json();

        currentDocumentId =
            saved.document_id ||
            saved.id ||
            currentDocumentId;

        setStatus(
            autoSave
                ? "Autosaved"
                : "Saved"
        );

        await loadDocuments();

    }

    catch (err) {

        console.error(err);

        setStatus("Save Failed");

    }

}


async function deleteCurrentDocument() {

    if (currentDocumentId === null)
        return;

    if (
        !confirm(
            "Delete this document?"
        )
    )
        return;

    try {

        const response =
            await fetch(

                `${API}/documents/${currentDocumentId}`,

                {
                    method: "DELETE"
                }

            );

        if (!response.ok)
            throw new Error();

        currentDocumentId = null;

        createBlankDocument();

        await loadDocuments();

        setStatus("Deleted");

    }

    catch {

        setStatus("Delete Failed");

    }

}


async function duplicateDocument() {

    if (currentDocumentId === null)
        return;

    const payload =
        getDocumentPayload();

    payload.title =
        payload.title +
        " Copy";

    try {

        const response =
            await fetch(

                `${API}/documents`,

                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)

                }

            );

        if (!response.ok)
            throw new Error();

        const doc =
            await response.json();

        currentDocumentId =
            doc.document_id;

        await loadDocuments();

        setStatus("Duplicated");

    }

    catch {

        setStatus(
            "Duplicate Failed"
        );

    }

}


async function refreshCurrentDocument() {

    if (
        currentDocumentId === null
    )
        return;

    await openDocument(
        currentDocumentId
    );

}


window.addEventListener(

    "beforeunload",

    function () {

        if (
            currentDocumentId !== null
        ) {

            saveDocument(true);

        }

    }

);


document.addEventListener(

    "visibilitychange",

    function () {

        if (
            document.hidden &&
            currentDocumentId !== null
        ) {

            saveDocument(true);

        }

    }

);


function debounce(fn, delay) {

    let timeout;

    return function () {

        clearTimeout(timeout);

        timeout = setTimeout(

            () => fn.apply(
                this,
                arguments
            ),

            delay

        );

    };

}


/* ===========================
   AI GENERATION
=========================== */

async function generateAI() {

    if (!currentDocumentId) {
        alert("Save the document first.");
        return;
    }

    setStatus("Generating AI...");

    try {

        const response = await fetch(
            `${API}/ai/generate`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    document_id: currentDocumentId
                })
            }
        );

        if (!response.ok)
            throw new Error();

        const data = await response.json();

        if (data.html_content) {
            quill.root.innerHTML = data.html_content;
        }

        setStatus("AI Complete");

    }

    catch (err) {

        console.error(err);

        setStatus("AI Failed");

    }

}


/* ===========================
   WEEKLY REPORT
=========================== */

async function generateWeekly() {

    if (!currentDocumentId) {
        alert("Save the document first.");
        return;
    }

    setStatus("Generating Weekly...");

    try {

        const response = await fetch(

            `${API}/weekly/generate/${currentDocumentId}`,

            {
                method: "POST"
            }

        );

        if (!response.ok)
            throw new Error();

        const data = await response.json();

        currentDocumentId = data.document_id;

        await openDocument(currentDocumentId);

        await loadDocuments();

        setStatus("Weekly Generated");

    }

    catch (err) {

        console.error(err);

        setStatus("Generation Failed");

    }

}


/* ===========================
   MONTHLY REPORT
=========================== */

async function generateMonthly() {

    if (!currentDocumentId) {
        alert("Save the document first.");
        return;
    }

    setStatus("Generating Monthly...");

    try {

        const response = await fetch(

            `${API}/monthly/generate/${currentDocumentId}`,

            {
                method: "POST"
            }

        );

        if (!response.ok)
            throw new Error();

        const data = await response.json();

        currentDocumentId = data.document_id;

        await openDocument(currentDocumentId);

        await loadDocuments();

        setStatus("Monthly Generated");

    }

    catch (err) {

        console.error(err);

        setStatus("Generation Failed");

    }

}


/* ===========================
   EXPORT
=========================== */

async function exportPDF() {

    if (!currentDocumentId)
        return;

    window.open(

        `${API}/export/pdf/${currentDocumentId}`,

        "_blank"

    );

}


async function exportDOCX() {

    if (!currentDocumentId)
        return;

    window.open(

        `${API}/export/docx/${currentDocumentId}`,

        "_blank"

    );

}


/* ===========================
   SEARCH
=========================== */

function filterDocuments(search) {

    search = search.toLowerCase();

    document
        .querySelectorAll(".document-item")
        .forEach(item => {

            const text =
                item.innerText.toLowerCase();

            item.style.display =
                text.includes(search)
                ? ""
                : "none";

        });

}


/* ===========================
   SHORTCUTS
=========================== */

document.addEventListener(

    "keydown",

    function(e){

        if(e.ctrlKey && e.key==="n"){

            e.preventDefault();

            createBlankDocument();

        }

        if(e.ctrlKey && e.key==="d"){

            e.preventDefault();

            duplicateDocument();

        }

        if(e.ctrlKey && e.key==="Delete"){

            e.preventDefault();

            deleteCurrentDocument();

        }

    }

);


/* ===========================
   QUILL EVENTS
=========================== */

quill.on(

    "text-change",

    debounce(

        function(){

            if(currentDocumentId){

                setStatus("Editing...");

            }

        },

        400

    )

);


/* ===========================
   AUTO SAVE
=========================== */

setInterval(function(){

    if(currentDocumentId){

        saveDocument(true);

    }

},10000);


/* ===========================
   END OF FILE
=========================== */
