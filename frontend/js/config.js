function ntpcApiBase(path = "") {
    const explicit = window.NTPC_API_BASE || "";
    const deployedBackend = "https://ntpc-bd-portal-1.onrender.com";
    const localBackend = "http://127.0.0.1:8000";
    const base = explicit || (
        window.location.protocol === "file:"
            ? localBackend
            : window.location.hostname.includes("ntpc-bd-portal-frontend.onrender.com")
                ? deployedBackend
                : window.location.origin
    );

    return `${base}${path}`;
}
