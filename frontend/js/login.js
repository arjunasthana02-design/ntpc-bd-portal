const API_BASE = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const showLoginPassword = document.getElementById("showLoginPassword");
    const showRegisterPassword = document.getElementById("showRegisterPassword");

    if (loginTab) loginTab.addEventListener("click", () => showAuthForm("login"));
    if (registerTab) registerTab.addEventListener("click", () => showAuthForm("register"));
    if (loginForm) loginForm.addEventListener("submit", login);
    if (registerForm) registerForm.addEventListener("submit", registerEmployee);

    if (showLoginPassword) {
        showLoginPassword.addEventListener("change", () => {
            togglePassword("password");
        });
    }

    if (showRegisterPassword) {
        showRegisterPassword.addEventListener("change", () => {
            togglePassword("registerPassword");
        });
    }

    showAuthForm("login");
});

function showAuthForm(mode) {
    const loginMode = mode === "login";

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");

    if (loginForm) loginForm.classList.toggle("hidden", !loginMode);
    if (registerForm) registerForm.classList.toggle("hidden", loginMode);
    if (loginTab) loginTab.classList.toggle("active", loginMode);
    if (registerTab) registerTab.classList.toggle("active", !loginMode);

    showMessage("");
}

async function login(event) {
    event.preventDefault();

    const username = document.getElementById("username")?.value.trim();
    const password = document.getElementById("password")?.value;

    if (!username || !password) {
        showMessage("Please enter username and password.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Login failed");
        }

        // save logged in user
        localStorage.setItem("ntpcUser", JSON.stringify(data));

        // redirect based on role
        if (data.role === "ADMIN") {
            window.location.href = "dashboard.html";
        } else {
            window.location.href = "employee_dashboard.html";
        }

    } catch (error) {
        showMessage(error.message || "Login failed");
    }
}

async function registerEmployee(event) {
    event.preventDefault();

    const fullName = document.getElementById("fullName")?.value.trim();
    const username = document.getElementById("registerUsername")?.value.trim();
    const password = document.getElementById("registerPassword")?.value;

    if (!fullName || !username || !password) {
        showMessage("Please fill all registration fields.");
        return;
    }

    const payload = {
        full_name: fullName,
        username: username,
        password: password,
        role: "EMPLOYEE",
    };

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Registration failed");
        }

        showMessage(data.message || "Registration submitted successfully.", false);

        const registerForm = document.getElementById("registerForm");
        if (registerForm) registerForm.reset();

        // optional: switch back to login after successful registration
        setTimeout(() => {
            showAuthForm("login");
        }, 1200);

    } catch (error) {
        showMessage(error.message || "Registration failed");
    }
}

function togglePassword(inputId) {
    const passwordBox = document.getElementById(inputId);
    if (!passwordBox) return;

    passwordBox.type = passwordBox.type === "password" ? "text" : "password";
}

function showMessage(message, isError = true) {
    const element = document.getElementById("message");
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "error");

    if (!message) return;

    if (isError) {
        element.classList.add("error");
    } else {
        element.classList.add("success");
    }
}