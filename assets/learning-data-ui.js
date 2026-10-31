/** Controls for the CourseStorage API. User data is never inserted as HTML. */
(function () {
    'use strict';
    const storage = window.CourseStorage;
    const dialog = document.getElementById('learning-data-dialog');
    const status = document.getElementById('learning-data-status');
    const warning = document.getElementById('storage-warning');
    function showStorageWarning() {
        warning.hidden = false;
        warning.textContent = 'Browser storage is unavailable. New work may last only until this page closes. Download your data to keep a copy.';
    }
    storage.subscribe(showStorageWarning);
    document.getElementById('learning-data-open').addEventListener('click', () => {
        const count = storage.keys().length;
        status.textContent = count + ' course records available in this browser session.';
        dialog.showModal();
    });
    document.getElementById('learning-data-close').addEventListener('click', () => dialog.close());
    document.getElementById('learning-data-export').addEventListener('click', () => {
        const data = storage.exportData();
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ee-review-learning-data.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = data.storageAccessFailed
            ? 'Download requested. Storage access failed, so this copy may contain only records available in this session.'
            : 'Download requested. Keep this file private if your answers contain project information.';
    });
    document.getElementById('learning-data-clear').addEventListener('click', () => {
        if (!window.confirm('Delete saved progress, answers and measurements for this course in this browser? Downloaded copies will remain.')) return;
        const result = storage.clear();
        if (result.complete) window.location.reload();
        else status.textContent = 'Browser storage blocked deletion. Use your browser’s site-data settings to finish clearing saved records.';
    });
})();
