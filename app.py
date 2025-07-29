import random
from flask import Flask, jsonify, request, session, redirect, url_for
from pathlib import Path
import hashlib
import os
import json

def retfromdir(fpath):
    return Path(fpath).read_text()

app = Flask(__name__)
app.secret_key = os.urandom(24)

ACCOUNTS_FILE = 'accounts.json'

def load_accounts_data():
    if not Path(ACCOUNTS_FILE).exists():
        with open(ACCOUNTS_FILE, 'w') as f:
            json.dump({"users": {}, "player_states": {}}, f)
    with open(ACCOUNTS_FILE, 'r') as f:
        return json.load(f)

def save_accounts_data(data):
    with open(ACCOUNTS_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def load_missions_data():
    with open('missions.json', 'r') as f:
        return json.load(f)

def load_characters_data():
    with open('characters.json', 'r') as f:
        return json.load(f)

def calculate_character_stats(base_hp, base_damage, level):
    """Calculate character stats based on level (current stats are level 20 stats, max level 100)"""
    # The current stats in characters.json are level 20 stats
    # Level 1 = 1/20th of level 20 stats, Level 20 = level 20 stats, Level 100 = 5x level 20 stats
    if level <= 20:
        multiplier = level / 20.0
    else:
        # After level 20, stats continue to grow to 5x base at level 100
        multiplier = 1.0 + (4.0 * (level - 20) / 80.0)
    
    return {
        'hp': int(base_hp * multiplier),
        'max_hp': int(base_hp * multiplier),
        'damage': int(base_damage * multiplier)
    }

def calculate_level_up_cost(current_level):
    """Calculate XP needed to level up from current level"""
    return 100 + current_level

def award_character_xp(user_id, char_id, xp_amount):
    """Award XP to a specific character and handle level ups"""
    accounts_data = load_accounts_data()
    
    # Find user data
    user_data = None
    for username, udata in accounts_data['users'].items():
        if udata['id'] == user_id:
            user_data = udata
            break
    
    if not user_data:
        return False
    
    # Initialize player_characters if not exists
    if 'player_characters' not in user_data:
        user_data['player_characters'] = {}
    
    # Initialize character if not exists (start at level 1)
    if str(char_id) not in user_data['player_characters']:
        user_data['player_characters'][str(char_id)] = {
            'level': 1,
            'xp': 0
        }
    
    char_data = user_data['player_characters'][str(char_id)]
    char_data['xp'] += xp_amount
    
    # Check for level ups
    level_ups = 0
    while char_data['level'] < 100:  # Max level 100
        xp_needed = calculate_level_up_cost(char_data['level'])
        if char_data['xp'] >= xp_needed:
            char_data['xp'] -= xp_needed
            char_data['level'] += 1
            level_ups += 1
        else:
            break
    
    save_accounts_data(accounts_data)
    return level_ups

def get_player_character_data(user_id, char_id):
    """Get player's character data including level and XP"""
    accounts_data = load_accounts_data()
    
    # Find user data
    user_data = None
    for username, udata in accounts_data['users'].items():
        if udata['id'] == user_id:
            user_data = udata
            break
    
    if not user_data:
        return None
    
    # Initialize player_characters if not exists
    if 'player_characters' not in user_data:
        user_data['player_characters'] = {}
    
    # Return character data (default to level 1 if not found)
    return user_data['player_characters'].get(str(char_id), {'level': 1, 'xp': 0})

def calculate_mission_rewards(stage_id):
    """Calculate XP and material rewards for completing a mission"""
    missions = load_missions_data()
    mission = next((m for m in missions if m['id'] == stage_id), None)
    if not mission:
        return None
    
    # Calculate XP reward
    xp_reward = mission['xp']['base']
    if random.random() < mission['xp']['extra_chance']:
        xp_reward += int(mission['xp']['extra'] * random.random())
    
    # Calculate material rewards
    material_rewards = {}
    for material_type, material_data in mission['materials'].items():
        amount = material_data['base']
        if random.random() < material_data['extra_chance']:
            amount += int(material_data['extra'] * random.random())
        material_rewards[material_type] = amount
    
    return {
        'xp': xp_reward,
        'materials': material_rewards
    }

def check_mission_complete(game_state):
    """Check if the mission is complete (all enemies defeated)"""
    return len(game_state.get('enemies', [])) == 0

def award_mission_rewards(user_id, stage_id):
    """Award rewards to player and update their inventory"""
    accounts_data = load_accounts_data()
    
    # Find the user by user_id
    user_data = None
    username = None
    for uname, udata in accounts_data['users'].items():
        if udata['id'] == user_id:
            user_data = udata
            username = uname
            break
    
    if not user_data:
        return None
    
    # Initialize inventory and stats if not exists
    if 'inventory' not in user_data:
        user_data['inventory'] = {}
    if 'total_xp' not in user_data:
        user_data['total_xp'] = 0
    
    # Calculate rewards
    rewards = calculate_mission_rewards(stage_id)
    if not rewards:
        return None
    
    # Award XP to player
    user_data['total_xp'] += rewards['xp']
    
    # Award XP to characters used in the mission
    if user_id in accounts_data['player_states']:
        game_data = accounts_data['player_states'][user_id]['game_data']
        if 'characters' in game_data:
            for character in game_data['characters']:
                if 'char_id' in character:
                    char_id = character['char_id']
                    level_ups = award_character_xp(user_id, char_id, rewards['xp'])
                    # You could track level ups here if needed for notifications
    
    # Award materials
    for material_type, amount in rewards['materials'].items():
        if material_type not in user_data['inventory']:
            user_data['inventory'][material_type] = 0
        user_data['inventory'][material_type] += amount
    
    save_accounts_data(accounts_data)
    return rewards

def reset_game_state(user_id):
    """Reset the game state after mission completion"""
    accounts_data = load_accounts_data()
    
    if user_id in accounts_data['player_states']:
        # Clear the player state completely
        del accounts_data['player_states'][user_id]
    
    save_accounts_data(accounts_data)
    return True

# Define element effectiveness system
# ELEMENT_EFFECTIVENESS = {
#     'fire': {'weak_to': ['water'], 'strong_vs': ['grass', 'ice']},
#     'water': {'weak_to': ['grass', 'lightning'], 'strong_vs': ['fire', 'earth']},
#     'earth': {'weak_to': ['grass', 'water'], 'strong_vs': ['lightning', 'fire']},
#     'air': {'weak_to': ['lightning'], 'strong_vs': ['earth']},
#     'lightning': {'weak_to': ['earth'], 'strong_vs': ['water', 'air']},
#     'grass': {'weak_to': ['fire', 'ice'], 'strong_vs': ['water', 'earth']},
#     'ice': {'weak_to': ['fire'], 'strong_vs': ['grass', 'air']},
#     'dark': {'weak_to': ['grass'], 'strong_vs': ['air']}
# }

def calculate_element_effectiveness(attacker_element, defender_element):
    """Calculate damage multiplier based on element effectiveness"""
    return 1.0  # Normal damage

def calculate_damage_with_status_effects(base_damage, attacker, defender):
    """Calculate final damage considering status effects"""
    damage = base_damage
    
    # Apply attacker status effects
    if hasattr(attacker, 'get') and 'status_effects' in attacker:
        if 'adrenaline' in attacker['status_effects']:
            damage *= 2  # Double damage from adrenaline
    
    # Apply defender status effects
    if hasattr(defender, 'get') and 'status_effects' in defender:
        if 'vulnerability' in defender['status_effects']:
            damage = int(damage * 1.5)  # 1.5x damage from vulnerability
        elif 'blessed' in defender['status_effects']:
            damage = int(damage * 0.5)  # 50% damage reduction from blessed
        elif 'immunity' in defender['status_effects']:
            damage = 0  # Immunity negates all damage
        elif 'divine_shield' in defender['status_effects']:
            damage = max(0, damage - 50)  # Divine shield absorbs 50 damage
    
    return max(0, int(damage))

# Stage configurations with more detailed stats
STAGE_CONFIGS = {
    1: {
        'enemies': [
            {
                'id': 1, 'x': 8, 'y': 4, 'hp': 50, 'max_hp': 50, 'attack_range': 1, 'move_range': 2, 'damage': 10,
                'element': 'fire', 'shield_hp': 30, 'max_shield_hp': 30, 'shield_weak_to': ['water', 'ice'],
                'status_effects': {}
            },
        ],
        'grid_size': {'width': 15, 'height': 15},
        'characters': [
            {'id': 1, 'x': 1, 'y': 1, 'hp': 100, 'max_hp': 100, 'attack_range': 2, 'move_range': 3, 'has_acted': False, 'damage': 25},
            {'id': 2, 'x': 1, 'y': 3, 'hp': 100, 'max_hp': 100, 'attack_range': 2, 'move_range': 3, 'has_acted': False, 'damage': 25},
            {'id': 3, 'x': 1, 'y': 5, 'hp': 100, 'max_hp': 100, 'attack_range': 2, 'move_range': 3, 'has_acted': False, 'damage': 25},
            {'id': 4, 'x': 1, 'y': 7, 'hp': 100, 'max_hp': 100, 'attack_range': 2, 'move_range': 3, 'has_acted': False, 'damage': 25},
        ],
        'team_sp': 3,
        'max_team_sp': 5
    },
    2: {
        'enemies': [
            {
                'id': 1, 'x': 7, 'y': 3, 'hp': 60, 'max_hp': 60, 'attack_range': 2, 'move_range': 2, 'damage': 15,
                'element': 'earth', 'shield_hp': 40, 'max_shield_hp': 40, 'shield_weak_to': ['grass', 'water'],
                'status_effects': {}
            },
            {
                'id': 2, 'x': 9, 'y': 5, 'hp': 45, 'max_hp': 45, 'attack_range': 1, 'move_range': 3, 'damage': 12,
                'element': 'lightning', 'shield_hp': 25, 'max_shield_hp': 25, 'shield_weak_to': ['earth'],
                'status_effects': {}
            },
        ],
        'grid_size': {'width': 15, 'height': 15},
        'characters': [],  # Will be filled with selected team
        'team_sp': 2,
        'max_team_sp': 5
    },
    3: {
        'enemies': [
            {
                'id': 1, 'x': 8, 'y': 4, 'hp': 80, 'max_hp': 80, 'attack_range': 3, 'move_range': 1, 'damage': 20,
                'element': 'dark', 'shield_hp': 60, 'max_shield_hp': 60, 'shield_weak_to': ['grass'],
                'status_effects': {}
            },
            {
                'id': 2, 'x': 6, 'y': 6, 'hp': 50, 'max_hp': 50, 'attack_range': 2, 'move_range': 2, 'damage': 14,
                'element': 'ice', 'shield_hp': 35, 'max_shield_hp': 35, 'shield_weak_to': ['fire'],
                'status_effects': {}
            },
            {
                'id': 3, 'x': 10, 'y': 2, 'hp': 40, 'max_hp': 40, 'attack_range': 1, 'move_range': 3, 'damage': 10,
                'element': 'air', 'shield_hp': 20, 'max_shield_hp': 20, 'shield_weak_to': ['lightning'],
                'status_effects': {}
            },
        ],
        'grid_size': {'width': 15, 'height': 15},
        'characters': [],  # Will be filled with selected team
        'team_sp': 1,
        'max_team_sp': 5
    },
}

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.endpoint and (request.endpoint.endswith('api') or request.is_json):
                 return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function

def process_status_effects(game_state):
    """Process status effects for all characters and enemies"""
    
    # Process character status effects
    for char in game_state['characters']:
        if 'status_effects' not in char:
            char['status_effects'] = {}
            continue
            
        effects_to_remove = []
        for effect, duration in char['status_effects'].items():
            if effect == 'regeneration':
                # Heal 15 HP per turn
                char['hp'] = min(char['max_hp'], char['hp'] + 15)
            elif effect == 'adrenaline':
                # Double damage and movement (handled in attack/movement logic)
                pass
            elif effect == 'blessed':
                # 50% damage reduction (handled in damage calculation)
                pass
            elif effect == 'immunity':
                # Immunity to damage (handled in damage calculation)
                pass
            elif effect == 'divine_shield':
                # Shield that absorbs damage (handled in damage calculation)
                pass
            
            # Decrease duration
            char['status_effects'][effect] = duration - 1
            if char['status_effects'][effect] <= 0:
                effects_to_remove.append(effect)
        
        # Remove expired effects
        for effect in effects_to_remove:
            del char['status_effects'][effect]
    
    # Process enemy status effects
    for enemy in game_state['enemies']:
        if 'status_effects' not in enemy:
            enemy['status_effects'] = {}
            continue
            
        effects_to_remove = []
        for effect, duration in enemy['status_effects'].items():
            if effect == 'burn':
                # Take 10 damage per turn
                enemy['hp'] -= 10
            elif effect == 'poison':
                # Take 8 damage per turn
                enemy['hp'] -= 8
            elif effect == 'vulnerability':
                # Take 1.5x damage (handled in damage calculation)
                pass
            elif effect == 'frozen':
                # Cannot act (handled in enemy turn logic)
                pass
            elif effect == 'chaos':
                # Random effects each turn
                import random
                random_effect = random.choice(['burn', 'poison', 'vulnerability'])
                enemy['status_effects'][random_effect] = 1
            
            # Decrease duration
            enemy['status_effects'][effect] = duration - 1
            if enemy['status_effects'][effect] <= 0:
                effects_to_remove.append(effect)
        
        # Remove expired effects
        for effect in effects_to_remove:
            del enemy['status_effects'][effect]
        
        # Remove dead enemies
        if enemy['hp'] <= 0:
            game_state['enemies'] = [e for e in game_state['enemies'] if e['id'] != enemy['id']]

def _advance_turn(game_state):
    """
    Advances the turn to the next character or triggers the enemy turn.
    """
    active_char_id = game_state.get('active_character_id')
    if not active_char_id:
        return

    char_ids = [c['id'] for c in game_state['characters']]
    if not char_ids:
        enemy_turn(game_state) # No characters left, just run enemy turn
        return

    try:
        current_index = char_ids.index(active_char_id)
    except ValueError:
        current_index = -1

    # Find the next character who hasn't acted
    next_char_found = False
    for i in range(1, len(char_ids) + 1):
        check_index = (current_index + i) % len(char_ids)
        if not game_state['characters'][check_index]['has_acted']:
            game_state['active_character_id'] = char_ids[check_index]
            next_char_found = True
            break
    
    if not next_char_found:
        # All characters have acted, start enemy turn
        game_state['turn'] = 'enemy'
        enemy_turn(game_state)
        # Process status effects at the end of the round
        process_status_effects(game_state)
        game_state['turn'] = 'player'
        # Reset all characters for the next round
        for char in game_state['characters']:
            char['has_acted'] = False
        # Set active character to the first one
        if game_state['characters']:
            game_state['active_character_id'] = game_state['characters'][0]['id']

@app.route('/')
@login_required
def index():
    return retfromdir('index.html')

@app.route('/login_page')
def login_page():
    return retfromdir('login.html')

@app.route('/mission_select_page')
@login_required
def mission_select_page():
    return retfromdir('mission_select.html')

@app.route('/team_formation_page')
@login_required
def team_formation_page():
    return retfromdir('team_formation.html')

@app.route('/missions')
@login_required
def get_missions():
    with open('missions.json', 'r') as f:
        missions = json.load(f)
    return jsonify(missions)

@app.route('/characters')
@login_required
def get_characters():
    characters = load_characters_data()
    return jsonify(characters)

@app.route('/player_characters')
@login_required
def get_player_characters():
    """Get all characters with player's level and XP data"""
    user_id = str(session['user_id'])
    
    # Load base character data
    characters = load_characters_data()
    
    # Enhance with player data
    player_characters = []
    for char in characters:
        player_char_data = get_player_character_data(user_id, char['id'])
        level = player_char_data['level'] if player_char_data else 1
        xp = player_char_data['xp'] if player_char_data else 0
        
        # Calculate current stats based on level
        calculated_stats = calculate_character_stats(char['max_hp'], char['basic_attack_damage'], level)
        
        # Calculate XP needed for next level
        xp_needed = calculate_level_up_cost(level) if level < 100 else 0
        
        player_char = {
            **char,
            'level': level,
            'xp': xp,
            'xp_needed': xp_needed,
            'current_hp': calculated_stats['hp'],
            'current_max_hp': calculated_stats['max_hp'],
            'current_damage': calculated_stats['damage'],
            'current_skill_damage': int(char['skill_attack_damage'] * (calculated_stats['damage'] / char['basic_attack_damage']))
        }
        player_characters.append(player_char)
    
    return jsonify(player_characters)

@app.route('/inventory')
@login_required
def get_inventory():
    user_id = str(session['user_id'])
    accounts_data = load_accounts_data()
    
    # Find the user by user_id
    user_data = None
    for username, udata in accounts_data['users'].items():
        if udata['id'] == user_id:
            user_data = udata
            break
    
    if not user_data:
        return jsonify({'inventory': {}, 'total_xp': 0})
    
    return jsonify({
        'inventory': user_data.get('inventory', {}),
        'total_xp': user_data.get('total_xp', 0)
    })

# ... (registration, login, logout routes remain the same)
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    accounts_data = load_accounts_data()
    if username in accounts_data['users']:
        return jsonify({'error': 'Username already exists'}), 409

    hashed_password = hash_password(password)
    
    next_user_id = str(max([int(uid) for uid in accounts_data['users'].keys()] or [0]) + 1)
    
    accounts_data['users'][username] = {'id': next_user_id, 'password': hashed_password}
    save_accounts_data(accounts_data)
    return jsonify({'message': 'Registration successful'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    accounts_data = load_accounts_data()
    user_info = accounts_data['users'].get(username)

    if user_info and user_info['password'] == hash_password(password):
        session['user_id'] = user_info['id']
        return jsonify({'message': 'Login successful', 'user_id': user_info['id']}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/select_stage', methods=['POST'])
@login_required
def select_stage():
    user_id = str(session['user_id'])
    data = request.json
    stage_id = int(data.get('stage_id'))
    selected_team = data.get('team', [])

    if stage_id not in STAGE_CONFIGS:
        return jsonify({'error': 'Invalid stage ID'}), 400

    # Load character data and create team characters
    available_characters = load_characters_data()
    team_characters = []
    
    if selected_team:
        # Use selected team with their stats based on player's character levels
        for i, selected_char in enumerate(selected_team):
            char_template = next((c for c in available_characters if c['id'] == selected_char['id']), None)
            if char_template:
                # Get player's character data (level, xp)
                player_char_data = get_player_character_data(user_id, char_template['id'])
                level = player_char_data['level'] if player_char_data else 1
                
                # Calculate stats based on level
                base_hp = char_template['max_hp']
                base_damage = char_template['basic_attack_damage']
                calculated_stats = calculate_character_stats(base_hp, base_damage, level)
                
                team_char = {
                    'id': i + 1,  # Use sequential IDs for the game
                    'char_id': char_template['id'],  # Keep reference to original character
                    'name': char_template['name'],
                    'x': 1, 'y': 1 + (i * 2),  # Position characters in starting positions
                    'hp': calculated_stats['hp'],
                    'max_hp': calculated_stats['max_hp'],
                    'attack_range': char_template['basic_attack_range'],
                    'skill_attack_range': char_template['skill_attack_range'],
                    'move_range': char_template['move_range'],
                    'has_acted': False,
                    'damage': calculated_stats['damage'],
                    'skill_damage': int(char_template['skill_attack_damage'] * (calculated_stats['damage'] / base_damage)),
                    'element': char_template.get('element', 'air'),  # Add element
                    'level': level,  # Track level for display and reference
                    'energy': 0,  # Start with 0 energy
                    'max_energy': 100,  # All characters have 100 max energy
                    'status_effects': {}  # Track status effects
                }
                team_characters.append(team_char)
    else:
        # Fallback to default team if no team selected
        default_chars = available_characters[:4]  # Take first 4 characters
        for i, char_template in enumerate(default_chars):
            # Get player's character data (level, xp)
            player_char_data = get_player_character_data(user_id, char_template['id'])
            level = player_char_data['level'] if player_char_data else 1
            
            # Calculate stats based on level
            base_hp = char_template['max_hp']
            base_damage = char_template['basic_attack_damage']
            calculated_stats = calculate_character_stats(base_hp, base_damage, level)
            
            team_char = {
                'id': i + 1,
                'char_id': char_template['id'],
                'name': char_template['name'],
                'x': 1, 'y': 1 + (i * 2),
                'hp': calculated_stats['hp'],
                'max_hp': calculated_stats['max_hp'],
                'attack_range': char_template['basic_attack_range'],
                'skill_attack_range': char_template['skill_attack_range'],
                'move_range': char_template['move_range'],
                'has_acted': False,
                'damage': calculated_stats['damage'],
                'skill_damage': int(char_template['skill_attack_damage'] * (calculated_stats['damage'] / base_damage)),
                'element': char_template.get('element', 'air'),  # Add element
                'energy': 0,  # Start with 0 energy
                'max_energy': 100,  # All characters have 100 max energy
                'status_effects': {}  # Track status effects
            }
            team_characters.append(team_char)

    initial_game_data = json.loads(json.dumps(STAGE_CONFIGS[stage_id]))
    initial_game_data['characters'] = team_characters  # Replace with selected team
    initial_game_data['turn'] = 'player'
    if team_characters:
        initial_game_data['active_character_id'] = team_characters[0]['id']
    
    # Ensure team SP is initialized
    if 'team_sp' not in initial_game_data:
        initial_game_data['team_sp'] = 0
    if 'max_team_sp' not in initial_game_data:
        initial_game_data['max_team_sp'] = 5

    accounts_data = load_accounts_data()
    accounts_data['player_states'][user_id] = {
        'current_stage': stage_id,
        'game_data': initial_game_data
    }
    save_accounts_data(accounts_data)
    return jsonify({'message': f'Stage {stage_id} selected', 'game_data': initial_game_data}), 200

@app.route('/game_state', methods=['GET'])
@login_required
def get_current_game_state():
    user_id = str(session['user_id'])
    accounts_data = load_accounts_data()
    player_state = accounts_data['player_states'].get(user_id)

    if player_state and player_state.get('game_data'):
        return jsonify(player_state['game_data'])
    
    return redirect(url_for('mission_select_page'))

@app.route('/move', methods=['POST'])
@login_required
def move():
    user_id = str(session['user_id'])
    accounts_data = load_accounts_data()
    game_state = accounts_data['player_states'][user_id]['game_data']
    
    data = request.json
    char_id = data['character_id']
    new_x, new_y = data['x'], data['y']

    char = next((c for c in game_state['characters'] if c['id'] == char_id), None)

    if not char or char['has_acted'] or char['id'] != game_state.get('active_character_id'):
        return jsonify({'error': 'Character cannot move now'}), 400

    if abs(new_x - char['x']) + abs(new_y - char['y']) > char['move_range']:
        return jsonify({'error': 'Move is out of range'}), 400

    # Check if the destination tile is occupied
    all_positions = {(c['x'], c['y']) for c in game_state['characters']} | \
                    {(e['x'], e['y']) for e in game_state['enemies']}
    if (new_x, new_y) in all_positions:
        return jsonify({'error': 'Tile is occupied'}), 400

    char['x'], char['y'] = new_x, new_y
    char['has_acted'] = True
    
    # ensure no enemy actions sent on player move
    game_state.pop('enemy_actions', None)

    _advance_turn(game_state)

    save_accounts_data(accounts_data)
    return jsonify(game_state)

@app.route('/attack', methods=['POST'])
@login_required
def attack():
    user_id = str(session['user_id'])
    accounts_data = load_accounts_data()
    game_state = accounts_data['player_states'][user_id]['game_data']
    character_data = load_characters_data()

    data = request.json
    attacker_id = data['attacker_id']
    target_id = data.get('target_id')  # For healing, this might be an ally
    attack_type = data.get('attack_type', 'basic')
    target_x = data.get('target_x')  # For area/full-area attacks
    target_y = data.get('target_y')
    
    attacker = next((c for c in game_state['characters'] if c['id'] == attacker_id), None)
    
    if not attacker or attacker['has_acted'] or attacker['id'] != game_state.get('active_character_id'):
        return jsonify({'error': 'Invalid action'}), 400

    # Get character template to determine attack type
    print(character_data)
    print(target_id)
    char_template = next((c for c in character_data if c['id'] == attacker.get('char_id', attacker_id)), None)
    if not char_template:
        return jsonify({'error': 'Character template not found'}), 400

    # Get attack type and damage
    if attack_type == 'ultimate':
        attack_range = char_template.get('ultimate_attack_range', 99)
        damage = char_template.get('ultimate_attack_damage', 100)
        attack_pattern = char_template.get('ultimate_attack_type', 'single')
        skill_pattern = char_template.get('ultimate_attack_pattern', attack_pattern)
        area_range = char_template.get('ultimate_attack_area_range', 2)
        energy_cost = char_template.get('ultimate_energy_cost', 100)
    elif attack_type == 'skill':
        attack_range = attacker.get('skill_attack_range', attacker.get('attack_range', 2))
        damage = char_template.get('skill_attack_damage', 25)
        attack_pattern = char_template.get('skill_attack_type', 'single')
        # Get additional pattern details for healing and area attacks
        skill_pattern = char_template.get('skill_attack_pattern', attack_pattern)
        area_range = char_template.get('skill_attack_area_range', 2)
    else:
        attack_range = attacker.get('attack_range', 2)
        damage = char_template.get('basic_attack_damage', 25)
        attack_pattern = char_template.get('basic_attack_type', 'single')
        # Get basic attack pattern details
        skill_pattern = char_template.get('basic_attack_pattern', attack_pattern)
        area_range = char_template.get('basic_attack_area_range', 1)

    # Initialize team SP if not present
    if 'team_sp' not in game_state:
        game_state['team_sp'] = 0
    if 'max_team_sp' not in game_state:
        game_state['max_team_sp'] = 5

    # Initialize character energy if not present
    if 'energy' not in attacker:
        attacker['energy'] = 0
    if 'max_energy' not in attacker:
        attacker['max_energy'] = 100

    # Check energy requirement for ultimate attacks
    if attack_type == 'ultimate':
        if attacker['energy'] < energy_cost:
            return jsonify({'error': 'Not enough energy for ultimate attack'}), 400

    # Check skill point requirement
    if attack_type == 'skill':
        if game_state['team_sp'] <= 0:
            return jsonify({'error': 'Not enough skill points'}), 400

    # Handle different attack patterns
    status_effect = None
    if attack_type == 'ultimate':
        status_effect = char_template.get('ultimate_status_effect')
    
    if attack_pattern == 'healing' or attack_pattern == 'mass-heal' or attack_pattern == 'buff-heal' or attack_pattern == 'revive-heal':
        # Healing attacks target allies instead of enemies
        heal_amount = damage
        
        if skill_pattern == 'single':
            # Single target heal
            if target_id:
                target = next((c for c in game_state['characters'] if c['id'] == target_id), None)
                if not target:
                    return jsonify({'error': 'Invalid healing target'}), 400
                
                if abs(target['x'] - attacker['x']) + abs(target['y'] - attacker['y']) > attack_range:
                    return jsonify({'error': 'Target is out of range'}), 400
                
                # Heal the target
                target['hp'] = min(target['max_hp'], target['hp'] + heal_amount)
            else:
                # If no target specified for single heal, heal self
                attacker['hp'] = min(attacker['max_hp'], attacker['hp'] + heal_amount)
                
        elif skill_pattern == 'area':
            # Area heal around a target point
            if target_x is None or target_y is None:
                return jsonify({'error': 'No target coordinates specified for area heal'}), 400
            
            if abs(target_x - attacker['x']) + abs(target_y - attacker['y']) > attack_range:
                return jsonify({'error': 'Target area is out of range'}), 400
            
            # Heal all allies within area_range tiles of the target point
            for ally in game_state['characters']:
                distance_to_target = abs(ally['x'] - target_x) + abs(ally['y'] - target_y)
                if distance_to_target <= area_range:
                    ally['hp'] = min(ally['max_hp'], ally['hp'] + heal_amount)
                    
        elif skill_pattern == 'full-area' or skill_pattern == 'team-wide':
            # Heal all allies within the attacker's range or team-wide
            for ally in game_state['characters']:
                if skill_pattern == 'team-wide' or (ally['id'] != attacker_id and abs(ally['x'] - attacker['x']) + abs(ally['y'] - attacker['y']) <= attack_range):
                    if attack_pattern == 'revive-heal':
                        # Full heal for revive-heal ultimates
                        ally['hp'] = ally['max_hp']
                    else:
                        ally['hp'] = min(ally['max_hp'], ally['hp'] + heal_amount)
                    
                    # Apply status effects for ultimate heals
                    if status_effect and attack_type == 'ultimate':
                        if 'status_effects' not in ally:
                            ally['status_effects'] = {}
                        ally['status_effects'][status_effect] = 3  # 3 turns duration
    
    elif attack_pattern == 'single':
        # Single target attack
        if not target_id:
            return jsonify({'error': 'No target specified'}), 400
        
        target = next((e for e in game_state['enemies'] if e['id'] == target_id), None)
        if not target:
            return jsonify({'error': 'Invalid target'}), 400
        
        if abs(target['x'] - attacker['x']) + abs(target['y'] - attacker['y']) > attack_range:
            return jsonify({'error': 'Target is out of range'}), 400
        
        # Get attacker element
        attacker_element = attacker.get('element', 'air')
        target_element = target.get('element', 'fire')
        
        # Calculate element effectiveness
        element_multiplier = calculate_element_effectiveness(attacker_element, target_element)
        modified_damage = int(damage * element_multiplier)
        
        # Apply shield mechanics
        shield_hp = target.get('shield_hp', 0)
        shield_weak_to = target.get('shield_weak_to', [])
        
        if shield_hp > 0:
            # Check if attack is effective against shield
            if attacker_element in shield_weak_to:
                # Deal full damage to shield and 10% to main HP
                shield_damage = min(modified_damage, shield_hp)
                target['shield_hp'] = max(0, shield_hp - shield_damage)
                target['hp'] -= max(1, int(modified_damage * 0.1))
            else:
                # Shield blocks 90% damage, only 10% goes through
                target['hp'] -= max(1, int(modified_damage * 0.1))
        else:
            # No shield, apply full damage
            target['hp'] -= modified_damage
        
        # Remove enemy if defeated
        if target['hp'] <= 0:
            game_state['enemies'] = [e for e in game_state['enemies'] if e['id'] != target_id]
    
    elif attack_pattern == 'area':
        # Area attack around a target point
        if target_x is None or target_y is None:
            return jsonify({'error': 'No target coordinates specified'}), 400
        
        if abs(target_x - attacker['x']) + abs(target_y - attacker['y']) > attack_range:
            return jsonify({'error': 'Target area is out of range'}), 400
        
        # Get attacker element
        attacker_element = attacker.get('element', 'air')
        
        # Attack all enemies within area_range tiles of the target point
        for enemy in game_state['enemies'][:]:  # Use slice to avoid issues with list modification
            distance_to_target = abs(enemy['x'] - target_x) + abs(enemy['y'] - target_y)
            if distance_to_target <= area_range:
                # Calculate element effectiveness for each enemy
                target_element = enemy.get('element', 'fire')
                element_multiplier = calculate_element_effectiveness(attacker_element, target_element)
                modified_damage = int(damage * element_multiplier)
                
                # Apply shield mechanics
                shield_hp = enemy.get('shield_hp', 0)
                shield_weak_to = enemy.get('shield_weak_to', [])
                
                if shield_hp > 0:
                    # Check if attack is effective against shield
                    if attacker_element in shield_weak_to:
                        # Deal full damage to shield and 10% to main HP
                        shield_damage = min(modified_damage, shield_hp)
                        enemy['shield_hp'] = max(0, shield_hp - shield_damage)
                        enemy['hp'] -= max(1, int(modified_damage * 0.1))
                    else:
                        # Shield blocks 90% damage, only 10% goes through
                        enemy['hp'] -= max(1, int(modified_damage * 0.1))
                else:
                    # No shield, apply full damage
                    enemy['hp'] -= modified_damage
                
                if enemy['hp'] <= 0:
                    game_state['enemies'] = [e for e in game_state['enemies'] if e['id'] != enemy['id']]
    
    elif attack_pattern == 'full-area':
        # Attack all enemies within the attacker's range
        attacker_element = attacker.get('element', 'air')
        
        for enemy in game_state['enemies'][:]:  # Use slice to avoid issues with list modification
            distance = abs(enemy['x'] - attacker['x']) + abs(enemy['y'] - attacker['y'])
            if distance <= attack_range:
                # Calculate element effectiveness for each enemy
                target_element = enemy.get('element', 'fire')
                element_multiplier = calculate_element_effectiveness(attacker_element, target_element)
                modified_damage = int(damage * element_multiplier)
                
                # Apply shield mechanics
                shield_hp = enemy.get('shield_hp', 0)
                shield_weak_to = enemy.get('shield_weak_to', [])
                
                if shield_hp > 0:
                    # Check if attack is effective against shield
                    if attacker_element in shield_weak_to:
                        # Deal full damage to shield and 10% to main HP
                        shield_damage = min(modified_damage, shield_hp)
                        enemy['shield_hp'] = max(0, shield_hp - shield_damage)
                        enemy['hp'] -= max(1, int(modified_damage * 0.1))
                    else:
                        # Shield blocks 90% damage, only 10% goes through
                        enemy['hp'] -= max(1, int(modified_damage * 0.1))
                else:
                    # No shield, apply full damage
                    enemy['hp'] -= modified_damage
                
                if enemy['hp'] <= 0:
                    game_state['enemies'] = [e for e in game_state['enemies'] if e['id'] != enemy['id']]

    elif attack_pattern == 'shield-break':
        # Shield-breaking attack that destroys all shields
        attacker_element = attacker.get('element', 'air')
        
        for enemy in game_state['enemies'][:]:
            distance = abs(enemy['x'] - attacker['x']) + abs(enemy['y'] - attacker['y'])
            if attack_range == 99 or distance <= attack_range:
                # Break all shields instantly
                enemy['shield_hp'] = 0
                
                # Apply damage
                target_element = enemy.get('element', 'fire')
                element_multiplier = calculate_element_effectiveness(attacker_element, target_element)
                modified_damage = int(damage * element_multiplier)
                enemy['hp'] -= modified_damage
                
                if enemy['hp'] <= 0:
                    game_state['enemies'] = [e for e in game_state['enemies'] if e['id'] != enemy['id']]

    elif attack_pattern == 'all-enemies' or attack_pattern == 'debuff':
        # Attack or debuff all enemies regardless of range
        for enemy in game_state['enemies'][:]:
            if attack_pattern == 'debuff':
                # Apply debuff without damage (like vulnerability)
                if 'status_effects' not in enemy:
                    enemy['status_effects'] = {}
                if status_effect:
                    enemy['status_effects'][status_effect] = 2  # 2 turns for debuffs
            else:
                # Damage all enemies
                attacker_element = attacker.get('element', 'air')
                target_element = enemy.get('element', 'fire')
                element_multiplier = calculate_element_effectiveness(attacker_element, target_element)
                modified_damage = int(damage * element_multiplier)
                
                # Apply shield mechanics
                shield_hp = enemy.get('shield_hp', 0)
                shield_weak_to = enemy.get('shield_weak_to', [])
                
                if shield_hp > 0:
                    if attacker_element in shield_weak_to:
                        shield_damage = min(modified_damage, shield_hp)
                        enemy['shield_hp'] = max(0, shield_hp - shield_damage)
                        enemy['hp'] -= max(1, int(modified_damage * 0.1))
                    else:
                        enemy['hp'] -= max(1, int(modified_damage * 0.1))
                else:
                    enemy['hp'] -= modified_damage
                
                # Apply status effects
                if status_effect:
                    if 'status_effects' not in enemy:
                        enemy['status_effects'] = {}
                    enemy['status_effects'][status_effect] = 3  # 3 turns for ultimate status effects
                
                if enemy['hp'] <= 0:
                    game_state['enemies'] = [e for e in game_state['enemies'] if e['id'] != enemy['id']]

    elif attack_pattern == 'lifesteal-area' or attack_pattern == 'poison-area' or attack_pattern == 'chaos-area':
        # Special area attacks with unique effects
        if target_x is None or target_y is None:
            return jsonify({'error': 'No target coordinates specified'}), 400
        
        if abs(target_x - attacker['x']) + abs(target_y - attacker['y']) > attack_range:
            return jsonify({'error': 'Target area is out of range'}), 400
        
        attacker_element = attacker.get('element', 'air')
        total_damage_dealt = 0
        
        for enemy in game_state['enemies'][:]:
            distance_to_target = abs(enemy['x'] - target_x) + abs(enemy['y'] - target_y)
            if distance_to_target <= area_range:
                target_element = enemy.get('element', 'fire')
                element_multiplier = calculate_element_effectiveness(attacker_element, target_element)
                modified_damage = int(damage * element_multiplier)
                
                # Apply shield mechanics
                shield_hp = enemy.get('shield_hp', 0)
                shield_weak_to = enemy.get('shield_weak_to', [])
                actual_damage = 0
                
                if shield_hp > 0 and attack_pattern != 'chaos-area':
                    if attacker_element in shield_weak_to:
                        shield_damage = min(modified_damage, shield_hp)
                        enemy['shield_hp'] = max(0, shield_hp - shield_damage)
                        actual_damage = max(1, int(modified_damage * 0.1))
                        enemy['hp'] -= actual_damage
                    else:
                        actual_damage = max(1, int(modified_damage * 0.1))
                        enemy['hp'] -= actual_damage
                else:
                    # No shield or chaos attack ignores shields
                    actual_damage = modified_damage
                    enemy['hp'] -= actual_damage
                    if attack_pattern == 'chaos-area':
                        enemy['shield_hp'] = 0  # Chaos ignores shields
                
                total_damage_dealt += actual_damage
                
                # Apply status effects
                if status_effect:
                    if 'status_effects' not in enemy:
                        enemy['status_effects'] = {}
                    enemy['status_effects'][status_effect] = 4  # Longer duration for ultimate effects
                
                if enemy['hp'] <= 0:
                    game_state['enemies'] = [e for e in game_state['enemies'] if e['id'] != enemy['id']]
        
        # Lifesteal effect
        if attack_pattern == 'lifesteal-area':
            heal_amount = int(total_damage_dealt * 0.25)  # 25% lifesteal
            attacker['hp'] = min(attacker['max_hp'], attacker['hp'] + heal_amount)

    elif attack_pattern == 'buff':
        # Team-wide buffs
        for ally in game_state['characters']:
            if status_effect:
                if 'status_effects' not in ally:
                    ally['status_effects'] = {}
                ally['status_effects'][status_effect] = 3  # 3 turns for team buffs

    # Handle energy and SP changes
    if attack_type == 'ultimate':
        attacker['energy'] -= energy_cost
    elif attack_type == 'skill':
        game_state['team_sp'] -= 1
    else:
        # Increase team SP for basic attacks (up to max), but only for non-healing attacks
        if attack_pattern not in ['healing', 'mass-heal', 'buff-heal', 'revive-heal'] and game_state['team_sp'] < game_state['max_team_sp']:
            game_state['team_sp'] += 1

    # Energy gain from dealing/receiving damage
    damage_dealt = 0
    if attack_pattern not in ['healing', 'mass-heal', 'buff-heal', 'revive-heal', 'buff', 'debuff']:
        # Calculate approximate damage dealt for energy gain
        if attack_pattern == 'single':
            damage_dealt = damage
        elif attack_pattern in ['area', 'lifesteal-area', 'poison-area', 'chaos-area']:
            damage_dealt = damage * min(2, len(game_state['enemies']))  # Estimate based on enemies hit
        elif attack_pattern in ['full-area', 'shield-break', 'all-enemies']:
            damage_dealt = damage * len(game_state['enemies'])
    
    # Gain energy based on damage dealt (10% of damage as energy)
    if damage_dealt > 0:
        energy_gain = min(20, max(5, int(damage_dealt * 0.1)))  # 5-20 energy per attack
        attacker['energy'] = min(attacker['max_energy'], attacker['energy'] + energy_gain)

    # Special character effects
    if char_template['id'] == 5 and attack_type == 'skill':  # Rex the Berserker
        # Berserker Rage: reduce own HP by 10
        attacker['hp'] = max(1, attacker['hp'] - 10)

    attacker['has_acted'] = True

    # Check for mission completion
    if check_mission_complete(game_state):
        stage_id = accounts_data['player_states'][user_id]['current_stage']
        rewards = award_mission_rewards(user_id, stage_id)
        game_state['mission_complete'] = True
        game_state['rewards'] = rewards
        # Reset game state after mission completion
        reset_game_state(user_id)
        return jsonify(game_state)

    _advance_turn(game_state)
    # ensure no enemy actions sent on player attack
    game_state.pop('enemy_actions', None)

    save_accounts_data(accounts_data)
    return jsonify(game_state)

@app.route('/end_turn', methods=['POST'])
@login_required
def end_turn():
    user_id = str(session['user_id'])
    accounts_data = load_accounts_data()
    game_state = accounts_data['player_states'][user_id]['game_data']

    active_char = next((c for c in game_state['characters'] if c['id'] == game_state.get('active_character_id')), None)
    if active_char:
        active_char['has_acted'] = True

    _advance_turn(game_state)
    
    save_accounts_data(accounts_data)
    return jsonify(game_state)

def enemy_turn(game_state):
    actions = []  # collect enemy move/attack actions
    if not game_state.get('enemies') or not game_state.get('characters'):
        game_state['enemy_actions'] = actions
        return

    all_unit_positions = {(c['x'], c['y']) for c in game_state['characters']} | \
                         {(e['x'], e['y']) for e in game_state['enemies']}

    for enemy in game_state['enemies']:
        # Skip if enemy is frozen
        if 'status_effects' in enemy and 'frozen' in enemy['status_effects']:
            continue
            
        # Find the closest character(s)
        min_dist = float('inf')
        closest_chars = []
        for char in game_state['characters']:
            dist = abs(char['x'] - enemy['x']) + abs(char['y'] - enemy['y'])
            if dist < min_dist:
                min_dist = dist
                closest_chars = [char]
            elif dist == min_dist:
                closest_chars.append(char)
        
        if not closest_chars:
            continue

        target_char = random.choice(closest_chars)

        # Attack if in range
        if min_dist <= enemy['attack_range']:
            # Calculate element effectiveness for enemy attack
            enemy_element = enemy.get('element', 'fire')
            target_element = target_char.get('element', 'air')
            element_multiplier = calculate_element_effectiveness(enemy_element, target_element)
            base_damage = int(enemy.get('damage', 10) * element_multiplier)
            
            # Apply status effect modifications
            final_damage = calculate_damage_with_status_effects(base_damage, enemy, target_char)
            
            target_char['hp'] -= final_damage
            
            # Character gains energy when taking damage
            if 'energy' not in target_char:
                target_char['energy'] = 0
            if 'max_energy' not in target_char:
                target_char['max_energy'] = 100
            energy_gain = min(15, max(3, int(final_damage * 0.15)))  # 3-15 energy when taking damage
            target_char['energy'] = min(target_char['max_energy'], target_char['energy'] + energy_gain)
            
            if target_char['hp'] <= 0:
                game_state['characters'] = [c for c in game_state['characters'] if c['id'] != target_char['id']]
            # record attack action
            actions.append({
                'type': 'attack',
                'enemy_id': enemy['id'],
                'target_id': target_char['id'],
                'target_pos': {'x': target_char['x'], 'y': target_char['y']}
            })
        # Otherwise, move towards the target
        else:
            # Simple move logic: reduce the largest distance (dx or dy)
            dx = target_char['x'] - enemy['x']
            dy = target_char['y'] - enemy['y']
            
            potential_moves = []
            
            # Try to move horizontally
            if abs(dx) > 0:
                new_x = enemy['x'] + (1 if dx > 0 else -1)
                if (new_x, enemy['y']) not in all_unit_positions:
                    potential_moves.append((new_x, enemy['y']))
            
            # Try to move vertically
            if abs(dy) > 0:
                new_y = enemy['y'] + (1 if dy > 0 else -1)
                if (enemy['x'], new_y) not in all_unit_positions:
                    potential_moves.append((enemy['x'], new_y))

            # Choose the move that gets it closer
            if potential_moves:
                potential_moves.sort(key=lambda pos: abs(target_char['x'] - pos[0]) + abs(target_char['y'] - pos[1]))
                # record start and initialize path
                start_x, start_y = enemy['x'], enemy['y']
                path = []
                # Move up to move_range
                for _ in range(enemy['move_range']):
                    if not potential_moves: break
                    
                    best_move = potential_moves[0]
                    
                    # Check if we can actually move there
                    if (best_move[0], best_move[1]) in all_unit_positions:
                        break # Path is blocked

                    all_unit_positions.remove((enemy['x'], enemy['y'])) # Old position is free
                    enemy['x'], enemy['y'] = best_move
                    all_unit_positions.add(best_move) # New position is taken
                    
                    # Recalculate potential moves from new spot
                    potential_moves = [best_move]
                    dx = target_char['x'] - enemy['x']
                    dy = target_char['y'] - enemy['y']
                    if abs(dx) > 0:
                        new_x = enemy['x'] + (1 if dx > 0 else -1)
                        if (new_x, enemy['y']) not in all_unit_positions:
                            potential_moves.append((new_x, enemy['y']))
                    if abs(dy) > 0:
                        new_y = enemy['y'] + (1 if dy > 0 else -1)
                        if (enemy['x'], new_y) not in all_unit_positions:
                            potential_moves.append((enemy['x'], new_y))
                    
                    if potential_moves:
                        potential_moves.sort(key=lambda pos: abs(target_char['x'] - pos[0]) + abs(target_char['y'] - pos[1]))
                        # record this step
                        path.append(best_move)

                # after movement steps, record movement action
                if path:
                    actions.append({
                        'type': 'move',
                        'enemy_id': enemy['id'],
                        'from': {'x': start_x, 'y': start_y},
                        'path': [{'x': pos[0], 'y': pos[1]} for pos in path]
                    })

    # attach collected actions to game state
    game_state['enemy_actions'] = actions

@app.route('/api/save-characters', methods=['POST'])
@login_required
def save_characters():
    """Save characters data from the character editor"""
    try:
        characters_data = request.json
        
        # Validate the data structure
        if not isinstance(characters_data, list):
            return jsonify({'error': 'Characters data must be an array'}), 400
        
        # Validate each character has required fields
        required_fields = ['id', 'name', 'hp', 'max_hp', 'move_range', 'basic_attack_range', 
                          'basic_attack_damage', 'skill_attack_range', 'skill_attack_damage',
                          'description', 'basic_attack_description', 'skill_attack_description',
                          'basic_attack_type', 'skill_attack_type', 'basic_attack_pattern', 
                          'skill_attack_pattern', 'basic_attack_area_range', 'skill_attack_area_range',
                          'element']
        
        for i, char in enumerate(characters_data):
            for field in required_fields:
                if field not in char:
                    return jsonify({'error': f'Character at index {i} is missing field: {field}'}), 400
        
        # Save to characters.json
        with open('characters.json', 'w') as f:
            json.dump(characters_data, f, indent=4)
        
        return jsonify({'message': 'Characters saved successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to save characters: {str(e)}'}), 500

@app.route('/character_editor')
@login_required
def character_editor_page():
    return retfromdir('character_editor.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
