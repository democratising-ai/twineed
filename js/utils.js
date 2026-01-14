// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Escape HTML entities to prevent XSS
 */
export function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Get element by ID shorthand
 */
export const $ = id => document.getElementById(id);

/**
 * Show a toast notification
 */
export function showToast(msg, duration = 2500) {
    const toast = $('toast');
    if (!toast) return;
    
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

/**
 * Download a file with given content
 */
export function download(filename, content, type = 'text/html') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

/**
 * Generate a unique passage name
 */
export function generatePassageName(passages, baseName = 'New Passage') {
    let name = baseName;
    let i = 1;
    while (passages?.[name]) {
        name = `${baseName} ${i++}`;
    }
    return name;
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
