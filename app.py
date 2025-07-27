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
    
    # Award XP
    user_data['total_xp'] += rewards['xp']
    
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

# Stage configurations with more detailed stats
STAGE_CONFIGS = {
    1: {
        'enemies': [
            {'id': 1, 'x': 8, 'y': 4, 'hp': 50, 'max_hp': 50, 'attack_range': 1, 'move_range': 2, 'damage': 10},
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
    # ... other stages
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

@app.route('/missions')
@login_required
def get_missions():
    with open('missions.json', 'r') as f:
        missions = json.load(f)
    return jsonify(missions)

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

    if stage_id not in STAGE_CONFIGS:
        return jsonify({'error': 'Invalid stage ID'}), 400

    initial_game_data = json.loads(json.dumps(STAGE_CONFIGS[stage_id]))
    initial_game_data['turn'] = 'player'
    if initial_game_data['characters']:
        initial_game_data['active_character_id'] = initial_game_data['characters'][0]['id']
    
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

    data = request.json
    attacker_id = data['attacker_id']
    target_id = data['target_id']
    attack_type = data.get('attack_type', 'basic')
    
    attacker = next((c for c in game_state['characters'] if c['id'] == attacker_id), None)
    target = next((e for e in game_state['enemies'] if e['id'] == target_id), None)

    if not attacker or not target or attacker['has_acted'] or attacker['id'] != game_state.get('active_character_id'):
        return jsonify({'error': 'Invalid action'}), 400

    if abs(target['x'] - attacker['x']) + abs(target['y'] - attacker['y']) > attacker['attack_range']:
        return jsonify({'error': 'Target is out of range'}), 400

    # Initialize team SP if not present
    if 'team_sp' not in game_state:
        game_state['team_sp'] = 0
    if 'max_team_sp' not in game_state:
        game_state['max_team_sp'] = 5

    if attack_type == 'skill':
        if game_state['team_sp'] > 0:
            target['hp'] -= attacker.get('damage', 25) * 1.5 # Skill attack bonus
            game_state['team_sp'] -= 1
        else:
            return jsonify({'error': 'Not enough skill points'}), 400
    else: # Basic attack
        target['hp'] -= attacker.get('damage', 25)
        # Increase team SP for basic attacks (up to max)
        if game_state['team_sp'] < game_state['max_team_sp']:
            game_state['team_sp'] += 1

    attacker['has_acted'] = True

    if target['hp'] <= 0:
        game_state['enemies'] = [e for e in game_state['enemies'] if e['id'] != target_id]
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
            target_char['hp'] -= enemy.get('damage', 10) # Use damage from config, default 10
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
