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
import { $, esc, showToast, generatePassageName, deepClone } from './utils.js';

// =====================================================
// APP STATE
// =====================================================
let stories = [];
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
        if (err.code !== 'auth/popup-closed-by-user') {
            showAuthError(AuthService.getErrorMessage(err.code));
        }
    }
});

$('forgotPasswordBtn').addEventListener('click', () => {
    $('forgotEmail').value = $('loginEmail').value;
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
        $('forgotPasswordModal').classList.remove('active');
        showToast('Password reset email sent!');
    } catch (err) {
        showAuthError(AuthService.getErrorMessage(err.code));
    }
});

$('logoutBtn').addEventListener('click', async () => {
    try {
        await AuthService.signOut();
    } catch (err) {
        console.error(err);
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

function renderStories() {
    if (!stories.length) {
        storiesList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <h3>No stories yet</h3>
                <p>Create your first interactive story</p>
            </div>`;
        return;
    }

    storiesList.innerHTML = stories.map(s => {
        const count = s.passages ? Object.keys(s.passages).length : 0;
        const date = s.updatedAt ? new Date(s.updatedAt.seconds * 1000).toLocaleDateString() : '';
        return `
            <div class="story-card" data-id="${s.id}">
                <div class="story-card-header">
                    <h3>${esc(s.title)}</h3>
                    <div class="story-card-icon">
                        <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    </div>
                </div>
                <p class="story-card-meta">${count} passages · ${date}</p>
            </div>`;
    }).join('');

    storiesList.querySelectorAll('.story-card').forEach(card => {
        card.addEventListener('click', () => openStory(card.dataset.id));
    });
}

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
    currentStory = stories.find(s => s.id === id);
    if (!currentStory) return;

    libraryView.classList.add('hidden');
    canvasView.classList.add('active');
    toolbar.classList.add('active');

    storyTitle.textContent = currentStory.title;

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
    $('renameTitle').value = currentStory.title;
    $('renameModal').classList.add('active');
    $('renameTitle').focus();
});

$('cancelRename').addEventListener('click', () => $('renameModal').classList.remove('active'));

$('renameForm').addEventListener('submit', async e => {
    e.preventDefault();
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
    } catch (err) {
        console.error(err);
    }
});

$('deleteStoryBtn').addEventListener('click', async () => {
    if (!confirm(`Delete "${currentStory.title}"? This cannot be undone.`)) return;

    try {
        await StoryDB.delete(currentStory.id);
        showToast('Deleted');
        closeStory();
    } catch (err) {
        console.error(err);
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
    reader.onload = async event => {
        try {
            // Use the auto-detect parser
            const story = parseFile(event.target.result, file.name);

            if (!story) {
                showToast('Could not parse file. Check format.');
                return;
            }

            // Create the story in the database
            await StoryDB.create({
                title: story.title,
                startPassage: story.startPassage,
                passages: story.passages,
                // Store additional metadata if present
                ifid: story.ifid,
                format: story.format,
                formatVersion: story.formatVersion,
                zoom: story.zoom,
                tags: story.tags,
                stylesheet: story.stylesheet,
                javascript: story.javascript,
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
    if (!currentStory) return;

    const name = generatePassageName(currentStory.passages);
    const pos = canvas.getCenterPosition();

    const passage = { name, content: '', x: pos.x, y: pos.y };

    try {
        if (!currentStory.passages) currentStory.passages = {};
        currentStory.passages[name] = passage;

        await StoryDB.update(currentStory.id, {
            [`passages.${name}`]: passage
        });

        renderer.render();
        openPassageEditor(name);
    } catch (err) {
        console.error(err);
    }
});

// =====================================================
// PASSAGE EDITOR
// =====================================================
function openPassageEditor(name) {
    const passage = currentStory.passages[name];
    if (!passage) return;

    renderer.setSelectedPassage(name);

    $('passageNameInput').value = passage.name;
    $('passageContentInput').value = passage.content || '';
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

    const oldName = selectedPassage;
    const newName = $('passageNameInput').value.trim() || oldName;
    const content = $('passageContentInput').value;

    try {
        if (newName !== oldName) {
            // Rename passage
            const passages = { ...currentStory.passages };
            const passage = passages[oldName];
            delete passages[oldName];
            passages[newName] = { ...passage, name: newName, content };

            let startPassage = currentStory.startPassage;
            if (startPassage === oldName) startPassage = newName;

            await StoryDB.setPassages(currentStory.id, passages, startPassage);

            currentStory.passages = passages;
            currentStory.startPassage = startPassage;
        } else {
            // Just update content
            currentStory.passages[oldName].content = content;
            await StoryDB.updatePassage(currentStory.id, oldName, { content });
        }

        renderer.setSelectedPassage(null);
        $('passageModal').classList.remove('active');
        renderer.render();
    } catch (err) {
        console.error(err);
    }
}

$('previewPassageBtn').addEventListener('click', () => {
    const selectedPassage = renderer.getSelectedPassage();
    if (!selectedPassage) return;

    // Save current content before preview
    const content = $('passageContentInput').value;
    if (currentStory.passages[selectedPassage]) {
        currentStory.passages[selectedPassage].content = content;
    }

    $('passageModal').classList.remove('active');
    $('playModal').classList.add('active');
    player.play(selectedPassage);
});

$('setStartPassageBtn').addEventListener('click', async () => {
    const selectedPassage = renderer.getSelectedPassage();
    if (!selectedPassage) return;

    try {
        await StoryDB.update(currentStory.id, { startPassage: selectedPassage });
        currentStory.startPassage = selectedPassage;
        showToast('Start passage set');
        renderer.render();
    } catch (err) {
        console.error(err);
    }
});

$('deletePassageBtn').addEventListener('click', async () => {
    const selectedPassage = renderer.getSelectedPassage();
    if (!selectedPassage) return;

    if (Object.keys(currentStory.passages).length <= 1) {
        showToast('Cannot delete the only passage');
        return;
    }

    if (!confirm(`Delete "${selectedPassage}"?`)) return;

    try {
        await StoryDB.deletePassage(currentStory.id, selectedPassage);
        delete currentStory.passages[selectedPassage];
        renderer.setSelectedPassage(null);
        $('passageModal').classList.remove('active');
        renderer.render();
        showToast('Deleted');
    } catch (err) {
        console.error(err);
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
