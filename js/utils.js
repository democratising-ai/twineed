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
let _toastTimer = null;
export function showToast(msg, duration = 2500) {
    const toast = $('toast');
    if (!toast) return;

    if (_toastTimer) clearTimeout(_toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    _toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        _toastTimer = null;
    }, duration);
}

/**
 * Download a file with given content
 */
export function download(filename, content, type = 'text/html') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
 * Validate a passage name. Returns an error string or null if valid.
 */
export function validatePassageName(name) {
    if (!name || !name.trim()) return 'Passage name cannot be empty';
    if (name.length > 200) return 'Passage name is too long (max 200 characters)';
    if (name.includes('.')) return 'Passage name cannot contain dots';
    if (/[[\]{}#$\/]/.test(name)) return 'Passage name contains invalid characters';
    const reserved = ['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf'];
    if (reserved.includes(name)) return 'Passage name is reserved';
    return null;
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
