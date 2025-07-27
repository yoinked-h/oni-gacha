const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const unitTooltip = document.getElementById('unit-tooltip');
const actionWheel = document.getElementById('action-wheel');
let TILE_SIZE = 40;

// Animation system for particles and trails
let particles = [];
let trails = [];

class Particle {
    constructor(x, y, dx, dy, life, color) {
        this.x = x; this.y = y; this.dx = dx; this.dy = dy; this.life = life; this.color = color;
    }
    update(dt) {
        this.x += this.dx * dt;
        this.y += this.dy * dt;
        this.life -= dt;
        return this.life > 0;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(this.life, 0);
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Trail {
    constructor(x1, y1, x2, y2, life, color, width = 3) {
        this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
        this.life = life; this.color = color; this.width = width;
    }
    update(dt) {
        this.life -= dt;
        return this.life > 0;
    }
    draw() {
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = Math.max(this.life, 0);
        ctx.lineWidth = this.width;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }
}

function spawnTrail(x1, y1, x2, y2, color, life = 0.5, width = 3) {
    trails.push(new Trail(x1, y1, x2, y2, life, color, width));
}

function spawnParticles(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 50;
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed;
        particles.push(new Particle(x, y, dx, dy, 1, color));
    }
}

function updateAnimations(dt) {
    particles = particles.filter(p => p.update(dt));
    trails = trails.filter(t => t.update(dt));
}

function drawAnimations() {
    trails.forEach(t => t.draw());
    particles.forEach(p => p.draw());
}

let lastTimestamp = 0;
function animationLoop(timestamp) {
    const dt = (timestamp - lastTimestamp) / 1000 || 0;
    lastTimestamp = timestamp;
    draw();
    updateAnimations(dt);
    drawAnimations();
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

let gameState = {};
let currentUserId = null;

// UI Elements
const backToMissionsBtn = document.getElementById('back-to-missions-btn');
const endTurnBtn = document.getElementById('end-turn-btn');
const dontMoveBtn = document.getElementById('dont-move-btn');
const basicAttackBtn = document.getElementById('basic-attack-btn');
const skillAttackBtn = document.getElementById('skill-attack-btn');

let selectedCharacter = null;
let hoveredUnit = null; // Can be character or enemy
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
        
        // Check for mission completion
        if (gameState.mission_complete && gameState.rewards) {
            showMissionCompleteDialog(gameState.rewards);
        }
        
        resizeCanvas();
    } catch (error) {
        console.error("Fetch error:", error);
        alert("Could not load game state. Redirecting to mission select.");
        window.location.href = '/mission_select_page';
    }
}

function showMissionCompleteDialog(rewards) {
    let materialsText = '';
    for (const [materialType, amount] of Object.entries(rewards.materials)) {
        const materialName = materialType.replace(/_/g, ' ').toUpperCase();
        materialsText += `${materialName}: +${amount}\n`;
    }
    
    const message = `🎉 MISSION COMPLETE! 🎉\n\nRewards:\nXP: +${rewards.xp}\n\nMaterials:\n${materialsText}`;
    alert(message);
    
    // Clear mission complete flag and redirect to mission select
    gameState.mission_complete = false;
    gameState.rewards = null;
    
    // Redirect back to mission select after showing rewards
    window.location.href = '/mission_select_page';
}

// --- Drawing Functions ---
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

    if (hoveredUnit && hoveredUnit.attack_range !== undefined) {
        ctx.fillStyle = 'rgba(255, 100, 0, 0.2)';
        const range = calculateRange(hoveredUnit, hoveredUnit.attack_range);
        range.forEach(tile => {
            ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        });
    }
}

function drawCharacters() {
    if (!gameState.characters) return;
    gameState.characters.forEach(char => {
        const x = char.x * TILE_SIZE;
        const y = char.y * TILE_SIZE;
        
        // Draw character base
        ctx.fillStyle = char.id === gameState.active_character_id ? '#00bfff' : '#4169E1';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Draw selection highlight
        if (selectedCharacter && selectedCharacter.id === char.id) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
            ctx.lineWidth = 1;
        }

        // Draw health bar above character
        drawHealthBar(x, y - 8, TILE_SIZE, char.hp, char.max_hp, '#00ff00', '#ff0000');
        
        // Draw character ID
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(char.id.toString(), x + TILE_SIZE/2, y + TILE_SIZE/2 + 4);
    });
}

function drawEnemies() {
    if (!gameState.enemies) return;
    gameState.enemies.forEach(enemy => {
        const x = enemy.x * TILE_SIZE;
        const y = enemy.y * TILE_SIZE;
        
        // Draw enemy base
        ctx.fillStyle = '#DC143C';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Draw health bar above enemy
        drawHealthBar(x, y - 8, TILE_SIZE, enemy.hp, enemy.max_hp, '#00ff00', '#ff0000');
        
        // Draw enemy ID
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('E' + enemy.id.toString(), x + TILE_SIZE/2, y + TILE_SIZE/2 + 4);
    });
}

function drawHealthBar(x, y, width, currentHP, maxHP, healthColor, damageColor) {
    const barHeight = 4;
    const healthPercentage = Math.max(0, currentHP / maxHP);
    
    // Background (damage)
    ctx.fillStyle = damageColor;
    ctx.fillRect(x, y, width, barHeight);
    
    // Current health
    ctx.fillStyle = healthColor;
    ctx.fillRect(x, y, width * healthPercentage, barHeight);
    
    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, barHeight);
}

function drawSPIndicators(x, y, width, currentSP, maxSP) {
    const starSize = 8;
    const spacing = starSize + 2;
    const totalWidth = maxSP * spacing - 2;
    const startX = x + (width - totalWidth) / 2;
    
    ctx.font = `${starSize}px Arial`;
    ctx.textAlign = 'center';
    
    for (let i = 0; i < maxSP; i++) {
        const starX = startX + i * spacing + starSize/2;
        ctx.fillStyle = i < currentSP ? '#FFD700' : '#555';
        ctx.fillText('★', starX, y + starSize);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawHighlights();
    drawCharacters();
    drawEnemies();
    updateTeamSPDisplay();
}

function updateTeamSPDisplay() {
    const teamSPNumberElement = document.getElementById('team-sp-number');
    const teamSPIconsElement = document.getElementById('team-sp-icons');
    
    if (teamSPNumberElement && teamSPIconsElement) {
        const teamSP = gameState.team_sp || 0;
        const maxTeamSP = gameState.max_team_sp || 5;
        
        // Update the number
        teamSPNumberElement.textContent = teamSP;
        
        // Clear existing icons
        teamSPIconsElement.innerHTML = '';
        
        // Add filled skill icons for current SP
        for (let i = 0; i < teamSP; i++) {
            const skillIcon = document.createElement('img');
            skillIcon.src = '/static/imgs/icons/skill.png';
            skillIcon.alt = 'Skill Point';
            skillIcon.className = 'sp-icon';
            teamSPIconsElement.appendChild(skillIcon);
        }
        
        // Add empty skill icons for remaining slots
        for (let i = teamSP; i < maxTeamSP; i++) {
            const emptyIcon = document.createElement('img');
            emptyIcon.src = '/static/imgs/icons/skillempty.png';
            emptyIcon.alt = 'Empty Skill Point';
            emptyIcon.className = 'sp-icon';
            teamSPIconsElement.appendChild(emptyIcon);
        }
    }
}

// --- Event Handlers ---
endTurnBtn.addEventListener('click', async () => {
    
    hideActionWheel();
    const prevChars = gameState.characters ? gameState.characters.map(c => ({ id: c.id, x: c.x, y: c.y, hp: c.hp })) : [];
    const response = await fetch('/end_turn', { method: 'POST' });
    if (response.ok) {
        gameState = await response.json();
        // Detect damage and spawn particles
        if (prevChars.length) {
            gameState.characters.forEach(newChar => {
                const oldChar = prevChars.find(c => c.id === newChar.id);
                if (oldChar && newChar.hp < oldChar.hp) {
                    const px = newChar.x * TILE_SIZE + TILE_SIZE/2;
                    const py = newChar.y * TILE_SIZE + TILE_SIZE/2;
                    spawnParticles(px, py, 'red', 15);
                }
            });
        }
        processEnemyActions();
        resetSelection();
        draw();
    } else {
        alert("Failed to end turn.");
    }
});

// Action wheel handlers
dontMoveBtn.addEventListener('click', () => {
    if (selectedCharacter) {
        handleEndTurnForCharacter();
    }
});

basicAttackBtn.addEventListener('click', () => {
    if (!selectedCharacter) return;
    isAttackMode = 'basic';
    attackableRange = calculateRange(selectedCharacter, selectedCharacter.attack_range);
    walkableRange = [];
    
    hideActionWheel();
    draw();
});

skillAttackBtn.addEventListener('click', () => {
    if (!selectedCharacter) return;
    const teamSP = gameState.team_sp || 0;
    if (teamSP <= 0) return;
    
    isAttackMode = 'skill';
    attackableRange = calculateRange(selectedCharacter, selectedCharacter.attack_range);
    walkableRange = [];
    
    hideActionWheel();
    draw();
});

async function handleEndTurnForCharacter() {
    if (!selectedCharacter) return;
    
    // Mark character as having acted and advance turn
    const response = await fetch('/end_turn', { method: 'POST' });
    if (response.ok) {
        gameState = await response.json();
        processEnemyActions();
        resetSelection();
        draw();
    } else {
        alert("Failed to end character turn.");
    }
}

// Mouse events
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const enemy = gameState.enemies?.find(e => e.x === x && e.y === y);
    const character = gameState.characters?.find(c => c.x === x && c.y === y);
    const unit = enemy || character;
    
    // Always update hover state and handle action wheel visibility
    if (unit !== hoveredUnit) {
        hoveredUnit = unit;
        updateTooltip(e, unit);
        draw();
    } else if (unit) {
        // Still hovering over the same unit, update tooltip position
        updateTooltip(e, unit);
    }
    
    // Always check action wheel visibility on mouse move
    handleActionWheelVisibility(e);
});

canvas.addEventListener('mouseleave', () => {
    hoveredUnit = null;
    hideTooltip();
    
    draw();
});

canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const clickedEnemy = gameState.enemies?.find(e => e.x === x && e.y === y);
    const clickedChar = gameState.characters?.find(c => c.x === x && c.y === y);

    if (selectedCharacter) {
        if (isAttackMode && clickedEnemy && attackableRange.some(t => t.x === x && t.y === y)) {
            await attack(isAttackMode, clickedEnemy.id);
        } else if (!isAttackMode && walkableRange.some(t => t.x === x && t.y === y)) {
            await move(selectedCharacter.id, x, y);
        } else {
            resetSelection();
        }
    } else if (clickedChar && clickedChar.id === gameState.active_character_id && !clickedChar.has_acted) {
        // Set hoveredUnit to the clicked character to ensure proper state
        hoveredUnit = clickedChar;
        selectCharacter(clickedChar, e);
        // After selecting, check if we're hovering over the selected character to show wheel
        handleActionWheelVisibility(e);
    } else {
        resetSelection();
    }
});

// --- UI Functions ---
function updateTooltip(mouseEvent, unit) {
    if (!unit) {
        hideTooltip();
        return;
    }
    
    let tooltipText = '';
    if (unit.hp !== undefined && unit.damage !== undefined && unit.sp === undefined) {
        // It's an enemy (has hp and damage but no sp)
        tooltipText = `Enemy ${unit.id} (HP: ${unit.hp}/${unit.max_hp}, ATK: ${unit.damage})`;
    } else {
        // It's a character
        tooltipText = `Character ${unit.id} (HP: ${unit.hp}/${unit.max_hp})`;
    }
    
    unitTooltip.textContent = tooltipText;
    unitTooltip.style.left = (mouseEvent.clientX + 10) + 'px';
    unitTooltip.style.top = (mouseEvent.clientY - 30) + 'px';
    unitTooltip.classList.remove('hidden');
}

function hideTooltip() {
    unitTooltip.classList.add('hidden');
}

function handleActionWheelVisibility(mouseEvent) {
    // Only show wheel if we have a selected character AND we're hovering over that same character
    if (selectedCharacter && hoveredUnit && 
        hoveredUnit.id === selectedCharacter.id && 
        hoveredUnit.x === selectedCharacter.x && 
        hoveredUnit.y === selectedCharacter.y) {
        // Show action wheel if hovering over the selected character
        showActionWheel(selectedCharacter, mouseEvent);
    } else {
        // Hide action wheel if not hovering over selected character or no character is selected
        hideActionWheel();
    }
}

function showActionWheel(character, mouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const wheelX = rect.left + character.x * TILE_SIZE + TILE_SIZE/2;
    const wheelY = rect.top + character.y * TILE_SIZE + TILE_SIZE/2;
    
    actionWheel.style.left = wheelX + 'px';
    actionWheel.style.top = wheelY + 'px';
    
    // Update skill button state based on team SP
    const teamSP = gameState.team_sp || 0;
    skillAttackBtn.style.opacity = teamSP > 0 ? '1' : '0.5';
    skillAttackBtn.style.pointerEvents = teamSP > 0 ? 'auto' : 'none';
    actionWheel.classList.remove('hidden');
}

function hideActionWheel() {
    
    actionWheel.classList.add('hidden');
}

function selectCharacter(char, mouseEvent) {
    selectedCharacter = char;
    isAttackMode = null;
    walkableRange = calculateRange(char, char.move_range);
    attackableRange = [];
    
    // Don't automatically show action wheel - it will show on hover
    draw();
}

function resetSelection() {
    selectedCharacter = null;
    isAttackMode = null;
    walkableRange = [];
    attackableRange = [];
    // hideActionWheel();
    draw();
}

function calculateRange(unit, range) {
    const results = [];
    if (!unit || !gameState.grid_size) return results;

    for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
            if (Math.abs(dx) + Math.abs(dy) <= range && (dx !== 0 || dy !== 0)) {
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

async function move(characterId, x, y) {
    const char = gameState.characters.find(c => c.id === characterId);
    if (char) {
        const startX = char.x * TILE_SIZE + TILE_SIZE / 2;
        const startY = char.y * TILE_SIZE + TILE_SIZE / 2;
        const endX = x * TILE_SIZE + TILE_SIZE / 2;
        const endY = y * TILE_SIZE + TILE_SIZE / 2;
        spawnParticles(startX, startY, 'green', 10);
        spawnParticles(endX, endY, 'green', 10);
        spawnTrail(startX, startY, endX, endY, 'green', 0.5, 3);
    }
    
    const response = await fetch('/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: characterId, x, y })
    });
    
    if (response.ok) {
        gameState = await response.json();
        processEnemyActions();
        resetSelection();
    } else {
        const error = await response.json();
        alert(error.error);
        resetSelection();
    }
}

async function attack(attackType, targetId) {
    const enemy = gameState.enemies.find(e => e.id === targetId);
    if (enemy) {
        const spawnX = enemy.x * TILE_SIZE + TILE_SIZE/2;
        const spawnY = enemy.y * TILE_SIZE + TILE_SIZE/2;
        spawnParticles(spawnX, spawnY, 'orange', 15);
    }
    
    const response = await fetch('/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attacker_id: selectedCharacter.id, target_id: targetId, attack_type: attackType })
    });
    
    if (response.ok) {
        gameState = await response.json();
        
        if (gameState.mission_complete && gameState.rewards) {
            showMissionCompleteDialog(gameState.rewards);
        }
        
        processEnemyActions();
        resetSelection();
    } else {
        const error = await response.json();
        alert(error.error);
        resetSelection();
    }
}

function processEnemyActions() {
    if (!gameState.enemy_actions) return;
    gameState.enemy_actions.forEach(action => {
        if (action.type === 'move') {
            let start = action.from;
            let sx = start.x * TILE_SIZE + TILE_SIZE / 2;
            let sy = start.y * TILE_SIZE + TILE_SIZE / 2;
            action.path.forEach(step => {
                let ex = step.x * TILE_SIZE + TILE_SIZE / 2;
                let ey = step.y * TILE_SIZE + TILE_SIZE / 2;
                spawnTrail(sx, sy, ex, ey, 'yellow', 0.6, 4);
                spawnParticles(ex, ey, 'orange', 8);
                sx = ex; sy = ey;
            });
        } else if (action.type === 'attack') {
            let pos = action.target_pos;
            let cx = pos.x * TILE_SIZE + TILE_SIZE / 2;
            let cy = pos.y * TILE_SIZE + TILE_SIZE / 2;
            spawnParticles(cx, cy, 'red', 20);
        }
    });
    delete gameState.enemy_actions;
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

