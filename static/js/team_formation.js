// Team formation JavaScript
let availableCharacters = [];
let selectedTeam = [null, null, null, null]; // 4 team slots
let selectedMission = null;
let hoveredCharacter = null;
let currentSelectedSlot = null; // Track which slot is being filled

// DOM elements
const characterSelectionPanel = document.getElementById('character-selection-panel');
const characterList = document.getElementById('character-list');
const teamSlots = document.querySelectorAll('.team-slot');
const startMissionBtn = document.getElementById('start-mission-btn');
const backToMissionsBtn = document.getElementById('back-to-missions-btn');
const characterInfo = document.getElementById('character-info');
const noCharacterSelected = document.getElementById('no-character-selected');
const closeCharacterPanelBtn = document.getElementById('close-character-panel');
const globalTooltip = document.getElementById('character-tooltip');
const tooltipContent = document.getElementById('tooltip-content');
const teamFormationMain = document.getElementById('team-formation-main');

// Character detail elements
const charName = document.getElementById('char-name');
const charDescription = document.getElementById('char-description');
const charHp = document.getElementById('char-hp');
const charMove = document.getElementById('char-move');
const charBasicRange = document.getElementById('char-basic-range');
const charBasicDamage = document.getElementById('char-basic-damage');
const charSkillRange = document.getElementById('char-skill-range');
const charSkillDamage = document.getElementById('char-skill-damage');
const charBasicDesc = document.getElementById('char-basic-desc');
const charSkillDesc = document.getElementById('char-skill-desc');

// Mission info elements
const missionName = document.getElementById('mission-name');
const missionDescription = document.getElementById('mission-description');

// Event listeners
backToMissionsBtn.addEventListener('click', () => {
    window.location.href = '/mission_select_page';
});

startMissionBtn.addEventListener('click', startMission);

// Close character selection panel
closeCharacterPanelBtn.addEventListener('click', closeCharacterPanel);

// Add click listeners to team slots
teamSlots.forEach((slot, index) => {
    slot.addEventListener('click', () => openCharacterPanel(index));
});

// Close panel when clicking outside
document.addEventListener('click', (e) => {
    if (characterSelectionPanel.classList.contains('visible') && 
        !characterSelectionPanel.contains(e.target) && 
        !e.target.closest('.team-slot')) {
        closeCharacterPanel();
    }
});

// Load mission info and characters
async function loadMissionInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const missionId = urlParams.get('mission');
    
    if (!missionId) {
        alert('No mission selected');
        window.location.href = '/mission_select_page';
        return;
    }
    
    try {
        // Load mission details
        const missionsResponse = await fetch('/missions');
        if (missionsResponse.ok) {
            const missions = await missionsResponse.json();
            selectedMission = missions.find(m => m.id == missionId);
            
            if (selectedMission) {
                missionName.textContent = `Mission: ${selectedMission.name}`;
                missionDescription.textContent = selectedMission.description;
            } else {
                throw new Error('Mission not found');
            }
        } else {
            throw new Error('Failed to load missions');
        }        // Load available characters with player levels
        const charactersResponse = await fetch('/player_characters');
        if (charactersResponse.ok) {
            availableCharacters = await charactersResponse.json();
            // Don't render character list immediately - will be rendered when panel opens
        } else {
            throw new Error('Failed to load characters');
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load mission or character data');
        window.location.href = '/mission_select_page';
    }
}

// Panel management functions
function openCharacterPanel(slotIndex) {
    currentSelectedSlot = slotIndex;
    characterSelectionPanel.classList.remove('hidden');
    characterSelectionPanel.classList.add('visible');
    renderCharacterList();
}

function closeCharacterPanel() {
    characterSelectionPanel.classList.remove('visible');
    currentSelectedSlot = null;
    hideCharacterDetails();
    
    // Add the panel back to hidden after animation completes
    setTimeout(() => {
        if (!characterSelectionPanel.classList.contains('visible')) {
            characterSelectionPanel.classList.add('hidden');
        }
    }, 300);
}

function renderCharacterList() {
    characterList.innerHTML = '';
      availableCharacters.forEach(character => {
        const isSelected = selectedTeam.some(teamChar => teamChar && teamChar.id === character.id);
        
        // Determine level class
        let levelClass = '';
        if (character.level >= 80) {
            levelClass = 'level-max';
        } else if (character.level >= 50) {
            levelClass = 'level-high';
        }
        
        const characterCard = document.createElement('div');
        characterCard.className = `character-card ${isSelected ? 'selected' : ''}`;
        characterCard.dataset.characterId = character.id;
        
        characterCard.innerHTML = `
            <div class="character-portrait">
                <span class="character-id">${character.id}</span>
            </div>
            <div class="character-info">
                <div class="character-name">${character.name}</div>
                <div class="character-level ${levelClass}">Level ${character.level}</div>
                <div class="character-brief-stats">
                    <span>HP: ${character.current_max_hp}</span>
                    <span>ATK: ${character.current_damage}</span>
                </div>
            </div>
        `;// Event listeners for character interaction
        characterCard.addEventListener('click', () => selectCharacterForSlot(character));
        characterCard.addEventListener('mouseenter', (event) => {
            showCharacterDetails(character);
            showCharacterTooltip(character, event.currentTarget);
        });
        characterCard.addEventListener('mouseleave', () => {
            if (hoveredCharacter === character) {
                hideCharacterDetails();
                hideCharacterTooltip();
            }
        });
        
        characterList.appendChild(characterCard);    });
}

function showCharacterTooltip(character, characterCard) {    if (!globalTooltip || !tooltipContent) return;
      // Calculate XP progress percentage
    const xpProgress = character.xp_needed > 0 ? (character.xp / character.xp_needed) * 100 : 100;
    const nearLevelup = xpProgress >= 80 ? 'near-levelup' : '';
    
    // Create tooltip content
    tooltipContent.innerHTML = `
        <h4>${character.name} (Level ${character.level})</h4>
        <div class="character-xp">
            <span class="xp-text">XP: ${character.xp} / ${character.xp_needed}</span>
            <div class="xp-progress-bar">
                <div class="xp-progress-fill ${nearLevelup}" style="width: ${xpProgress}%"></div>
            </div>
        </div>
        <p>${character.description}</p>
        <div class="tooltip-stats">
            <div class="tooltip-stat">
                <span class="tooltip-stat-label">Health:</span>
                <span class="tooltip-stat-value">${character.current_max_hp}</span>
            </div>
            <div class="tooltip-stat">
                <span class="tooltip-stat-label">Movement:</span>
                <span class="tooltip-stat-value">${character.move_range}</span>
            </div>
            <div class="tooltip-stat">
                <span class="tooltip-stat-label">Basic Range:</span>
                <span class="tooltip-stat-value">${character.basic_attack_range}</span>
            </div>
            <div class="tooltip-stat">
                <span class="tooltip-stat-label">Basic Damage:</span>
                <span class="tooltip-stat-value">${character.current_damage}</span>
            </div>
            <div class="tooltip-stat">
                <span class="tooltip-stat-label">Skill Range:</span>
                <span class="tooltip-stat-value">${character.skill_attack_range}</span>
            </div>
            <div class="tooltip-stat">
                <span class="tooltip-stat-label">Skill Damage:</span>
                <span class="tooltip-stat-value">${character.current_skill_damage}</span>
            </div>
        </div>
        <div class="tooltip-abilities">
            <h5>Abilities</h5>
            <div class="tooltip-ability">
                <div class="tooltip-ability-name">Basic Attack</div>
                <div class="tooltip-ability-desc">${character.basic_attack_description || 'A standard attack.'}</div>
            </div>
            <div class="tooltip-ability">
                <div class="tooltip-ability-name">Skill Attack</div>
                <div class="tooltip-ability-desc">${character.skill_attack_description || 'A special ability.'}</div>
            </div>
        </div>
    `;
    
    // Position the tooltip
    const cardRect = characterCard.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Position tooltip to the right of the sidebar
    let topPosition = cardRect.top;
    
    // Show tooltip first to get its height
    globalTooltip.classList.remove('hidden');
    globalTooltip.classList.add('visible');
    
    // Adjust position if tooltip would go off screen
    const tooltipHeight = globalTooltip.offsetHeight;
    if (topPosition + tooltipHeight > viewportHeight - 20) {
        topPosition = viewportHeight - tooltipHeight - 20;
    }
    if (topPosition < 20) {
        topPosition = 20;
    }
    
    globalTooltip.style.top = `${topPosition}px`;
}

function hideCharacterTooltip() {
    if (!globalTooltip) return;
    
    globalTooltip.classList.remove('visible');
    globalTooltip.classList.add('hidden');
}

function positionTooltip(characterCard) {
    // This function is no longer needed but keeping for compatibility
    return;
}

function selectCharacterForSlot(character) {
    if (currentSelectedSlot === null) return;
    
    // Check if character is already selected in another slot
    const existingSlotIndex = selectedTeam.findIndex(teamChar => teamChar && teamChar.id === character.id);
    
    if (existingSlotIndex !== -1 && existingSlotIndex !== currentSelectedSlot) {
        // Character is already in another slot, swap them
        const currentSlotCharacter = selectedTeam[currentSelectedSlot];
        selectedTeam[existingSlotIndex] = currentSlotCharacter;
        selectedTeam[currentSelectedSlot] = character;
        
        updateTeamSlot(existingSlotIndex, currentSlotCharacter);
        updateTeamSlot(currentSelectedSlot, character);
    } else {
        // Add character to the current slot
        selectedTeam[currentSelectedSlot] = character;
        updateTeamSlot(currentSelectedSlot, character);
    }
    
    checkStartMissionButton();
    closeCharacterPanel();
}

function addCharacterToTeam(character, slotIndex) {
    selectedTeam[slotIndex] = character;
    updateTeamSlot(slotIndex, character);
    checkStartMissionButton();
}

function removeCharacterFromTeam(slotIndex) {
    selectedTeam[slotIndex] = null;
    updateTeamSlot(slotIndex, null);
    checkStartMissionButton();
}

function updateTeamSlot(slotIndex, character) {
    const slot = teamSlots[slotIndex];
    
    if (character) {
        // Determine level class
        let levelClass = '';
        if (character.level >= 80) {
            levelClass = 'level-max';
        } else if (character.level >= 50) {
            levelClass = 'level-high';
        }
        
        slot.className = 'team-slot filled';
        slot.innerHTML = `
            <div class="slot-content">
                <span class="slot-number">${slotIndex + 1}</span>                <div class="team-character-info">
                    <div class="team-character-portrait">${character.id}</div>
                    <div class="team-character-name">${character.name}</div>
                    <div class="team-character-level ${levelClass}">Level ${character.level}</div>
                    <div class="team-character-stats">HP: ${character.current_max_hp} | ATK: ${character.current_damage}</div>
                </div>
                <button class="remove-character-btn" onclick="removeCharacterFromTeam(${slotIndex})">×</button>
            </div>
        `;
        
        // Add hover event to show character details
        slot.addEventListener('mouseenter', () => showCharacterDetails(character));
        slot.addEventListener('mouseleave', () => {
            if (hoveredCharacter === character) {
                hideCharacterDetails();
            }
        });
    } else {
        slot.className = 'team-slot empty';
        slot.innerHTML = `
            <div class="slot-content">
                <span class="slot-number">${slotIndex + 1}</span>
                <span class="slot-text">Click to select</span>
            </div>
        `;
        
        // Remove any existing event listeners for character details
        slot.removeEventListener('mouseenter', () => {});
        slot.removeEventListener('mouseleave', () => {});
    }
}

function showCharacterDetails(character) {
    hoveredCharacter = character;
    
    charName.textContent = `${character.name} (Level ${character.level})`;
    charDescription.textContent = character.description;
    charHp.textContent = character.current_max_hp;
    charMove.textContent = character.move_range;
    charBasicRange.textContent = character.basic_attack_range;
    charBasicDamage.textContent = character.current_damage;
    charSkillRange.textContent = character.skill_attack_range;
    charSkillDamage.textContent = character.current_skill_damage;
    
    // Display attack descriptions
    charBasicDesc.textContent = character.basic_attack_description || 'A standard attack.';
    charSkillDesc.textContent = character.skill_attack_description || 'A special ability.';
}

function hideCharacterDetails() {
    hoveredCharacter = null;
}

function checkStartMissionButton() {
    const teamSize = selectedTeam.filter(char => char !== null).length;
    startMissionBtn.disabled = teamSize === 0;
    
    if (teamSize > 0) {
        startMissionBtn.textContent = `Start Mission (${teamSize}/4 characters)`;
    } else {
        startMissionBtn.textContent = 'Start Mission';
    }
}

async function startMission() {
    const teamCharacters = selectedTeam.filter(char => char !== null);
    
    if (teamCharacters.length === 0) {
        alert('Please select at least one character for your team');
        return;
    }
    
    try {
        const response = await fetch('/select_stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                stage_id: selectedMission.id,
                team: teamCharacters
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`Mission started with ${teamCharacters.length} characters!`);
            window.location.href = '/'; // Redirect to main game page
        } else {
            alert(data.error || 'Failed to start mission');
        }
    } catch (error) {
        console.error('Error starting mission:', error);
        alert('Failed to start mission. Please try again.');
    }
}

// Initialize on page load
window.onload = () => {
    const currentUserId = localStorage.getItem('user_id');
    if (!currentUserId) {
        window.location.href = '/login_page';
    } else {
        loadMissionInfo();
    }
};
