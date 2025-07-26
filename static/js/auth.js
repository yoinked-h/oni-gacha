const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const showRegisterLink = document.getElementById('show-register');

const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');
const registerBtn = document.getElementById('register-btn');
const showLoginLink = document.getElementById('show-login');

const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');

showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginSection.style.display = 'none';
    registerSection.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerSection.style.display = 'none';
    loginSection.style.display = 'block';
});

loginBtn.addEventListener('click', loginUser);
registerBtn.addEventListener('click', registerUser);

async function registerUser() {
    const username = registerUsernameInput.value;
    const password = registerPasswordInput.value;

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (response.ok) {
        alert(data.message);
        showLoginLink.click(); // Switch to login section
    } else {
        alert(data.error);
    }
}

async function loginUser() {
    const username = loginUsernameInput.value;
    const password = loginPasswordInput.value;

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (response.ok) {
        localStorage.setItem('user_id', data.user_id); // Store user ID
        alert(data.message);
        window.location.href = '/'; // Redirect to main game page
    } else {
        alert(data.error);
    }
}
