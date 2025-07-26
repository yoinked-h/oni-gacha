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
            missionListDiv.appendChild(button);
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
    const response = await fetch('/select_stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: stageId })
    });
    const data = await response.json();

    if (response.ok) {
        alert(data.message);
        window.location.href = '/'; // Redirect to main game page
    } else {
        alert(data.error);
    }
}

// Initial load
window.onload = () => {
    const currentUserId = localStorage.getItem('user_id');
    if (!currentUserId) {
        window.location.href = '/login_page'; // Redirect if not logged in
    } else {
        loadMissions();
    }
};
