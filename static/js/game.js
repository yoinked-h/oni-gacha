const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
let TILE_SIZE = 40;

let gameState = {};
let currentUserId = null;

// UI Elements
const backToMissionsBtn = document.getElementById('back-to-missions-btn');
const endTurnBtn = document.getElementById('end-turn-btn');
const actionButtons = document.getElementById('action-buttons');
const basicAttackBtn = document.getElementById('basic-attack-btn');
const skillAttackBtn = document.getElementById('skill-attack-btn');

let selectedCharacter = null;
let hoveredEnemy = null;
let isAttackMode = null; // Can be 'basic' or 'skill'
let walkableRange = [];
let attackableRange = [];

// --- Canvas & UI Resizing ---
function resizeCanvas() {
    const containerWidth = canvasContainer.clientWidth;
    const containerHeight = canvasContainer.clientHeight;

    if (gameState.grid_size) {
        TILE_SIZE = Math.min(
            Math.floor(containerWidth / gameState.grid_size.width),
            Math.floor(containerHeight / gameState.grid_size.height)
        );
    }

    canvas.width = gameState.grid_size ? gameState.grid_size.width * TILE_SIZE : containerWidth;
    canvas.height = gameState.grid_size ? gameState.grid_size.height * TILE_SIZE : containerHeight;

    draw();
}

window.addEventListener('resize', resizeCanvas);

// --- Game Logic ---
backToMissionsBtn.addEventListener('click', () => {
    window.location.href = '/mission_select_page';
});

async function fetchGameState() {
    if (!currentUserId) {
        window.location.href = '/login_page';
        return;
    }
    try {
        const response = await fetch('/game_state');
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login_page';
            }
            throw new Error('Failed to fetch game state');
        }
        gameState = await response.json();
        setActiveCharacter();
        resizeCanvas();
    } catch (error) {
        console.error("Fetch error:", error);
        alert("Could not load game state. Redirecting to mission select.");
        window.location.href = '/mission_select_page';
    }
}

// --- Drawing ---
function drawGrid() {
    if (!gameState.grid_size) return;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let x = 0; x < gameState.grid_size.width; x++) {
        for (let y = 0; y < gameState.grid_size.height; y++) {
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
}

function drawHighlights() {
    const range = isAttackMode ? attackableRange : walkableRange;
    const color = isAttackMode ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 0, 0.3)';

    ctx.fillStyle = color;
    range.forEach(tile => {
        ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });

    if (hoveredEnemy) {
        ctx.fillStyle = 'rgba(255, 100, 0, 0.2)';
        const range = calculateRange(hoveredEnemy, hoveredEnemy.attack_range);
        range.forEach(tile => {
            ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        });
    }
}

function drawCharacters() {
    if (!gameState.characters) return;
    gameState.characters.forEach(char => {
        ctx.fillStyle = char.id === gameState.active_character_id ? '#00bfff' : 'blue';
        ctx.fillRect(char.x * TILE_SIZE, char.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        if (selectedCharacter && selectedCharacter.id === char.id) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 3;
            ctx.strokeRect(char.x * TILE_SIZE + 1.5, char.y * TILE_SIZE + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
            ctx.lineWidth = 1;
        }
    });
}

function drawEnemies() {
    if (!gameState.enemies) return;
    gameState.enemies.forEach(enemy => {
        ctx.fillStyle = 'red';
        ctx.fillRect(enemy.x * TILE_SIZE, enemy.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
}

function drawUI() {
    const charStatsDiv = document.getElementById('char-stats');
    charStatsDiv.innerHTML = '';
    if (!gameState.characters) return;

    gameState.characters.forEach(char => {
        const charDiv = document.createElement('div');
        charDiv.className = 'char-card';
        if (char.id === gameState.active_character_id) {
            charDiv.classList.add('active-char');
        }

        let stars = Array.from({ length: char.max_sp }, (_, i) =>
            `<span class="star ${i < char.sp ? 'filled' : ''}">★</span>`
        ).join('');

        charDiv.innerHTML = `
            <h3>Character ${char.id}</h3>
            <p>HP: ${char.hp} / ${char.max_hp}</p>
            <div class="skill-points">${stars}</div>
        `;
        charDiv.addEventListener('click', () => {
            const clickedChar = gameState.characters.find(c => c.id === char.id);
            if (clickedChar && clickedChar.id === gameState.active_character_id) {
                selectCharacter(clickedChar);
            }
        });
        charStatsDiv.appendChild(charDiv);
    });

    if (selectedCharacter) {
        actionButtons.classList.remove('hidden');
        skillAttackBtn.disabled = selectedCharacter.sp <= 0;
    } else {
        actionButtons.classList.add('hidden');
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawHighlights();
    drawCharacters();
    drawEnemies();
    drawUI();
}

// --- Actions & Event Handlers ---
endTurnBtn.addEventListener('click', async () => {
    const response = await fetch('/end_turn', { method: 'POST' });
    if (response.ok) {
        gameState = await response.json();
        resetSelection();
        setActiveCharacter();
        draw();
    } else {
        alert("Failed to end turn.");
    }
});

basicAttackBtn.addEventListener('click', () => {
    if (!selectedCharacter) return;
    isAttackMode = 'basic';
    attackableRange = calculateRange(selectedCharacter, selectedCharacter.attack_range);
    walkableRange = []; // Clear move range
    draw();
});

skillAttackBtn.addEventListener('click', () => {
    if (!selectedCharacter || selectedCharacter.sp <= 0) return;
    isAttackMode = 'skill';
    attackableRange = calculateRange(selectedCharacter, selectedCharacter.attack_range);
    walkableRange = [];
    draw();
});


canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const enemy = gameState.enemies.find(e => e.x === x && e.y === y);
    if (enemy !== hoveredEnemy) {
        hoveredEnemy = enemy;
        draw();
    }
});

canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const clickedEnemy = gameState.enemies.find(e => e.x === x && e.y === y);
    const clickedChar = gameState.characters.find(c => c.x === x && c.y === y);

    if (selectedCharacter) {
        if (isAttackMode && clickedEnemy && attackableRange.some(t => t.x === x && t.y === y)) {
            await attack(isAttackMode, clickedEnemy.id);
        } else if (!isAttackMode && walkableRange.some(t => t.x === x && t.y === y)) {
            await move(selectedCharacter.id, x, y);
        } else {
            resetSelection();
        }
    } else if (clickedChar && clickedChar.id === gameState.active_character_id) {
        selectCharacter(clickedChar);
    }
});

function selectCharacter(char) {
    selectedCharacter = char;
    isAttackMode = null;
    walkableRange = calculateRange(char, char.move_range);
    attackableRange = [];
    draw();
}

function resetSelection() {
    selectedCharacter = null;
    isAttackMode = null;
    walkableRange = [];
    attackableRange = [];
    draw();
}

function setActiveCharacter() {
    const activeChar = gameState.characters.find(c => c.id === gameState.active_character_id);
    if (activeChar && !activeChar.has_acted) {
        // Automatically select the active character
        // selectCharacter(activeChar);
    }
}

function calculateRange(unit, range) {
    const results = [];
    if (!unit || !gameState.grid_size) return results;

    for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
            if (Math.abs(dx) + Math.abs(dy) <= range) {
                const tileX = unit.x + dx;
                const tileY = unit.y + dy;
                if (tileX >= 0 && tileX < gameState.grid_size.width && tileY >= 0 && tileY < gameState.grid_size.height) {
                    results.push({ x: tileX, y: tileY });
                }
            }
        }
    }
    return results;
}

async function handleActionResponse(response) {
    if (response.ok) {
        gameState = await response.json();
        resetSelection();
        setActiveCharacter();
        draw();
    } else {
        const error = await response.json();
        alert(error.error);
        resetSelection();
    }
}

async function move(characterId, x, y) {
    const response = await fetch('/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: characterId, x, y })
    });
    handleActionResponse(response);
}

async function attack(attackType, targetId) {
    const response = await fetch('/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            attacker_id: selectedCharacter.id,
            target_id: targetId,
            attack_type: attackType
        })
    });
    handleActionResponse(response);
}

// --- Initial Load ---
window.onload = () => {
    currentUserId = localStorage.getItem('user_id');
    if (currentUserId) {
        fetchGameState();
    } else {
        window.location.href = '/login_page';
    }
};

