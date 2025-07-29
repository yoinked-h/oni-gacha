const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const unitTooltip = document.getElementById('unit-tooltip');
const attackTooltip = document.getElementById('attack-tooltip');
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
let characterData = {}; // Store character templates with attack descriptions
let currentUserId = null;

// UI Elements
const backToMissionsBtn = document.getElementById('back-to-missions-btn');
const endTurnBtn = document.getElementById('end-turn-btn');
const dontMoveBtn = document.getElementById('dont-move-btn');
const basicAttackBtn = document.getElementById('basic-attack-btn');
const skillAttackBtn = document.getElementById('skill-attack-btn');
const ultimateAttackBtn = document.getElementById('ultimate-attack-btn');

let selectedCharacter = null;
let hoveredUnit = null; // Can be character or enemy
let isAttackMode = null; // Can be 'basic', 'skill', or 'ultimate'
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

async function fetchCharacterData() {
    try {
        const response = await fetch('/characters');
        if (response.ok) {
            const characters = await response.json();
            // Convert array to object with character id as key for easy lookup
            characterData = {};
            characters.forEach(char => {
                characterData[char.id] = char;
            });
        } else {
            console.error('Failed to fetch character data');
        }
    } catch (error) {
        console.error('Error fetching character data:', error);
    }
}

function showMissionCompleteDialog(rewards) {
    // Update XP display
    document.getElementById('xp-amount').textContent = `+${rewards.xp}`;
    
    // Update materials display
    const materialsList = document.getElementById('materials-list');
    materialsList.innerHTML = '';
    
    for (const [materialType, amount] of Object.entries(rewards.materials)) {
        const materialName = materialType.replace(/_/g, ' ').toUpperCase();
        const materialItem = document.createElement('div');
        materialItem.className = 'material-item';
        materialItem.innerHTML = `
            <span class="material-name">${materialName}</span>
            <span class="material-amount">+${amount}</span>
        `;
        materialsList.appendChild(materialItem);
    }
    
    // Show the popup
    document.getElementById('mission-complete-overlay').classList.remove('hidden');
    
    // Clear mission complete flag
    gameState.mission_complete = false;
    gameState.rewards = null;
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
    let color = isAttackMode ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 0, 0.3)';
    
    // Customize color based on attack type
    if (isAttackMode && selectedCharacter && characterData[selectedCharacter.id]) {
        const charData = characterData[selectedCharacter.id];
        let attackPattern;
        
        if (isAttackMode === 'ultimate') {
            attackPattern = charData.ultimate_attack_type;
        } else if (isAttackMode === 'skill') {
            attackPattern = charData.skill_attack_type;
        } else {
            attackPattern = charData.basic_attack_type;
        }
        
        switch (attackPattern) {
            case 'healing':
            case 'mass-heal':
            case 'buff-heal':
            case 'revive-heal':
                color = 'rgba(0, 255, 0, 0.4)'; // Green for healing
                break;
            case 'area':
            case 'lifesteal-area':
            case 'poison-area':
            case 'chaos-area':
                color = 'rgba(255, 165, 0, 0.4)'; // Orange for area attacks
                break;
            case 'full-area':
            case 'shield-break':
            case 'team-wide':
            case 'all-enemies':
                color = 'rgba(128, 0, 128, 0.4)'; // Purple for full-area attacks
                break;
            case 'debuff':
            case 'buff':
                color = 'rgba(255, 255, 0, 0.4)'; // Yellow for status effects
                break;
            case 'single':
            default:
                if (isAttackMode === 'ultimate') {
                    color = 'rgba(255, 0, 255, 0.5)'; // Bright magenta for ultimate attacks
                } else {
                    color = 'rgba(255, 0, 0, 0.3)'; // Red for single target
                }
                break;
        }
    }

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
        
        // Draw energy bar below health bar
        if (char.energy !== undefined && char.max_energy !== undefined) {
            drawEnergyBar(x, y - 16, TILE_SIZE, char.energy, char.max_energy);
        }
        
        // Draw element indicator
        if (char.element) {
            drawElementIndicator(x + 2, y + 2, char.element);
        }
        
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
        
        // Draw shield bar if enemy has shield
        if (enemy.shield_hp && enemy.max_shield_hp) {
            drawShieldBar(x, y - 16, TILE_SIZE, enemy.shield_hp, enemy.max_shield_hp);
            
            // Draw weakness indicators above shield bar if enemy has shield weaknesses
            if (enemy.shield_weak_to && enemy.shield_weak_to.length > 0) {
                drawWeaknessIndicators(x, y - 24, enemy.shield_weak_to);
            }
        }
        
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

function drawShieldBar(x, y, width, currentShield, maxShield) {
    if (maxShield <= 0) return;
    
    const barHeight = 4;
    const shieldRatio = currentShield / maxShield;
    
    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, width, barHeight);
    
    // Shield bar
    ctx.fillStyle = '#00bfff';
    ctx.fillRect(x, y, width * shieldRatio, barHeight);
    
    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, barHeight);
}

function drawEnergyBar(x, y, width, currentEnergy, maxEnergy) {
    if (maxEnergy <= 0) return;
    
    const barHeight = 4;
    const energyRatio = currentEnergy / maxEnergy;
    
    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, width, barHeight);
    
    // Energy bar (purple/magenta)
    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(x, y, width * energyRatio, barHeight);
    
    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, barHeight);
}

function drawWeaknessIndicators(x, y, weaknesses) {
    if (!weaknesses || weaknesses.length === 0) return;
    
    const elementColors = {
        'fire': '#FF4444',
        'water': '#4444FF',
        'earth': '#8B4513',
        'air': '#87CEEB',
        'lightning': '#FFD700',
        'grass': '#32CD32',
        'ice': '#87CEEB',
        'dark': '#800080'
    };
    
    const radius = 4;
    const spacing = 10;
    const totalWidth = weaknesses.length * spacing - 2;
    const startX = x + (TILE_SIZE - totalWidth) / 2;
    
    weaknesses.forEach((weakness, index) => {
        const weaknessX = startX + index * spacing;
        const color = elementColors[weakness] || '#FFFFFF';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(weaknessX, y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

function drawElementIndicator(x, y, element) {
    // Load element data and draw colored circle
    const elementColors = {
        'fire': '#FF4444',
        'water': '#4444FF',
        'earth': '#8B4513',
        'air': '#87CEEB',
        'lightning': '#FFD700',
        'grass': '#32CD32',
        'ice': '#87CEEB',
        'dark': '#800080'
    };
    
    const color = elementColors[element] || '#FFFFFF';
    const radius = 6;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();
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
    const skillRange = selectedCharacter.skill_attack_range || selectedCharacter.attack_range;
    attackableRange = calculateRange(selectedCharacter, skillRange);
    walkableRange = [];
    
    hideActionWheel();
    draw();
});

ultimateAttackBtn.addEventListener('click', () => {
    if (!selectedCharacter) return;
    const charData = characterData[selectedCharacter.id];
    if (!charData || !charData.ultimate_attack_range) return;
    
    const energy = selectedCharacter.energy || 0;
    const energyCost = charData.ultimate_energy_cost || 100;
    if (energy < energyCost) return;
    
    isAttackMode = 'ultimate';
    const ultimateRange = charData.ultimate_attack_range === 99 ? 99 : charData.ultimate_attack_range;
    if (ultimateRange === 99) {
        // Global range ultimate - show entire battlefield as attackable
        attackableRange = [];
        for (let x = 0; x < gameState.grid_size.width; x++) {
            for (let y = 0; y < gameState.grid_size.height; y++) {
                attackableRange.push({ x, y });
            }
        }
    } else {
        attackableRange = calculateRange(selectedCharacter, ultimateRange);
    }
    walkableRange = [];
    
    hideActionWheel();
    draw();
});

// Add tooltip event listeners for attack buttons
basicAttackBtn.addEventListener('mouseenter', (e) => {
    if (selectedCharacter && characterData[selectedCharacter.id]) {
        showAttackTooltip(e, 'basic', selectedCharacter.id);
    }
});

basicAttackBtn.addEventListener('mouseleave', () => {
    hideAttackTooltip();
});

skillAttackBtn.addEventListener('mouseenter', (e) => {
    if (selectedCharacter && characterData[selectedCharacter.id]) {
        showAttackTooltip(e, 'skill', selectedCharacter.id);
    }
});

skillAttackBtn.addEventListener('mouseleave', () => {
    hideAttackTooltip();
});

ultimateAttackBtn.addEventListener('mouseenter', (e) => {
    if (selectedCharacter && characterData[selectedCharacter.id]) {
        showAttackTooltip(e, 'ultimate', selectedCharacter.id);
    }
});

ultimateAttackBtn.addEventListener('mouseleave', () => {
    hideAttackTooltip();
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
    const ischaracter = !!character;
    // Always update hover state and handle action wheel visibility
    if (unit !== hoveredUnit) {
        hoveredUnit = unit;
        updateTooltip(e, unit, ischaracter);
        draw();
    } else if (unit) {
        // Still hovering over the same unit, update tooltip position
        updateTooltip(e, unit, ischaracter);
    }
    
    // Always check action wheel visibility on mouse move
    handleActionWheelVisibility(e);
});

canvas.addEventListener('mouseleave', () => {
    hoveredUnit = null;
    hideTooltip();
    hideAttackTooltip();
    
    draw();
});

canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const clickedEnemy = gameState.enemies?.find(e => e.x === x && e.y === y);
    const clickedChar = gameState.characters?.find(c => c.x === x && c.y === y);

    if (selectedCharacter && isAttackMode) {
        // Get character data to determine attack pattern
        const charData = characterData[selectedCharacter.id];
        if (!charData) {
            alert("Character data not found");
            resetSelection();
            return;
        }
        
        let attackPattern;
        if (isAttackMode === 'ultimate') {
            attackPattern = charData.ultimate_attack_type;
        } else if (isAttackMode === 'skill') {
            attackPattern = charData.skill_attack_type;
        } else {
            attackPattern = charData.basic_attack_type;
        }
        
        // Check if click is within attackable range
        if (!attackableRange.some(t => t.x === x && t.y === y)) {
            resetSelection();
            return;
        }
        
        if (attackPattern === 'healing' || attackPattern === 'mass-heal' || attackPattern === 'buff-heal' || attackPattern === 'revive-heal') {
            // Healing attacks target allies
            if (clickedChar && clickedChar.id !== selectedCharacter.id) {
                // Heal specific ally
                await attack(isAttackMode, clickedChar.id);
            } else if (!clickedChar && !clickedEnemy) {
                // Heal all allies in range (click on empty space)
                await attack(isAttackMode);
            } else {
                alert("Healing attacks can only target allies or empty space for area heal");
            }
        } else if (attackPattern === 'single') {
            // Single target attack - must target enemy
            if (clickedEnemy) {
                await attack(isAttackMode, clickedEnemy.id);
            } else {
                alert("Please select an enemy to attack");
            }
        } else if (attackPattern === 'area' || attackPattern === 'lifesteal-area' || attackPattern === 'poison-area' || attackPattern === 'chaos-area') {
            // Area attack - can target any tile in range
            await attack(isAttackMode, null, x, y);
        } else if (attackPattern === 'full-area' || attackPattern === 'shield-break' || attackPattern === 'team-wide' || attackPattern === 'all-enemies' || attackPattern === 'debuff' || attackPattern === 'buff') {
            // Full area attack or team-wide effects - targets all enemies/allies in range
            await attack(isAttackMode);
        }
    } else if (selectedCharacter && !isAttackMode) {
        // Movement mode
        if (walkableRange.some(t => t.x === x && t.y === y)) {
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
function updateTooltip(mouseEvent, unit, isCharacter) {
    if (!unit) {
        hideTooltip();
        return;
    }
    
    let tooltipText = '';
    if (!isCharacter) {
        // It's an enemy (has hp and damage but no sp)
        const elementText = unit.element ? ` | Element: ${unit.element.charAt(0).toUpperCase() + unit.element.slice(1)}` : '';
        const shieldText = unit.shield_hp > 0 ? ` | Shield: ${unit.shield_hp}/${unit.max_shield_hp}` : '';
        const weaknessText = unit.shield_weak_to && unit.shield_weak_to.length > 0 ? ` | Weak to: ${unit.shield_weak_to.join(', ')}` : '';
        tooltipText = `Enemy ${unit.id} (HP: ${unit.hp}/${unit.max_hp}, ATK: ${unit.damage}${elementText}${shieldText}${weaknessText})`;
    } else {
        // It's a character
        const characterName = unit.name || `Character ${unit.id}`;
        const elementText = unit.element ? ` | Element: ${unit.element.charAt(0).toUpperCase() + unit.element.slice(1)}` : '';
        const energyText = unit.energy !== undefined ? ` | Energy: ${unit.energy}/${unit.max_energy || 100}` : '';
        tooltipText = `${characterName} (HP: ${unit.hp}/${unit.max_hp}${elementText}${energyText})`;
    }
    
    unitTooltip.textContent = tooltipText;
    unitTooltip.style.left = (mouseEvent.clientX + 10) + 'px';
    unitTooltip.style.top = (mouseEvent.clientY - 30) + 'px';
    unitTooltip.classList.remove('hidden');
}

function hideTooltip() {
    unitTooltip.classList.add('hidden');
}

function showAttackTooltip(mouseEvent, attackType, characterId) {
    const charData = characterData[characterId];
    if (!charData) return;
    
    let attackName, attackDescription;
    
    if (attackType === 'ultimate') {
        attackName = charData.ultimate_attack_description?.split(':')[0] || 'Ultimate Attack';
        attackDescription = charData.ultimate_attack_description?.split(':')[1]?.trim() || 'No description available';
    } else if (attackType === 'skill') {
        attackName = charData.skill_attack_description?.split(':')[0] || 'Skill Attack';
        attackDescription = charData.skill_attack_description?.split(':')[1]?.trim() || 'No description available';
    } else {
        attackName = charData.basic_attack_description?.split(':')[0] || 'Basic Attack';
        attackDescription = charData.basic_attack_description?.split(':')[1]?.trim() || 'No description available';
    }
    
    const attackNameElement = attackTooltip.querySelector('.attack-name');
    const attackDescElement = attackTooltip.querySelector('.attack-description');
    
    attackNameElement.textContent = attackName;
    attackDescElement.textContent = attackDescription;
    
    attackTooltip.style.left = (mouseEvent.clientX + 10) + 'px';
    attackTooltip.style.top = (mouseEvent.clientY - 50) + 'px';
    attackTooltip.classList.remove('hidden');
}

function hideAttackTooltip() {
    attackTooltip.classList.add('hidden');
}

function hideAttackTooltip() {
    attackTooltip.classList.add('hidden');
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
    
    // Update ultimate button state based on character energy
    const charData = characterData[character.id];
    const energy = character.energy || 0;
    const energyCost = charData?.ultimate_energy_cost || 100;
    const hasUltimate = charData?.ultimate_attack_range !== undefined;
    
    if (hasUltimate) {
        ultimateAttackBtn.style.display = 'block';
        ultimateAttackBtn.style.opacity = energy >= energyCost ? '1' : '0.5';
        ultimateAttackBtn.style.pointerEvents = energy >= energyCost ? 'auto' : 'none';
    } else {
        ultimateAttackBtn.style.display = 'none';
    }
    
    actionWheel.classList.remove('hidden');
}

function hideActionWheel() {
    actionWheel.classList.add('hidden');
    hideAttackTooltip(); // Hide attack tooltips when action wheel is hidden
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

async function attack(attackType, targetId, targetX, targetY) {
    if (!selectedCharacter) return;
    
    // Get character template data for attack type
    const charData = characterData[selectedCharacter.id];
    if (!charData) {
        alert("Character data not found");
        return;
    }

    let attackPattern;
    if (attackType === 'ultimate') {
        attackPattern = charData.ultimate_attack_type;
    } else if (attackType === 'skill') {
        attackPattern = charData.skill_attack_type;
    } else {
        attackPattern = charData.basic_attack_type;
    }
    
    let requestData = {
        attacker_id: selectedCharacter.id,
        attack_type: attackType
    };
    
    // Add appropriate target data based on attack pattern
    if (attackPattern === 'healing' || attackPattern === 'mass-heal' || attackPattern === 'buff-heal' || attackPattern === 'revive-heal') {
        // For healing, target allies or heal all in range
        if (targetId) {
            requestData.target_id = targetId;
        }
        // If no specific target, heal all allies in range
    } else if (attackPattern === 'single') {
        // Single target attack
        if (!targetId) {
            alert("Please select a target");
            return;
        }
        requestData.target_id = targetId;
    } else if (attackPattern === 'area' || attackPattern === 'lifesteal-area' || attackPattern === 'poison-area' || attackPattern === 'chaos-area') {
        // Area attack needs target coordinates
        if (targetX === undefined || targetY === undefined) {
            alert("Please select a target area");
            return;
        }
        requestData.target_x = targetX;
        requestData.target_y = targetY;
    } else if (attackPattern === 'full-area' || attackPattern === 'shield-break' || attackPattern === 'team-wide' || attackPattern === 'all-enemies' || attackPattern === 'debuff' || attackPattern === 'buff') {
        // Full area attack or team-wide effects don't need specific target
        // Will affect all enemies/allies in range
    }
    
    // Visual effects based on attack type and pattern
    if (attackType === 'ultimate') {
        // Special ultimate attack visual effects
        const spawnX = selectedCharacter.x * TILE_SIZE + TILE_SIZE/2;
        const spawnY = selectedCharacter.y * TILE_SIZE + TILE_SIZE/2;
        
        // Create dramatic ultimate attack effects
        spawnParticles(spawnX, spawnY, 'magenta', 50);
        spawnParticles(spawnX, spawnY, 'white', 30);
        spawnParticles(spawnX, spawnY, 'gold', 20);
        
        // Add screen-wide effect for ultimate attacks
        if (attackPattern === 'all-enemies' || attackPattern === 'team-wide' || attackPattern === 'debuff' || attackPattern === 'buff') {
            // Create effects across the entire battlefield
            for (let i = 0; i < 10; i++) {
                const randomX = Math.random() * canvas.width;
                const randomY = Math.random() * canvas.height;
                spawnParticles(randomX, randomY, 'purple', 15);
            }
        }
    } else if (attackPattern === 'single' && targetId) {
        const enemy = gameState.enemies.find(e => e.id === targetId);
        if (enemy) {
            const spawnX = enemy.x * TILE_SIZE + TILE_SIZE/2;
            const spawnY = enemy.y * TILE_SIZE + TILE_SIZE/2;
            spawnParticles(spawnX, spawnY, 'orange', 15);
        }
    } else if ((attackPattern === 'area' || attackPattern === 'lifesteal-area' || attackPattern === 'poison-area' || attackPattern === 'chaos-area') && targetX !== undefined && targetY !== undefined) {
        const spawnX = targetX * TILE_SIZE + TILE_SIZE/2;
        const spawnY = targetY * TILE_SIZE + TILE_SIZE/2;
        const color = attackType === 'ultimate' ? 'magenta' : 'red';
        spawnParticles(spawnX, spawnY, color, 25);
    } else if (attackPattern === 'full-area' || attackPattern === 'shield-break') {
        // Visual effects for all enemies in range
        const range = attackType === 'ultimate' ? (charData.ultimate_attack_range === 99 ? 99 : charData.ultimate_attack_range) :
                     attackType === 'skill' ? selectedCharacter.skill_attack_range : selectedCharacter.attack_range;
        gameState.enemies.forEach(enemy => {
            const distance = Math.abs(enemy.x - selectedCharacter.x) + Math.abs(enemy.y - selectedCharacter.y);
            if (range === 99 || distance <= range) {
                const spawnX = enemy.x * TILE_SIZE + TILE_SIZE/2;
                const spawnY = enemy.y * TILE_SIZE + TILE_SIZE/2;
                const color = attackType === 'ultimate' ? 'magenta' : 'purple';
                spawnParticles(spawnX, spawnY, color, 20);
            }
        });
    } else if (attackPattern === 'healing' || attackPattern === 'mass-heal' || attackPattern === 'buff-heal' || attackPattern === 'revive-heal') {
        // Visual effects for healing
        const spawnX = selectedCharacter.x * TILE_SIZE + TILE_SIZE/2;
        const spawnY = selectedCharacter.y * TILE_SIZE + TILE_SIZE/2;
        const color = attackType === 'ultimate' ? 'gold' : 'green';
        spawnParticles(spawnX, spawnY, color, 20);
    }
    
    const response = await fetch('/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
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
        fetchCharacterData(); // Load character data for tooltips
        fetchGameState();
    } else {
        window.location.href = '/login_page';
    }
    
    // Add event listener for mission complete continue button
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            window.location.href = '/mission_select_page';
        });
    }
};

