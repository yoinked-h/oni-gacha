const missionListDiv = document.getElementById('mission-list');
const logoutBtn = document.getElementById('logout-btn');

logoutBtn.addEventListener('click', logoutUser);

async function logoutUser() {
    const response = await fetch('/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();

    if (response.ok) {
        localStorage.removeItem('user_id');
        alert(data.message);
        window.location.href = '/login_page';
    } else {
        alert(data.error);
    }
}

async function loadPlayerStats() {
    try {
        const response = await fetch('/inventory');
        if (response.ok) {
            const data = await response.json();
            
            // Update total XP
            document.getElementById('total-xp').textContent = `Total XP: ${data.total_xp}`;
            
            // Update inventory
            const inventoryList = document.getElementById('inventory-list');
            if (Object.keys(data.inventory).length === 0) {
                inventoryList.innerHTML = '<p>No materials yet</p>';
            } else {
                let inventoryHTML = '';
                for (const [materialType, amount] of Object.entries(data.inventory)) {
                    const materialName = materialType.replace(/_/g, ' ').toUpperCase();
                    inventoryHTML += `<p>${materialName}: ${amount}</p>`;
                }
                inventoryList.innerHTML = inventoryHTML;
            }
        } else {
            console.error("Failed to load player stats.");
        }
    } catch (error) {
        console.error("Error loading player stats:", error);
    }
}

async function loadMissions() {
    const response = await fetch('/missions');
    if (response.ok) {
        const missions = await response.json();
        missionListDiv.innerHTML = ''; // Clear existing buttons
        missions.forEach(mission => {
            const button = document.createElement('button');
            button.classList.add('mission-btn');
            button.dataset.stageId = mission.id;
            button.textContent = mission.name;
            
            // Add mission info
            const missionInfo = document.createElement('div');
            missionInfo.classList.add('mission-info');
            missionInfo.innerHTML = `
                <small>${mission.description}</small><br>
                <small>Base XP: ${mission.xp.base} | Bonus XP Chance: ${(mission.xp.extra_chance * 100).toFixed(0)}%</small>
            `;
            
            const missionContainer = document.createElement('div');
            missionContainer.appendChild(button);
            missionContainer.appendChild(missionInfo);
            missionListDiv.appendChild(missionContainer);
        });
    } else {
        console.error("Failed to load missions.");
        alert("Failed to load missions. Please try again later.");
    }
}

missionListDiv.addEventListener('click', async (e) => {
    if (e.target.classList.contains('mission-btn')) {
        const stageId = parseInt(e.target.dataset.stageId);
        await selectStage(stageId);
    }
});

async function selectStage(stageId) {
    // Redirect to team formation page with the selected mission
    window.location.href = `/team_formation_page?mission=${stageId}`;
}

// Initial load
window.onload = () => {
    const currentUserId = localStorage.getItem('user_id');
    if (!currentUserId) {
        window.location.href = '/login_page'; // Redirect if not logged in
    } else {
        loadPlayerStats();
        loadMissions();
    }
};
