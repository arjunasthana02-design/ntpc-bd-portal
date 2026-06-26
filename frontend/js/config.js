function ntpcApiBase(path = "") {
    const explicit = window.NTPC_API_BASE || "";
    const base = explicit || (
        window.location.protocol === "file:"
            ? "http://127.0.0.1:8000"
            : window.location.origin
    );

    return `${base}${path}`;
}
