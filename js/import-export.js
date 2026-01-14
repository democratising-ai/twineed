// =====================================================
// IMPORT / EXPORT - TWINE 2 ARCHIVE FORMAT HANDLING
// =====================================================

import { esc, download } from './utils.js';

// =====================================================
// GENERATE UUID v4 FOR IFID
// =====================================================
function generateIFID() {
    // Generate a v4 UUID with uppercase letters (Twine 2 standard)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16).toUpperCase();
    });
}

// =====================================================
// ESCAPE HTML ENTITIES FOR TWINE FORMAT
// =====================================================
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// =====================================================
// UNESCAPE HTML ENTITIES FROM TWINE FORMAT
// =====================================================
function unescapeHtml(str) {
    if (!str) return '';
    const doc = new DOMParser().parseFromString(str, 'text/html');
    return doc.documentElement.textContent;
}

// =====================================================
// TWINE 2 ARCHIVE IMPORT PARSER
// =====================================================
export function parseTwine(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find tw-storydata - could be multiple in an archive
    const storyDataElements = doc.querySelectorAll('tw-storydata');
    if (!storyDataElements.length) return null;

    // Use the first story (or the only one)
    const storyData = storyDataElements[0];

    // Extract story metadata
    const title = storyData.getAttribute('name') || 'Imported Story';
    const startNode = storyData.getAttribute('startnode');
    const ifid = storyData.getAttribute('ifid') || generateIFID();
    const format = storyData.getAttribute('format') || '';
    const formatVersion = storyData.getAttribute('format-version') || '';
    const zoom = parseFloat(storyData.getAttribute('zoom')) || 1;
    const tags = storyData.getAttribute('tags') || '';

    // Extract Story Stylesheet - try multiple selectors
    let styleEl = storyData.querySelector('style[type="text/twine-css"]');
    if (!styleEl) styleEl = storyData.querySelector('#twine-user-stylesheet');
    if (!styleEl) styleEl = storyData.querySelector('style[role="stylesheet"]');
    const stylesheet = styleEl ? styleEl.textContent : '';

    // Extract Story JavaScript - try multiple selectors
    let scriptEl = storyData.querySelector('script[type="text/twine-javascript"]');
    if (!scriptEl) scriptEl = storyData.querySelector('#twine-user-script');
    if (!scriptEl) scriptEl = storyData.querySelector('script[role="script"]');
    const javascript = scriptEl ? scriptEl.textContent : '';

    // Extract tag colors
    const tagColors = {};
    storyData.querySelectorAll('tw-tag').forEach(tag => {
        const name = tag.getAttribute('name');
        const color = tag.getAttribute('color');
        if (name && color) {
            tagColors[name] = color;
        }
    });

    // Extract passages - search within storyData specifically
    const passages = {};
    let startPassage = 'Start';
    let pidToName = {};

    // Get passages from within this specific storyData element
    storyData.querySelectorAll('tw-passagedata').forEach(p => {
        const name = p.getAttribute('name');
        const pid = p.getAttribute('pid');
        const tagsAttr = p.getAttribute('tags') || '';
        const positionAttr = p.getAttribute('position') || '100,100';
        const sizeAttr = p.getAttribute('size') || '100,100';

        const position = positionAttr.split(',');
        const size = sizeAttr.split(',');

        // Get passage content - innerHTML gives us the raw content
        // textContent is already decoded by the parser
        const content = p.textContent;

        pidToName[pid] = name;

        passages[name] = {
            name,
            content,
            tags: tagsAttr ? tagsAttr.split(' ').filter(t => t.trim()) : [],
            x: parseInt(position[0]) || 100,
            y: parseInt(position[1]) || 100,
            width: parseInt(size[0]) || 100,
            height: parseInt(size[1]) || 100
        };

        if (pid === startNode) {
            startPassage = name;
        }
    });

    // If no passages found, return null
    if (Object.keys(passages).length === 0) {
        return null;
    }

    return {
        title,
        startPassage,
        passages,
        ifid,
        format,
        formatVersion,
        zoom,
        tags,
        stylesheet,
        javascript,
        tagColors
    };
}

// =====================================================
// TWINE 2 ARCHIVE EXPORT (for Twine editor import)
// =====================================================
export function exportAsTwineArchive(story) {
    const html = generateTwineArchive(story);
    download(story.title + '.html', html, 'text/html');
}

function generateTwineArchive(story) {
    const passages = story.passages || {};
    const passageNames = Object.keys(passages);

    // Generate IFID if not present
    const ifid = story.ifid || generateIFID();

    // Determine start node PID
    let startNodePid = '1';
    let pid = 1;
    const pidMap = {};

    passageNames.forEach(name => {
        pidMap[name] = pid.toString();
        if (name === story.startPassage) {
            startNodePid = pid.toString();
        }
        pid++;
    });

    // Generate passage elements
    const passageElements = passageNames.map(name => {
        const p = passages[name];
        const tags = Array.isArray(p.tags) ? p.tags.join(' ') : (p.tags || '');
        const x = Math.round(p.x || 100);
        const y = Math.round(p.y || 100);
        const width = p.width || 100;
        const height = p.height || 100;

        return `<tw-passagedata pid="${pidMap[name]}" name="${escapeHtml(name)}" tags="${escapeHtml(tags)}" position="${x},${y}" size="${width},${height}">${escapeHtml(p.content || '')}</tw-passagedata>`;
    }).join('');

    // Generate tag color elements
    const tagColors = story.tagColors || {};
    const tagElements = Object.entries(tagColors).map(([name, color]) =>
        `<tw-tag name="${escapeHtml(name)}" color="${escapeHtml(color)}"></tw-tag>`
    ).join('');

    // Story metadata
    const format = story.format || 'Harlowe';
    const formatVersion = story.formatVersion || '3.3.9';
    const zoom = story.zoom || 1;
    const storyTags = story.tags || '';
    const stylesheet = story.stylesheet || '';
    const javascript = story.javascript || '';

    return `<tw-storydata name="${escapeHtml(story.title)}" startnode="${startNodePid}" creator="Twine Workshop" creator-version="1.0.0" format="${escapeHtml(format)}" format-version="${escapeHtml(formatVersion)}" ifid="${ifid}" options="" tags="${escapeHtml(storyTags)}" zoom="${zoom}" hidden><style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css">${stylesheet}</style><script role="script" id="twine-user-script" type="text/twine-javascript">${javascript}</script>${tagElements}${passageElements}</tw-storydata>`;
}

// =====================================================
// PLAYABLE HTML EXPORT
// =====================================================
export function exportAsHtml(story) {
    const html = generatePlayableHtml(story);
    download(story.title + '.html', html);
}

function generatePlayableHtml(story) {
    const passages = story.passages || {};
    const passagesJson = JSON.stringify(passages).replace(/<\/script>/gi, '<\\/script>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(story.title)}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: Georgia, 'Times New Roman', serif;
    background: linear-gradient(135deg, #1e1e3f 0%, #151529 100%);
    color: #e8e8f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
}
#story {
    max-width: 650px;
    background: rgba(45, 45, 90, 0.5);
    backdrop-filter: blur(10px);
    padding: 3rem;
    border-radius: 16px;
    border: 1px solid rgba(139, 92, 246, 0.3);
    line-height: 1.9;
    font-size: 1.15rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
#story p { margin-bottom: 1.25rem; }
.link {
    color: #a78bfa;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color 0.15s;
}
.link:hover { color: #c4b5fd; }
h1 {
    font-size: 1.75rem;
    margin-bottom: 2rem;
    color: #a78bfa;
    font-weight: normal;
}
</style>
</head>
<body>
<div id="story"></div>
<script>
const passages = ${passagesJson};
const startPassage = "${story.startPassage || 'Start'}";

function showPassage(name) {
    const p = passages[name];
    if (!p) {
        document.getElementById('story').innerHTML = '<p>Passage not found: ' + name + '</p>';
        return;
    }

    let content = p.content || '';

    // Handle [[Display Text->Target]] syntax
    content = content.replace(/\\[\\[([^\\]]+)->([^\\]]+)\\]\\]/g, (match, display, target) => {
        return '<span class="link" onclick="showPassage(\\'' + target.trim().replace(/'/g, "\\\\'") + '\\')">' + display.trim() + '</span>';
    });

    // Handle [[Display Text|Target]] syntax
    content = content.replace(/\\[\\[([^\\]|]+)\\|([^\\]]+)\\]\\]/g, (match, display, target) => {
        return '<span class="link" onclick="showPassage(\\'' + target.trim().replace(/'/g, "\\\\'") + '\\')">' + display.trim() + '</span>';
    });

    // Handle [[Target]] syntax (simple links)
    content = content.replace(/\\[\\[([^\\]|>]+)\\]\\]/g, (match, target) => {
        return '<span class="link" onclick="showPassage(\\'' + target.trim().replace(/'/g, "\\\\'") + '\\')">' + target.trim() + '</span>';
    });

    content = content.split('\\n\\n').map(p => '<p>' + p.replace(/\\n/g, '<br>') + '</p>').join('');
    document.getElementById('story').innerHTML = '<h1>${esc(story.title)}</h1>' + content;
}

showPassage(startPassage);
</script>
</body>
</html>`;
}

// =====================================================
// JSON EXPORT (for backup)
// =====================================================
export function exportAsJson(story) {
    const json = JSON.stringify(story, null, 2);
    download(story.title + '.json', json, 'application/json');
}

// =====================================================
// JSON IMPORT
// =====================================================
export function parseJson(content) {
    try {
        const data = JSON.parse(content);
        if (!data.title || !data.passages) return null;
        return {
            title: data.title,
            startPassage: data.startPassage || 'Start',
            passages: data.passages,
            ifid: data.ifid || generateIFID(),
            format: data.format || '',
            formatVersion: data.formatVersion || '',
            zoom: data.zoom || 1,
            tags: data.tags || '',
            stylesheet: data.stylesheet || '',
            javascript: data.javascript || '',
            tagColors: data.tagColors || {}
        };
    } catch {
        return null;
    }
}

// =====================================================
// TWEE 3 EXPORT
// =====================================================
export function exportAsTwee(story) {
    const twee = generateTwee(story);
    download(story.title + '.twee', twee, 'text/plain');
}

function generateTwee(story) {
    const passages = story.passages || {};
    const ifid = story.ifid || generateIFID();

    let output = '';

    // StoryTitle passage
    output += `:: StoryTitle\n${story.title}\n\n`;

    // StoryData passage with JSON metadata
    const storyData = {
        ifid: ifid,
        format: story.format || 'Harlowe',
        'format-version': story.formatVersion || '3.3.9',
        start: story.startPassage || 'Start',
        zoom: story.zoom || 1
    };

    if (story.tagColors && Object.keys(story.tagColors).length > 0) {
        storyData['tag-colors'] = story.tagColors;
    }

    output += `:: StoryData\n${JSON.stringify(storyData, null, 2)}\n\n`;

    // Story Stylesheet (if present)
    if (story.stylesheet) {
        output += `:: UserStylesheet [stylesheet]\n${story.stylesheet}\n\n`;
    }

    // Story JavaScript (if present)
    if (story.javascript) {
        output += `:: UserScript [script]\n${story.javascript}\n\n`;
    }

    // Regular passages
    Object.values(passages).forEach(p => {
        const tags = Array.isArray(p.tags) && p.tags.length > 0 ? ` [${p.tags.join(' ')}]` : '';
        const position = `{"position":"${Math.round(p.x || 100)},${Math.round(p.y || 100)}","size":"${p.width || 100},${p.height || 100}"}`;

        output += `:: ${p.name}${tags} ${position}\n${p.content || ''}\n\n`;
    });

    return output.trim();
}

// =====================================================
// TWEE 3 IMPORT
// =====================================================
export function parseTwee(content) {
    const lines = content.split('\n');
    const passages = {};
    let currentPassage = null;
    let title = 'Imported Story';
    let startPassage = 'Start';
    let ifid = generateIFID();
    let format = '';
    let formatVersion = '';
    let zoom = 1;
    let tagColors = {};
    let stylesheet = '';
    let javascript = '';

    let passageIndex = 0;

    // Helper function to save the current passage
    function saveCurrentPassage() {
        if (currentPassage && currentPassage.type === 'passage') {
            passages[currentPassage.name] = {
                name: currentPassage.name,
                content: currentPassage.content.trim(),
                tags: currentPassage.tags,
                x: currentPassage.x,
                y: currentPassage.y,
                width: currentPassage.width,
                height: currentPassage.height
            };
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for passage header
        const headerMatch = line.match(/^::\s*(.+?)\s*(?:\[([^\]]*)\])?\s*(\{.*\})?\s*$/);

        if (headerMatch) {
            // Save the previous passage before starting a new one
            saveCurrentPassage();

            const passageName = headerMatch[1].trim();
            const tags = headerMatch[2] ? headerMatch[2].split(' ').filter(t => t) : [];
            const metadataStr = headerMatch[3];

            let x = 100 + (passageIndex % 5) * 200;
            let y = 100 + Math.floor(passageIndex / 5) * 150;
            let width = 100;
            let height = 100;

            // Parse position metadata
            if (metadataStr) {
                try {
                    const metadata = JSON.parse(metadataStr);
                    if (metadata.position) {
                        const [px, py] = metadata.position.split(',');
                        x = parseInt(px) || x;
                        y = parseInt(py) || y;
                    }
                    if (metadata.size) {
                        const [w, h] = metadata.size.split(',');
                        width = parseInt(w) || width;
                        height = parseInt(h) || height;
                    }
                } catch (e) {
                    // Ignore metadata parse errors
                }
            }

            // Handle special passages
            if (passageName === 'StoryTitle') {
                currentPassage = { type: 'title' };
            } else if (passageName === 'StoryData') {
                currentPassage = { type: 'storydata', jsonContent: '' };
            } else if (tags.includes('stylesheet')) {
                currentPassage = { type: 'stylesheet' };
            } else if (tags.includes('script')) {
                currentPassage = { type: 'script' };
            } else {
                // Regular passage
                currentPassage = {
                    type: 'passage',
                    name: passageName,
                    tags: tags,
                    x,
                    y,
                    width,
                    height,
                    content: ''
                };
                passageIndex++;
            }
        } else if (currentPassage) {
            // Add content to current passage
            if (currentPassage.type === 'title') {
                if (line.trim()) {
                    title = line.trim();
                }
            } else if (currentPassage.type === 'storydata') {
                // Accumulate JSON content
                currentPassage.jsonContent += line + '\n';

                // Try to parse when we have complete JSON
                try {
                    const data = JSON.parse(currentPassage.jsonContent);
                    ifid = data.ifid || ifid;
                    format = data.format || format;
                    formatVersion = data['format-version'] || formatVersion;
                    startPassage = data.start || startPassage;
                    zoom = data.zoom || zoom;
                    tagColors = data['tag-colors'] || tagColors;
                    currentPassage.parsed = true;
                } catch (e) {
                    // Not yet complete JSON, continue accumulating
                }
            } else if (currentPassage.type === 'stylesheet') {
                stylesheet += line + '\n';
            } else if (currentPassage.type === 'script') {
                javascript += line + '\n';
            } else if (currentPassage.type === 'passage') {
                currentPassage.content += (currentPassage.content ? '\n' : '') + line;
            }
        }
    }

    // Save the last passage
    saveCurrentPassage();

    // If no passages were found, return null
    if (Object.keys(passages).length === 0) {
        return null;
    }

    return {
        title,
        startPassage,
        passages,
        ifid,
        format,
        formatVersion,
        zoom,
        tags: '',
        stylesheet: stylesheet.trim(),
        javascript: javascript.trim(),
        tagColors
    };
}

// =====================================================
// AUTO-DETECT AND PARSE FILE
// =====================================================
export function parseFile(content, filename) {
    const ext = filename.toLowerCase().split('.').pop();

    if (ext === 'json') {
        return parseJson(content);
    } else if (ext === 'twee' || ext === 'tw') {
        return parseTwee(content);
    } else if (ext === 'html' || ext === 'htm') {
        // Try Twine HTML first
        const twineResult = parseTwine(content);
        if (twineResult) {
            return twineResult;
        }
        // Could add other HTML format detection here
        return null;
    }

    // Try auto-detection based on content
    if (content.trim().startsWith('{')) {
        return parseJson(content);
    } else if (content.includes('<tw-storydata')) {
        return parseTwine(content);
    } else if (content.includes('::')) {
        return parseTwee(content);
    }

    return null;
}
