document.addEventListener("DOMContentLoaded", () => {
    // Diffuse launcher
    const diffItems = document.querySelectorAll('.diff-item');
    if (diffItems.length > 0) {
        const dirA = document.getElementById('dir_a_val').value;
        const dirB = document.getElementById('dir_b_val').value;
        
        diffItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                // Prevenir múltiples clicks
                if(item.classList.contains('loading')) return;
                
                const file = item.getAttribute('data-file');
                const btn = item.querySelector('.open-btn');
                
                const originalText = btn.innerText;
                btn.innerText = "Abriendo...";
                item.classList.add('loading');
                
                try {
                    const response = await fetch('/open_diffuse', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            dir_a: dirA,
                            dir_b: dirB,
                            archivo: file
                        })
                    });
                    
                    const data = await response.json();
                    if (!data.success) {
                        alert("Error al abrir Diffuse: " + data.error);
                    }
                } catch (err) {
                    alert("Error de conexión al intentar abrir Diffuse: " + err);
                } finally {
                    btn.innerText = originalText;
                    item.classList.remove('loading');
                }
            });
        });
    }

    // Modal Folder Picker
    const folderPickerModal = document.getElementById('folderPickerModal');
    const folderList = document.getElementById('folderList');
    const currentPathLabel = document.getElementById('currentPathLabel');
    const bwsBtns = document.querySelectorAll('.browse-btn');
    const closeModal = document.getElementById('closeModal');
    const cancelModal = document.getElementById('cancelModal');
    const selectFolderBtn = document.getElementById('selectFolderBtn');
    
    let currentTargetInput = null;
    let currentNavPath = ".";

    if (bwsBtns.length > 0 && folderPickerModal) {
        
        const openModal = async (targetId) => {
            currentTargetInput = document.getElementById(targetId);
            const val = currentTargetInput.value;
            currentNavPath = val ? val : ".";
            
            currentTargetInput.blur(); // Remove focus
            folderPickerModal.classList.add('show');
            await loadPath(currentNavPath);
        };
        
        const hideModal = () => {
            folderPickerModal.classList.remove('show');
            currentTargetInput = null;
        };

        const loadPath = async (path) => {
            folderList.innerHTML = '<div class="loading-state">Cargando...</div>';
            try {
                const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
                const data = await response.json();
                
                if (data.error) {
                    alert("Error leyendo directorio: " + data.error);
                    return;
                }
                
                currentNavPath = data.current_path;
                currentPathLabel.innerText = currentNavPath;
                
                folderList.innerHTML = '';
                
                // Add parent ".." link
                if (data.parent_path) {
                    const el = document.createElement('div');
                    el.className = 'folder-item parent-dir';
                    el.innerHTML = '<span class="icon">📁</span> ..';
                    el.onclick = () => loadPath(data.parent_path);
                    folderList.appendChild(el);
                }
                
                if (data.directories.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'empty-state';
                    empty.innerText = 'Carpeta vacía (sin subdirectorios)';
                    folderList.appendChild(empty);
                } else {
                    data.directories.forEach(dir => {
                        const el = document.createElement('div');
                        el.className = 'folder-item';
                        el.innerHTML = `<span class="icon">📁</span> ${dir.name}`;
                        el.onclick = () => loadPath(dir.path);
                        folderList.appendChild(el);
                    });
                }
                
            } catch(e) {
                folderList.innerHTML = '<div class="alert alert-error">Error cargando directorio</div>';
            }
        };

        bwsBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                openModal(btn.getAttribute('data-target'));
            });
        });

        closeModal.addEventListener('click', hideModal);
        cancelModal.addEventListener('click', hideModal);
        
        selectFolderBtn.addEventListener('click', () => {
            if(currentTargetInput) {
                currentTargetInput.value = currentNavPath;
            }
            hideModal();
        });

        // Close when clicking outside modal content
        window.addEventListener('click', (e) => {
            if (e.target == folderPickerModal) {
                hideModal();
            }
        });
    }
});
