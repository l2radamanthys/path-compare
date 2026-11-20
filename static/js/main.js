document.addEventListener("DOMContentLoaded", () => {
    const HISTORY_KEY = "patch_compare_history_v1";
    const VIEW_MODE_KEY = "patch_compare_view_mode_v1";
    const THEME_KEY = "patch_compare_theme_v1";

    /* ============================================================
     * Tema Claro / Oscuro
     * ============================================================ */
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeToggleIcon = document.getElementById("themeToggleIcon");
    const themeToggleLabel = document.getElementById("themeToggleLabel");

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch {
            // Ignorar si localStorage no está disponible
        }
        if (themeToggleIcon && themeToggleLabel) {
            if (theme === "light") {
                themeToggleIcon.textContent = "🌙";
                themeToggleLabel.textContent = "Modo Oscuro";
            } else {
                themeToggleIcon.textContent = "☀️";
                themeToggleLabel.textContent = "Modo Claro";
            }
        }
    }

    if (themeToggleBtn) {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(currentTheme);
        themeToggleBtn.addEventListener("click", () => {
            const active = document.documentElement.getAttribute("data-theme") || "dark";
            applyTheme(active === "dark" ? "light" : "dark");
        });
    }

    /* ============================================================
     * Utilidades UI: Toasts y Modal de Confirmación
     * ============================================================ */
    const toastContainer = document.getElementById("toastContainer");

    function showToast(message, type = "info", duration = 3500) {
        if (!toastContainer) return;
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.25s ease";
            setTimeout(() => toast.remove(), 260);
        }, duration);
    }

    const confirmModal = document.getElementById("confirmModal");
    const confirmModalTitle = document.getElementById("confirmModalTitle");
    const confirmModalMessage = document.getElementById("confirmModalMessage");
    const acceptConfirmBtn = document.getElementById("acceptConfirmBtn");
    const cancelConfirmBtn = document.getElementById("cancelConfirmBtn");
    const closeConfirmModal = document.getElementById("closeConfirmModal");

    let confirmResolver = null;

    function resolveConfirm(value) {
        if (!confirmModal) return;
        confirmModal.classList.remove("show");
        if (confirmResolver) {
            const r = confirmResolver;
            confirmResolver = null;
            r(value);
        }
    }

    if (confirmModal) {
        acceptConfirmBtn.addEventListener("click", () => resolveConfirm(true));
        cancelConfirmBtn.addEventListener("click", () => resolveConfirm(false));
        closeConfirmModal.addEventListener("click", () => resolveConfirm(false));
        confirmModal.addEventListener("click", (e) => {
            if (e.target === confirmModal) resolveConfirm(false);
        });
    }

    function showConfirm({ title = "Confirmar", message = "", confirmText = "Confirmar", danger = false }) {
        if (!confirmModal) return Promise.resolve(window.confirm(message));
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        acceptConfirmBtn.textContent = confirmText;
        acceptConfirmBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
        confirmModal.classList.add("show");
        return new Promise((resolve) => {
            confirmResolver = resolve;
        });
    }

    /* ============================================================
     * Historial en localStorage (Index + guardado desde Results)
     * ============================================================ */
    function loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveHistoryEntry(entry) {
        if (!entry.dir_a || !entry.dir_b) return;
        let items = loadHistory().filter(
            (x) => !(x.dir_a === entry.dir_a && x.dir_b === entry.dir_b)
        );
        items.unshift(entry);
        items = items.slice(0, 6);
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
        } catch {
            // Ignorar si localStorage no está disponible
        }
    }

    /* ============================================================
     * Página de Configuración (index.html)
     * ============================================================ */
    const compareForm = document.getElementById("compareForm");
    if (compareForm) {
        const dirAInput = document.getElementById("dir_a");
        const dirBInput = document.getElementById("dir_b");
        const incExtsInput = document.getElementById("include_exts");
        const excExtsInput = document.getElementById("exclude_exts");
        const incDirsInput = document.getElementById("include_dirs");
        const excDirsInput = document.getElementById("exclude_dirs");

        // Intercambiar A <-> B
        const swapDirsBtn = document.getElementById("swapDirsBtn");
        if (swapDirsBtn) {
            swapDirsBtn.addEventListener("click", () => {
                const tmp = dirAInput.value;
                dirAInput.value = dirBInput.value;
                dirBInput.value = tmp;
                showToast("Directorios A y B intercambiados", "info", 2000);
            });
        }

        // Limpiar formulario
        const clearFormBtn = document.getElementById("clearFormBtn");
        if (clearFormBtn) {
            clearFormBtn.addEventListener("click", () => {
                [dirAInput, dirBInput, incExtsInput, excExtsInput, incDirsInput, excDirsInput].forEach(
                    (el) => (el.value = "")
                );
            });
        }

        // Presets rápidos de filtros
        function mergeCsvInput(inputEl, additionsStr) {
            if (!additionsStr) return;
            const current = inputEl.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const toAdd = additionsStr
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const merged = [...current];
            toAdd.forEach((item) => {
                if (!merged.includes(item)) merged.push(item);
            });
            inputEl.value = merged.join(", ");
        }

        document.querySelectorAll(".preset-chip").forEach((chip) => {
            chip.addEventListener("click", () => {
                mergeCsvInput(excDirsInput, chip.dataset.excludeDirs || "");
                mergeCsvInput(excExtsInput, chip.dataset.excludeExts || "");
                showToast(`Preset aplicado: ${chip.textContent.trim()}`, "info", 1800);
            });
        });

        // Renderizar historial reciente
        const recentSection = document.getElementById("recentHistorySection");
        const recentList = document.getElementById("recentHistoryList");
        const clearHistoryBtn = document.getElementById("clearHistoryBtn");

        function renderHistory() {
            const items = loadHistory();
            if (!items.length) {
                recentSection.classList.add("hidden");
                return;
            }
            recentSection.classList.remove("hidden");
            recentList.innerHTML = "";
            items.forEach((item) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "history-item-btn";
                const shortA = item.dir_a.split("/").filter(Boolean).slice(-2).join("/") || item.dir_a;
                const shortB = item.dir_b.split("/").filter(Boolean).slice(-2).join("/") || item.dir_b;
                btn.textContent = `${shortA}  ⇄  ${shortB}`;
                btn.title = `A: ${item.dir_a}\nB: ${item.dir_b}`;
                btn.addEventListener("click", () => {
                    dirAInput.value = item.dir_a || "";
                    dirBInput.value = item.dir_b || "";
                    incExtsInput.value = item.include_exts || "";
                    excExtsInput.value = item.exclude_exts || "";
                    incDirsInput.value = item.include_dirs || "";
                    excDirsInput.value = item.exclude_dirs || "";
                    showToast("Configuración cargada del historial", "info", 2000);
                });
                recentList.appendChild(btn);
            });
        }

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener("click", () => {
                localStorage.removeItem(HISTORY_KEY);
                renderHistory();
            });
        }

        renderHistory();
    }

    /* ============================================================
     * Modal Explorador de Carpetas
     * ============================================================ */
    const folderPickerModal = document.getElementById("folderPickerModal");
    const folderList = document.getElementById("folderList");
    const currentPathLabel = document.getElementById("currentPathLabel");
    const bwsBtns = document.querySelectorAll(".browse-btn");
    const closeModal = document.getElementById("closeModal");
    const cancelModal = document.getElementById("cancelModal");
    const selectFolderBtn = document.getElementById("selectFolderBtn");

    let currentTargetInput = null;
    let currentNavPath = ".";

    if (bwsBtns.length > 0 && folderPickerModal) {
        const openModal = async (targetId) => {
            currentTargetInput = document.getElementById(targetId);
            const val = currentTargetInput.value.trim();
            currentNavPath = val || ".";
            currentTargetInput.blur();
            folderPickerModal.classList.add("show");
            await loadPath(currentNavPath);
        };

        const hideModal = () => {
            folderPickerModal.classList.remove("show");
            currentTargetInput = null;
        };

        const loadPath = async (path) => {
            folderList.innerHTML = '<div class="loading-state">Cargando...</div>';
            try {
                const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
                const data = await response.json();

                if (data.error) {
                    showToast("Error leyendo directorio: " + data.error, "error");
                    folderList.innerHTML = "";
                    const errDiv = document.createElement("div");
                    errDiv.className = "alert alert-error";
                    errDiv.textContent = data.error;
                    folderList.appendChild(errDiv);
                    return;
                }

                currentNavPath = data.current_path;
                currentPathLabel.textContent = currentNavPath;
                folderList.innerHTML = "";

                if (data.parent_path) {
                    const el = document.createElement("div");
                    el.className = "folder-item parent-dir";
                    const icon = document.createElement("span");
                    icon.textContent = "📁";
                    const name = document.createElement("span");
                    name.textContent = "..";
                    el.append(icon, name);
                    el.addEventListener("click", () => loadPath(data.parent_path));
                    folderList.appendChild(el);
                }

                if (data.directories.length === 0) {
                    const empty = document.createElement("div");
                    empty.className = "empty-state";
                    empty.textContent = "Carpeta vacía (sin subdirectorios)";
                    folderList.appendChild(empty);
                } else {
                    data.directories.forEach((dir) => {
                        const el = document.createElement("div");
                        el.className = "folder-item";
                        const icon = document.createElement("span");
                        icon.textContent = "📁";
                        const name = document.createElement("span");
                        name.textContent = dir.name;
                        el.append(icon, name);
                        el.addEventListener("click", () => loadPath(dir.path));
                        folderList.appendChild(el);
                    });
                }
            } catch {
                folderList.innerHTML = "";
                const errDiv = document.createElement("div");
                errDiv.className = "alert alert-error";
                errDiv.textContent = "Error de conexión al cargar directorio.";
                folderList.appendChild(errDiv);
            }
        };

        bwsBtns.forEach((btn) => {
            btn.addEventListener("click", () => openModal(btn.getAttribute("data-target")));
        });

        closeModal.addEventListener("click", hideModal);
        cancelModal.addEventListener("click", hideModal);

        selectFolderBtn.addEventListener("click", () => {
            if (currentTargetInput) {
                currentTargetInput.value = currentNavPath;
            }
            hideModal();
        });

        folderPickerModal.addEventListener("click", (e) => {
            if (e.target === folderPickerModal) hideModal();
        });
    }

    /* ============================================================
     * Página de Resultados (results.html)
     * ============================================================ */
    const resultsDataEl = document.getElementById("resultsData");
    if (!resultsDataEl) return;

    const initialData = JSON.parse(resultsDataEl.textContent);

    // Guardar en historial reciente
    saveHistoryEntry({
        dir_a: initialData.dir_a,
        dir_b: initialData.dir_b,
        ...initialData.filters,
    });

    const state = {
        dir_a: initialData.dir_a,
        dir_b: initialData.dir_b,
        diff_cmd: initialData.diff_cmd || "diffuse",
        lists: {
            diferentes: [...(initialData.lists.diferentes || [])],
            solo_a: [...(initialData.lists.solo_a || [])],
            solo_b: [...(initialData.lists.solo_b || [])],
            iguales: [...(initialData.lists.iguales || [])],
        },
        globalSearch: "",
        categorySearch: {
            diferentes: "",
            solo_a: "",
            solo_b: "",
            iguales: "",
        },
        viewMode: localStorage.getItem(VIEW_MODE_KEY) === "tree" ? "tree" : "flat",
    };

    // Copiar rutas A/B al portapapeles
    document.querySelectorAll(".copy-path-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const text = btn.dataset.copyText || "";
            try {
                await navigator.clipboard.writeText(text);
                showToast("Ruta copiada al portapapeles", "success", 2000);
            } catch {
                showToast("No se pudo copiar al portapapeles", "error");
            }
        });
    });

    // Modal de Vista Previa de Archivo con Resaltado de Código
    const filePreviewModal = document.getElementById("filePreviewModal");
    const filePreviewTitle = document.getElementById("filePreviewTitle");
    const filePreviewMeta = document.getElementById("filePreviewMeta");
    const filePreviewBody = document.getElementById("filePreviewBody");
    const closeFilePreviewModal = document.getElementById("closeFilePreviewModal");
    const closeFilePreviewModalFooter = document.getElementById("closeFilePreviewModalFooter");
    const filePreviewCopyContentBtn = document.getElementById("filePreviewCopyContentBtn");
    const filePreviewCopyProjectBtn = document.getElementById("filePreviewCopyProjectBtn");

    let currentFilePreviewCtx = null;

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function hideFilePreviewModal() {
        if (!filePreviewModal) return;
        filePreviewModal.classList.remove("show");
        currentFilePreviewCtx = null;
    }

    if (filePreviewModal) {
        closeFilePreviewModal.addEventListener("click", hideFilePreviewModal);
        closeFilePreviewModalFooter.addEventListener("click", hideFilePreviewModal);
        filePreviewModal.addEventListener("click", (e) => {
            if (e.target === filePreviewModal) hideFilePreviewModal();
        });

        filePreviewCopyContentBtn.addEventListener("click", async () => {
            if (!currentFilePreviewCtx || typeof currentFilePreviewCtx.content !== "string") return;
            try {
                await navigator.clipboard.writeText(currentFilePreviewCtx.content);
                showToast("Código copiado al portapapeles", "success", 2000);
            } catch {
                showToast("No se pudo copiar el código", "error");
            }
        });

        filePreviewCopyProjectBtn.addEventListener("click", async () => {
            if (!currentFilePreviewCtx) return;
            const { file, side, categoryKey } = currentFilePreviewCtx;
            const direction = side === "a" ? "a_to_b" : "b_to_a";
            await copySingleFile(file, direction, categoryKey, filePreviewCopyProjectBtn);
            if (!state.lists[categoryKey].includes(file)) {
                hideFilePreviewModal();
            }
        });
    }

    async function openFilePreview(file, side, categoryKey) {
        if (!filePreviewModal) return;
        currentFilePreviewCtx = { file, side, categoryKey, content: "" };
        filePreviewTitle.textContent = file;
        filePreviewMeta.innerHTML = "";
        filePreviewBody.innerHTML = '<div class="loading-state">Cargando archivo...</div>';
        filePreviewCopyContentBtn.classList.add("hidden");

        if (categoryKey === "solo_a") {
            filePreviewCopyProjectBtn.textContent = "Copiar a Dir B →";
            filePreviewCopyProjectBtn.classList.remove("hidden");
        } else if (categoryKey === "solo_b") {
            filePreviewCopyProjectBtn.textContent = "← Copiar a Dir A";
            filePreviewCopyProjectBtn.classList.remove("hidden");
        } else {
            filePreviewCopyProjectBtn.classList.add("hidden");
        }

        filePreviewModal.classList.add("show");

        try {
            const response = await fetch("/api/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dir_a: state.dir_a,
                    dir_b: state.dir_b,
                    side,
                    archivo: file,
                }),
            });
            const data = await response.json();
            if (!data.success) {
                filePreviewBody.innerHTML = "";
                const err = document.createElement("div");
                err.className = "empty-state";
                err.textContent = data.error || "No se pudo leer el archivo.";
                filePreviewBody.appendChild(err);
                return;
            }

            const sidePill = document.createElement("span");
            sidePill.className = `path-tag ${side === "a" ? "tag-a" : "tag-b"}`;
            sidePill.textContent = side === "a" ? "Dir A" : "Dir B";

            const sizePill = document.createElement("span");
            sizePill.className = "meta-pill";
            sizePill.textContent = formatBytes(data.size);

            filePreviewMeta.append(sidePill, sizePill);

            if (data.too_large) {
                filePreviewBody.innerHTML =
                    '<div class="empty-state">El archivo supera 2 MB y no se puede previsualizar inline.</div>';
                return;
            }

            if (data.is_binary) {
                filePreviewBody.innerHTML =
                    '<div class="empty-state">Archivo binario: vista previa de texto no disponible.</div>';
                return;
            }

            const linesPill = document.createElement("span");
            linesPill.className = "meta-pill";
            linesPill.textContent = `${data.lines} línea(s)`;
            filePreviewMeta.appendChild(linesPill);

            currentFilePreviewCtx.content = data.content;
            filePreviewCopyContentBtn.classList.remove("hidden");

            const grid = document.createElement("div");
            grid.className = "code-preview-grid";

            const totalLines = Math.max(1, data.content.split("\n").length);
            const gutter = document.createElement("div");
            gutter.className = "code-gutter";
            gutter.textContent = Array.from({ length: totalLines }, (_, i) => String(i + 1)).join("\n");

            const pre = document.createElement("pre");
            pre.className = "code-pre";
            const code = document.createElement("code");
            code.className = "hljs";

            let detectedLang = "";
            if (window.hljs) {
                try {
                    const extMap = {
                        py: "python",
                        js: "javascript",
                        mjs: "javascript",
                        cjs: "javascript",
                        ts: "typescript",
                        tsx: "typescript",
                        jsx: "javascript",
                        html: "xml",
                        htm: "xml",
                        xml: "xml",
                        svg: "xml",
                        css: "css",
                        scss: "scss",
                        json: "json",
                        yml: "yaml",
                        yaml: "yaml",
                        md: "markdown",
                        sh: "bash",
                        bash: "bash",
                        zsh: "bash",
                        sql: "sql",
                        toml: "ini",
                        ini: "ini",
                        dockerfile: "dockerfile",
                        java: "java",
                        go: "go",
                        rs: "rust",
                        rb: "ruby",
                        php: "php",
                        c: "c",
                        h: "c",
                        cpp: "cpp",
                        hpp: "cpp",
                        cs: "csharp",
                    };
                    const baseName = file.split("/").pop().toLowerCase();
                    const mappedLang =
                        extMap[data.extension] ||
                        (baseName === "dockerfile" ? "dockerfile" : baseName === "makefile" ? "makefile" : "");

                    if (mappedLang && window.hljs.getLanguage(mappedLang)) {
                        const res = window.hljs.highlight(data.content, { language: mappedLang });
                        code.innerHTML = res.value;
                        detectedLang = mappedLang;
                    } else {
                        const res = window.hljs.highlightAuto(data.content);
                        code.innerHTML = res.value;
                        detectedLang = res.language || "";
                    }
                } catch {
                    code.textContent = data.content;
                }
            } else {
                code.textContent = data.content;
            }

            if (detectedLang) {
                const langPill = document.createElement("span");
                langPill.className = "meta-pill";
                langPill.textContent = detectedLang;
                filePreviewMeta.appendChild(langPill);
            }

            pre.appendChild(code);
            grid.append(gutter, pre);
            filePreviewBody.innerHTML = "";
            filePreviewBody.appendChild(grid);
        } catch (err) {
            filePreviewBody.innerHTML = "";
            const errEl = document.createElement("div");
            errEl.className = "empty-state";
            errEl.textContent = "Error de conexión al previsualizar archivo: " + err;
            filePreviewBody.appendChild(errEl);
        }
    }

    // Modal de Vista Previa de Diff
    const diffPreviewModal = document.getElementById("diffPreviewModal");
    const diffModalTitle = document.getElementById("diffModalTitle");
    const diffModalStats = document.getElementById("diffModalStats");
    const diffViewer = document.getElementById("diffViewer");
    const closeDiffModal = document.getElementById("closeDiffModal");
    const closeDiffModalFooter = document.getElementById("closeDiffModalFooter");
    const diffModalOpenExternalBtn = document.getElementById("diffModalOpenExternalBtn");
    let currentPreviewFile = null;

    function hideDiffModal() {
        diffPreviewModal.classList.remove("show");
        currentPreviewFile = null;
    }

    if (diffPreviewModal) {
        closeDiffModal.addEventListener("click", hideDiffModal);
        closeDiffModalFooter.addEventListener("click", hideDiffModal);
        diffPreviewModal.addEventListener("click", (e) => {
            if (e.target === diffPreviewModal) hideDiffModal();
        });
        diffModalOpenExternalBtn.addEventListener("click", () => {
            if (currentPreviewFile) {
                openExternalDiff(currentPreviewFile, diffModalOpenExternalBtn);
            }
        });
    }

    async function openDiffPreview(file) {
        currentPreviewFile = file;
        diffModalTitle.textContent = file;
        diffModalStats.innerHTML = "";
        diffViewer.innerHTML = '<div class="loading-state">Generando diff...</div>';
        diffPreviewModal.classList.add("show");

        try {
            const response = await fetch("/api/diff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dir_a: state.dir_a,
                    dir_b: state.dir_b,
                    archivo: file,
                }),
            });
            const data = await response.json();
            if (!data.success) {
                diffViewer.innerHTML = "";
                const err = document.createElement("div");
                err.className = "empty-state";
                err.textContent = data.error || "No se pudo generar el diff.";
                diffViewer.appendChild(err);
                return;
            }

            if (data.too_large) {
                diffViewer.innerHTML =
                    '<div class="empty-state">El archivo supera 2 MB. Ábrelo en la herramienta externa para compararlo.</div>';
                return;
            }

            if (data.is_binary) {
                diffViewer.innerHTML =
                    '<div class="empty-state">Archivo binario: no se puede mostrar diff de texto inline.</div>';
                return;
            }

            const addBadge = document.createElement("span");
            addBadge.className = "diff-stat-add";
            addBadge.textContent = `+${data.stats.added}`;
            const delBadge = document.createElement("span");
            delBadge.className = "diff-stat-del";
            delBadge.textContent = `-${data.stats.removed}`;
            diffModalStats.append(addBadge, delBadge);

            diffViewer.innerHTML = "";
            if (!data.diff_lines.length) {
                const empty = document.createElement("div");
                empty.className = "empty-state";
                empty.textContent = "Los archivos ya son idénticos.";
                diffViewer.appendChild(empty);
                return;
            }

            const frag = document.createDocumentFragment();
            data.diff_lines.forEach((line) => {
                const div = document.createElement("div");
                div.className = "diff-line";
                if (line.startsWith("+++") || line.startsWith("---")) {
                    div.classList.add("diff-line-meta");
                } else if (line.startsWith("@@")) {
                    div.classList.add("diff-line-hunk");
                } else if (line.startsWith("+")) {
                    div.classList.add("diff-line-add");
                } else if (line.startsWith("-")) {
                    div.classList.add("diff-line-del");
                }
                div.textContent = line;
                frag.appendChild(div);
            });
            diffViewer.appendChild(frag);
        } catch (err) {
            diffViewer.innerHTML = "";
            const errEl = document.createElement("div");
            errEl.className = "empty-state";
            errEl.textContent = "Error de conexión al cargar diff: " + err;
            diffViewer.appendChild(errEl);
        }
    }

    // Acciones sobre archivos
    function moveFileToIguales(categoryKey, file) {
        state.lists[categoryKey] = state.lists[categoryKey].filter((f) => f !== file);
        if (!state.lists.iguales.includes(file)) {
            state.lists.iguales.push(file);
            state.lists.iguales.sort((a, b) => a.localeCompare(b));
        }
        renderCategory(categoryKey);
        renderCategory("iguales");
        updateSummaryCounts();
    }

    function removeFileFromCategory(categoryKey, file) {
        state.lists[categoryKey] = state.lists[categoryKey].filter((f) => f !== file);
        renderCategory(categoryKey);
        updateSummaryCounts();
    }

    async function openExternalDiff(file, btnEl) {
        if (btnEl.classList.contains("loading")) return;
        const originalText = btnEl.textContent;
        btnEl.textContent = "Abriendo...";
        btnEl.classList.add("loading");
        btnEl.disabled = true;

        try {
            const response = await fetch("/open_diffuse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dir_a: state.dir_a,
                    dir_b: state.dir_b,
                    archivo: file,
                }),
            });
            const data = await response.json();
            if (!data.success) {
                showToast("Error al abrir diff externo: " + data.error, "error", 4500);
            } else if (data.are_equal) {
                moveFileToIguales("diferentes", file);
                showToast(`'${file}' ahora es idéntico en ambos directorios`, "success");
            }
        } catch (err) {
            showToast("Error de conexión al abrir diff externo: " + err, "error");
        } finally {
            btnEl.textContent = originalText;
            btnEl.classList.remove("loading");
            btnEl.disabled = false;
        }
    }

    async function copySingleFile(file, direction, sourceCategory, btnEl, { overwrite = false } = {}) {
        const destLabel = direction === "a_to_b" ? "Dir B" : "Dir A";
        if (overwrite) {
            const ok = await showConfirm({
                title: "Sobrescribir archivo",
                message: `¿Deseas sobrescribir '${file}' en ${destLabel} con la versión del otro proyecto?`,
                confirmText: `Sobrescribir en ${destLabel}`,
                danger: true,
            });
            if (!ok) return;
        }

        const originalText = btnEl.textContent;
        btnEl.textContent = "Copiando...";
        btnEl.classList.add("loading");
        btnEl.disabled = true;

        try {
            const response = await fetch("/api/copy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dir_a: state.dir_a,
                    dir_b: state.dir_b,
                    archivo: file,
                    direction,
                    overwrite,
                }),
            });
            const data = await response.json();
            if (!data.success) {
                showToast("Error al copiar: " + (data.error || "Desconocido"), "error", 4500);
                return;
            }
            moveFileToIguales(sourceCategory, file);
            showToast(`Copiado '${file}' → ${destLabel}`, "success");
        } catch (err) {
            showToast("Error de conexión al copiar: " + err, "error");
        } finally {
            btnEl.textContent = originalText;
            btnEl.classList.remove("loading");
            btnEl.disabled = false;
        }
    }

    async function copyBatchVisible(categoryKey, direction, btnEl) {
        const visibleFiles = getFilteredFiles(categoryKey);
        if (!visibleFiles.length) {
            showToast("No hay archivos visibles para copiar.", "warning");
            return;
        }
        const destLabel = direction === "a_to_b" ? "Dir B" : "Dir A";
        const ok = await showConfirm({
            title: `Copiar ${visibleFiles.length} archivo(s)`,
            message: `Se copiarán ${visibleFiles.length} archivo(s) visibles hacia ${destLabel}.\n¿Deseas continuar?`,
            confirmText: `Copiar ${visibleFiles.length} a ${destLabel}`,
        });
        if (!ok) return;

        const originalText = btnEl.textContent;
        btnEl.textContent = "Copiando...";
        btnEl.disabled = true;

        try {
            const response = await fetch("/api/copy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dir_a: state.dir_a,
                    dir_b: state.dir_b,
                    archivos: visibleFiles,
                    direction,
                    overwrite: false,
                }),
            });
            const data = await response.json();
            const copied = data.copied || [];
            if (copied.length > 0) {
                const copiedSet = new Set(copied);
                state.lists[categoryKey] = state.lists[categoryKey].filter((f) => !copiedSet.has(f));
                copied.forEach((f) => {
                    if (!state.lists.iguales.includes(f)) state.lists.iguales.push(f);
                });
                state.lists.iguales.sort((a, b) => a.localeCompare(b));
                renderCategory(categoryKey);
                renderCategory("iguales");
                updateSummaryCounts();
                showToast(`Se copiaron ${copied.length} archivo(s) a ${destLabel}`, "success");
            }
            if (data.errors && data.errors.length > 0) {
                showToast(`${data.errors.length} archivo(s) tuvieron errores al copiar.`, "warning", 4500);
            }
        } catch (err) {
            showToast("Error de conexión en copia masiva: " + err, "error");
        } finally {
            btnEl.textContent = originalText;
            btnEl.disabled = false;
        }
    }

    async function deleteExclusiveFile(file, side, categoryKey, btnEl) {
        const sideLabel = side === "a" ? "Dir A" : "Dir B";
        const ok = await showConfirm({
            title: "Eliminar archivo",
            message: `¿Seguro que deseas eliminar permanentemente '${file}' de ${sideLabel}?`,
            confirmText: "Eliminar",
            danger: true,
        });
        if (!ok) return;

        btnEl.disabled = true;
        try {
            const response = await fetch("/api/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dir_a: state.dir_a,
                    dir_b: state.dir_b,
                    side,
                    archivo: file,
                }),
            });
            const data = await response.json();
            if (!data.success) {
                showToast("Error al eliminar: " + (data.error || "Desconocido"), "error");
                return;
            }
            removeFileFromCategory(categoryKey, file);
            showToast(`Eliminado '${file}' de ${sideLabel}`, "warning");
        } catch (err) {
            showToast("Error de conexión al eliminar: " + err, "error");
        } finally {
            btnEl.disabled = false;
        }
    }

    /* ============================================================
     * Filtrado y Renderizado (Lista Plana y Vista Árbol)
     * ============================================================ */
    function getFilteredFiles(categoryKey) {
        const list = state.lists[categoryKey] || [];
        const gq = state.globalSearch.trim().toLowerCase();
        const cq = (state.categorySearch[categoryKey] || "").trim().toLowerCase();
        if (!gq && !cq) return list;
        return list.filter((file) => {
            const lower = file.toLowerCase();
            if (gq && !lower.includes(gq)) return false;
            if (cq && !lower.includes(cq)) return false;
            return true;
        });
    }

    function updateSummaryCounts() {
        ["diferentes", "solo_a", "solo_b", "iguales"].forEach((key) => {
            const el = document.getElementById(`count-${key}`);
            if (el) el.textContent = String(state.lists[key].length);
        });
    }

    function createFileItemElement(file, categoryKey, displayLabel = null) {
        const li = document.createElement("li");
        li.className = "file-item" + (categoryKey === "diferentes" ? " diff-item" : "");

        const main = document.createElement("div");
        main.className = "file-main";

        const icon = document.createElement("span");
        icon.className = "file-icon";
        if (categoryKey === "diferentes") icon.textContent = "📝";
        else if (categoryKey === "iguales") icon.textContent = "✅";
        else icon.textContent = "➕";

        const nameSpan = document.createElement("span");
        nameSpan.className = "file-name";
        nameSpan.textContent = displayLabel || file;
        nameSpan.title = file;

        main.append(icon, nameSpan);

        const actions = document.createElement("div");
        actions.className = "file-actions";

        if (categoryKey === "diferentes") {
            const previewBtn = document.createElement("button");
            previewBtn.type = "button";
            previewBtn.className = "action-btn btn-diff-preview";
            previewBtn.textContent = "Diff";
            previewBtn.title = "Vista previa de diferencias";
            previewBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openDiffPreview(file);
            });

            const extBtn = document.createElement("button");
            extBtn.type = "button";
            extBtn.className = "action-btn";
            extBtn.textContent = "Abrir";
            extBtn.title = `Abrir en ${state.diff_cmd}`;
            extBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openExternalDiff(file, extBtn);
            });

            const aToBBtn = document.createElement("button");
            aToBBtn.type = "button";
            aToBBtn.className = "action-btn btn-sync-action";
            aToBBtn.textContent = "A→B";
            aToBBtn.title = "Sobrescribir en Dir B con la versión de Dir A";
            aToBBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                copySingleFile(file, "a_to_b", "diferentes", aToBBtn, { overwrite: true });
            });

            const bToABtn = document.createElement("button");
            bToABtn.type = "button";
            bToABtn.className = "action-btn btn-sync-action";
            bToABtn.textContent = "B→A";
            bToABtn.title = "Sobrescribir en Dir A con la versión de Dir B";
            bToABtn.addEventListener("click", (e) => {
                e.stopPropagation();
                copySingleFile(file, "b_to_a", "diferentes", bToABtn, { overwrite: true });
            });

            actions.append(previewBtn, extBtn, aToBBtn, bToABtn);

            li.addEventListener("dblclick", () => openDiffPreview(file));
        } else if (categoryKey === "solo_a") {
            const viewBtn = document.createElement("button");
            viewBtn.type = "button";
            viewBtn.className = "action-btn btn-diff-preview";
            viewBtn.textContent = "Ver";
            viewBtn.title = "Previsualizar archivo con resaltado de código";
            viewBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openFilePreview(file, "a", "solo_a");
            });

            const copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "action-btn btn-copy-action";
            copyBtn.textContent = "Copiar a B →";
            copyBtn.title = "Copiar este archivo al Directorio B";
            copyBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                copySingleFile(file, "a_to_b", "solo_a", copyBtn);
            });

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "action-btn btn-delete-action";
            delBtn.textContent = "🗑️";
            delBtn.title = "Eliminar este archivo del Directorio A";
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteExclusiveFile(file, "a", "solo_a", delBtn);
            });

            actions.append(viewBtn, copyBtn, delBtn);
            li.addEventListener("dblclick", () => openFilePreview(file, "a", "solo_a"));
        } else if (categoryKey === "solo_b") {
            const viewBtn = document.createElement("button");
            viewBtn.type = "button";
            viewBtn.className = "action-btn btn-diff-preview";
            viewBtn.textContent = "Ver";
            viewBtn.title = "Previsualizar archivo con resaltado de código";
            viewBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openFilePreview(file, "b", "solo_b");
            });

            const copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "action-btn btn-copy-action";
            copyBtn.textContent = "← Copiar a A";
            copyBtn.title = "Copiar este archivo al Directorio A";
            copyBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                copySingleFile(file, "b_to_a", "solo_b", copyBtn);
            });

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "action-btn btn-delete-action";
            delBtn.textContent = "🗑️";
            delBtn.title = "Eliminar este archivo del Directorio B";
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteExclusiveFile(file, "b", "solo_b", delBtn);
            });

            actions.append(viewBtn, copyBtn, delBtn);
            li.addEventListener("dblclick", () => openFilePreview(file, "b", "solo_b"));
        } else if (categoryKey === "iguales") {
            const viewBtn = document.createElement("button");
            viewBtn.type = "button";
            viewBtn.className = "action-btn btn-diff-preview";
            viewBtn.textContent = "Ver";
            viewBtn.title = "Previsualizar archivo con resaltado de código";
            viewBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openFilePreview(file, "a", "iguales");
            });

            actions.append(viewBtn);
            li.addEventListener("dblclick", () => openFilePreview(file, "a", "iguales"));
        }

        li.append(main, actions);
        return li;
    }

    function buildTree(files) {
        const root = { folders: {}, files: [] };
        files.forEach((file) => {
            const parts = file.split("/");
            let node = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const folder = parts[i];
                if (!node.folders[folder]) {
                    node.folders[folder] = { folders: {}, files: [] };
                }
                node = node.folders[folder];
            }
            node.files.push({ fullPath: file, name: parts[parts.length - 1] });
        });
        return root;
    }

    function countTreeFiles(node) {
        let count = node.files.length;
        Object.values(node.folders).forEach((sub) => {
            count += countTreeFiles(sub);
        });
        return count;
    }

    function renderTreeNode(node, categoryKey) {
        const frag = document.createDocumentFragment();
        const folderNames = Object.keys(node.folders).sort((a, b) => a.localeCompare(b));

        folderNames.forEach((folderName) => {
            const subNode = node.folders[folderName];
            const folderDiv = document.createElement("div");
            folderDiv.className = "tree-folder";

            const header = document.createElement("div");
            header.className = "tree-folder-header";

            const caret = document.createElement("span");
            caret.className = "tree-caret";
            caret.textContent = "▼";

            const icon = document.createElement("span");
            icon.textContent = "📂";

            const label = document.createElement("span");
            label.textContent = folderName;

            const count = document.createElement("span");
            count.className = "tree-folder-count";
            count.textContent = `(${countTreeFiles(subNode)})`;

            header.append(caret, icon, label, count);
            header.addEventListener("click", () => {
                folderDiv.classList.toggle("collapsed");
            });

            const children = document.createElement("div");
            children.className = "tree-children";
            children.appendChild(renderTreeNode(subNode, categoryKey));

            folderDiv.append(header, children);
            frag.appendChild(folderDiv);
        });

        if (node.files.length > 0) {
            const ul = document.createElement("ul");
            ul.className = "file-list";
            node.files.forEach((f) => {
                ul.appendChild(createFileItemElement(f.fullPath, categoryKey, f.name));
            });
            frag.appendChild(ul);
        }

        return frag;
    }

    function renderCategory(categoryKey) {
        const wrapper = document.getElementById(`list-${categoryKey}`);
        const badge = document.getElementById(`badge-${categoryKey}`);
        if (!wrapper) return;

        const total = state.lists[categoryKey].length;
        const filtered = getFilteredFiles(categoryKey);
        const hasQuery = Boolean(
            state.globalSearch.trim() || (state.categorySearch[categoryKey] || "").trim()
        );

        if (badge) {
            badge.textContent = hasQuery ? `${filtered.length} / ${total}` : `${total}`;
        }

        // Habilitar/deshabilitar botones de copia en lote
        if (categoryKey === "solo_a") {
            const btn = document.getElementById("batchCopyAtoB");
            if (btn) btn.disabled = filtered.length === 0;
        } else if (categoryKey === "solo_b") {
            const btn = document.getElementById("batchCopyBtoA");
            if (btn) btn.disabled = filtered.length === 0;
        }

        wrapper.innerHTML = "";

        if (total === 0) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent =
                categoryKey === "diferentes"
                    ? "No se encontraron diferencias."
                    : categoryKey === "iguales"
                      ? "No hay archivos iguales."
                      : "No hay archivos exclusivos.";
            wrapper.appendChild(empty);
            return;
        }

        if (filtered.length === 0) {
            const noMatch = document.createElement("p");
            noMatch.className = "empty-state";
            noMatch.textContent = "Sin coincidencias para la búsqueda actual.";
            wrapper.appendChild(noMatch);
            return;
        }

        if (state.viewMode === "tree") {
            const tree = buildTree(filtered);
            wrapper.appendChild(renderTreeNode(tree, categoryKey));
        } else {
            const ul = document.createElement("ul");
            ul.className = "file-list";
            const frag = document.createDocumentFragment();
            filtered.forEach((file) => {
                frag.appendChild(createFileItemElement(file, categoryKey));
            });
            ul.appendChild(frag);
            wrapper.appendChild(ul);
        }
    }

    function renderAllCategories() {
        ["diferentes", "solo_a", "solo_b", "iguales"].forEach(renderCategory);
        updateSummaryCounts();
    }

    /* ============================================================
     * Eventos de Buscadores, Toggle de Vista y Copia en Lote
     * ============================================================ */
    const globalSearchInput = document.getElementById("globalSearchInput");
    const globalSearchClear = document.getElementById("globalSearchClear");

    if (globalSearchInput) {
        globalSearchInput.addEventListener("input", () => {
            state.globalSearch = globalSearchInput.value;
            globalSearchClear.classList.toggle("hidden", !state.globalSearch);
            renderAllCategories();
        });
        globalSearchClear.addEventListener("click", () => {
            globalSearchInput.value = "";
            state.globalSearch = "";
            globalSearchClear.classList.add("hidden");
            renderAllCategories();
            globalSearchInput.focus();
        });
    }

    document.querySelectorAll(".category-search-input").forEach((input) => {
        const cat = input.dataset.category;
        const clearBtn = document.querySelector(`[data-clear-category="${cat}"]`);

        input.addEventListener("input", () => {
            state.categorySearch[cat] = input.value;
            if (clearBtn) clearBtn.classList.toggle("hidden", !input.value);
            renderCategory(cat);
        });

        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                input.value = "";
                state.categorySearch[cat] = "";
                clearBtn.classList.add("hidden");
                renderCategory(cat);
                input.focus();
            });
        }
    });

    const viewModeToggle = document.getElementById("viewModeToggle");
    const viewModeLabel = document.getElementById("viewModeLabel");

    function updateViewModeButton() {
        if (!viewModeLabel) return;
        viewModeLabel.textContent = state.viewMode === "tree" ? "Vista Lista" : "Vista Árbol";
    }

    if (viewModeToggle) {
        updateViewModeButton();
        viewModeToggle.addEventListener("click", () => {
            state.viewMode = state.viewMode === "tree" ? "flat" : "tree";
            localStorage.setItem(VIEW_MODE_KEY, state.viewMode);
            updateViewModeButton();
            renderAllCategories();
        });
    }

    const batchCopyAtoB = document.getElementById("batchCopyAtoB");
    if (batchCopyAtoB) {
        batchCopyAtoB.addEventListener("click", () =>
            copyBatchVisible("solo_a", "a_to_b", batchCopyAtoB)
        );
    }

    const batchCopyBtoA = document.getElementById("batchCopyBtoA");
    if (batchCopyBtoA) {
        batchCopyBtoA.addEventListener("click", () =>
            copyBatchVisible("solo_b", "b_to_a", batchCopyBtoA)
        );
    }

    // Renderizado inicial
    renderAllCategories();
});
