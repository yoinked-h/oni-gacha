// Character Editor JavaScript
let characters = [];
let nextId = 1;
let editingCharacterId = null;

// Element color mapping
function getElementColor(element) {
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
    return elementColors[element] || '#FFFFFF';
}

// DOM elements
const charactersGrid = document.getElementById('characters-grid');
const addCharacterBtn = document.getElementById('add-character-btn');
const saveAllBtn = document.getElementById('save-all-btn');
const loadJsonBtn = document.getElementById('load-json-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const jsonEditor = document.getElementById('json-editor');
const jsonTextarea = document.getElementById('json-textarea');
const loadFromJsonBtn = document.getElementById('load-from-json');
const validateJsonBtn = document.getElementById('validate-json');
const closeJsonEditorBtn = document.getElementById('close-json-editor');
const statusMessage = document.getElementById('status-message');

// Initialize the editor
document.addEventListener('DOMContentLoaded', () => {
    loadCharacters();
    setupEventListeners();
});

function setupEventListeners() {
    addCharacterBtn.addEventListener('click', addNewCharacter);
    saveAllBtn.addEventListener('click', saveAllCharacters);
    loadJsonBtn.addEventListener('click', showJsonEditor);
    exportJsonBtn.addEventListener('click', exportToJson);
    loadFromJsonBtn.addEventListener('click', loadFromJson);
    validateJsonBtn.addEventListener('click', validateJson);
    closeJsonEditorBtn.addEventListener('click', hideJsonEditor);
}

// Load characters from the server
async function loadCharacters() {
    try {
        const response = await fetch('/characters.json');
        if (response.ok) {
            characters = await response.json();
            nextId = Math.max(...characters.map(c => c.id)) + 1;
            renderCharacters();
            showStatus('Characters loaded successfully', 'success');
        } else {
            throw new Error('Failed to load characters');
        }
    } catch (error) {
        console.error('Error loading characters:', error);
        showStatus('Failed to load characters. Starting with empty list.', 'error');
        characters = [];
        nextId = 1;
        renderCharacters();
    }
}

// Render all characters
function renderCharacters() {
    charactersGrid.innerHTML = '';
    characters.forEach(character => {
        const characterCard = createCharacterCard(character);
        charactersGrid.appendChild(characterCard);
    });
}

// Create a character card
function createCharacterCard(character) {
    const isEditing = editingCharacterId === character.id;
    
    const card = document.createElement('div');
    card.className = `character-editor-card ${isEditing ? 'editing' : ''}`;
    card.dataset.characterId = character.id;
    
    if (isEditing) {
        card.innerHTML = createEditForm(character);
    } else {
        card.innerHTML = createViewCard(character);
    }
    
    return card;
}

// Create view-only card
function createViewCard(character) {
    return `
        <div class="character-card-header">
            <span class="character-id">ID: ${character.id}</span>
            <div class="character-actions">
                <button class="btn btn-small" onclick="editCharacter(${character.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteCharacter(${character.id})">Delete</button>
            </div>
        </div>
        <h3 style="color: #00bfff; margin-bottom: 10px;">${character.name}</h3>        <p style="color: #ccc; margin-bottom: 15px; font-size: 14px;">${character.description}</p>
        <div style="margin-bottom: 15px;">
            <strong>Element:</strong> <span style="color: ${getElementColor(character.element || 'air')}; font-weight: bold;">${(character.element || 'air').charAt(0).toUpperCase() + (character.element || 'air').slice(1)}</span>
        </div>        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <div><strong>HP:</strong> ${character.hp}/${character.max_hp}</div>
            <div><strong>Move:</strong> ${character.move_range}</div>
            <div><strong>Basic Atk:</strong> ${character.basic_attack_damage}</div>
            <div><strong>Basic Range:</strong> ${character.basic_attack_range}</div>
            <div><strong>Skill Atk:</strong> ${character.skill_attack_damage}</div>
            <div><strong>Skill Range:</strong> ${character.skill_attack_range}</div>
            ${character.ultimate_attack_damage !== undefined ? `<div><strong>Ultimate Atk:</strong> ${character.ultimate_attack_damage}</div>` : ''}
            ${character.ultimate_attack_range !== undefined ? `<div><strong>Ultimate Range:</strong> ${character.ultimate_attack_range}</div>` : ''}
            ${character.ultimate_energy_cost !== undefined ? `<div><strong>Energy Cost:</strong> ${character.ultimate_energy_cost}</div>` : ''}
        </div>
        
        <div style="margin-bottom: 10px;">
            <strong>Basic Type:</strong> ${character.basic_attack_type} (${character.basic_attack_pattern}${character.basic_attack_area_range > 0 ? `, range: ${character.basic_attack_area_range}` : ''})
        </div>
        <div style="margin-bottom: 10px;">
            <strong>Skill Type:</strong> ${character.skill_attack_type} (${character.skill_attack_pattern}${character.skill_attack_area_range > 0 ? `, range: ${character.skill_attack_area_range}` : ''})
        </div>
        ${character.ultimate_attack_type !== undefined ? `<div style="margin-bottom: 10px;"><strong>Ultimate Type:</strong> ${character.ultimate_attack_type} (${character.ultimate_attack_pattern}${character.ultimate_attack_area_range > 0 ? `, range: ${character.ultimate_attack_area_range}` : ''}${character.ultimate_status_effect ? `, effect: ${character.ultimate_status_effect}` : ''})</div>` : ''}
        
        <div style="margin-bottom: 10px;">
            <strong>Basic Attack:</strong> ${character.basic_attack_description}
        </div>
        <div${character.ultimate_attack_description ? ' style="margin-bottom: 10px;"' : ''}>
            <strong>Skill Attack:</strong> ${character.skill_attack_description}
        </div>
        ${character.ultimate_attack_description ? `<div><strong>Ultimate Attack:</strong> ${character.ultimate_attack_description}</div>` : ''}
    `;
}

// Create edit form
function createEditForm(character) {
    return `
        <div class="character-card-header">
            <span class="character-id">ID: ${character.id}</span>
            <div class="character-actions">
                <button class="btn btn-small btn-success" onclick="saveCharacter(${character.id})">Save</button>
                <button class="btn btn-small" onclick="cancelEdit()">Cancel</button>
            </div>
        </div>
        
        <form id="character-form-${character.id}">
            <div class="form-group">
                <label>Name</label>
                <input type="text" name="name" value="${character.name}" required>
            </div>
              <div class="form-group">
                <label>Description</label>
                <textarea name="description" required>${character.description}</textarea>
            </div>
            
            <div class="form-group">
                <label>Element</label>
                <select name="element" required>
                    <option value="fire" ${character.element === 'fire' ? 'selected' : ''}>Fire</option>
                    <option value="magic" ${character.element === 'magic' ? 'selected' : ''}>Magic</option>
                    <option value="star" ${character.element === 'star' ? 'selected' : ''}>Star</option>
                    <option value="water" ${character.element === 'water' ? 'selected' : ''}>Water</option>
                    <option value="moon" ${character.element === 'moon' ? 'selected' : ''}>Moon</option>
                    <option value="grass" ${character.element === 'grass' ? 'selected' : ''}>Grass</option>
                    <option value="electricity" ${character.element === 'electricity' ? 'selected' : ''}>Electricity</option>
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>HP</label>
                    <input type="number" name="hp" value="${character.hp}" min="1" required>
                </div>
                <div class="form-group">
                    <label>Max HP</label>
                    <input type="number" name="max_hp" value="${character.max_hp}" min="1" required>
                </div>
            </div>
            
            <div class="form-group">
                <label>Move Range</label>
                <input type="number" name="move_range" value="${character.move_range}" min="1" required>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Basic Attack Damage</label>
                    <input type="number" name="basic_attack_damage" value="${character.basic_attack_damage}" min="1" required>
                </div>
                <div class="form-group">
                    <label>Basic Attack Range</label>
                    <input type="number" name="basic_attack_range" value="${character.basic_attack_range}" min="1" required>
                </div>
            </div>
              <div class="form-group">
                <label>Basic Attack Type</label>
                <select name="basic_attack_type" onchange="updateBasicAttackFields(${character.id})" required>
                    <option value="single" ${character.basic_attack_type === 'single' ? 'selected' : ''}>Single Target</option>
                    <option value="area" ${character.basic_attack_type === 'area' ? 'selected' : ''}>Area of Effect</option>
                    <option value="full-area" ${character.basic_attack_type === 'full-area' ? 'selected' : ''}>Full Area</option>
                    <option value="healing" ${character.basic_attack_type === 'healing' ? 'selected' : ''}>Healing</option>
                </select>
            </div>
            
            <div class="form-row" id="basic-pattern-fields-${character.id}">
                <div class="form-group">
                    <label>Basic Attack Pattern</label>
                    <select name="basic_attack_pattern" required>
                        <option value="single" ${character.basic_attack_pattern === 'single' ? 'selected' : ''}>Single Target</option>
                        <option value="area" ${character.basic_attack_pattern === 'area' ? 'selected' : ''}>Area Effect</option>
                        <option value="full-area" ${character.basic_attack_pattern === 'full-area' ? 'selected' : ''}>Full Area</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Basic Attack Area Range</label>
                    <input type="number" name="basic_attack_area_range" value="${character.basic_attack_area_range || 0}" min="0" required>
                </div>
            </div>
            
            <div class="form-group">
                <label>Basic Attack Description</label>
                <textarea name="basic_attack_description" required>${character.basic_attack_description}</textarea>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Skill Attack Damage</label>
                    <input type="number" name="skill_attack_damage" value="${character.skill_attack_damage}" min="1" required>
                </div>
                <div class="form-group">
                    <label>Skill Attack Range</label>
                    <input type="number" name="skill_attack_range" value="${character.skill_attack_range}" min="1" required>
                </div>
            </div>
              <div class="form-group">
                <label>Skill Attack Type</label>
                <select name="skill_attack_type" onchange="updateSkillAttackFields(${character.id})" required>
                    <option value="single" ${character.skill_attack_type === 'single' ? 'selected' : ''}>Single Target</option>
                    <option value="area" ${character.skill_attack_type === 'area' ? 'selected' : ''}>Area of Effect</option>
                    <option value="full-area" ${character.skill_attack_type === 'full-area' ? 'selected' : ''}>Full Area</option>
                    <option value="healing" ${character.skill_attack_type === 'healing' ? 'selected' : ''}>Healing</option>
                </select>
            </div>
            
            <div class="form-row" id="skill-pattern-fields-${character.id}">
                <div class="form-group">
                    <label>Skill Attack Pattern</label>
                    <select name="skill_attack_pattern" required>
                        <option value="single" ${character.skill_attack_pattern === 'single' ? 'selected' : ''}>Single Target</option>
                        <option value="area" ${character.skill_attack_pattern === 'area' ? 'selected' : ''}>Area Effect</option>
                        <option value="full-area" ${character.skill_attack_pattern === 'full-area' ? 'selected' : ''}>Full Area</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Skill Attack Area Range</label>
                    <input type="number" name="skill_attack_area_range" value="${character.skill_attack_area_range || 0}" min="0" required>
                </div>
            </div>
              <div class="form-group">
                <label>Skill Attack Description</label>
                <textarea name="skill_attack_description" required>${character.skill_attack_description}</textarea>
            </div>
              <!-- Ultimate Attack Section -->
            <div class="ultimate-section">
                <h4>Ultimate Attack</h4>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Ultimate Attack Damage</label>
                        <input type="number" name="ultimate_attack_damage" value="${character.ultimate_attack_damage || 80}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Ultimate Attack Range</label>
                        <input type="number" name="ultimate_attack_range" value="${character.ultimate_attack_range || 3}" min="1">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Ultimate Energy Cost</label>
                    <input type="number" name="ultimate_energy_cost" value="${character.ultimate_energy_cost || 100}" min="1">
                </div>
                
                <div class="form-group">
                    <label>Ultimate Attack Type</label>
                    <select name="ultimate_attack_type" onchange="updateUltimateAttackFields(${character.id})">
                        <option value="single" ${character.ultimate_attack_type === 'single' ? 'selected' : ''}>Single Target</option>
                        <option value="area" ${character.ultimate_attack_type === 'area' ? 'selected' : ''}>Area of Effect</option>
                        <option value="full-area" ${character.ultimate_attack_type === 'full-area' ? 'selected' : ''}>Full Area</option>
                        <option value="healing" ${character.ultimate_attack_type === 'healing' ? 'selected' : ''}>Healing</option>
                        <option value="mass-heal" ${character.ultimate_attack_type === 'mass-heal' ? 'selected' : ''}>Mass Heal</option>
                        <option value="shield-break" ${character.ultimate_attack_type === 'shield-break' ? 'selected' : ''}>Shield Break</option>
                        <option value="debuff" ${character.ultimate_attack_type === 'debuff' ? 'selected' : ''}>Debuff</option>
                        <option value="buff" ${character.ultimate_attack_type === 'buff' ? 'selected' : ''}>Buff</option>
                        <option value="lifesteal-area" ${character.ultimate_attack_type === 'lifesteal-area' ? 'selected' : ''}>Lifesteal Area</option>
                        <option value="poison-area" ${character.ultimate_attack_type === 'poison-area' ? 'selected' : ''}>Poison Area</option>
                        <option value="chaos-area" ${character.ultimate_attack_type === 'chaos-area' ? 'selected' : ''}>Chaos Area</option>
                        <option value="buff-heal" ${character.ultimate_attack_type === 'buff-heal' ? 'selected' : ''}>Buff & Heal</option>
                        <option value="revive-heal" ${character.ultimate_attack_type === 'revive-heal' ? 'selected' : ''}>Revive & Heal</option>
                    </select>
                </div>
                
                <div class="form-row" id="ultimate-pattern-fields-${character.id}">
                    <div class="form-group">
                        <label>Ultimate Attack Pattern</label>
                        <select name="ultimate_attack_pattern">
                            <option value="single" ${character.ultimate_attack_pattern === 'single' ? 'selected' : ''}>Single Target</option>
                            <option value="area" ${character.ultimate_attack_pattern === 'area' ? 'selected' : ''}>Area Effect</option>
                            <option value="full-area" ${character.ultimate_attack_pattern === 'full-area' ? 'selected' : ''}>Full Area</option>
                            <option value="team-wide" ${character.ultimate_attack_pattern === 'team-wide' ? 'selected' : ''}>Team Wide</option>
                            <option value="all-enemies" ${character.ultimate_attack_pattern === 'all-enemies' ? 'selected' : ''}>All Enemies</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Ultimate Attack Area Range</label>
                        <input type="number" name="ultimate_attack_area_range" value="${character.ultimate_attack_area_range || 0}" min="0">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Ultimate Status Effect (optional)</label>
                    <select name="ultimate_status_effect">
                        <option value="" ${!character.ultimate_status_effect ? 'selected' : ''}>None</option>
                        <option value="burn" ${character.ultimate_status_effect === 'burn' ? 'selected' : ''}>Burn</option>
                        <option value="poison" ${character.ultimate_status_effect === 'poison' ? 'selected' : ''}>Poison</option>
                        <option value="frozen" ${character.ultimate_status_effect === 'frozen' ? 'selected' : ''}>Frozen</option>
                        <option value="vulnerability" ${character.ultimate_status_effect === 'vulnerability' ? 'selected' : ''}>Vulnerability</option>
                        <option value="divine_shield" ${character.ultimate_status_effect === 'divine_shield' ? 'selected' : ''}>Divine Shield</option>
                        <option value="regeneration" ${character.ultimate_status_effect === 'regeneration' ? 'selected' : ''}>Regeneration</option>
                        <option value="immunity" ${character.ultimate_status_effect === 'immunity' ? 'selected' : ''}>Immunity</option>
                        <option value="adrenaline" ${character.ultimate_status_effect === 'adrenaline' ? 'selected' : ''}>Adrenaline</option>
                        <option value="blessed" ${character.ultimate_status_effect === 'blessed' ? 'selected' : ''}>Blessed</option>
                        <option value="chaos" ${character.ultimate_status_effect === 'chaos' ? 'selected' : ''}>Chaos</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Ultimate Attack Description</label>
                    <textarea name="ultimate_attack_description" placeholder="Ultimate Name: Description of the ultimate attack and its effects">${character.ultimate_attack_description || ''}</textarea>
                </div>
            </div>
        </form>
    `;
}

// Add new character
function addNewCharacter() {    const newCharacter = {
        id: nextId++,
        name: "New Character",
        hp: 100,
        max_hp: 100,
        move_range: 2,
        basic_attack_range: 1,
        basic_attack_damage: 25,
        skill_attack_range: 2,
        skill_attack_damage: 40,
        element: "air",
        description: "A new character ready for adventure.",
        basic_attack_description: "Basic Attack: A standard attack that deals moderate damage.",
        skill_attack_description: "Skill Attack: A special ability with unique effects.",
        basic_attack_type: "single",
        basic_attack_pattern: "single",
        basic_attack_area_range: 0,
        skill_attack_type: "single",
        skill_attack_pattern: "single",
        skill_attack_area_range: 0,
        ultimate_attack_range: 3,
        ultimate_attack_damage: 80,
        ultimate_energy_cost: 100,
        ultimate_attack_description: "Ultimate Attack: A powerful ultimate ability with devastating effects.",
        ultimate_attack_type: "full-area",
        ultimate_attack_pattern: "full-area",
        ultimate_attack_area_range: 0,
        ultimate_status_effect: ""
    };
    
    characters.push(newCharacter);
    editingCharacterId = newCharacter.id;
    renderCharacters();
    showStatus('New character added. Please edit the details.', 'success');
}

// Edit character
function editCharacter(id) {
    editingCharacterId = id;
    renderCharacters();
}

// Save character
function saveCharacter(id) {
    const form = document.getElementById(`character-form-${id}`);
    const formData = new FormData(form);
    
    const characterIndex = characters.findIndex(c => c.id === id);
    if (characterIndex === -1) return;
      // Update character with form data
    const updatedCharacter = { ...characters[characterIndex] };
      for (const [key, value] of formData.entries()) {
        if (key.includes('damage') || key.includes('hp') || key.includes('range') || key.includes('area_range') || key.includes('cost')) {
            updatedCharacter[key] = parseInt(value);
        } else {
            updatedCharacter[key] = value;
        }
    }
    
    characters[characterIndex] = updatedCharacter;
    editingCharacterId = null;
    renderCharacters();
    showStatus(`Character "${updatedCharacter.name}" saved successfully.`, 'success');
}

// Cancel edit
function cancelEdit() {
    editingCharacterId = null;
    renderCharacters();
}

// Delete character
function deleteCharacter(id) {
    const character = characters.find(c => c.id === id);
    if (!character) return;
    
    if (confirm(`Are you sure you want to delete "${character.name}"?`)) {
        characters = characters.filter(c => c.id !== id);
        renderCharacters();
        showStatus(`Character "${character.name}" deleted.`, 'success');
    }
}

// Save all characters to server
async function saveAllCharacters() {
    try {
        const response = await fetch('/api/save-characters', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(characters)
        });
        
        if (response.ok) {
            showStatus('All characters saved successfully!', 'success');
        } else {
            throw new Error('Failed to save characters');
        }
    } catch (error) {
        console.error('Error saving characters:', error);
        showStatus('Failed to save characters to server. You can export to JSON as backup.', 'error');
    }
}

// Show JSON editor
function showJsonEditor() {
    jsonTextarea.value = JSON.stringify(characters, null, 2);
    jsonEditor.classList.remove('hidden');
}

// Hide JSON editor
function hideJsonEditor() {
    jsonEditor.classList.add('hidden');
}

// Load from JSON
function loadFromJson() {
    try {
        const jsonData = JSON.parse(jsonTextarea.value);
        
        if (!Array.isArray(jsonData)) {
            throw new Error('JSON must be an array of characters');
        }
          // Validate each character has required fields
        jsonData.forEach((char, index) => {            const requiredFields = ['id', 'name', 'hp', 'max_hp', 'move_range', 'basic_attack_range', 
                                  'basic_attack_damage', 'skill_attack_range', 'skill_attack_damage',
                                  'description', 'basic_attack_description', 'skill_attack_description',
                                  'basic_attack_type', 'skill_attack_type', 'basic_attack_pattern', 
                                  'skill_attack_pattern', 'basic_attack_area_range', 'skill_attack_area_range',
                                  'element'];
            
            requiredFields.forEach(field => {
                if (!(field in char)) {
                    throw new Error(`Character at index ${index} is missing field: ${field}`);
                }
            });
        });
        
        characters = jsonData;
        nextId = Math.max(...characters.map(c => c.id)) + 1;
        renderCharacters();
        hideJsonEditor();
        showStatus('Characters loaded from JSON successfully!', 'success');
        
    } catch (error) {
        showStatus(`Invalid JSON: ${error.message}`, 'error');
    }
}

// Validate JSON
function validateJson() {
    try {
        const jsonData = JSON.parse(jsonTextarea.value);
        showStatus('JSON is valid!', 'success');
    } catch (error) {
        showStatus(`Invalid JSON: ${error.message}`, 'error');
    }
}

// Export to JSON
function exportToJson() {
    const jsonString = JSON.stringify(characters, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'characters.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('Characters exported to JSON file!', 'success');
}

// Show status message
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.classList.remove('hidden');
    
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 5000);
}

// Global functions (needed for onclick handlers)
window.editCharacter = editCharacter;
window.saveCharacter = saveCharacter;
window.cancelEdit = cancelEdit;
window.deleteCharacter = deleteCharacter;

// Dynamic field update functions
function updateBasicAttackFields(characterId) {
    const selectElement = document.querySelector(`form#character-form-${characterId} select[name="basic_attack_type"]`);
    const patternFieldsContainer = document.getElementById(`basic-pattern-fields-${characterId}`);
    const patternSelect = document.querySelector(`form#character-form-${characterId} select[name="basic_attack_pattern"]`);
    const areaRangeInput = document.querySelector(`form#character-form-${characterId} input[name="basic_attack_area_range"]`);
    
    if (!selectElement || !patternFieldsContainer || !patternSelect || !areaRangeInput) return;
    
    const attackType = selectElement.value;
    
    // Update pattern options based on attack type
    patternSelect.innerHTML = '';
    
    if (attackType === 'healing') {
        patternSelect.innerHTML = `
            <option value="single">Single Target</option>
            <option value="area">Area Effect</option>
            <option value="full-area">Full Area</option>
        `;
        patternSelect.value = 'single';
        patternFieldsContainer.style.display = 'grid';
    } else if (attackType === 'area') {
        patternSelect.innerHTML = `
            <option value="area">Area Effect</option>
        `;
        patternSelect.value = 'area';
        areaRangeInput.value = areaRangeInput.value || 2;
        patternFieldsContainer.style.display = 'grid';
    } else if (attackType === 'full-area') {
        patternSelect.innerHTML = `
            <option value="full-area">Full Area</option>
        `;
        patternSelect.value = 'full-area';
        areaRangeInput.value = 0;
        patternFieldsContainer.style.display = 'grid';
    } else {
        patternSelect.innerHTML = `
            <option value="single">Single Target</option>
        `;
        patternSelect.value = 'single';
        areaRangeInput.value = 0;
        patternFieldsContainer.style.display = 'grid';
    }
}

function updateSkillAttackFields(characterId) {
    const selectElement = document.querySelector(`form#character-form-${characterId} select[name="skill_attack_type"]`);
    const patternFieldsContainer = document.getElementById(`skill-pattern-fields-${characterId}`);
    const patternSelect = document.querySelector(`form#character-form-${characterId} select[name="skill_attack_pattern"]`);
    const areaRangeInput = document.querySelector(`form#character-form-${characterId} input[name="skill_attack_area_range"]`);
    
    if (!selectElement || !patternFieldsContainer || !patternSelect || !areaRangeInput) return;
    
    const attackType = selectElement.value;
    
    // Update pattern options based on attack type
    patternSelect.innerHTML = '';
    
    if (attackType === 'healing') {
        patternSelect.innerHTML = `
            <option value="single">Single Target</option>
            <option value="area">Area Effect</option>
            <option value="full-area">Full Area</option>
        `;
        patternSelect.value = 'single';
        patternFieldsContainer.style.display = 'grid';
    } else if (attackType === 'area') {
        patternSelect.innerHTML = `
            <option value="area">Area Effect</option>
        `;
        patternSelect.value = 'area';
        areaRangeInput.value = areaRangeInput.value || 2;
        patternFieldsContainer.style.display = 'grid';
    } else if (attackType === 'full-area') {
        patternSelect.innerHTML = `
            <option value="full-area">Full Area</option>
        `;
        patternSelect.value = 'full-area';
        areaRangeInput.value = 0;
        patternFieldsContainer.style.display = 'grid';
    } else {
        patternSelect.innerHTML = `
            <option value="single">Single Target</option>
        `;
        patternSelect.value = 'single';
        areaRangeInput.value = 0;
        patternFieldsContainer.style.display = 'grid';
    }
}

function updateUltimateAttackFields(characterId) {
    const selectElement = document.querySelector(`form#character-form-${characterId} select[name="ultimate_attack_type"]`);
    const patternFieldsContainer = document.getElementById(`ultimate-pattern-fields-${characterId}`);
    const patternSelect = document.querySelector(`form#character-form-${characterId} select[name="ultimate_attack_pattern"]`);
    const areaRangeInput = document.querySelector(`form#character-form-${characterId} input[name="ultimate_attack_area_range"]`);
    
    if (!selectElement || !patternFieldsContainer || !patternSelect || !areaRangeInput) return;
    
    const attackType = selectElement.value;
    
    // Update pattern options based on attack type
    patternSelect.innerHTML = '';
    
    if (attackType === 'healing' || attackType === 'mass-heal' || attackType === 'buff-heal' || attackType === 'revive-heal') {
        patternSelect.innerHTML = `
            <option value="single">Single Target</option>
            <option value="area">Area Effect</option>
            <option value="team-wide">Team Wide</option>
        `;
        patternSelect.value = attackType === 'mass-heal' || attackType === 'buff-heal' || attackType === 'revive-heal' ? 'team-wide' : 'single';
        patternFieldsContainer.style.display = 'grid';
    } else if (attackType === 'area' || attackType === 'lifesteal-area' || attackType === 'poison-area' || attackType === 'chaos-area') {
        patternSelect.innerHTML = `
            <option value="area">Area Effect</option>
        `;
        patternSelect.value = 'area';
        areaRangeInput.value = areaRangeInput.value || 2;
        patternFieldsContainer.style.display = 'grid';
    } else if (attackType === 'full-area' || attackType === 'shield-break') {
        patternSelect.innerHTML = `
            <option value="full-area">Full Area</option>
        `;
        patternSelect.value = 'full-area';
        areaRangeInput.value = 0;
        patternFieldsContainer.style.display = 'grid';
    } else if (attackType === 'debuff' || attackType === 'buff') {
        patternSelect.innerHTML = `
            <option value="single">Single Target</option>
            <option value="area">Area Effect</option>
            <option value="all-enemies">All Enemies</option>
            <option value="team-wide">Team Wide</option>
        `;
        patternSelect.value = attackType === 'debuff' ? 'all-enemies' : 'team-wide';
        patternFieldsContainer.style.display = 'grid';
    } else {
        patternSelect.innerHTML = `
            <option value="single">Single Target</option>
        `;
        patternSelect.value = 'single';
        areaRangeInput.value = 0;
        patternFieldsContainer.style.display = 'grid';
    }
}

// Make these functions globally available
window.updateBasicAttackFields = updateBasicAttackFields;
window.updateSkillAttackFields = updateSkillAttackFields;
window.updateUltimateAttackFields = updateUltimateAttackFields;
