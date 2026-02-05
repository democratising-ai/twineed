// =====================================================
// MAIN APP - WIRING & STATE MANAGEMENT
// =====================================================

import { AuthService, StoryDB } from './firebase.js';
import { CanvasController } from './canvas.js';
import { StoryRenderer, StoryPlayer } from './story.js';
import {
    parseTwine,
    parseTwee,
    parseJson,
    parseFile,
    exportAsHtml,
    exportAsTwineArchive,
    exportAsTwee,
    exportAsJson
} from './import-export.js';
import { $, esc, showToast, generatePassageName, validatePassageName, deepClone } from './utils.js';

// =====================================================
// OWNERSHIP HELPERS
// =====================================================
function isOwner(story) {
    return story && story.ownerId === AuthService.getCurrentUserId();
}

// =====================================================
// APP STATE
// =====================================================
let stories = [];
let communityStories = [];
let currentTab = 'mine';
let currentStory = null;

// =====================================================
// DOM REFERENCES
// =====================================================
const loginScreen = $('loginScreen');
const app = $('app');
const toolbar = document.querySelector('.toolbar');
const libraryView = $('libraryView');
const canvasView = $('canvasView');
const storiesList = $('storiesList');
const storyTitle = $('storyTitle');

// =====================================================
// INITIALIZE CONTROLLERS
// =====================================================
const canvas = new CanvasController({
    canvasView: $('canvasView'),
    canvasContainer: $('canvasContainer'),
    zoomDisplay: $('zoomLevel'),
    onNodeDrag: (name, x, y) => {
        renderer.updatePassagePosition(name, x, y);
        renderer.renderConnections();
    },
    onNodeDragEnd: async (name) => {
        const passage = currentStory?.passages[name];
        if (passage) {
            try {
                await StoryDB.updatePassage(currentStory.id, name, {
                    x: passage.x,
                    y: passage.y
                });
            } catch (err) {
                console.error(err);
                showToast('Error saving position');
            }
        }
    }
});

const renderer = new StoryRenderer({
    passagesLayer: $('passagesLayer'),
    connectionsLayer: $('connectionsLayer'),
    onPassageSelect: (name) => {
        renderer.setSelectedPassage(name);
    },
    onPassageEdit: (name) => {
        openPassageEditor(name);
    },
    onPassageDragStart: (node, e) => {
        if (!isOwner(currentStory)) return;
        canvas.startDrag(node, e);
    }
});

const player = new StoryPlayer($('playContent'));

// =====================================================
// AUTH UI
// =====================================================
AuthService.onAuthStateChanged(user => {
    if (user) {
        showApp();
    } else {
        loginScreen.classList.remove('hidden');
        app.classList.remove('active');
    }
});

$('showRegisterBtn').addEventListener('click', () => {
    $('loginView').classList.remove('active');
    $('registerView').classList.add('active');
    hideAuthError();
});

$('backToLoginBtn').addEventListener('click', () => {
    $('registerView').classList.remove('active');
    $('loginView').classList.add('active');
    hideAuthError();
});

$('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;

    try {
        await AuthService.signInWithEmail(email, password);
    } catch (err) {
        showAuthError(AuthService.getErrorMessage(err.code));
    }
});

$('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('registerEmail').value.trim();
    const password = $('registerPassword').value;
    const confirmPassword = $('registerPasswordConfirm').value;

    if (password !== confirmPassword) {
        showAuthError('Passwords do not match');
        return;
    }

    try {
        await AuthService.signUpWithEmail(email, password);
    } catch (err) {
        showAuthError(AuthService.getErrorMessage(err.code));
    }
});

$('googleSignInBtn').addEventListener('click', async () => {
    try {
        await AuthService.signInWithGoogle();
    } catch (err) {
        showAuthError(AuthService.getErrorMessage(err.code));
    }
});

$('forgotPasswordBtn').addEventListener('click', () => {
    $('forgotEmail').value = $('loginEmail').value;
    $('forgotError').style.display = 'none';
    $('forgotPasswordModal').classList.add('active');
});

$('cancelForgotPassword').addEventListener('click', () => {
    $('forgotPasswordModal').classList.remove('active');
});

$('forgotPasswordForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('forgotEmail').value.trim();

    try {
        await AuthService.sendPasswordReset(email);
        $('forgotError').style.display = 'none';
        $('forgotPasswordModal').classList.remove('active');
        showToast('Password reset email sent!');
    } catch (err) {
        const errorEl = $('forgotError');
        errorEl.textContent = AuthService.getErrorMessage(err.code);
        errorEl.style.display = 'block';
    }
});

$('logoutBtn').addEventListener('click', async () => {
    try {
        await AuthService.signOut();
    } catch (err) {
        console.error(err);
        showToast('Error signing out');
    }
});

function showApp() {
    loginScreen.classList.add('hidden');
    app.classList.add('active');
    loadStories();
}

function showAuthError(message) {
    const errorEl = $('loginError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideAuthError() {
    $('loginError').style.display = 'none';
}

// =====================================================
// LIBRARY
// =====================================================
async function loadStories() {
    storiesList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        stories = await StoryDB.getAll();
        renderStories();
    } catch (err) {
        console.error(err);
        storiesList.innerHTML = '<div class="empty-state"><p>Error loading. Check Firebase config.</p></div>';
    }
}

async function loadCommunityStories() {
    storiesList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        communityStories = await StoryDB.getAllPublic();
        renderStories();
    } catch (err) {
        console.error(err);
        storiesList.innerHTML = '<div class="empty-state"><p>Error loading community stories.</p></div>';
    }
}

function switchTab(tab) {
    currentTab = tab;
    $('myStoriesTab').classList.toggle('active', tab === 'mine');
    $('communityTab').classList.toggle('active', tab === 'community');
    if (tab === 'mine') {
        loadStories();
    } else {
        loadCommunityStories();
    }
}

function renderStories() {
    const list = currentTab === 'mine' ? stories : communityStories;
    const uid = AuthService.getCurrentUserId();

    if (!list.length) {
        const msg = currentTab === 'mine'
            ? '<h3>No stories yet</h3><p>Create your first interactive story</p>'
            : '<h3>No community stories</h3><p>No one has shared a story yet</p>';
        storiesList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                ${msg}
            </div>`;
        return;
    }

    storiesList.innerHTML = list.map(s => {
        const count = s.passages ? Object.keys(s.passages).length : 0;
        const date = s.updatedAt ? new Date(s.updatedAt.seconds * 1000).toLocaleDateString() : '';
        const owned = s.ownerId === uid;
        const badge = currentTab === 'community' && owned ? ' · <span class="badge-own">Yours</span>' : '';
        const duplicateBtn = currentTab === 'community' && !owned
            ? `<button class="btn-duplicate-card" data-id="${s.id}" title="Duplicate to My Stories">
                <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
               </button>`
            : '';
        return `
            <div class="story-card ${currentTab === 'community' && !owned ? 'community-card' : ''}" data-id="${s.id}">
                <div class="story-card-header">
                    <h3>${esc(s.title)}</h3>
                    <div class="story-card-actions">
                        ${duplicateBtn}
                        <div class="story-card-icon">
                            <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        </div>
                    </div>
                </div>
                <p class="story-card-meta">${count} passages · ${date}${badge}</p>
            </div>`;
    }).join('');

    storiesList.querySelectorAll('.story-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-duplicate-card')) return;
            openStory(card.dataset.id);
        });
    });

    storiesList.querySelectorAll('.btn-duplicate-card').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const storyId = btn.dataset.id;
            const source = communityStories.find(s => s.id === storyId);
            if (!source) return;

            try {
                await StoryDB.create({
                    title: source.title + ' (Copy)',
                    startPassage: source.startPassage,
                    passages: deepClone(source.passages)
                });
                showToast('Duplicated to My Stories!');
            } catch (err) {
                console.error(err);
                showToast('Error duplicating story');
            }
        });
    });
}

// =====================================================
// LIBRARY TABS
// =====================================================
$('myStoriesTab').addEventListener('click', () => switchTab('mine'));
$('communityTab').addEventListener('click', () => switchTab('community'));

// =====================================================
// STORY MANAGEMENT
// =====================================================
$('newStoryBtn').addEventListener('click', () => {
    $('newStoryModal').classList.add('active');
    $('newStoryTitle').value = '';
    $('newStoryTitle').focus();
});

$('cancelNewStory').addEventListener('click', () => $('newStoryModal').classList.remove('active'));

$('newStoryForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = $('newStoryTitle').value.trim();
    if (!title) return;

    try {
        const id = await StoryDB.create({
            title,
            startPassage: 'Start',
            passages: {
                'Start': {
                    name: 'Start',
                    content: 'Your story begins here.\n\nLink to passages: [[Next]]',
                    x: 400,
                    y: 300
                }
            }
        });

        $('newStoryModal').classList.remove('active');
        showToast('Story created!');

        const story = await StoryDB.get(id);
        stories.unshift(story);
        openStory(id);
    } catch (err) {
        console.error(err);
        showToast('Error creating story');
    }
});

function openStory(id) {
    currentStory = stories.find(s => s.id === id) || communityStories.find(s => s.id === id);
    if (!currentStory) return;

    libraryView.classList.add('hidden');
    canvasView.classList.add('active');
    toolbar.classList.add('active');

    storyTitle.textContent = currentStory.title;

    // Toggle UI based on ownership
    const owned = isOwner(currentStory);
    $('addPassageBtn').style.display = owned ? '' : 'none';
    $('renameStoryBtn').style.display = owned ? '' : 'none';
    $('deleteStoryBtn').style.display = owned ? '' : 'none';
    $('duplicateStoryBtn').style.display = '';

    renderer.setStory(currentStory);
    player.setStory(currentStory);
    canvas.reset();
    renderer.render();
}

$('backBtn').addEventListener('click', closeStory);

function closeStory() {
    canvasView.classList.remove('active');
    toolbar.classList.remove('active');
    libraryView.classList.remove('hidden');
    currentStory = null;
    renderer.setStory(null);
    loadStories();
}

// Story menu
$('menuBtn').addEventListener('click', e => {
    e.stopPropagation();
    $('storyMenu').classList.toggle('active');
});

document.addEventListener('click', () => {
    $('storyMenu').classList.remove('active');
});

$('renameStoryBtn').addEventListener('click', () => {
    if (!isOwner(currentStory)) return;
    $('renameTitle').value = currentStory.title;
    $('renameModal').classList.add('active');
    $('renameTitle').focus();
});

$('cancelRename').addEventListener('click', () => $('renameModal').classList.remove('active'));

$('renameForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!isOwner(currentStory)) { showToast('Only the owner can rename'); return; }
    const title = $('renameTitle').value.trim();
    if (!title) return;

    try {
        await StoryDB.update(currentStory.id, { title });
        currentStory.title = title;
        storyTitle.textContent = title;
        $('renameModal').classList.remove('active');
        showToast('Renamed!');
    } catch (err) {
        console.error(err);
        showToast('Error renaming story');
    }
});

$('duplicateStoryBtn').addEventListener('click', () => {
    $('duplicateTitle').value = currentStory.title + ' (Copy)';
    $('duplicateModal').classList.add('active');
    $('duplicateTitle').focus();
});

$('cancelDuplicate').addEventListener('click', () => $('duplicateModal').classList.remove('active'));

$('duplicateForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = $('duplicateTitle').value.trim();
    if (!title) return;

    try {
        await StoryDB.create({
            title,
            startPassage: currentStory.startPassage,
            passages: deepClone(currentStory.passages)
        });
        $('duplicateModal').classList.remove('active');
        showToast('Duplicated!');
        stories = await StoryDB.getAll();
    } catch (err) {
        console.error(err);
        showToast('Error duplicating story');
    }
});

$('deleteStoryBtn').addEventListener('click', async () => {
    if (!isOwner(currentStory)) { showToast('Only the owner can delete'); return; }
    if (!confirm(`Delete "${currentStory.title}"? This cannot be undone.`)) return;

    try {
        await StoryDB.delete(currentStory.id);
        showToast('Deleted');
        closeStory();
    } catch (err) {
        console.error(err);
        showToast('Error deleting story');
    }
});

// =====================================================
// EXPORT
// =====================================================
$('exportStoryBtn').addEventListener('click', () => {
    $('exportModal').classList.add('active');
});

$('cancelExport').addEventListener('click', () => {
    $('exportModal').classList.remove('active');
});

// Export as Twine Archive (compatible with Twine 2 editor)
$('exportTwineArchive').addEventListener('click', () => {
    if (!currentStory) return;
    exportAsTwineArchive(currentStory);
    $('exportModal').classList.remove('active');
    showToast('Exported as Twine Archive!');
});

// Export as Playable HTML
$('exportPlayable').addEventListener('click', () => {
    if (!currentStory) return;
    exportAsHtml(currentStory);
    $('exportModal').classList.remove('active');
    showToast('Exported as Playable HTML!');
});

// Export as Twee 3
$('exportTwee').addEventListener('click', () => {
    if (!currentStory) return;
    exportAsTwee(currentStory);
    $('exportModal').classList.remove('active');
    showToast('Exported as Twee!');
});

// Export as JSON
$('exportJson').addEventListener('click', () => {
    if (!currentStory) return;
    exportAsJson(currentStory);
    $('exportModal').classList.remove('active');
    showToast('Exported as JSON!');
});

// =====================================================
// IMPORT
// =====================================================
$('importBtn').addEventListener('click', () => {
    $('importModal').classList.add('active');
    $('importFile').value = '';
});

$('cancelImport').addEventListener('click', () => $('importModal').classList.remove('active'));

$('importForm').addEventListener('submit', async e => {
    e.preventDefault();
    const file = $('importFile').files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
        showToast('Error reading file');
    };
    reader.onload = async event => {
        try {
            // Use the auto-detect parser
            const story = parseFile(event.target.result, file.name);

            if (!story) {
                showToast('Could not parse file. Check format.');
                return;
            }

            // Sanitize: strip script tags from stylesheet, clear javascript
            // (javascript field is not used by this app and is an XSS risk in exports)
            const safeStylesheet = (story.stylesheet || '')
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/expression\s*\(/gi, '')
                .replace(/javascript\s*:/gi, '')
                .replace(/@import\b/gi, '/* @import */')
                .replace(/url\s*\(\s*['"]?\s*data\s*:/gi, 'url(/* blocked */')
                .replace(/behavior\s*:/gi, '/* behavior: */')
                .replace(/-moz-binding\s*:/gi, '/* -moz-binding: */');

            // Sanitize passage names to prevent prototype pollution
            const reserved = ['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf'];
            const safePassages = {};
            for (const [name, passage] of Object.entries(story.passages || {})) {
                if (reserved.includes(name)) continue;
                if (!name || !name.trim()) continue;
                safePassages[name] = passage;
            }
            if (Object.keys(safePassages).length === 0) {
                showToast('No valid passages found in file');
                return;
            }
            // Ensure startPassage references a valid passage
            const safeStart = safePassages[story.startPassage]
                ? story.startPassage
                : Object.keys(safePassages)[0];

            // Create the story in the database
            await StoryDB.create({
                title: story.title,
                startPassage: safeStart,
                passages: safePassages,
                // Store additional metadata if present
                ifid: story.ifid,
                format: story.format,
                formatVersion: story.formatVersion,
                zoom: story.zoom,
                tags: story.tags,
                stylesheet: safeStylesheet,
                javascript: '',
                tagColors: story.tagColors
            });

            $('importModal').classList.remove('active');
            showToast('Imported successfully!');
            loadStories();
        } catch (err) {
            console.error(err);
            showToast('Import error');
        }
    };
    reader.readAsText(file);
});

// =====================================================
// CANVAS CONTROLS
// =====================================================
$('zoomInBtn').addEventListener('click', () => canvas.zoomIn());
$('zoomOutBtn').addEventListener('click', () => canvas.zoomOut());

// =====================================================
// ADD PASSAGE
// =====================================================
$('addPassageBtn').addEventListener('click', async () => {
    if (!currentStory || !isOwner(currentStory)) return;

    const name = generatePassageName(currentStory.passages);
    const nameError = validatePassageName(name);
    if (nameError) {
        showToast(nameError);
        return;
    }
    const pos = canvas.getCenterPosition();

    const passage = { name, content: '', x: pos.x, y: pos.y };

    try {
        await StoryDB.update(currentStory.id, {
            [`passages.${name}`]: passage
        });

        // Update local state only after DB success
        if (!currentStory.passages) currentStory.passages = {};
        currentStory.passages[name] = passage;

        renderer.render();
        openPassageEditor(name);
    } catch (err) {
        console.error(err);
        showToast('Error adding passage');
    }
});

// =====================================================
// PASSAGE EDITOR
// =====================================================
function openPassageEditor(name) {
    const passage = currentStory.passages[name];
    if (!passage) return;

    renderer.setSelectedPassage(name);

    const owned = isOwner(currentStory);
    $('passageNameInput').value = passage.name;
    $('passageNameInput').readOnly = !owned;
    $('passageContentInput').value = passage.content || '';
    $('passageContentInput').readOnly = !owned;
    $('deletePassageBtn').style.display = owned ? '' : 'none';
    $('setStartPassageBtn').style.display = owned ? '' : 'none';
    $('passageModal').classList.add('active');
    $('passageContentInput').focus();
}

$('closePassageBtn').addEventListener('click', closePassageEditor);

$('passageModal').addEventListener('click', e => {
    if (e.target === $('passageModal')) closePassageEditor();
});

async function closePassageEditor() {
    const selectedPassage = renderer.getSelectedPassage();

    if (!currentStory || !selectedPassage) {
        $('passageModal').classList.remove('active');
        return;
    }

    // Non-owners can only view, not save
    if (!isOwner(currentStory)) {
        renderer.setSelectedPassage(null);
        $('passageModal').classList.remove('active');
        return;
    }

    const oldName = selectedPassage;
    const newName = $('passageNameInput').value.trim() || oldName;
    const content = $('passageContentInput').value;

    // Validate new name if changed
    if (newName !== oldName) {
        const nameError = validatePassageName(newName);
        if (nameError) {
            showToast(nameError);
            return;
        }
    }

    try {
        if (newName !== oldName) {
            // Check for name collision
            if (currentStory.passages[newName]) {
                showToast(`A passage named "${newName}" already exists`);
                return;
            }

            // Rename passage (deep clone to avoid mutating local state before DB success)
            const passages = deepClone(currentStory.passages);
            const passage = passages[oldName];
            delete passages[oldName];
            passages[newName] = { ...passage, name: newName, content };

            // Update link references in all other passages
            Object.values(passages).forEach(p => {
                if (p.name === newName) return; // skip the renamed passage itself
                if (!p.content) return;
                p.content = p.content
                    .replace(/\[\[([^\]]*?)\|([^\]]*?)\]\]/g, (m, display, target) =>
                        target.trim() === oldName ? `[[${display}|${newName}]]` : m)
                    .replace(/\[\[([^\]]*?)->([^\]]*?)\]\]/g, (m, display, target) =>
                        target.trim() === oldName ? `[[${display}->${newName}]]` : m)
                    .replace(/\[\[([^\]|>]*?)\]\]/g, (m, target) =>
                        target.trim() === oldName ? `[[${newName}]]` : m);
            });

            let startPassage = currentStory.startPassage;
            if (startPassage === oldName) startPassage = newName;

            await StoryDB.setPassages(currentStory.id, passages, startPassage);

            currentStory.passages = passages;
            currentStory.startPassage = startPassage;
        } else {
            // Just update content
            await StoryDB.updatePassage(currentStory.id, oldName, { content });
            currentStory.passages[oldName].content = content;
        }

        renderer.setSelectedPassage(null);
        $('passageModal').classList.remove('active');
        renderer.render();
    } catch (err) {
        console.error(err);
        showToast('Error saving passage');
    }
}

$('previewPassageBtn').addEventListener('click', async () => {
    const selectedPassage = renderer.getSelectedPassage();
    if (!selectedPassage) return;

    // Persist current content before preview
    const content = $('passageContentInput').value;
    if (currentStory.passages[selectedPassage]) {
        currentStory.passages[selectedPassage].content = content;
        if (isOwner(currentStory)) {
            try {
                await StoryDB.updatePassage(currentStory.id, selectedPassage, { content });
            } catch (err) {
                console.error(err);
                showToast('Error saving passage before preview');
            }
        }
    }

    $('passageModal').classList.remove('active');
    $('playModal').classList.add('active');
    player.play(selectedPassage);
});

$('setStartPassageBtn').addEventListener('click', async () => {
    if (!isOwner(currentStory)) return;
    const selectedPassage = renderer.getSelectedPassage();
    if (!selectedPassage) return;

    try {
        await StoryDB.update(currentStory.id, { startPassage: selectedPassage });
        currentStory.startPassage = selectedPassage;
        showToast('Start passage set');
        renderer.render();
    } catch (err) {
        console.error(err);
        showToast('Error setting start passage');
    }
});

$('deletePassageBtn').addEventListener('click', async () => {
    if (!isOwner(currentStory)) return;
    const selectedPassage = renderer.getSelectedPassage();
    if (!selectedPassage) return;

    if (Object.keys(currentStory.passages).length <= 1) {
        showToast('Cannot delete the only passage');
        return;
    }

    if (!confirm(`Delete "${selectedPassage}"?`)) return;

    try {
        // If deleting the start passage, reassign to another passage
        let newStart = undefined;
        if (currentStory.startPassage === selectedPassage) {
            newStart = Object.keys(currentStory.passages).find(n => n !== selectedPassage);
        }

        // Atomic: delete passage and update start in one call
        await StoryDB.deletePassage(currentStory.id, selectedPassage, newStart);
        delete currentStory.passages[selectedPassage];

        if (newStart !== undefined) {
            currentStory.startPassage = newStart;
        }

        renderer.setSelectedPassage(null);
        $('passageModal').classList.remove('active');
        renderer.render();
        showToast('Deleted');
    } catch (err) {
        console.error(err);
        showToast('Error deleting passage');
    }
});

// =====================================================
// PLAY MODE
// =====================================================
$('playBtn').addEventListener('click', () => {
    if (!currentStory) return;
    $('playModal').classList.add('active');
    player.play(currentStory.startPassage || 'Start');
});

$('closePlayBtn').addEventListener('click', () => {
    $('playModal').classList.remove('active');
});

$('playModal').addEventListener('click', e => {
    if (e.target === $('playModal')) $('playModal').classList.remove('active');
});

// =====================================================
// GLOBAL KEYBOARD SHORTCUTS
// =====================================================
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            if (m.id === 'passageModal') {
                closePassageEditor();
            } else {
                m.classList.remove('active');
            }
        });
    }
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(m => {
    if (m.id !== 'passageModal' && m.id !== 'playModal') {
        m.addEventListener('click', e => {
            if (e.target === m) m.classList.remove('active');
        });
    }
});
